import { Fragment, MouseEvent } from 'react';
import { TrashIcon, PlusIcon } from '../icons';
import { WeightUnit, Workout } from '../types';
import { interleaveWorkoutSets, isUnstartedWorkout } from '../utils';
import { HomeSetRow } from './HomeSetRow';

/**
 * 同じマルチセットの種目を１枚のパネルでラウンド順に表示する
 */
export function HomeMultiSetCard({
  workouts,
  weightUnit,
  readOnly,
  removingWorkoutId,
  onOpen,
  onDelete,
}: {
  workouts: Workout[];
  weightUnit: WeightUnit;
  readOnly: boolean;
  removingWorkoutId: string | null;
  onOpen: (id: string) => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>, workout: Workout) => void;
}) {
  const label = workouts.length === 2 ? 'スーパーセット' : 'マルチセット';
  return (
    <article
      className={`exercise-card home-multi-set-card ${workouts.some((item) => item.id === removingWorkoutId) ? 'removing' : ''}`}
    >
      <button
        className="exercise-card-open"
        type="button"
        aria-label={`${label}の詳細を開く`}
        disabled={workouts.some((item) => item.id === removingWorkoutId)}
        onClick={() => onOpen(workouts[0].id)}
      />
      <header className="exercise-head">
        <h2>
          {workouts.map((workout) => (
            <span className="home-multi-set-heading-row" key={workout.id}>
              <span className="exercise-head-part">{workout.part}</span>
              <span className="exercise-head-separator" aria-hidden="true">
                ｜
              </span>
              <span className="exercise-head-name">{workout.name}</span>
            </span>
          ))}
        </h2>
        {!readOnly && (
          <button
            className="delete-workout"
            type="button"
            aria-label={`${label}の種目をすべて削除`}
            disabled={workouts.some((item) => item.id === removingWorkoutId)}
            onClick={(event) => onDelete(event, workouts[0])}
          >
            <TrashIcon />
          </button>
        )}
      </header>
      <div className="exercise-body">
        <table className="set-table" aria-label={`${label}の記録`}>
          <thead>
            <tr>
              <th>セット</th>
              <th>重さ</th>
              <th>記録</th>
              <th>RM</th>
            </tr>
          </thead>
          <tbody>
            {interleaveWorkoutSets(workouts).map(({ workout, set, index }) => (
              <Fragment key={set.id}>
                <tr className="home-multi-set-row-label">
                  <th colSpan={4}>
                    {workout.name}
                  </th>
                </tr>
                <HomeSetRow
                  set={set}
                  index={index}
                  measurementType={workout.measurementType}
                  weightUnit={weightUnit}
                />
              </Fragment>
            ))}
          </tbody>
        </table>
        {workouts
          .filter((workout) => workout.note.trim())
          .map((workout) => (
            <p className="exercise-today-note" key={workout.id}>
              {workout.name}：{workout.note}
            </p>
          ))}
        {!readOnly && workouts.every(isUnstartedWorkout) && (
          <div className="new-workout-overlay" aria-hidden="true">
            <div className="new-workout-overlay-icon">
              <PlusIcon />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
