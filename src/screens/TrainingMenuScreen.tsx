import { useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { CalendarIcon, EditIcon, TrashIcon } from '../icons';
import { useSmithNoteContext } from '../hooks/useSmithNoteContext';
import { Preset } from '../types';
import { presetColor, weekdayLabels } from '../utils';

/**
 * トレーニングメニュー画面が必要とする state・操作を Context から組み立てる
 */
function useTrainingMenuScreenModel() {
  const { state, actions } = useSmithNoteContext();

  return {
    presets: state.presets,
    onEditPreset: actions.editPreset,
    onDeletePreset: actions.deletePreset,
  };
}

/**
 * トレーニングメニューの一覧・追加・編集・削除を行う画面
 */
export function TrainingMenuScreen() {
  const { presets, onEditPreset, onDeletePreset } = useTrainingMenuScreenModel();
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);

  /**
   * 確認ダイアログで選んだメニューを削除する
   */
  function confirmDeletePreset() {
    if (!deleteTarget) return;
    onDeletePreset(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="screen active training-menu-screen">
      <ScreenHeader title="トレーニングメニュー" />
      <div className="training-menu-wrap">
        <section className="schedule-panel">
          <div className="schedule-panel-head">
            <div className="schedule-title">
              <CalendarIcon />
              <h2>メニュー一覧</h2>
            </div>
          </div>
          <p className="schedule-desc">曜日や間隔は各メニューの編集画面で設定できます。</p>
          {!presets.length ? (
            <div className="schedule-empty">トレーニングメニューがありません</div>
          ) : (
            <div className="schedule-list">
              {presets.map((preset) => (
                <div
                  className="preset-plan-row"
                  key={preset.id}
                  style={{ borderLeftColor: presetColor(preset.color) }}
                >
                  <button
                    className="preset-plan-main"
                    type="button"
                    onClick={() => onEditPreset(preset.id)}
                  >
                    <span>{preset.name}</span>
                    <span className="preset-plan-meta">
                      <small>{preset.exerciseIds.length}種目</small>
                      <small>{formatPresetSchedule(preset)}</small>
                    </span>
                  </button>
                  <button
                    className="preset-plan-edit"
                    type="button"
                    aria-label={`${preset.name}を編集`}
                    onClick={() => onEditPreset(preset.id)}
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="preset-plan-delete"
                    type="button"
                    aria-label={`${preset.name}を削除`}
                    onClick={() => setDeleteTarget(preset)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {deleteTarget && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-menu-delete-title"
          >
            <div id="training-menu-delete-title" className="confirm-title">
              トレーニングメニューを削除しますか？
            </div>
            <p>「{deleteTarget.name}」を削除します。削除後に画面下部から元に戻せます。</p>
            <div className="confirm-actions">
              <button className="small-outline" type="button" onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
              <button className="danger-button" type="button" onClick={confirmDeletePreset}>
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * メニューのスケジュールを一覧向けの短い文言にする
 */
function formatPresetSchedule(preset: Preset) {
  const schedule = preset.schedule;
  if (!schedule) return '設定なし';
  if (schedule.mode === 'weekly') {
    return schedule.weekdays.length
      ? schedule.weekdays.map((weekday) => weekdayLabels[weekday]).join('・')
      : '曜日未選択';
  }
  if (!schedule.startDate) return '開始日未設定';
  return `${schedule.startDate.replaceAll('-', '/')}から${schedule.intervalDays}日ごと`;
}
