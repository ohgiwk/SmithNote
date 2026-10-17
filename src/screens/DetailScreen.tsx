import { Fragment, MouseEvent, PointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScreenHeader } from '../components/ScreenHeader';
import { ChevronDown, ChevronUp, HistoryIcon, PlusIcon, TrashIcon, UndoIcon } from '../icons';
import {
  interleaveWorkoutSets,
  calcRm,
  exerciseWeightStep,
  formatStoredWeightInput,
  formatWeight,
  formatWeightForStorageInput,
  gripOptions,
  gripStyleOptions,
  intensityOptions,
  isRepsMeasurement,
  measurementUnit,
  number,
  formatWorkoutUsageTime,
  workoutUsageElapsedSeconds,
  weightUnitLabel,
} from '../utils';
import { IntensityIcon } from '../components/IntensityIcon';
import { restTimerStartEvent } from '../components/RestTimer';
import { useSmithNoteContext } from '../hooks/useSmithNoteContext';
import { GripStyleType, GripType, SetIntensity, WeightUnit, Workout } from '../types';

/**
 * 種目詳細画面が必要とする state・操作を Context から組み立てる view-model フック
 */
function useDetailScreenModel() {
  const { currentWorkout, screen, state, actions } = useSmithNoteContext();
  const exercise = currentWorkout
    ? state.exercises.find((item) => item.id === currentWorkout.exerciseId)
    : undefined;
  const previousWorkout = currentWorkout
    ? findPreviousWorkout(state.workouts, currentWorkout)
    : undefined;

  const groupWorkouts = currentWorkout?.multiSetGroupId
    ? state.workouts
        .filter(
          (item) =>
            item.date === currentWorkout.date &&
            item.multiSetGroupId === currentWorkout.multiSetGroupId,
        )
        .sort((a, b) => (a.multiSetOrder ?? 0) - (b.multiSetOrder ?? 0))
    : currentWorkout
      ? [currentWorkout]
      : [];

  return {
    workout: currentWorkout,
    previousWorkout,
    groupWorkouts,
    rows: interleaveWorkoutSets(groupWorkouts).map((row) => ({
      ...row,
      weightStep: exerciseWeightStep(state.workouts, row.workout, state.weightUnit),
    })),
    onSelectGroupWorkout: actions.openWorkoutDetail,
    onAddMultiSetRound: actions.addMultiSetRound,
    exercise,
    weightUnit: state.weightUnit,
    restTimerSettings: state.restTimerSettings,
    active: screen === 'detail',
    readOnly: Boolean(currentWorkout && state.workoutEndTimes[currentWorkout.date]),
    onOpenHistory: () => actions.setScreen('exerciseHistory'),
    onOpenWorkoutHistory: actions.openWorkoutHistory,
    onUpdateSet: actions.updateSet,
    onUpdateSetAchievement: actions.updateSetAchievement,
    onResetSetAchievement: actions.resetSetAchievement,
    onUpdateWorkoutNote: actions.updateWorkoutNote,
    onUpdateSetIntensity: actions.updateSetIntensity,
    onUpdateWorkoutGrip: actions.updateWorkoutGrip,
    onUpdateWorkoutGripStyle: actions.updateWorkoutGripStyle,
    onDeleteSet: actions.deleteSet,
    onAddSet: actions.addSet,
    onCopyWorkoutSetValues: actions.copyWorkoutSetValues,
    onUpdateExerciseGoal: actions.updateExerciseGoal,
    onUpdateExerciseNote: actions.updateExerciseNote,
    onStartWorkoutUsage: actions.startWorkoutUsage,
    onPauseWorkoutUsage: actions.pauseWorkoutUsage,
    onResetWorkoutUsage: actions.resetWorkoutUsage,
  };
}

function WorkoutUsageTimer({
  workout,
  active,
  readOnly,
  onStart,
  onPause,
  onReset,
}: {
  workout: Workout;
  active: boolean;
  readOnly: boolean;
  onStart: (workoutId: string) => void;
  onPause: (workoutId: string) => void;
  onReset: (workoutId: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const autoCollapseRef = useRef<number | undefined>(undefined);
  const actionRef = useRef({ onStart, onPause });
  actionRef.current = { onStart, onPause };

  useEffect(() => {
    if (!active || readOnly) return undefined;
    return () => actionRef.current.onPause(workout.id);
  }, [active, readOnly, workout.id]);

  useEffect(() => {
    if (!workout.usageStartedAt) return undefined;
    const updateNow = () => setNow(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 1000);
    document.addEventListener('visibilitychange', updateNow);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, [workout.usageStartedAt]);

  useEffect(() => {
    return () => window.clearTimeout(autoCollapseRef.current);
  }, [active, workout.id]);

  function startUsage() {
    window.clearTimeout(autoCollapseRef.current);
    setExpanded(true);
    onStart(workout.id);
    autoCollapseRef.current = window.setTimeout(() => setExpanded(false), 10_000);
  }

  function cancelAutoCollapse() {
    window.clearTimeout(autoCollapseRef.current);
  }

  const elapsed = workoutUsageElapsedSeconds(workout, now);
  const running = Boolean(workout.usageStartedAt);

  const showActions = expanded || (!readOnly && !running && elapsed > 0);

  return (
    <div
      className={`workout-usage-timer ${showActions ? 'expanded' : ''}`}
      aria-label="種目実施時間"
    >
      {!readOnly && !running && elapsed === 0 && !showActions ? (
        <button className="workout-usage-start" type="button" onClick={startUsage}>
          開始
        </button>
      ) : (
        <button
          className="workout-usage-summary"
          type="button"
          aria-expanded={showActions}
          aria-label={showActions ? '実施時間タイマーを閉じる' : '実施時間タイマーを操作'}
          onClick={() => {
            cancelAutoCollapse();
            setExpanded((current) => !current);
          }}
        >
          {showActions && <span>実施時間</span>}
          <strong aria-live="off">{formatWorkoutUsageTime(elapsed)}</strong>
        </button>
      )}
      {!readOnly && showActions && (
        <div className="workout-usage-actions">
          <button
            type="button"
            onClick={() => {
              if (running) {
                cancelAutoCollapse();
                onPause(workout.id);
              } else {
                startUsage();
              }
            }}
          >
            {running ? '停止' : elapsed > 0 ? '再開' : '開始'}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              cancelAutoCollapse();
              onReset(workout.id);
            }}
          >
            リセット
          </button>
        </div>
      )}
    </div>
  );
}

function findPreviousWorkout(workouts: Workout[], currentWorkout: Workout) {
  return workouts
    .filter(
      (workout) =>
        workout.exerciseId === currentWorkout.exerciseId &&
        workout.id !== currentWorkout.id &&
        workout.date < currentWorkout.date,
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

function ExerciseGoalEditor({
  exerciseId,
  measurementType,
  goal,
  weightUnit,
  readOnly,
  onSave,
}: {
  exerciseId: string;
  measurementType: 'reps' | 'seconds';
  goal?: { weight: number; recordValue: number };
  weightUnit: 'kg' | 'lbs';
  readOnly: boolean;
  onSave: (exerciseId: string, goal?: { weight: number; recordValue: number }) => void;
}) {
  const [weight, setWeight] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setWeight(goal ? formatStoredWeightInput(goal.weight, weightUnit) : '');
    setRecordValue(goal ? String(goal.recordValue) : '');
    setIsEditing(false);
  }, [goal, weightUnit]);

  const canEdit = !readOnly && (!goal || isEditing);
  const storedWeight = formatWeightForStorageInput(weight, weightUnit);
  const canSave =
    weight.trim() !== '' &&
    recordValue.trim() !== '' &&
    Number(storedWeight) >= 0 &&
    Number(recordValue) > 0;

  return (
    <section className="exercise-goal" aria-labelledby="exercise-goal-title">
      <div className="exercise-goal-heading">
        <div>
          <span className="exercise-goal-kicker">CURRENT GOAL</span>
          <h2 id="exercise-goal-title">現在の目標</h2>
        </div>
        {!readOnly && goal && !isEditing && (
          <button className="goal-edit-button" type="button" onClick={() => setIsEditing(true)}>
            編集
          </button>
        )}
      </div>
      <div className={`exercise-goal-form${canEdit ? '' : ' readonly'}`}>
        <label>
          <span>重量</span>
          <div className="goal-input">
            <input
              type="number"
              min="0"
              step={weightUnit === 'lbs' ? '1' : '0.5'}
              inputMode="decimal"
              value={weight}
              readOnly={!canEdit}
              onChange={(event) => setWeight(event.target.value)}
            />
            <span>{weightUnitLabel(weightUnit)}</span>
          </div>
        </label>
        <label>
          <span>{measurementType === 'seconds' ? '秒数' : '回数'}</span>
          <div className="goal-input">
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={recordValue}
              readOnly={!canEdit}
              onChange={(event) => setRecordValue(event.target.value)}
            />
            <span>{measurementUnit(measurementType)}</span>
          </div>
        </label>
        {canEdit && (
          <div className={`goal-actions${goal ? ' editing' : ''}`}>
            {goal && (
              <button
                className="goal-delete-button"
                type="button"
                onClick={() => onSave(exerciseId, undefined)}
              >
                削除
              </button>
            )}
            <button
              className="goal-save-button"
              type="button"
              disabled={!canSave}
              onClick={() =>
                onSave(exerciseId, {
                  weight: number(storedWeight),
                  recordValue: number(recordValue),
                })
              }
            >
              {goal ? '更新' : '設定'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function WorkoutGripEditor({
  workout,
  exercise,
  readOnly,
  onUpdateGrip,
  onUpdateGripStyle,
}: {
  workout: NonNullable<ReturnType<typeof useDetailScreenModel>['workout']>;
  exercise: ReturnType<typeof useDetailScreenModel>['exercise'];
  readOnly: boolean;
  onUpdateGrip: (workoutId: string, grip?: GripType) => void;
  onUpdateGripStyle: (workoutId: string, gripStyle?: GripStyleType) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`workout-grip-editor${open ? ' open' : ''}`} aria-label="グリップ">
      <button
        className="workout-grip-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>詳細記録</span>
        {open ? <ChevronUp /> : <ChevronDown />}
      </button>
      {open && (
        <div className="workout-grip-fields">
          <label>
            <span>握りの向き</span>
            <select
              value={workout.grip ?? ''}
              disabled={readOnly}
              onChange={(event) =>
                onUpdateGrip(
                  workout.id,
                  event.target.value ? (event.target.value as GripType) : undefined,
                )
              }
            >
              <option value="">未選択</option>
              {workout.grip && !exercise?.availableGrips?.includes(workout.grip) && (
                <option value={workout.grip}>
                  {gripOptions.find((option) => option.value === workout.grip)?.label ??
                    workout.grip}
                </option>
              )}
              {gripOptions
                .filter((option) => exercise?.availableGrips?.includes(option.value))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>握り方</span>
            <select
              value={workout.gripStyle ?? ''}
              disabled={readOnly}
              onChange={(event) =>
                onUpdateGripStyle(
                  workout.id,
                  event.target.value ? (event.target.value as GripStyleType) : undefined,
                )
              }
            >
              <option value="">未選択</option>
              {workout.gripStyle && !exercise?.availableGripStyles?.includes(workout.gripStyle) && (
                <option value={workout.gripStyle}>
                  {gripStyleOptions.find((option) => option.value === workout.gripStyle)?.label ??
                    workout.gripStyle}
                </option>
              )}
              {gripStyleOptions
                .filter((option) => exercise?.availableGripStyles?.includes(option.value))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

function PreviousWorkoutRecord({
  workout,
  weightUnit,
  canCopy,
  onCopy,
}: {
  workout?: Workout;
  weightUnit: WeightUnit;
  canCopy: boolean;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasPreviousWorkout = Boolean(workout);
  const unit = workout ? measurementUnit(workout.measurementType) : '回';
  const isReps = workout ? isRepsMeasurement(workout.measurementType) : true;

  return (
    <section
      className={`workout-grip-editor previous-record${open ? ' open' : ''}${
        hasPreviousWorkout ? '' : ' empty'
      }`}
      aria-label="前回記録"
    >
      <button
        className="workout-grip-toggle"
        type="button"
        aria-expanded={hasPreviousWorkout ? open : undefined}
        disabled={!hasPreviousWorkout}
        onClick={() => setOpen((current) => !current)}
      >
        <span>前回記録</span>
        {hasPreviousWorkout && (open ? <ChevronUp /> : <ChevronDown />)}
      </button>
      {open && workout && (
        <div className="previous-record-panel">
          <article className="history-card previous-record-card">
            <header className="history-card-head">
              <div className="history-card-date">{workout.date.replaceAll('-', '/')}</div>
            </header>
            <table
              className="history-set-table previous-record-table"
              aria-label="前回記録のセット一覧"
            >
              <thead>
                <tr>
                  <th>セット</th>
                  <th>重さ</th>
                  <th>{unit === '秒' ? '秒数' : '回数'}</th>
                  <th>RM</th>
                  <th>強度</th>
                </tr>
              </thead>
              <tbody>
                {workout.sets.map((set, index) => (
                  <tr key={set.id}>
                    <td className="history-num">{index + 1}</td>
                    <td className="history-weight">
                      {set.weight === null ? (
                        '-'
                      ) : (
                        <>
                          {formatWeight(set.weight, weightUnit)}
                          <small> {weightUnitLabel(weightUnit)}</small>
                        </>
                      )}
                    </td>
                    <td className="history-reps">
                      {set.recordValue ?? '-'}
                      {set.recordValue === null ? '' : <small> {unit}</small>}
                    </td>
                    <td className="history-rm">
                      {isReps && number(set.weight) > 0 && number(set.recordValue) > 0
                        ? `${formatWeight(
                            calcRm(number(set.weight), number(set.recordValue)),
                            weightUnit,
                          )} ${weightUnitLabel(weightUnit)}`
                        : '-'}
                    </td>
                    <td
                      className={`history-assist${set.intensity ? ` intensity-${set.intensity}` : ''}`}
                    >
                      <IntensityIcon intensity={set.intensity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          {canCopy && (
            <button className="previous-record-copy" type="button" onClick={onCopy}>
              前回記録をコピー
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const setDeleteActionWidth = 72;

function SwipeableSetRow({
  children,
  open,
  readOnly,
  deleteLabel,
  onOpenChange,
  onDelete,
}: {
  children: ReactNode;
  open: boolean;
  readOnly: boolean;
  deleteLabel: string;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const [dragOffset, setDragOffset] = useState(open ? -setDeleteActionWidth : 0);
  const [dragging, setDragging] = useState(false);
  const swipeStart = useRef<{
    x: number;
    y: number;
    offset: number;
    direction: 'pending' | 'horizontal' | 'vertical';
  } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (!dragging) setDragOffset(open ? -setDeleteActionWidth : 0);
  }, [dragging, open]);

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    if (readOnly || event.button !== 0) return;
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      offset: open ? -setDeleteActionWidth : 0,
      direction: 'pending',
    };
    setDragging(false);
  }

  function moveSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    if (!start) return;
    const diffX = event.clientX - start.x;
    const diffY = event.clientY - start.y;

    if (start.direction === 'pending' && Math.max(Math.abs(diffX), Math.abs(diffY)) > 8) {
      start.direction = Math.abs(diffX) > Math.abs(diffY) ? 'horizontal' : 'vertical';
      if (start.direction === 'horizontal') {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }
    }
    if (start.direction !== 'horizontal') return;

    event.preventDefault();
    setDragOffset(Math.max(-setDeleteActionWidth, Math.min(0, start.offset + diffX)));
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.direction !== 'horizontal') return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const finishOffset = Math.max(
      -setDeleteActionWidth,
      Math.min(0, start.offset + event.clientX - start.x),
    );
    const shouldOpen = finishOffset <= -setDeleteActionWidth / 2;
    suppressClick.current = true;
    setDragging(false);
    setDragOffset(shouldOpen ? -setDeleteActionWidth : 0);
    onOpenChange(shouldOpen);
    globalThis.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  function cancelSwipe() {
    swipeStart.current = null;
    setDragging(false);
    setDragOffset(open ? -setDeleteActionWidth : 0);
  }

  function closeOnClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!open) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOffset(0);
    onOpenChange(false);
  }

  return (
    <div className={`detail-swipe-row${readOnly ? ' readonly' : ''}`}>
      {!readOnly && (
        <button
          className="detail-set-delete"
          type="button"
          aria-label={deleteLabel}
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          onClick={onDelete}
        >
          <TrashIcon />
          <span>削除</span>
        </button>
      )}
      <div
        className={`detail-row${dragging ? ' dragging' : ''}`}
        style={{ transform: `translateX(${dragOffset}px)` }}
        onPointerDown={startSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={finishSwipe}
        onPointerCancel={cancelSwipe}
        onClickCapture={closeOnClick}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * 種目詳細画面。各セットの重量・記録・強度の入力やレストタイマーを表示する
 */
export function DetailScreen() {
  const {
    workout,
    previousWorkout,
    groupWorkouts,
    rows,
    onSelectGroupWorkout,
    onAddMultiSetRound,
    exercise,
    weightUnit,
    restTimerSettings,
    active,
    readOnly,
    onOpenHistory,
    onOpenWorkoutHistory,
    onUpdateSet,
    onUpdateSetAchievement,
    onResetSetAchievement,
    onUpdateWorkoutNote,
    onUpdateSetIntensity,
    onUpdateWorkoutGrip,
    onUpdateWorkoutGripStyle,
    onDeleteSet,
    onAddSet,
    onCopyWorkoutSetValues,
    onUpdateExerciseGoal,
    onUpdateExerciseNote,
    onStartWorkoutUsage,
    onPauseWorkoutUsage,
    onResetWorkoutUsage,
  } = useDetailScreenModel();
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!historyMenuOpen) return undefined;
    historyMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    function closeFromOutside(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && !historyMenuRef.current?.contains(event.target))
        setHistoryMenuOpen(false);
    }
    function closeFromEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setHistoryMenuOpen(false);
      historyMenuRef.current?.querySelector<HTMLButtonElement>('.history-btn')?.focus();
    }
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [historyMenuOpen]);
  const [copyConfirmationOpen, setCopyConfirmationOpen] = useState(false);
  const [openDeleteSetId, setOpenDeleteSetId] = useState<string | null>(null);
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const [recordInputs, setRecordInputs] = useState<Record<string, string>>({});
  const [showTodayNote, setShowTodayNote] = useState(Boolean(workout?.note));
  useEffect(() => setShowTodayNote(Boolean(workout?.note)), [workout?.id, workout?.note]);
  if (!workout) return null;
  const currentWorkout = workout;
  const isMultiSet = groupWorkouts.length > 1;
  const groupLabel = groupWorkouts.length === 2 ? 'スーパーセット' : 'マルチセット';
  function weightInputValue(setId: string, value: number | null) {
    return weightInputs[setId] ?? formatStoredWeightInput(value, weightUnit);
  }
  function recordInputValue(setId: string, value: number | null) {
    return recordInputs[setId] ?? value ?? '';
  }
  function updateWeightInput(setId: string, value: string) {
    setWeightInputs((current) => ({ ...current, [setId]: value }));
    onUpdateSet(setId, 'weight', formatWeightForStorageInput(value, weightUnit));
  }
  function updateRecordInput(setId: string, value: string) {
    setRecordInputs((current) => ({ ...current, [setId]: value }));
    onUpdateSet(setId, 'recordValue', value.trim() === '' ? null : Number(value));
  }
  function markSetMissed(setId: string) {
    setRecordInputs((current) => ({ ...current, [setId]: '' }));
    onUpdateSetAchievement(setId, 'missed');
  }
  function updateIntensity(
    setId: string,
    currentIntensity: SetIntensity | undefined,
    nextIntensity: SetIntensity,
  ) {
    const nextSelected = currentIntensity !== nextIntensity;
    onUpdateSetIntensity(setId, nextSelected ? nextIntensity : undefined);
    if (nextSelected && restTimerSettings.autoStartOnIntensity) {
      window.dispatchEvent(new Event(restTimerStartEvent));
    }
  }
  function releaseInput(setId: string) {
    setWeightInputs((current) => {
      const next = { ...current };
      delete next[setId];
      return next;
    });
    setRecordInputs((current) => {
      const next = { ...current };
      delete next[setId];
      return next;
    });
  }
  function requestCopyPreviousWorkoutSets() {
    if (!previousWorkout || readOnly) return;
    const hasInput = currentWorkout.sets.some(
      (set) =>
        String(weightInputValue(set.id, set.weight)).trim() !== '' ||
        String(recordInputValue(set.id, set.recordValue)).trim() !== '',
    );
    if (hasInput) {
      setCopyConfirmationOpen(true);
      return;
    }
    copyPreviousWorkoutSets();
  }
  function copyPreviousWorkoutSets() {
    if (!previousWorkout || readOnly) return;
    const nextWeightInputs: Record<string, string> = {};
    const nextRecordInputs: Record<string, string> = {};
    previousWorkout.sets.forEach((previousSet, index) => {
      const currentSet = currentWorkout.sets[index];
      if (!currentSet) return;
      nextWeightInputs[currentSet.id] = formatStoredWeightInput(previousSet.weight, weightUnit);
      nextRecordInputs[currentSet.id] =
        previousSet.recordValue === null ? '' : String(previousSet.recordValue);
    });
    onCopyWorkoutSetValues(currentWorkout.id, previousWorkout.sets);
    setWeightInputs((current) => ({ ...current, ...nextWeightInputs }));
    setRecordInputs((current) => ({ ...current, ...nextRecordInputs }));
  }
  return (
    <section className="screen active detail-screen">
      <ScreenHeader
        title={isMultiSet ? groupLabel : workout.name}
        right={
          <div className="detail-history-control" ref={historyMenuRef}>
            <button
              className="history-btn"
              type="button"
              aria-label="履歴"
              aria-haspopup={isMultiSet ? 'menu' : undefined}
              aria-expanded={isMultiSet ? historyMenuOpen : undefined}
              aria-controls={historyMenuOpen ? 'multi-set-history-menu' : undefined}
              onClick={() =>
                isMultiSet ? setHistoryMenuOpen((current) => !current) : onOpenHistory()
              }
            >
              <HistoryIcon />
            </button>
            {historyMenuOpen && (
              <div
                className="multi-set-history-menu"
                id="multi-set-history-menu"
                role="menu"
                aria-label="履歴を見る種目を選択"
                onKeyDown={(event) => {
                  const items = [
                    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
                  ];
                  const current = items.findIndex((item) => item === document.activeElement);
                  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? items.length - 1
                          : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
                            items.length;
                    items[next]?.focus();
                  } else if (event.key === 'Tab') setHistoryMenuOpen(false);
                }}
              >
                <div className="multi-set-history-menu-title" role="presentation">
                  種目の履歴を見る
                </div>
                {groupWorkouts.map((member) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={member.id}
                    onClick={() => {
                      setHistoryMenuOpen(false);
                      onOpenWorkoutHistory(member.id);
                    }}
                  >
                    <span>{member.part}</span>
                    <strong>{member.name}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />
      <WorkoutUsageTimer
        workout={workout}
        active={active}
        readOnly={readOnly}
        onStart={onStartWorkoutUsage}
        onPause={onPauseWorkoutUsage}
        onReset={onResetWorkoutUsage}
      />
      <div className="content">
        {isMultiSet && (
          <section className="multi-set-members" aria-label="マルチセットの種目">
            <ul>
              {groupWorkouts.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    aria-pressed={member.id === workout.id}
                    onClick={() => onSelectGroupWorkout(member.id)}
                  >
                    {member.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {exercise && (
          <>
            <ExerciseGoalEditor
              exerciseId={exercise.id}
              measurementType={exercise.measurementType}
              goal={exercise.goal}
              weightUnit={weightUnit}
              readOnly={readOnly}
              onSave={onUpdateExerciseGoal}
            />
            <PreviousWorkoutRecord
              workout={previousWorkout}
              weightUnit={weightUnit}
              canCopy={!readOnly}
              onCopy={requestCopyPreviousWorkoutSets}
            />
          </>
        )}
        <div className={`detail-table ${isMultiSet ? 'multi-set-table' : ''}`}>
          {rows.map(({ set, index, workout: rowWorkout, weightStep }, rowIndex) => {
            const unit = measurementUnit(rowWorkout.measurementType);
            const isReps = isRepsMeasurement(rowWorkout.measurementType);
            const roundSets = rows.filter((row) => row.index === index).map((row) => row.set);
            const lastInRound = rows[rowIndex + 1]?.index !== index;
            return (
              <Fragment key={set.id}>
                <SwipeableSetRow
                  open={openDeleteSetId === set.id}
                  readOnly={readOnly}
                  deleteLabel={`${isMultiSet ? rowWorkout.name + 'の' : ''}${index + 1}セット目を削除`}
                  onOpenChange={(open) => setOpenDeleteSetId(open ? set.id : null)}
                  onDelete={() => {
                    setOpenDeleteSetId(null);
                    onDeleteSet(set.id);
                  }}
                >
                  {isMultiSet && <div className="multi-set-row-title">{rowWorkout.name}</div>}
                  <div className="num">{index + 1}</div>
                  <label className="field">
                    <input
                      type="number"
                      step={weightStep}
                      min="0"
                      inputMode="decimal"
                      readOnly={readOnly}
                      value={weightInputValue(set.id, set.weight)}
                      onBlur={() => releaseInput(set.id)}
                      onChange={(event) => updateWeightInput(set.id, event.target.value)}
                    />
                    <span className="unit">{weightUnitLabel(weightUnit)}</span>
                  </label>
                  <label className="field">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      readOnly={readOnly}
                      value={recordInputValue(set.id, set.recordValue)}
                      onBlur={() => releaseInput(set.id)}
                      onChange={(event) => updateRecordInput(set.id, event.target.value)}
                    />
                    <span className="unit">{unit}</span>
                    {set.achievement === 'missed' && typeof set.targetRecordValue === 'number' && (
                      <span className="target-value">
                        目標 {set.targetRecordValue}
                        {unit}
                      </span>
                    )}
                  </label>
                  <div className="rm-value">
                    {isReps
                      ? `${formatWeight(
                          calcRm(number(set.weight), number(set.recordValue)),
                          weightUnit,
                        )} ${weightUnitLabel(weightUnit)}`
                      : '-'}
                  </div>
                  {set.achievement ? (
                    <div className="intensity-picker" aria-label={`${index + 1}セット目の強度`}>
                      {intensityOptions.map((option) => (
                        <button
                          className={`intensity-button intensity-button-${option.value}${set.intensity === option.value ? ' active' : ''}`}
                          key={option.value}
                          type="button"
                          disabled={readOnly}
                          aria-label={option.label}
                          aria-pressed={set.intensity === option.value}
                          onClick={() => updateIntensity(set.id, set.intensity, option.value)}
                        >
                          <IntensityIcon intensity={option.value} />
                        </button>
                      ))}
                      {!isMultiSet && (
                        <button
                          className="intensity-reset-button"
                          type="button"
                          disabled={readOnly}
                          aria-label={`${index + 1}セット目の達成判定を戻す`}
                          onClick={() => onResetSetAchievement(set.id)}
                        >
                          <UndoIcon />
                        </button>
                      )}
                    </div>
                  ) : !isMultiSet ? (
                    <div
                      className="achievement-actions"
                      aria-label={`${index + 1}セット目の達成状態`}
                    >
                      <button
                        className="achievement-button achieved"
                        type="button"
                        disabled={readOnly || set.recordValue === null}
                        onClick={() => onUpdateSetAchievement(set.id, 'achieved')}
                      >
                        達成
                      </button>
                      <button
                        className="achievement-button missed"
                        type="button"
                        disabled={readOnly || set.recordValue === null}
                        onClick={() => markSetMissed(set.id)}
                      >
                        未達
                      </button>
                    </div>
                  ) : null}
                </SwipeableSetRow>
                {isMultiSet && lastInRound && (
                  <div
                    className="multi-set-round-actions"
                    role="group"
                    aria-label={`${index + 1}セット目の達成状態`}
                  >
                    {roundSets.every((item) => item.achievement) ? (
                      <button
                        className="small-outline"
                        type="button"
                        disabled={readOnly}
                        aria-label={`${index + 1}セット目の達成判定を戻す`}
                        onClick={() =>
                          roundSets.forEach((item) => {
                            releaseInput(item.id);
                            onResetSetAchievement(item.id);
                          })
                        }
                      >
                        <UndoIcon /> 判定を戻す
                      </button>
                    ) : (
                      <div className="achievement-actions">
                        <button
                          className="achievement-button achieved"
                          type="button"
                          disabled={readOnly || roundSets.some((item) => item.recordValue === null)}
                          onClick={() =>
                            roundSets.forEach((item) => onUpdateSetAchievement(item.id, 'achieved'))
                          }
                        >
                          達成
                        </button>
                        <button
                          className="achievement-button missed"
                          type="button"
                          disabled={readOnly || roundSets.some((item) => item.recordValue === null)}
                          onClick={() => roundSets.forEach((item) => markSetMissed(item.id))}
                        >
                          未達
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
          {!readOnly && (
            <button
              className="detail-add-set"
              type="button"
              aria-label={isMultiSet ? '各種目にセットを追加' : 'セットを追加'}
              onClick={() => (isMultiSet ? onAddMultiSetRound(workout.id) : onAddSet(workout.id))}
            >
              <PlusIcon />
            </button>
          )}
        </div>
        {exercise && (
          <WorkoutGripEditor
            workout={workout}
            exercise={exercise}
            readOnly={readOnly}
            onUpdateGrip={onUpdateWorkoutGrip}
            onUpdateGripStyle={onUpdateWorkoutGripStyle}
          />
        )}
        {exercise && (
          <label className="workout-note">
            <span>種目メモ</span>
            <textarea
              maxLength={1000}
              placeholder="フォームや器具設定など、次回も引き継ぐメモ"
              rows={5}
              readOnly={readOnly}
              value={exercise.note ?? ''}
              onChange={(event) => onUpdateExerciseNote(exercise.id, event.target.value)}
            />
          </label>
        )}
        {(showTodayNote || Boolean(workout.note)) && (
          <label className="workout-note workout-today-note">
            <span>本日のメモ</span>
            <textarea
              autoFocus={!workout.note}
              maxLength={1000}
              placeholder="今日のコンディションや気づきを入力"
              rows={4}
              readOnly={readOnly}
              value={workout.note}
              onChange={(event) => onUpdateWorkoutNote(workout.id, event.target.value)}
            />
          </label>
        )}
        {!readOnly && !showTodayNote && !workout.note && (
          <button
            className="add-today-note-button"
            type="button"
            onClick={() => setShowTodayNote(true)}
          >
            <PlusIcon />
            本日のメモを追加
          </button>
        )}
      </div>
      {copyConfirmationOpen && (
        <ConfirmDialog
          title="前回記録で上書きしますか？"
          className="copy-previous-workout-dialog"
          labelledBy="copy-previous-workout-title"
          onClose={() => setCopyConfirmationOpen(false)}
        >
          <p>入力済みの重量・回数（秒数）を前回記録で上書きします。</p>
          <div className="confirm-actions">
            <button
              className="small-outline"
              type="button"
              onClick={() => setCopyConfirmationOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                setCopyConfirmationOpen(false);
                copyPreviousWorkoutSets();
              }}
            >
              上書きしてコピー
            </button>
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}
