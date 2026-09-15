import { createPortal } from 'react-dom';
import { useState } from 'react';
import { ChevronDown, ChevronUp, DragHandle, EditIcon, TrashIcon } from '../icons';
import { ReorderItem, useExerciseReorder } from '../hooks/useExerciseReorder';
import type { Exercise } from '../types';
import { exerciseCategories } from '../utils';

type ExercisePickerProps = {
  activePart: string | null;
  groupedExercises: Map<string, Exercise[]>;
  label: string;
  mode: 'single' | 'multi' | 'manage';
  frequentExercises?: Exercise[];
  partColors: Map<string, string>;
  selectedExerciseIds?: string[];
  onDeleteExercise?: (exerciseId: string) => void;
  onEditExercise?: (part: string, exerciseId: string) => void;
  onReorder?: (part: string, layout: ReorderItem[]) => void;
  onSelectExercise?: (exerciseId: string) => void;
  onSelectPart: (part: string) => void;
};

export function ExercisePicker({
  activePart,
  groupedExercises,
  label,
  mode,
  frequentExercises = [],
  partColors,
  selectedExerciseIds = [],
  onDeleteExercise,
  onEditExercise,
  onReorder,
  onSelectExercise,
  onSelectPart,
}: ExercisePickerProps) {
  const [frequentOpen, setFrequentOpen] = useState(true);
  const [searchText, setSearchText] = useState('');
  const query = mode === 'single' ? searchText.normalize('NFKC').trim().toLowerCase() : '';
  const searchResults = query
    ? [...groupedExercises.values()]
        .flat()
        .filter((exercise) => exercise.name.normalize('NFKC').toLowerCase().includes(query))
    : [];
  const tabs = [...groupedExercises.keys()];
  const currentPart = activePart && groupedExercises.has(activePart) ? activePart : tabs[0];
  const currentExercises = currentPart ? (groupedExercises.get(currentPart) ?? []) : [];
  const reorder = useExerciseReorder({
    exercises: currentExercises,
    onCommit: (layout) => {
      if (currentPart) onReorder?.(currentPart, layout);
    },
  });
  const selectedIds = new Set(selectedExerciseIds);
  const draggedExercise = currentExercises.find((exercise) => exercise.id === reorder.draggingId);

  return (
    <>
      <div className="part-tabs" role="tablist" aria-label="部位">
        {tabs.map((part) => {
          const isActive = part === currentPart;
          const color = partColors.get(part);
          return (
            <button
              className={`part-tab ${isActive ? 'active' : ''}`}
              key={part}
              type="button"
              role="tab"
              aria-selected={isActive}
              style={isActive && color ? { background: color } : undefined}
              onClick={() => {
                setSearchText('');
                onSelectPart(part);
              }}
            >
              {part}
            </button>
          );
        })}
      </div>
      <div className="content">
        {mode === 'single' && (
          <div className="exercise-search">
            <input
              className="form-input"
              type="search"
              aria-label="種目名で検索"
              placeholder="種目名で検索"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            {searchText && (
              <button className="small-outline" type="button" onClick={() => setSearchText('')}>
                クリア
              </button>
            )}
          </div>
        )}
        {query && (
          <section className="part-card" aria-label="検索結果">
            <div className="part-list-head" role="status">
              <span className="part-list-label">
                {searchResults.length
                  ? `検索結果 ${searchResults.length}件`
                  : '該当する種目がありません'}
              </span>
            </div>
            <div className="exercise-list">
              {searchResults.map((exercise) => (
                <button
                  className="exercise-option exercise-search-result"
                  style={{ borderLeftColor: partColors.get(exercise.part) }}
                  key={exercise.id}
                  type="button"
                  onClick={() => onSelectExercise?.(exercise.id)}
                >
                  <span className="exercise-search-part">{exercise.part}</span>
                  <span className="exercise-search-name">{exercise.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {!query && currentPart && (
          <>
            {mode === 'single' && !!frequentExercises.length && (
              <section
                className="frequent-exercises-card"
                aria-labelledby="frequent-exercises-title"
              >
                <button
                  className="frequent-exercises-toggle"
                  type="button"
                  aria-expanded={frequentOpen}
                  onClick={() => setFrequentOpen((open) => !open)}
                >
                  <span id="frequent-exercises-title">よく行う種目</span>
                  <span className="frequent-exercises-toggle-icon" aria-hidden="true">
                    {frequentOpen ? <ChevronUp /> : <ChevronDown />}
                  </span>
                </button>
                {frequentOpen && (
                  <div className="frequent-exercises-list">
                    {frequentExercises.map((exercise) => (
                      <button
                        type="button"
                        key={exercise.id}
                        onClick={() => onSelectExercise?.(exercise.id)}
                      >
                        {exercise.name}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
            <section className="part-card">
              <div className="part-list-head">
                <span className="part-list-label">{label}</span>
              </div>
              {mode === 'manage' ? (
                <div className="exercise-list" ref={reorder.listRef}>
                  {exerciseCategories.map(({ value, label: categoryLabel }) => (
                    <div className="category-section" data-category-section={value} key={value}>
                      <div className="category-subhead">{categoryLabel}</div>
                      <div className="category-rows">
                        {reorder.itemsFor(value).map((exercise) => (
                          <div
                            className={`exercise-option edit-row ${
                              reorder.draggingId === exercise.id ? 'dragging' : ''
                            }`}
                            data-exercise-row={exercise.id}
                            key={exercise.id}
                            onPointerDown={(event) => reorder.onPointerDown(event, exercise.id)}
                            onPointerMove={reorder.onPointerMove}
                            onPointerUp={reorder.onPointerUp}
                            onPointerCancel={reorder.onPointerUp}
                          >
                            <span className="drag-handle" data-drag-handle aria-hidden="true">
                              <DragHandle />
                            </span>
                            <span className="exercise-name">{exercise.name}</span>
                            <button
                              className="edit-exercise"
                              data-row-action
                              type="button"
                              aria-label="種目を編集"
                              onClick={() => onEditExercise?.(exercise.part, exercise.id)}
                            >
                              <EditIcon />
                            </button>
                            <button
                              className="delete-exercise"
                              data-row-action
                              type="button"
                              aria-label="種目を削除"
                              onClick={() => onDeleteExercise?.(exercise.id)}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="exercise-list">
                  {exerciseCategories.flatMap(({ value, label: categoryLabel }) => {
                    const items = currentExercises.filter(
                      (exercise) => exercise.category === value,
                    );
                    if (!items.length) return [];
                    return [
                      <div className="category-subhead" key={`head-${value}`}>
                        {categoryLabel}
                      </div>,
                      ...items.map((exercise) => {
                        const selected = selectedIds.has(exercise.id);
                        return (
                          <button
                            className={`exercise-option ${
                              mode === 'multi' ? 'preset-exercise-option' : ''
                            } ${selected ? 'selected' : ''}`}
                            key={exercise.id}
                            type="button"
                            aria-pressed={mode === 'multi' ? selected : undefined}
                            onClick={() => onSelectExercise?.(exercise.id)}
                          >
                            {mode === 'multi' ? (
                              <>
                                <span>{exercise.name}</span>
                                <span className="preset-exercise-check" aria-hidden="true">
                                  {selected ? '✓' : ''}
                                </span>
                              </>
                            ) : (
                              exercise.name
                            )}
                          </button>
                        );
                      }),
                    ];
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {mode === 'manage' &&
        draggedExercise &&
        reorder.dragOverlay &&
        createPortal(
          <div
            className="exercise-option edit-row exercise-drag-overlay"
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
            <span className="exercise-name">{draggedExercise.name}</span>
            <span className="edit-exercise exercise-row-action-placeholder">
              <EditIcon />
            </span>
            <span className="delete-exercise exercise-row-action-placeholder">
              <TrashIcon />
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
