import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { useFlatReorder } from '../hooks/useFlatReorder';
import { DragHandle, PlusIcon, TrashIcon } from '../icons';
import { useSmithNoteContext } from '../hooks/useSmithNoteContext';
import { PresetSchedule, TrainingPlanMode } from '../types';
import { parseDate, presetColor, presetColors, weekdayLabels } from '../utils';

/**
 * プリセット編集画面が必要とする state・操作を Context から組み立てる view-model フック
 */
function usePresetEditScreenModel() {
  const { presetDraft, presetDraftMode, selectedDate, state, actions } = useSmithNoteContext();

  return {
    preset: presetDraft,
    isStartFlow: presetDraftMode === 'start',
    selectedDate,
    exercises: state.exercises,
    onBack: actions.cancelPresetDraft,
    onSave: actions.savePresetDraft,
    onUpdate: actions.updatePresetDraft,
    onOpenExerciseSelect: () => actions.setScreen('presetExerciseSelect'),
  };
}

/**
 * プリセット編集画面。名称変更・種目の追加/削除/並び替えを行う
 */
export function PresetEditScreen() {
  const {
    preset,
    isStartFlow,
    selectedDate,
    exercises,
    onBack,
    onSave,
    onUpdate,
    onOpenExerciseSelect,
  } = usePresetEditScreenModel();
  const reorder = useFlatReorder({
    items: preset?.exerciseIds ?? [],
    onCommit: (exerciseIds) => onUpdate({ exerciseIds }),
  });

  /**
   * 下書きから指定種目を外す
   */
  function removeExercise(exerciseId: string) {
    if (!preset) return;
    onUpdate({ exerciseIds: preset.exerciseIds.filter((id) => id !== exerciseId) });
  }
  const draggedExercise = exercises.find((item) => item.id === reorder.draggingId);
  const draggedExerciseName = draggedExercise
    ? `${draggedExercise.part} - ${draggedExercise.name}`
    : '削除済みの種目';

  return (
    <section className="screen active">
      <ScreenHeader
        title="メニュー編集"
        onBack={onBack}
        right={
          <button className="bar-btn right" type="button" onClick={onSave}>
            {isStartFlow ? '開始' : '保存'}
          </button>
        }
      />
      <div className="preset-wrap">
        {!preset ? (
          <div className="empty">
            <div>
              <strong>編集するメニューを選択してください</strong>
              <span>トレーニングメニュー画面から編集できます。</span>
            </div>
          </div>
        ) : (
          <div className="preset-edit-layout">
            <section className="preset-card">
              <header className="preset-card-head">
                <input
                  className="preset-name-input"
                  maxLength={24}
                  value={preset.name}
                  aria-label="メニュー名"
                  onChange={(event) => onUpdate({ name: event.target.value })}
                />
              </header>
            </section>
            <section className="preset-card">
              <div className="preset-section-heading">
                <div className="preset-section-title">種目の選択</div>
                <div className="preset-section-actions">
                  <small>{preset.exerciseIds.length}種目選択中</small>
                  <button
                    className="preset-section-add"
                    type="button"
                    aria-label="種目を選択"
                    onClick={onOpenExerciseSelect}
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
              <div ref={reorder.listRef}>
                {preset.exerciseIds.length ? (
                  reorder.activeItems.map((exerciseId) => {
                    const exercise = exercises.find((item) => item.id === exerciseId);
                    const name = exercise
                      ? `${exercise.part} - ${exercise.name}`
                      : '削除済みの種目';
                    return (
                      <div
                        className={`preset-row ${
                          reorder.draggingId === exerciseId ? 'dragging' : ''
                        }`}
                        data-reorder-row={exerciseId}
                        key={exerciseId}
                        onPointerDown={(event) => reorder.onPointerDown(event, exerciseId)}
                        onPointerMove={reorder.onPointerMove}
                        onPointerUp={reorder.onPointerUp}
                        onPointerCancel={reorder.onPointerUp}
                      >
                        <span className="drag-handle" data-drag-handle aria-hidden="true">
                          <DragHandle />
                        </span>
                        <div className="preset-row-name">{name}</div>
                        <button
                          className="preset-row-btn"
                          type="button"
                          aria-label="種目を外す"
                          onClick={() => removeExercise(exerciseId)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty preset-exercise-empty">
                    <div>
                      <strong>種目未登録</strong>
                      <span>右上の＋から種目を選択してください。</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <section className="preset-card">
              <PresetScheduleEditor
                fallbackStartDate={selectedDate}
                schedule={preset.schedule}
                onChange={(schedule) => onUpdate({ schedule })}
              />
            </section>
            <section className="preset-card">
              <div className="preset-color-editor" role="group" aria-label="メニューの色">
                <div className="preset-section-title">メニューの色</div>
                <div className="preset-color-options">
                  {presetColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      aria-label={color.label}
                      aria-pressed={presetColor(preset.color) === color.value}
                      style={{ backgroundColor: color.value }}
                      onClick={() => onUpdate({ color: color.value })}
                    >
                      {presetColor(preset.color) === color.value ? '✓' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
      {reorder.draggingId &&
        reorder.dragOverlay &&
        createPortal(
          <div
            className="preset-row preset-row-drag-overlay"
            style={{
              left: reorder.dragOverlay.left,
              top: reorder.dragOverlay.top,
              width: reorder.dragOverlay.width,
            }}
            aria-hidden="true"
          >
            <span className="drag-handle">
              <DragHandle />
            </span>
            <div className="preset-row-name">{draggedExerciseName}</div>
            <span className="preset-row-btn preset-row-delete-placeholder">
              <TrashIcon />
            </span>
          </div>,
          document.body,
        )}
    </section>
  );
}

type PresetScheduleEditorProps = {
  schedule: PresetSchedule | undefined;
  fallbackStartDate: string;
  onChange: (schedule: PresetSchedule | undefined) => void;
};

/**
 * プリセットに紐づく曜日・間隔スケジュールを編集する
 */
function PresetScheduleEditor({
  schedule,
  fallbackStartDate,
  onChange,
}: PresetScheduleEditorProps) {
  const intervalDays = schedule?.intervalDays ?? 3;
  const startDate = schedule?.startDate || fallbackStartDate;
  const weekdays = schedule?.weekdays ?? [];
  const [intervalText, setIntervalText] = useState(String(intervalDays));

  useEffect(() => {
    setIntervalText(String(intervalDays));
  }, [intervalDays]);

  /**
   * スケジュール方式を切り替え、未設定項目には操作日の既定値を入れる
   */
  function selectMode(mode: TrainingPlanMode) {
    onChange({
      mode,
      weekdays:
        mode === 'weekly' && !weekdays.length ? [parseDate(fallbackStartDate).getDay()] : weekdays,
      intervalDays,
      startDate,
    });
  }

  /**
   * 曜日ボタンの選択状態を切り替える
   */
  function toggleWeekday(weekday: number) {
    const next = weekdays.includes(weekday)
      ? weekdays.filter((value) => value !== weekday)
      : [...weekdays, weekday].sort((a, b) => a - b);
    onChange({
      mode: 'weekly',
      weekdays: next,
      intervalDays,
      startDate,
    });
  }

  /**
   * 有効な間隔だけを保存する
   */
  function updateInterval(text: string) {
    setIntervalText(text);
    const value = Number(text);
    if (!Number.isFinite(value) || value < 1) return;
    onChange({
      mode: 'interval',
      weekdays,
      intervalDays: Math.round(value),
      startDate,
    });
  }

  return (
    <section className="preset-schedule">
      <div className="preset-section-title">スケジュール</div>
      <p>設定した日は、ホームでこのメニューが最初から選択されます。</p>
      <div className="preset-schedule-mode" role="group" aria-label="スケジュール方式">
        <button
          className={!schedule ? 'active' : ''}
          type="button"
          onClick={() => onChange(undefined)}
        >
          設定なし
        </button>
        <button
          className={schedule?.mode === 'weekly' ? 'active' : ''}
          type="button"
          onClick={() => selectMode('weekly')}
        >
          曜日
        </button>
        <button
          className={schedule?.mode === 'interval' ? 'active' : ''}
          type="button"
          onClick={() => selectMode('interval')}
        >
          何日ごと
        </button>
      </div>
      {schedule?.mode === 'weekly' && (
        <div className="weekday-picker" aria-label="メニューの曜日">
          {weekdayLabels.map((day, index) => (
            <button
              className={weekdays.includes(index) ? 'active' : ''}
              key={day}
              type="button"
              onClick={() => toggleWeekday(index)}
            >
              {day}
            </button>
          ))}
        </div>
      )}
      {schedule?.mode === 'interval' && (
        <div className="interval-fields">
          <label className="form-field">
            <span>間隔</span>
            <input
              className="form-input form-input-compact"
              inputMode="numeric"
              min="1"
              type="number"
              value={intervalText}
              onChange={(event) => updateInterval(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>開始日</span>
            <input
              className="form-input form-input-compact"
              type="date"
              value={startDate}
              onChange={(event) =>
                onChange({
                  mode: 'interval',
                  weekdays,
                  intervalDays,
                  startDate: event.target.value,
                })
              }
            />
          </label>
        </div>
      )}
    </section>
  );
}
