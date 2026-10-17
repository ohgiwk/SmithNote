import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { State, Workout } from '../types';
import { useWorkoutActions } from './useWorkoutActions';

type WorkoutActions = ReturnType<typeof useWorkoutActions>;

const workout: Workout = {
  id: 'w1',
  exerciseId: 'e1',
  date: '2026-07-06',
  name: 'ベンチプレス',
  part: '胸',
  measurementType: 'reps',
  sets: [{ id: 's1', weight: 50, recordValue: 10 }],
  note: '',
  usageElapsedSeconds: 0,
};

const state: State = {
  schemaVersion: 2,
  updatedAt: '2026-07-06T00:00:00.000Z',
  exercises: [],
  goalAchievements: [],
  workouts: [workout],
  workoutStartTimes: {},
  workoutEndTimes: {},
  presets: [],
  trainingDays: [],
  trainingPlans: [],
  parts: [],
  hiddenParts: [],
  weightUnit: 'kg',
  themeMode: 'dark',
  notificationSettings: { enabled: false },
  restTimerSettings: { autoStartOnIntensity: true, defaultSeconds: 60, alertVolume: 100 },
  catalogVersion: 1,
};

function WorkoutActionsProbe({
  onRender,
  initialState = state,
}: {
  onRender: (actions: WorkoutActions, state: State) => void;
  initialState?: State;
}) {
  const [currentState, setCurrentState] = useState(initialState);
  const actions = useWorkoutActions({
    state: currentState,
    saveState: (updater) => setCurrentState((draft) => updater(draft)),
    showToast: vi.fn(),
    showScreen: vi.fn(),
    selectedDate: workout.date,
    currentWorkout: currentState.workouts[0],
    currentWorkoutId: workout.id,
    setCurrentWorkoutId: vi.fn(),
    selectedWorkouts: currentState.workouts,
  });
  onRender(actions, currentState);
  return null;
}

describe('useWorkoutActions copyWorkoutSetValues', () => {
  it('前回セットが多い場合は不足セットを追加して重量と回数をコピーする', () => {
    let actions: WorkoutActions | null = null;
    let latestState: State = state;
    const sourceSets: Workout['sets'] = [
      { id: 'p1', weight: 45, recordValue: 12 },
      { id: 'p2', weight: 40, recordValue: 10 },
    ];
    render(
      <WorkoutActionsProbe
        onRender={(nextActions, nextState) => {
          actions = nextActions;
          latestState = nextState;
        }}
      />,
    );

    act(() => {
      actions?.copyWorkoutSetValues(workout.id, sourceSets);
    });

    const sets = latestState.workouts[0]?.sets;
    expect(sets).toHaveLength(2);
    expect(sets?.[0]).toMatchObject({ id: 's1', weight: 45, recordValue: 12 });
    expect(sets?.[1]).toMatchObject({ weight: 40, recordValue: 10 });
  });
});

describe('useWorkoutActions workout usage timer', () => {
  it('開始、停止、再開、リセットを保存する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T10:00:00.000Z'));
    let actions: WorkoutActions | null = null;
    let latestState: State = state;
    const view = render(
      <WorkoutActionsProbe
        onRender={(nextActions, nextState) => {
          actions = nextActions;
          latestState = nextState;
        }}
      />,
    );

    act(() => actions?.startWorkoutUsage(workout.id));
    expect(latestState.workouts[0].usageStartedAt).toBe('2026-07-06T10:00:00.000Z');

    vi.setSystemTime(new Date('2026-07-06T10:01:05.000Z'));
    act(() => actions?.pauseWorkoutUsage(workout.id));
    expect(latestState.workouts[0].usageElapsedSeconds).toBe(65);
    expect(latestState.workouts[0].usageStartedAt).toBeUndefined();

    act(() => actions?.startWorkoutUsage(workout.id));
    expect(latestState.workouts[0].usageStartedAt).toBe('2026-07-06T10:01:05.000Z');
    act(() => actions?.resetWorkoutUsage(workout.id));
    expect(latestState.workouts[0].usageElapsedSeconds).toBe(0);
    expect(latestState.workouts[0].usageStartedAt).toBeUndefined();

    view.unmount();
    vi.useRealTimers();
  });
});

describe('セット追加時の回数初期値', () => {
  it.each(['reps', 'seconds'] as const)(
    '既存の%sセットは変更せず新規セットに適用する',
    (measurementType) => {
      let actions!: WorkoutActions;
      let latestState!: State;
      render(
        <WorkoutActionsProbe
          initialState={{ ...state, defaultReps: 12, workouts: [{ ...workout, measurementType }] }}
          onRender={(nextActions, nextState) => {
            actions = nextActions;
            latestState = nextState;
          }}
        />,
      );
      act(() => actions.openWorkoutDetail('w1'));
      expect(latestState.workouts[0].sets[0].recordValue).toBe(10);
      expect(
        latestState.workouts[0].sets
          .slice(1)
          .every((set) => set.recordValue === (measurementType === 'reps' ? 12 : null)),
      ).toBe(true);
      act(() => actions.addSet('w1'));
      expect(latestState.workouts[0].sets[5].recordValue).toBe(
        measurementType === 'reps' ? 12 : null,
      );
    },
  );
});

describe('デフォルトのセット数までの補充', () => {
  it.each([1, 3, 7])('設定が%sセットの場合に既存記録を保持して補充する', (count) => {
    let actions!: WorkoutActions;
    let latestState!: State;
    render(
      <WorkoutActionsProbe
        initialState={{
          ...state,
          defaultSetCount: count,
          workouts: [
            { ...workout, sets: [...workout.sets, { id: 's2', weight: null, recordValue: null }] },
          ],
        }}
        onRender={(nextActions, nextState) => {
          actions = nextActions;
          latestState = nextState;
        }}
      />,
    );
    act(() => actions.openWorkoutDetail('w1'));
    expect(latestState.workouts[0].sets).toHaveLength(Math.max(2, count));
    expect(latestState.workouts[0].sets[0]).toEqual(workout.sets[0]);
    act(() => actions.addSet('w1'));
    expect(latestState.workouts[0].sets).toHaveLength(Math.max(2, count) + 1);
  });
});
