import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ExercisePicker } from '../components/ExercisePicker';
import { EditIcon, MultiSetIcon } from '../icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSmithNoteContext } from '../hooks/useSmithNoteContext';
import type { Exercise } from '../types';
import { frequentExercisesForPart } from '../utils';

type ExerciseListMode = 'select' | 'manage';

function useSelectScreenModel() {
  const { state, groupedExercises, partRecentLabels, partColors, activePart, actions } =
    useSmithNoteContext();
  return {
    workouts: state.workouts,
    groupedExercises,
    partRecentLabels,
    partColors,
    activePart,
    onOpenExerciseManager: () => actions.setScreen('exerciseManage'),
    onStartMultiSet: actions.startMultiSet,
    onAddExercise: actions.addExerciseToToday,
    onReorder: actions.reorderPartExercises,
    onDeleteExercise: actions.deleteExercise,
    onOpenExerciseEditor: (part: string, exerciseId: string | null = null) =>
      actions.openExerciseEditor(part, exerciseId),
    onSelectPart: actions.selectPart,
  };
}

function ExerciseListScreen({ mode }: { mode: ExerciseListMode }) {
  const model = useSelectScreenModel();
  const isManageMode = mode === 'manage';
  const [multiMode, setMultiMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const currentPart =
    model.activePart && model.groupedExercises.has(model.activePart)
      ? model.activePart
      : [...model.groupedExercises.keys()][0];
  const frequentExercises = currentPart
    ? frequentExercisesForPart(model.groupedExercises.get(currentPart) ?? [], model.workouts)
    : [];

  function requestDeleteExercise(exerciseId: string) {
    const exercise = [...model.groupedExercises.values()]
      .flat()
      .find((item) => item.id === exerciseId);
    if (exercise) setDeleteTarget(exercise);
  }

  function confirmDeleteExercise() {
    if (!deleteTarget) return;
    model.onDeleteExercise(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="screen active">
      <ScreenHeader
        title={mode === 'manage' ? '種目一覧を編集' : '種目を選択'}
        right={
          isManageMode ? undefined : (
            <div className="select-header-actions">
              <button
                className="multi-set-mode-toggle"
                type="button"
                aria-label={multiMode ? '通常モードに戻す' : 'マルチセットモード'}
                title={multiMode ? '通常モードに戻す' : 'マルチセットモード'}
                aria-pressed={multiMode}
                onClick={() => {
                  setMultiMode((current) => !current);
                  setSelectedIds([]);
                }}
              >
                <MultiSetIcon />
              </button>
              <button
                className="select-edit-button"
                type="button"
                aria-label="種目を編集"
                title="種目を編集"
                onClick={model.onOpenExerciseManager}
              >
                <EditIcon />
              </button>
            </div>
          )
        }
      />
      {!isManageMode && multiMode && (
        <div className="multi-set-selection">
          <h2 className="multi-set-selection-title">マルチセットモード</h2>
          {multiMode && (
            <>
              <p>2種目以上を選択してください。</p>
              <button
                className="danger-button"
                type="button"
                disabled={selectedIds.length < 2}
                onClick={() => model.onStartMultiSet(selectedIds)}
              >
                {selectedIds.length}種目で確定
              </button>
            </>
          )}
        </div>
      )}
      <ExercisePicker
        activePart={model.activePart}
        groupedExercises={model.groupedExercises}
        label={
          isManageMode && currentPart
            ? `${currentPart}の種目`
            : currentPart
              ? model.partRecentLabels.get(currentPart) || '履歴なし'
              : ''
        }
        mode={isManageMode ? 'manage' : multiMode ? 'multi' : 'single'}
        selectedExerciseIds={selectedIds}
        frequentExercises={isManageMode ? undefined : frequentExercises}
        partColors={model.partColors}
        onDeleteExercise={requestDeleteExercise}
        onEditExercise={model.onOpenExerciseEditor}
        onReorder={model.onReorder}
        onSelectExercise={
          multiMode
            ? (id) =>
                setSelectedIds((current) =>
                  current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                )
            : model.onAddExercise
        }
        onSelectPart={model.onSelectPart}
      />
      {deleteTarget && (
        <ConfirmDialog
          title="種目を削除しますか？"
          labelledBy="exercise-delete-title"
          onClose={() => setDeleteTarget(null)}
        >
          <p>
            「{deleteTarget.name}
            」を削除します。登録されているトレーニングメニューからも削除されます。
          </p>
          <div className="confirm-actions">
            <button className="small-outline" type="button" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </button>
            <button className="danger-button" type="button" onClick={confirmDeleteExercise}>
              削除
            </button>
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}

export function SelectScreen() {
  return <ExerciseListScreen mode="select" />;
}

export function ExerciseManageScreen() {
  return <ExerciseListScreen mode="manage" />;
}
