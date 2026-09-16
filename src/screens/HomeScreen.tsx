import { MouseEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { PlusIcon, TrashIcon } from '../icons';
import { Preset, Workout } from '../types';
import {
  calculateWorkoutDurationMinutes,
  formatWorkoutDuration,
  formatWorkoutTime,
  isRecordedSet,
  isUnstartedWorkout,
  localDate,
  parseDate,
} from '../utils';
import { HomeSetRow } from '../components/HomeSetRow';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSmithNoteContext } from '../hooks/useSmithNoteContext';
import { HomeCalendar, type HomeCalendarOverlayState } from '../components/HomeCalendar';
import { scheduledPresetsForDate } from '../selectors/smithNoteSelectors';
import { setAuthEntryMode, type AuthEntryMode } from '../authState';

type WorkoutSummary = {
  startTime: string;
  endTime: string;
  duration: string;
  exerciseCount: number;
  setCount: number;
};

const newPresetOptionValue = '__new_preset__';
const workoutRemoveAnimationMs = 220;
const daySwipeAnimationMs = 220;
const dayPageOffsets = [-1, 0, 1] as const;

type DaySwipeState = {
  offset: number;
  animating: boolean;
  dragging: boolean;
};

type HomeDayPage = {
  offset: (typeof dayPageOffsets)[number];
  date: string;
  workouts: Workout[];
  scheduledPresets: ReturnType<typeof scheduledPresetsForDate>;
  workoutStartTime: string | undefined;
  workoutEndTime: string | undefined;
};

type PresetDropdownProps = {
  presets: Preset[];
  value: string;
  onChange: (value: string) => void;
};

function PresetDropdown({ presets, value, onChange }: PresetDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedPreset = presets.find((preset) => preset.id === value);
  const selectedName = selectedPreset?.name || '[新規作成]';
  const selectedStatus = selectedPreset
    ? selectedPreset.exerciseIds.length
      ? `${selectedPreset.exerciseIds.length}種目`
      : '未設定'
    : '';

  useEffect(() => {
    if (!open) return undefined;
    const closeFromOutside = (event: globalThis.PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [open]);

  function select(valueToSelect: string) {
    onChange(valueToSelect);
    setOpen(false);
  }

  return (
    <div className="workout-menu-dropdown" ref={dropdownRef}>
      <button
        className="workout-menu-dropdown-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedName}</span>
        <small>{selectedStatus}</small>
        <span className="workout-menu-dropdown-chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div
          className="workout-menu-dropdown-list"
          role="listbox"
          aria-label="トレーニングメニューを選択"
        >
          {presets.map((preset) => (
            <button
              className="workout-menu-dropdown-option"
              type="button"
              role="option"
              aria-selected={preset.id === value}
              key={preset.id}
              onClick={() => select(preset.id)}
            >
              <span>{preset.name}</span>
              <small>
                {preset.exerciseIds.length ? `${preset.exerciseIds.length}種目` : '未設定'}
              </small>
            </button>
          ))}
          <button
            className="workout-menu-dropdown-option new-preset"
            type="button"
            role="option"
            aria-selected={value === newPresetOptionValue}
            onClick={() => select(newPresetOptionValue)}
          >
            <span>[新規作成]</span>
          </button>
        </div>
      )}
    </div>
  );
}

function moveDateByDays(date: string, days: number) {
  const next = parseDate(date);
  next.setDate(next.getDate() + days);
  return localDate(next);
}

/**
 * ホーム本文の横スワイプで前後の日付へ移動するための状態とイベントを管理する
 */
function useHomeDaySwipe(selectedDate: string, onSelectDateBySwipe: (date: string) => void) {
  const [swipe, setSwipe] = useState<DaySwipeState>({
    offset: 0,
    animating: false,
    dragging: false,
  });
  const swipeStart = useRef<{ x: number; y: number; width: number } | null>(null);
  const pendingDays = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);

  function clearTransitionTimer() {
    if (transitionTimer.current === null) return;
    globalThis.clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
  }

  function finishTransition() {
    clearTransitionTimer();
    const days = pendingDays.current;
    pendingDays.current = null;
    setSwipe({ offset: 0, animating: false, dragging: false });
    if (days) onSelectDateBySwipe(moveDateByDays(selectedDate, days));
  }

  function suppressNextClick() {
    suppressClick.current = true;
    globalThis.setTimeout(() => {
      suppressClick.current = false;
    }, 260);
  }

  function startSwipe(event: PointerEvent<HTMLElement>) {
    if (swipe.animating) return;
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      width: event.currentTarget.getBoundingClientRect().width,
    };
    pendingDays.current = null;
    clearTransitionTimer();
    setSwipe({ offset: 0, animating: false, dragging: false });
  }

  function moveSwipe(event: PointerEvent<HTMLElement>) {
    const start = swipeStart.current;
    if (!start) return;
    const diffX = event.clientX - start.x;
    const diffY = event.clientY - start.y;
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 12) return;
    const dragging = Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY);
    if (!dragging && !swipe.dragging) return;
    if (dragging && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setSwipe({
      offset: Math.max(Math.min(diffX, start.width), -start.width),
      animating: false,
      dragging: true,
    });
  }

  function finishSwipe(event: PointerEvent<HTMLElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const diffX = event.clientX - start.x;
    const diffY = event.clientY - start.y;
    const wasDragging = swipe.dragging || Math.abs(diffX) > 10;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!wasDragging) return;
    suppressNextClick();
    if (Math.abs(diffX) < Math.max(64, start.width * 0.22) || Math.abs(diffX) <= Math.abs(diffY)) {
      pendingDays.current = null;
      setSwipe((current) => ({ ...current, offset: 0, animating: current.offset !== 0 }));
      clearTransitionTimer();
      transitionTimer.current = globalThis.setTimeout(finishTransition, daySwipeAnimationMs + 60);
      return;
    }
    const days = diffX < 0 ? 1 : -1;
    pendingDays.current = days;
    setSwipe({ offset: -days * start.width, animating: true, dragging: false });
    clearTransitionTimer();
    transitionTimer.current = globalThis.setTimeout(finishTransition, daySwipeAnimationMs + 60);
  }

  function cancelSwipe() {
    swipeStart.current = null;
    pendingDays.current = null;
    setSwipe((current) => ({ ...current, offset: 0, animating: current.offset !== 0 }));
    clearTransitionTimer();
    transitionTimer.current = globalThis.setTimeout(finishTransition, daySwipeAnimationMs + 60);
  }

  function blockSuppressedClick(event: MouseEvent<HTMLElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(
    () => () => {
      clearTransitionTimer();
    },
    [],
  );

  return {
    swipe,
    startSwipe,
    moveSwipe,
    finishSwipe,
    cancelSwipe,
    finishTransition,
    blockSuppressedClick,
  };
}

/**
 * ホーム画面が必要とする state・派生値・操作を Context から組み立てる view-model フック
 */
function useHomeScreenModel() {
  const { selectedDate, state, selectedWorkouts, currentPreset, partColors, actions } =
    useSmithNoteContext();

  return {
    selectedDate,
    workouts: state.workouts,
    exercises: state.exercises,
    selectedWorkouts,
    presets: state.presets,
    currentPreset,
    partColors,
    weightUnit: state.weightUnit,
    workoutStartTimes: state.workoutStartTimes,
    workoutEndTimes: state.workoutEndTimes,
    workoutStartTime: state.workoutStartTimes[selectedDate],
    workoutEndTime: state.workoutEndTimes[selectedDate],
    /**
     * 日付を選択し、対象日のホーム内容へ移動する
     */
    onSelectDate: (date: string) => {
      actions.selectDate(date);
      actions.setCurrentWorkoutId(null);
      actions.setScreen('home');
    },
    onSelectPreset: actions.selectPreset,
    onEndWorkoutDay: actions.endWorkoutDay,
    onResumeWorkoutDay: actions.resumeWorkoutDay,
    onStartPreset: actions.startPreset,
    onCreatePresetDraftForStart: actions.createPresetDraftForStart,
    onOpenSelect: () => actions.setScreen('select'),
    onOpenTrainingMenu: () => actions.setScreen('trainingMenu'),
    onEditPresetForStart: actions.editPresetForStart,
    onOpenAnalysis: actions.openAnalysis,
    onOpenSettings: () => actions.setScreen('settings'),
    onOpenGoalAchievements: () => actions.setScreen('goalAchievements'),
    onOpenAuth: (mode: AuthEntryMode) => {
      setAuthEntryMode(mode);
      actions.setScreen('auth');
    },
    onOpenDetail: actions.openWorkoutDetail,
    onDeleteWorkout: actions.deleteWorkout,
    cloud: actions.cloud,
  };
}

/**
 * ホーム画面。選択日のトレーニング一覧・集計・プリセット開始・カレンダーを表示する
 */
type HomeScreenProps = {
  onOverlayStateChange: (state: HomeCalendarOverlayState) => void;
};

export function HomeScreen({ onOverlayStateChange }: HomeScreenProps) {
  const {
    selectedDate,
    workouts,
    exercises,
    selectedWorkouts,
    presets,
    currentPreset,
    partColors,
    weightUnit,
    workoutStartTimes,
    workoutEndTimes,
    workoutStartTime,
    workoutEndTime,
    onSelectDate,
    onSelectPreset,
    onEndWorkoutDay,
    onResumeWorkoutDay,
    onStartPreset,
    onCreatePresetDraftForStart,
    onOpenSelect,
    onOpenTrainingMenu,
    onEditPresetForStart,
    onOpenAnalysis,
    onOpenSettings,
    onOpenGoalAchievements,
    onOpenAuth,
    onOpenDetail,
    onDeleteWorkout,
    cloud,
  } = useHomeScreenModel();
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null);
  const [removingWorkoutId, setRemovingWorkoutId] = useState<string | null>(null);
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummary | null>(null);
  const removeTimerRef = useRef<number | null>(null);
  const [selectedPresetValue, setSelectedPresetValue] = useState(
    currentPreset?.id || newPresetOptionValue,
  );
  const [presetExercisesOpen, setPresetExercisesOpen] = useState(true);
  const isNewPresetSelected = selectedPresetValue === newPresetOptionValue;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetValue) || null;
  const selectedPresetExercises = selectedPreset
    ? selectedPreset.exerciseIds.flatMap((exerciseId) => {
        const exercise = exercises.find((item) => item.id === exerciseId);
        return exercise ? [exercise] : [];
      })
    : [];
  const currentPresetIsEmpty = !!selectedPreset && selectedPreset.exerciseIds.length === 0;
  const [dayTransition, setDayTransition] = useState<'fade' | 'none'>('fade');
  const homeDayClassName = dayTransition === 'fade' ? 'home-day-fade' : '';
  const dayPages = dayPageOffsets.map((offset) => {
    const date = moveDateByDays(selectedDate, offset);
    return {
      offset,
      date,
      workouts: workouts.filter((workout) => workout.date === date),
      scheduledPresets: scheduledPresetsForDate(date, presets),
      workoutStartTime: workoutStartTimes[date],
      workoutEndTime: workoutEndTimes[date],
    };
  });

  function selectDateWithFade(date: string) {
    setDayTransition('fade');
    onSelectDate(date);
  }

  function selectDateBySwipe(date: string) {
    setDayTransition('none');
    onSelectDate(date);
  }

  const daySwipe = useHomeDaySwipe(selectedDate, selectDateBySwipe);

  useEffect(() => {
    setSelectedPresetValue(currentPreset?.id || newPresetOptionValue);
  }, [currentPreset?.id]);

  useEffect(
    () => () => {
      if (removeTimerRef.current !== null) {
        globalThis.clearTimeout(removeTimerRef.current);
      }
    },
    [],
  );

  /**
   * 削除対象のカードをフェードアウトさせたあと、実データを削除する
   */
  function removeWorkoutAfterAnimation(workoutId: string) {
    if (removingWorkoutId) return;
    setRemovingWorkoutId(workoutId);
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    removeTimerRef.current = globalThis.setTimeout(
      () => {
        onDeleteWorkout(workoutId);
        setRemovingWorkoutId(null);
        removeTimerRef.current = null;
      },
      reduceMotion ? 0 : workoutRemoveAnimationMs,
    );
  }

  /**
   * 削除を要求する。未記録の種目は確認なしで削除する
   */
  function requestDelete(event: MouseEvent<HTMLButtonElement>, workout: Workout) {
    event.stopPropagation();
    if (isUnstartedWorkout(workout)) {
      removeWorkoutAfterAnimation(workout.id);
      return;
    }
    setDeleteTarget(workout);
  }

  /**
   * 確認ダイアログで選んだ種目を削除する
   */
  function confirmDelete() {
    if (!deleteTarget) return;
    removeWorkoutAfterAnimation(deleteTarget.id);
    setDeleteTarget(null);
  }

  /**
   * 指定した終了時刻から実施内容のサマリーを作り、ダイアログへ表示する
   */
  function showWorkoutSummary(endTime: string) {
    if (!workoutStartTime) return;
    const recordedWorkouts = selectedWorkouts.filter((workout) => workout.sets.some(isRecordedSet));
    setWorkoutSummary({
      startTime: formatWorkoutTime(workoutStartTime),
      endTime: formatWorkoutTime(endTime),
      duration: formatWorkoutDuration(calculateWorkoutDurationMinutes(workoutStartTime, endTime)),
      exerciseCount: recordedWorkouts.length,
      setCount: recordedWorkouts.reduce(
        (total, workout) => total + workout.sets.filter(isRecordedSet).length,
        0,
      ),
    });
  }

  /**
   * 終了時刻を保存し、実施内容のサマリーをダイアログへ表示する
   */
  function finishWorkout(removeUnstartedWorkouts = false) {
    const endTime = onEndWorkoutDay(removeUnstartedWorkouts);
    if (!endTime) return;
    showWorkoutSummary(endTime);
  }

  /**
   * 未開始種目がある場合は確認し、無ければそのままトレーニングを終了する
   */
  function requestFinishWorkout() {
    if (selectedWorkouts.some(isUnstartedWorkout)) {
      setFinishConfirmationOpen(true);
      return;
    }
    finishWorkout();
  }

  /**
   * 未開始種目が残っていることを了承してトレーニングを終了する
   */
  function confirmFinishWorkout() {
    setFinishConfirmationOpen(false);
    finishWorkout(true);
  }

  function renderDayPage(page: HomeDayPage) {
    const isCurrentPage = page.offset === 0;
    const pageClassName = page.offset === 0 ? 'current' : page.offset < 0 ? 'previous' : 'next';
    const startReadyClassName = !page.workouts.length && !page.workoutEndTime ? 'start-ready' : '';
    const contentMotionClassName = isCurrentPage ? homeDayClassName : '';
    const startTitleId = `workout-menu-start-title-${page.date}`;

    return (
      <div
        className={`home-day-page ${pageClassName} ${startReadyClassName}`}
        key={page.date}
        aria-hidden={!isCurrentPage}
        inert={isCurrentPage ? undefined : true}
      >
        {!page.workouts.length && !page.workoutEndTime && (
          <div
            className={`workout-start-area ${contentMotionClassName}`}
            key={`start-${page.date}`}
          >
            <section className="workout-start-panel" aria-labelledby={startTitleId}>
              <div className="workout-start-section">
                <h2 id={startTitleId}>トレーニングを開始</h2>
                {!!page.scheduledPresets.length && (
                  <span className="scheduled-menu-label">
                    今日の予定: {page.scheduledPresets.map((preset) => preset.name).join(' / ')}
                  </span>
                )}
                <PresetDropdown
                  presets={presets}
                  value={selectedPresetValue}
                  onChange={(presetId) => {
                    setSelectedPresetValue(presetId);
                    setPresetExercisesOpen(true);
                    if (presetId !== newPresetOptionValue) onSelectPreset(presetId);
                  }}
                />
                {selectedPreset && !!selectedPresetExercises.length && (
                  <div className="workout-start-exercise-list">
                    <button
                      className="workout-start-exercise-toggle"
                      type="button"
                      aria-expanded={presetExercisesOpen}
                      onClick={() => setPresetExercisesOpen((open) => !open)}
                    >
                      <span>種目一覧（{selectedPresetExercises.length}種目）</span>
                      <span aria-hidden="true">{presetExercisesOpen ? '−' : '＋'}</span>
                    </button>
                    {presetExercisesOpen && (
                      <ul>
                        {selectedPresetExercises.map((exercise) => (
                          <li key={exercise.id}>
                            <span>{exercise.part}</span>
                            <strong>{exercise.name}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <button
                  className="primary workout-start-primary"
                  type="button"
                  onClick={() =>
                    isNewPresetSelected
                      ? onCreatePresetDraftForStart()
                      : currentPresetIsEmpty
                        ? onEditPresetForStart(selectedPreset?.id || '')
                        : onStartPreset(selectedPreset?.id || '')
                  }
                >
                  {isNewPresetSelected || currentPresetIsEmpty
                    ? 'トレーニングメニューを作成する'
                    : 'トレーニングメニューから開始'}
                </button>
              </div>
              <div className="workout-start-divider">
                <span>または</span>
              </div>
              <div className="workout-start-section">
                <button
                  className="workout-select-start-button"
                  type="button"
                  onClick={onOpenSelect}
                >
                  種目を選んで開始
                </button>
              </div>
            </section>
          </div>
        )}
        <div className={`content ${contentMotionClassName}`} key={`content-${page.date}`}>
          {page.workouts.map((workout) => (
            <article
              className={`exercise-card ${removingWorkoutId === workout.id ? 'removing' : ''}`}
              key={workout.id}
            >
              <button
                className="exercise-card-open"
                type="button"
                aria-label={`${workout.name}の詳細を開く`}
                disabled={removingWorkoutId === workout.id}
                onClick={() => onOpenDetail(workout.id)}
              />
              <header
                className="exercise-head"
                style={{ borderLeftColor: partColors.get(workout.part) }}
              >
                <h2>
                  <span className="exercise-head-part">{workout.part}</span>
                  <span className="exercise-head-separator" aria-hidden="true">
                    ｜
                  </span>
                  <span className="exercise-head-name">{workout.name}</span>
                </h2>
              </header>
              <div className="exercise-body">
                <table className="set-table">
                  <thead>
                    <tr>
                      <th>セット</th>
                      <th>重さ</th>
                      <th>記録</th>
                      <th>RM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workout.sets.map((set, setIndex) => (
                      <HomeSetRow
                        key={set.id}
                        set={set}
                        index={setIndex}
                        measurementType={workout.measurementType}
                        weightUnit={weightUnit}
                      />
                    ))}
                  </tbody>
                </table>
                {workout.note.trim() && <p className="exercise-today-note">{workout.note}</p>}
                {!page.workoutEndTime && isUnstartedWorkout(workout) && (
                  <div className="new-workout-overlay" aria-hidden="true">
                    <div className="new-workout-overlay-icon">
                      <PlusIcon />
                    </div>
                  </div>
                )}
              </div>
              {!page.workoutEndTime && (
                <button
                  className="delete-workout"
                  type="button"
                  aria-label={`${workout.name}を削除`}
                  onClick={(event) => requestDelete(event, workout)}
                >
                  <TrashIcon />
                </button>
              )}
            </article>
          ))}
          {page.workoutStartTime && !page.workoutEndTime && !!page.workouts.length && (
            <button
              className="primary workout-action-button"
              type="button"
              onClick={requestFinishWorkout}
            >
              トレーニングを終了
            </button>
          )}
          {page.workoutStartTime && page.workoutEndTime && (
            <div className="workout-completed-actions">
              <button
                className="workout-action-button workout-summary-button"
                type="button"
                onClick={() => showWorkoutSummary(page.workoutEndTime || '')}
              >
                トレーニング結果を見る
              </button>
              <button className="resume-workout-button" type="button" onClick={onResumeWorkoutDay}>
                再開
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      className={`screen active detail-screen home-screen ${
        !selectedWorkouts.length && !workoutEndTime ? 'workout-start-ready' : ''
      }`}
    >
      <HomeCalendar
        selectedDate={selectedDate}
        workouts={workouts}
        presets={presets}
        onSelectDate={selectDateWithFade}
        onOpenTrainingMenu={onOpenTrainingMenu}
        onOpenAnalysis={onOpenAnalysis}
        onOpenSettings={onOpenSettings}
        onOpenGoalAchievements={onOpenGoalAchievements}
        onOpenAuth={onOpenAuth}
        onOverlayStateChange={onOverlayStateChange}
        cloud={cloud}
      />
      <div
        className={`home-day-swipe ${daySwipe.swipe.dragging ? 'horizontal-dragging' : ''}`}
        onPointerDown={daySwipe.startSwipe}
        onPointerMove={daySwipe.moveSwipe}
        onPointerUp={daySwipe.finishSwipe}
        onPointerCancel={daySwipe.cancelSwipe}
        onClickCapture={daySwipe.blockSuppressedClick}
      >
        <div
          className={`home-day-swipe-track ${
            daySwipe.swipe.animating ? 'animating' : ''
          } ${daySwipe.swipe.dragging ? 'dragging' : ''}`}
          style={{ transform: `translateX(${daySwipe.swipe.offset}px)` }}
          onTransitionEnd={daySwipe.finishTransition}
        >
          {dayPages.map(renderDayPage)}
        </div>
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title="記録を削除しますか？"
          labelledBy="workout-delete-title"
          onClose={() => setDeleteTarget(null)}
        >
          <p>
            {deleteTarget.part} - {deleteTarget.name} の記録をこの日から削除します。
          </p>
          <div className="confirm-actions">
            <button className="small-outline" type="button" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </button>
            <button className="danger-button" type="button" onClick={confirmDelete}>
              削除
            </button>
          </div>
        </ConfirmDialog>
      )}
      {finishConfirmationOpen && (
        <ConfirmDialog
          title="トレーニングを終了しますか？"
          labelledBy="workout-finish-confirm-title"
          onClose={() => setFinishConfirmationOpen(false)}
        >
          <p>
            未開始の種目が
            {selectedWorkouts.filter(isUnstartedWorkout).length}
            種目あります。このまま終了しても記録には含まれません。
          </p>
          <div className="confirm-actions">
            <button
              className="small-outline"
              type="button"
              onClick={() => setFinishConfirmationOpen(false)}
            >
              キャンセル
            </button>
            <button className="danger-button" type="button" onClick={confirmFinishWorkout}>
              終了する
            </button>
          </div>
        </ConfirmDialog>
      )}
      {workoutSummary && (
        <ConfirmDialog
          title="お疲れ様でした！"
          labelledBy="workout-summary-title"
          className="workout-summary-dialog"
          onClose={() => setWorkoutSummary(null)}
        >
          <div className="workout-summary-stats">
            <div>
              <span>開始時間</span>
              <strong>{workoutSummary.startTime}</strong>
            </div>
            <div>
              <span>終了時間</span>
              <strong>{workoutSummary.endTime}</strong>
            </div>
            <div>
              <span>トレーニング時間</span>
              <strong>{workoutSummary.duration}</strong>
            </div>
            <div>
              <span>実施した種目数</span>
              <strong>{workoutSummary.exerciseCount}種目</strong>
            </div>
            <div>
              <span>合計セット数</span>
              <strong>{workoutSummary.setCount}セット</strong>
            </div>
          </div>
          <button className="primary" type="button" onClick={() => setWorkoutSummary(null)}>
            閉じる
          </button>
        </ConfirmDialog>
      )}
    </section>
  );
}
