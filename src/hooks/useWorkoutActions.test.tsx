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
  showToast = vi.fn(),
}: {
  onRender: (actions: WorkoutActions, state: State) => void;
  initialState?: State;
  showToast?: Parameters<typeof useWorkoutActions>[0]['showToast'];
}) {
  const [currentState, setCurrentState] = useState(initialState);
  const actions = useWorkoutActions({
    state: currentState,
    saveState: (updater) => setCurrentState((draft) => updater(draft)),
    showToast,
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

describe('マルチセット', () => {
  const exercises = ['e1', 'e2', 'e3'].map((id) => ({
    id,
    name: id,
    part: '胸',
    category: 'free' as const,
    measurementType: 'reps' as const,
  }));
  it('選択順を保存し、既存値を保持して新規種目に設定を適用する', () => {
    let actions!: WorkoutActions;
    let latest!: State;
    render(
      <WorkoutActionsProbe
        initialState={{ ...state, exercises, defaultReps: 12, defaultSetCount: 3 }}
        onRender={(a, s) => {
          actions = a;
          latest = s;
        }}
      />,
    );
    act(() => actions.startMultiSet(['e2', 'e1', 'e2', 'e3']));
    expect(latest.workouts.map((item) => item.exerciseId)).toEqual(['e2', 'e1', 'e3']);
    expect(new Set(latest.workouts.map((item) => item.multiSetGroupId)).size).toBe(1);
    expect(latest.workouts.map((item) => item.multiSetOrder)).toEqual([0, 1, 2]);
    expect(latest.workouts.find((item) => item.id === 'w1')?.sets[0]).toEqual(workout.sets[0]);
    expect(latest.workouts[0].sets).toHaveLength(3);
    expect(latest.workouts[0].sets[0].recordValue).toBe(12);
    expect(latest.workoutStartTimes[workout.date]).toBeTruthy();
    act(() => actions.openWorkoutDetail(latest.workouts[0].id));
    expect(latest.workouts.every((item) => item.sets.length === 3)).toBe(true);
    act(() => actions.addMultiSetRound('w1'));
    expect(latest.workouts.every((item) => item.sets.length === 4)).toBe(true);
    const otherSetId = latest.workouts[0].sets[0].id;
    act(() => actions.updateSet(otherSetId, 'weight', 22));
    expect(latest.workouts[0].sets[0].weight).toBe(22);
    act(() => actions.deleteSet(otherSetId));
    expect(latest.workouts[0].sets).toHaveLength(3);
    expect(latest.workouts.find((item) => item.id === 'w1')?.sets).toHaveLength(4);
  });
  it.each([false, true])('不十分な選択または終了済み日は変更しない（終了:%s）', (ended) => {
    let actions!: WorkoutActions;
    let latest!: State;
    const initial = {
      ...state,
      exercises,
      workoutEndTimes: ended ? { [workout.date]: '12:00' } : {},
    };
    render(
      <WorkoutActionsProbe
        initialState={initial}
        onRender={(a, s) => {
          actions = a;
          latest = s;
        }}
      />,
    );
    act(() => actions.startMultiSet(ended ? ['e1', 'e2'] : ['e1', 'e1', 'unknown']));
    expect(latest).toBe(initial);
  });
});

describe('グループ全体の削除と復元', () => {
  it('同日グループだけを削除し、元に戻すと全種目と並び順を復元する', () => {
    const a = { ...workout, multiSetGroupId: 'g1', multiSetOrder: 0 };
    const b = { ...a, id: 'w2', exerciseId: 'e2', multiSetOrder: 1 };
    const single = { ...workout, id: 'single' };
    const otherDay = { ...a, id: 'other', date: '2026-07-05' };
    const initial = { ...state, workouts: [a, single, b, otherDay] };
    const showToast = vi.fn<Parameters<typeof useWorkoutActions>[0]['showToast']>();
    let actions!: WorkoutActions;
    let latest!: State;
    render(
      <WorkoutActionsProbe
        initialState={initial}
        showToast={showToast}
        onRender={(nextActions, nextState) => {
          actions = nextActions;
          latest = nextState;
        }}
      />,
    );
    act(() => actions.deleteWorkout('w2'));
    expect(latest.workouts.map((item) => item.id)).toEqual(['single', 'other']);
    const undo = showToast.mock.calls[0][1]?.onAction;
    expect(undo).toBeTruthy();
    act(() => undo?.());
    expect(latest.workouts).toEqual(initial.workouts);
  });
  it('終了済みグループは削除しない', () => {
    const initial = {
      ...state,
      workouts: [{ ...workout, multiSetGroupId: 'g1' }],
      workoutEndTimes: { [workout.date]: '12:00' },
    };
    let actions!: WorkoutActions;
    let latest!: State;
    render(
      <WorkoutActionsProbe
        initialState={initial}
        onRender={(a, s) => {
          actions = a;
          latest = s;
        }}
      />,
    );
    act(() => actions.deleteWorkout('w1'));
    expect(latest).toBe(initial);
  });
});
