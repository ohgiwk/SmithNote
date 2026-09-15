import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { restTimerStartEvent } from '../components/RestTimer';
import { SmithNoteContext, SmithNoteContextValue } from '../hooks/useSmithNoteContext';
import { State, Workout } from '../types';
import { DetailScreen } from './DetailScreen';

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
  exercises: [
    {
      id: 'e1',
      part: '胸',
      name: 'ベンチプレス',
      measurementType: 'reps',
      category: 'free',
      availableGrips: ['normal'],
      availableGripStyles: ['thumbAround'],
    },
  ],
  goalAchievements: [],
  workouts: [workout],
  workoutStartTimes: {},
  workoutEndTimes: {},
  presets: [],
  trainingDays: [],
  trainingPlans: [],
  parts: [{ name: '胸', color: '#ef4444' }],
  hiddenParts: [],
  weightUnit: 'kg',
  themeMode: 'dark',
  notificationSettings: { enabled: false },
  restTimerSettings: { autoStartOnIntensity: true, defaultSeconds: 60, alertVolume: 100 },
  catalogVersion: 1,
};

function renderDetailScreen({
  updateSet = vi.fn(),
  updateSetAchievement = vi.fn(),
  resetSetAchievement = vi.fn(),
  copyWorkoutSetValues = vi.fn(),
  updateWorkoutNote = vi.fn(),
  updateExerciseNote = vi.fn(),
  startWorkoutUsage = vi.fn(),
  pauseWorkoutUsage = vi.fn(),
  resetWorkoutUsage = vi.fn(),
  weightUnit = 'kg',
  currentWorkout = workout,
  workouts,
  restTimerAutoStart = true,
  restTimerDefaultSeconds = 60,
}: {
  updateSet?: ReturnType<typeof vi.fn>;
  updateSetAchievement?: ReturnType<typeof vi.fn>;
  resetSetAchievement?: ReturnType<typeof vi.fn>;
  copyWorkoutSetValues?: ReturnType<typeof vi.fn>;
  updateWorkoutNote?: ReturnType<typeof vi.fn>;
  updateExerciseNote?: ReturnType<typeof vi.fn>;
  startWorkoutUsage?: ReturnType<typeof vi.fn>;
  pauseWorkoutUsage?: ReturnType<typeof vi.fn>;
  resetWorkoutUsage?: ReturnType<typeof vi.fn>;
  weightUnit?: State['weightUnit'];
  currentWorkout?: Workout;
  workouts?: Workout[];
  restTimerAutoStart?: boolean;
  restTimerDefaultSeconds?: number;
}) {
  const value = {
    screen: 'detail',
    currentWorkout,
    state: {
      ...state,
      weightUnit,
      workouts: workouts ?? [currentWorkout],
      restTimerSettings: {
        autoStartOnIntensity: restTimerAutoStart,
        defaultSeconds: restTimerDefaultSeconds,
        alertVolume: 100,
      },
    },
    actions: {
      setScreen: vi.fn(),
      updateSet,
      updateSetAchievement,
      resetSetAchievement,
      updateWorkoutNote,
      updateExerciseNote,
      startWorkoutUsage,
      pauseWorkoutUsage,
      resetWorkoutUsage,
      updateSetIntensity: vi.fn(),
      updateWorkoutGrip: vi.fn(),
      updateWorkoutGripStyle: vi.fn(),
      deleteSet: vi.fn(),
      addSet: vi.fn(),
      copyWorkoutSetValues,
      updateExerciseGoal: vi.fn(),
      setRestTimerDefaultSeconds: vi.fn(),
      setRestTimerAutoStart: vi.fn(),
    },
  } as unknown as SmithNoteContextValue;

  return render(
    <SmithNoteContext.Provider value={value}>
      <DetailScreen />
    </SmithNoteContext.Provider>,
  );
}

function detailNumberInputs(container: HTMLElement) {
  return [
    ...container.querySelectorAll('.detail-table input[type="number"]'),
  ] as HTMLInputElement[];
}

describe('DetailScreen set inputs', () => {
  it('表示時に実施時間を開始し、停止・再開・リセットを操作できる', () => {
    const startWorkoutUsage = vi.fn();
    const pauseWorkoutUsage = vi.fn();
    const resetWorkoutUsage = vi.fn();
    const runningWorkout = {
      ...workout,
      usageElapsedSeconds: 62,
      usageStartedAt: new Date().toISOString(),
    };
    const { container, unmount } = renderDetailScreen({
      currentWorkout: runningWorkout,
      startWorkoutUsage,
      pauseWorkoutUsage,
      resetWorkoutUsage,
    });

    expect(startWorkoutUsage).toHaveBeenCalledWith('w1');
    expect(within(container).getByLabelText('種目実施時間').textContent).toContain('1:02');
    expect(within(container).queryByRole('button', { name: '停止' })).toBeNull();
    fireEvent.click(within(container).getByRole('button', { name: '実施時間タイマーを操作' }));
    fireEvent.click(within(container).getByRole('button', { name: '停止' }));
    expect(pauseWorkoutUsage).toHaveBeenCalledWith('w1');
    fireEvent.click(within(container).getByRole('button', { name: 'リセット' }));
    expect(resetWorkoutUsage).toHaveBeenCalledWith('w1');

    unmount();
    expect(pauseWorkoutUsage).toHaveBeenCalledWith('w1');
  });

  it('終了済みの詳細では実施時間を表示するだけで自動開始しない', () => {
    const startWorkoutUsage = vi.fn();
    const endedWorkout = { ...workout, usageElapsedSeconds: 125 };
    state.workoutEndTimes[endedWorkout.date] = '12:00';
    const { container } = renderDetailScreen({
      currentWorkout: endedWorkout,
      workouts: [endedWorkout],
      startWorkoutUsage,
    });

    expect(within(container).getByLabelText('種目実施時間').textContent).toContain('2:05');
    fireEvent.click(within(container).getByRole('button', { name: '実施時間タイマーを操作' }));
    expect(within(container).queryByRole('button', { name: '再開' })).toBeNull();
    expect(startWorkoutUsage).not.toHaveBeenCalled();
    delete state.workoutEndTimes[endedWorkout.date];
  });

  it('種目メモを種目マスタへ保存し、本日のメモは追加後にワークアウトへ保存する', () => {
    const updateExerciseNote = vi.fn();
    const updateWorkoutNote = vi.fn();
    const { container } = renderDetailScreen({ updateExerciseNote, updateWorkoutNote });

    const exerciseNote = within(container).getByLabelText('種目メモ');
    fireEvent.change(exerciseNote, { target: { value: 'バーの位置を固定' } });
    expect(updateExerciseNote).toHaveBeenCalledWith('e1', 'バーの位置を固定');

    expect(within(container).queryByLabelText('本日のメモ')).toBeNull();
    fireEvent.click(within(container).getByRole('button', { name: '本日のメモを追加' }));
    const todayNote = within(container).getByLabelText('本日のメモ');
    fireEvent.change(todayNote, { target: { value: '肩に違和感あり' } });
    expect(updateWorkoutNote).toHaveBeenCalledWith('w1', '肩に違和感あり');
  });

  it('重量入力中の文字列を保ち、保存値は数値へ変換する', () => {
    const updateSet = vi.fn();
    const { container } = renderDetailScreen({ updateSet });
    const [weightInput] = detailNumberInputs(container);

    fireEvent.change(weightInput, { target: { value: '60.5' } });

    expect(weightInput.value).toBe('60.5');
    expect(updateSet).toHaveBeenLastCalledWith('s1', 'weight', 60.5);

    fireEvent.blur(weightInput);
    expect(weightInput.value).toBe('50');
  });

  it('空の回数入力は null として保存する', () => {
    const updateSet = vi.fn();
    const { container } = renderDetailScreen({ updateSet });
    const [, recordInput] = detailNumberInputs(container);

    fireEvent.change(recordInput, { target: { value: '' } });

    expect(recordInput.value).toBe('');
    expect(updateSet).toHaveBeenLastCalledWith('s1', 'recordValue', null);
  });

  it('lbs 入力は kg の保存値へ変換する', () => {
    const updateSet = vi.fn();
    const { container } = renderDetailScreen({ updateSet, weightUnit: 'lbs' });
    const [weightInput] = detailNumberInputs(container);

    fireEvent.change(weightInput, { target: { value: '220.462' } });

    expect(weightInput.value).toBe('220.462');
    expect(updateSet).toHaveBeenLastCalledWith('s1', 'weight', 100);
  });

  it('未判定のセットでは達成/未達ボタンを表示し、未達を記録できる', () => {
    const updateSetAchievement = vi.fn();
    const { container } = renderDetailScreen({ updateSetAchievement });

    const missedButton = within(container)
      .getAllByRole('button', { name: '未達' })
      .find((button) => !button.hasAttribute('disabled'));
    expect(missedButton).toBeTruthy();
    fireEvent.click(missedButton!);

    expect(updateSetAchievement).toHaveBeenCalledWith('s1', 'missed');
  });

  it('未達セットでは目標値と強度ピッカーを表示する', () => {
    const missedWorkout: Workout = {
      ...workout,
      sets: [
        { id: 's1', weight: 50, recordValue: 8, targetRecordValue: 10, achievement: 'missed' },
      ],
    };
    const { container } = renderDetailScreen({ currentWorkout: missedWorkout });

    expect(within(container).getByText('目標 10回')).toBeTruthy();
    expect(within(container).queryByRole('button', { name: 'きつい' })).not.toBeNull();
  });

  it('戻るアイコンで達成判定を取り消せる', () => {
    const resetSetAchievement = vi.fn();
    const achievedWorkout: Workout = {
      ...workout,
      sets: [{ id: 's1', weight: 50, recordValue: 10, achievement: 'achieved' }],
    };
    const { container } = renderDetailScreen({
      currentWorkout: achievedWorkout,
      resetSetAchievement,
    });

    fireEvent.click(within(container).getByRole('button', { name: '1セット目の達成判定を戻す' }));

    expect(resetSetAchievement).toHaveBeenCalledWith('s1');
  });

  it('前回記録を開くと最新の前回セットを表で表示する', () => {
    const previousWorkout: Workout = {
      ...workout,
      id: 'w0',
      date: '2026-07-01',
      sets: [{ id: 's0', weight: 45, recordValue: 12 }],
    };
    const { container } = renderDetailScreen({
      workouts: [previousWorkout, workout],
    });

    expect(within(container).queryByRole('table', { name: '前回記録のセット一覧' })).toBeNull();
    fireEvent.click(within(container).getByRole('button', { name: /前回記録/ }));

    const table = within(container).getByRole('table', { name: '前回記録のセット一覧' });
    expect(within(container).getByText('2026/07/01')).toBeTruthy();
    expect(
      within(table).getByText((_, element) => element?.textContent === '45.0 kg'),
    ).toBeTruthy();
    expect(within(table).getByText((_, element) => element?.textContent === '12 回')).toBeTruthy();
  });

  it('前回記録がない場合は開閉できない', () => {
    const { container } = renderDetailScreen({});
    const toggle = within(container).getByRole('button', { name: '前回記録' });

    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(toggle);

    expect(within(container).queryByRole('table', { name: '前回記録のセット一覧' })).toBeNull();
    expect(within(container).queryByText('前回記録はありません')).toBeNull();
  });

  it('コピーボタンで前回記録の重量と回数を今回セットに挿入する', () => {
    const copyWorkoutSetValues = vi.fn();
    const previousWorkout: Workout = {
      ...workout,
      id: 'w0',
      date: '2026-07-01',
      sets: [{ id: 's0', weight: 45, recordValue: 12 }],
    };
    const { container } = renderDetailScreen({
      copyWorkoutSetValues,
      workouts: [previousWorkout, workout],
    });

    fireEvent.click(within(container).getByRole('button', { name: /前回記録/ }));
    fireEvent.click(within(container).getByRole('button', { name: '前回記録をコピー' }));

    expect(copyWorkoutSetValues).toHaveBeenCalledWith('w1', previousWorkout.sets);
    const [weightInput, recordInput] = detailNumberInputs(container);
    expect(weightInput.value).toBe('45');
    expect(recordInput.value).toBe('12');
  });

  it('前回記録のセット数が多い場合もまとめてコピーする', () => {
    const copyWorkoutSetValues = vi.fn();
    const previousWorkout: Workout = {
      ...workout,
      id: 'w0',
      date: '2026-07-01',
      sets: [
        { id: 'p1', weight: 45, recordValue: 12 },
        { id: 'p2', weight: 40, recordValue: 10 },
      ],
    };
    const { container } = renderDetailScreen({
      copyWorkoutSetValues,
      workouts: [previousWorkout, workout],
    });

    fireEvent.click(within(container).getByRole('button', { name: /前回記録/ }));
    fireEvent.click(within(container).getByRole('button', { name: '前回記録をコピー' }));

    expect(copyWorkoutSetValues).toHaveBeenCalledWith('w1', previousWorkout.sets);
  });

  it('強度アイコンを押すとレストタイマー開始イベントを送る', () => {
    const achievedWorkout: Workout = {
      ...workout,
      sets: [{ id: 's1', weight: 50, recordValue: 10, achievement: 'achieved' }],
    };
    const onStartRestTimer = vi.fn();
    window.addEventListener(restTimerStartEvent, onStartRestTimer);
    const { container } = renderDetailScreen({ currentWorkout: achievedWorkout });

    fireEvent.click(within(container).getByRole('button', { name: 'きつい' }));
    window.removeEventListener(restTimerStartEvent, onStartRestTimer);

    expect(onStartRestTimer).toHaveBeenCalledTimes(1);
  });

  it('選択済みの強度アイコンを解除してもレストタイマー開始イベントを送らない', () => {
    const achievedWorkout: Workout = {
      ...workout,
      sets: [{ id: 's1', weight: 50, recordValue: 10, achievement: 'achieved', intensity: 3 }],
    };
    const onStartRestTimer = vi.fn();
    window.addEventListener(restTimerStartEvent, onStartRestTimer);
    const { container } = renderDetailScreen({ currentWorkout: achievedWorkout });

    fireEvent.click(within(container).getByRole('button', { name: 'きつい' }));
    window.removeEventListener(restTimerStartEvent, onStartRestTimer);

    expect(onStartRestTimer).not.toHaveBeenCalled();
  });

  it('設定がオフなら強度アイコンでレストタイマーを開始しない', () => {
    const achievedWorkout: Workout = {
      ...workout,
      sets: [{ id: 's1', weight: 50, recordValue: 10, achievement: 'achieved' }],
    };
    const onStartRestTimer = vi.fn();
    window.addEventListener(restTimerStartEvent, onStartRestTimer);
    const { container } = renderDetailScreen({
      currentWorkout: achievedWorkout,
      restTimerAutoStart: false,
    });

    fireEvent.click(within(container).getByRole('button', { name: 'きつい' }));
    window.removeEventListener(restTimerStartEvent, onStartRestTimer);

    expect(onStartRestTimer).not.toHaveBeenCalled();
  });
});
