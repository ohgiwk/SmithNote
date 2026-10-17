import { describe, expect, it } from 'vitest';
import {
  calculateWorkoutDurationMinutes,
  groupWorkoutPanels,
  interleaveWorkoutSets,
  calcRm,
  exerciseWeightStep,
  calendarCells,
  compactCalendarCells,
  formatStoredWeightInput,
  formatWorkoutDuration,
  formatWorkoutTime,
  formatWorkoutUsageTime,
  formatWeightForStorageInput,
  findExerciseGoalAchievementSet,
  isExerciseGoalAchieved,
  isMeaningfulSet,
  formatWeight,
  groupExercises,
  intensityOptions,
  isBlank,
  isRepsMeasurement,
  isUnstartedWorkout,
  localDate,
  measurementLabel,
  measurementUnit,
  newSet,
  nextMonthLabel,
  number,
  parseDate,
  prevMonthLabel,
  uid,
  workoutUsageElapsedSeconds,
} from './utils';
import { Exercise, Workout, WorkoutSet } from './types';

/**
 * 空セット5つを持つ未開始ワークアウトを作るテスト用ヘルパー
 */
function makeWorkout(sets: WorkoutSet[]): Workout {
  return {
    id: 'w1',
    exerciseId: 'e1',
    date: '2026-01-01',
    name: 'ベンチプレス',
    part: '胸',
    measurementType: 'reps',
    sets,
    note: '',
    usageElapsedSeconds: 0,
  };
}

describe('calcRm', () => {
  it('重量か回数が0なら 0.0 を返す', () => {
    expect(calcRm(0, 10)).toBe('0.0');
    expect(calcRm(100, 0)).toBe('0.0');
  });

  it('回数が3より大きいと小数第1位で計算する', () => {
    expect(calcRm(100, 10)).toBe('133.3');
  });

  it('回数が3以下のときは小数第2位で計算する', () => {
    expect(calcRm(100, 3)).toBe('110.00');
    expect(calcRm(100, 1)).toBe('103.33');
  });
});

describe('number', () => {
  it('数値化できる文字列を数値へ変換する', () => {
    expect(number('12')).toBe(12);
    expect(number('3.5')).toBe(3.5);
  });

  it('数値化できない場合は 0 を返す', () => {
    expect(number('abc')).toBe(0);
    expect(number('')).toBe(0);
  });

  it('数値はそのまま返す', () => {
    expect(number(7)).toBe(7);
  });
});

describe('workout usage timer', () => {
  it('保存済み秒数と開始後の実時間を合算する', () => {
    const workout = {
      ...makeWorkout([]),
      usageElapsedSeconds: 30,
      usageStartedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(workoutUsageElapsedSeconds(workout, Date.parse('2026-01-01T00:01:05.000Z'))).toBe(95);
  });

  it('1時間未満と1時間以上を読みやすく整形する', () => {
    expect(formatWorkoutUsageTime(522)).toBe('8:42');
    expect(formatWorkoutUsageTime(4122)).toBe('1:08:42');
  });
});

describe('isBlank', () => {
  it('空文字や空白のみは true', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
  });

  it('値があれば false', () => {
    expect(isBlank('0')).toBe(false);
    expect(isBlank(0)).toBe(false);
    expect(isBlank('5')).toBe(false);
  });
});

describe('isExerciseGoalAchieved', () => {
  it('重量と回数の両方が目標以上のセットがあれば true', () => {
    expect(
      isExerciseGoalAchieved([{ id: 's1', weight: 82.5, recordValue: 10 }], {
        weight: 80,
        recordValue: 10,
      }),
    ).toBe(true);
  });

  it('条件が別々のセットに分かれている場合は false', () => {
    expect(
      isExerciseGoalAchieved(
        [
          { id: 's1', weight: 82.5, recordValue: 8 },
          { id: 's2', weight: 75, recordValue: 10 },
        ],
        { weight: 80, recordValue: 10 },
      ),
    ).toBe(false);
  });

  it('未入力の値は 0 の目標でも達成扱いにしない', () => {
    expect(
      isExerciseGoalAchieved([{ id: 's1', weight: null, recordValue: 30 }], {
        weight: 0,
        recordValue: 30,
      }),
    ).toBe(false);
  });
});

describe('findExerciseGoalAchievementSet', () => {
  it('目標を最も上回る重量のセットを返す', () => {
    const sets = [
      { id: 's1', weight: 80, recordValue: 8 },
      { id: 's2', weight: 82.5, recordValue: 10 },
      { id: 's3', weight: 85, recordValue: 12 },
    ];
    expect(findExerciseGoalAchievementSet(sets, { weight: 80, recordValue: 10 })).toEqual(sets[2]);
  });

  it('重量が同じなら回数・秒数が最も多いセットを返す', () => {
    const sets = [
      { id: 's1', weight: 82.5, recordValue: 10 },
      { id: 's2', weight: 82.5, recordValue: 12 },
    ];
    expect(findExerciseGoalAchievementSet(sets, { weight: 80, recordValue: 10 })).toEqual(sets[1]);
  });

  it('目標を満たすセットがなければ undefined', () => {
    expect(
      findExerciseGoalAchievementSet([{ id: 's1', weight: 80, recordValue: 8 }], {
        weight: 80,
        recordValue: 10,
      }),
    ).toBeUndefined();
  });
});

describe('formatWeight', () => {
  it('小数第1位の文字列にする', () => {
    expect(formatWeight('60')).toBe('60.0');
    expect(formatWeight(2.5)).toBe('2.5');
    expect(formatWeight('abc')).toBe('0.0');
  });

  it('lbs 指定では kg から lbs へ換算する', () => {
    expect(formatWeight(100, 'lbs')).toBe('220.5');
  });
});

describe('formatWeightForStorageInput', () => {
  it('kg 入力は入力中の文字列を保つ', () => {
    expect(formatStoredWeightInput(60, 'kg')).toBe('60');
    expect(formatWeightForStorageInput('60.', 'kg')).toBe(60);
  });

  it('lbs 入力を kg 保存値へ換算する', () => {
    expect(formatWeightForStorageInput('220.462', 'lbs')).toBe(100);
  });

  it('空入力は空文字のまま扱う', () => {
    expect(formatWeightForStorageInput('', 'lbs')).toBeNull();
  });
});

describe('measurement helpers', () => {
  it('単位を返す', () => {
    expect(measurementUnit('seconds')).toBe('秒');
    expect(measurementUnit('reps')).toBe('回');
  });

  it('ラベルを返す', () => {
    expect(measurementLabel('seconds')).toBe('秒数');
    expect(measurementLabel('reps')).toBe('回数');
  });

  it('reps 判定を返す', () => {
    expect(isRepsMeasurement('reps')).toBe(true);
    expect(isRepsMeasurement('seconds')).toBe(false);
  });
});

describe('isUnstartedWorkout', () => {
  it('空のセット5つなら未開始とみなす', () => {
    const workout = makeWorkout(Array.from({ length: 5 }, () => newSet()));
    expect(isUnstartedWorkout(workout)).toBe(true);
  });

  it('いずれかに記録があれば未開始ではない', () => {
    const sets = Array.from({ length: 5 }, () => newSet());
    sets[0] = { ...sets[0], weight: 60, recordValue: 10 };
    expect(isUnstartedWorkout(makeWorkout(sets))).toBe(false);
  });

  it('セット数が5以外でも記録がなければ未開始とみなす', () => {
    const sets = Array.from({ length: 4 }, () => newSet());
    expect(isUnstartedWorkout(makeWorkout(sets))).toBe(true);
  });

  it('強度・メモ・握りがあれば未開始ではない', () => {
    expect(isUnstartedWorkout(makeWorkout([{ ...newSet(), intensity: 3 }]))).toBe(false);
    expect(isUnstartedWorkout({ ...makeWorkout([newSet()]), note: 'フォーム確認' })).toBe(false);
    expect(isUnstartedWorkout({ ...makeWorkout([newSet()]), grip: 'normal' })).toBe(false);
  });
});

describe('isMeaningfulSet', () => {
  it('重量・回数・強度のいずれかがあれば意味のあるセットとみなす', () => {
    expect(isMeaningfulSet(newSet())).toBe(false);
    expect(isMeaningfulSet({ ...newSet(), weight: 20 })).toBe(true);
    expect(isMeaningfulSet({ ...newSet(), recordValue: 12 })).toBe(true);
    expect(isMeaningfulSet({ ...newSet(), intensity: 4 })).toBe(true);
  });
});

describe('トレーニング時間', () => {
  it('同日内の経過分数を計算する', () => {
    expect(calculateWorkoutDurationMinutes('09:30', '11:05')).toBe(95);
  });

  it('日付をまたぐ経過分数を計算する', () => {
    expect(calculateWorkoutDurationMinutes('23:50', '00:20')).toBe(30);
  });

  it('分数を読みやすい時間表記にする', () => {
    expect(formatWorkoutDuration(45)).toBe('45分');
    expect(formatWorkoutDuration(60)).toBe('1時間');
    expect(formatWorkoutDuration(95)).toBe('1時間35分');
  });

  it('開始・終了時刻を日本語の時分表記にする', () => {
    expect(formatWorkoutTime('09:05')).toBe('09時05分');
    expect(formatWorkoutTime('23:40')).toBe('23時40分');
  });
});

describe('localDate / parseDate', () => {
  it('Date を YYYY-MM-DD 形式へ変換する', () => {
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('文字列からローカル日付を作る', () => {
    const date = parseDate('2026-01-05');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(5);
  });

  it('localDate と parseDate は往復する', () => {
    expect(localDate(parseDate('2026-06-11'))).toBe('2026-06-11');
  });
});

describe('calendarCells', () => {
  it('常に42セルを返す', () => {
    expect(calendarCells(2026, 0)).toHaveLength(42);
  });

  it('先頭は前月分から始まり、当月の1日を含む', () => {
    const cells = calendarCells(2026, 0);
    expect(cells[0].date).toBe('2025-12-28');
    expect(cells[0].inMonth).toBe(false);
    const firstOfMonth = cells.find((cell) => cell.date === '2026-01-01');
    expect(firstOfMonth?.inMonth).toBe(true);
    expect(firstOfMonth?.day).toBe(1);
  });
});

describe('compactCalendarCells', () => {
  it('月に必要な週だけを返す', () => {
    expect(compactCalendarCells(2026, 1)).toHaveLength(28);
    expect(compactCalendarCells(2026, 0)).toHaveLength(35);
    expect(compactCalendarCells(2026, 4)).toHaveLength(42);
  });
});

describe('month labels', () => {
  it('前月ラベルを返す', () => {
    expect(prevMonthLabel(2026, 0)).toBe('12月');
    expect(prevMonthLabel(2026, 5)).toBe('05月');
  });

  it('翌月ラベルを返す', () => {
    expect(nextMonthLabel(2026, 0)).toBe('02月');
    expect(nextMonthLabel(2026, 11)).toBe('01月');
  });
});

describe('groupExercises', () => {
  it('部位ごとにまとめる', () => {
    const exercises: Exercise[] = [
      { id: '1', part: '胸', name: 'ベンチプレス', measurementType: 'reps', category: 'free' },
      {
        id: '2',
        part: '背中',
        name: 'ラットプルダウン',
        measurementType: 'reps',
        category: 'machine',
      },
      {
        id: '3',
        part: '胸',
        name: 'ダンベルフライ',
        measurementType: 'reps',
        category: 'dumbbell',
      },
    ];
    const grouped = groupExercises(exercises);
    expect([...grouped.keys()]).toEqual(['胸', '背中']);
    expect(grouped.get('胸')).toHaveLength(2);
    expect(grouped.get('背中')).toHaveLength(1);
  });
});

describe('newSet', () => {
  it('空のセットを作る', () => {
    const set = newSet();
    expect(set.weight).toBeNull();
    expect(set.recordValue).toBeNull();
    expect(typeof set.id).toBe('string');
    expect(set.id.length).toBeGreaterThan(0);
  });
});

describe('uid', () => {
  it('呼び出すたびに異なる文字列を返す', () => {
    expect(uid()).not.toBe(uid());
  });
});

describe('intensityOptions', () => {
  it('5段階の強度を持つ', () => {
    expect(intensityOptions).toHaveLength(5);
    expect(intensityOptions.map((option) => option.value)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('種目別の重量増減幅', () => {
  const current = { ...makeWorkout([]), date: '2026-10-17' };
  function history(weights: number[], overrides: Partial<Workout> = {}): Workout {
    return {
      ...makeWorkout(
        weights.map((weight, index) => ({ id: String(index), weight, recordValue: 10 })),
      ),
      date: '2026-10-16',
      ...overrides,
    };
  }
  it('過去記録の最小差を採用し、別種目・当日・未来の重量を除く', () => {
    expect(
      exerciseWeightStep(
        [
          history([40, 42.5, 45, 45]),
          history([1, 1.5], { exerciseId: 'other' }),
          history([1, 1.2], { date: current.date }),
          history([1, 1.1], { date: '2026-10-18' }),
        ],
        current,
        'kg',
      ),
    ).toBe(2.5);
  });
  it('履歴なし・同じ重量だけの場合は従来の幅を使う', () => {
    expect(exerciseWeightStep([], current, 'kg')).toBe(0.5);
    expect(exerciseWeightStep([history([40, 40])], current, 'lbs')).toBe(1);
  });
  it('Lbsに換算した表示重量から差を求める', () => {
    expect(exerciseWeightStep([history([50 / 2.20462, 55 / 2.20462])], current, 'lbs')).toBe(5);
  });
  it('直近10回にない古い重量差は採用しない', () => {
    const recent = Array.from({ length: 10 }, (_, index) =>
      history([40, 45], { date: `2026-10-${String(index + 1).padStart(2, '0')}` }),
    );
    expect(
      exerciseWeightStep([...recent, history([40, 40.5], { date: '2026-09-01' })], current, 'kg'),
    ).toBe(5);
  });
});

describe('マルチセットの並び順', () => {
  it('異なるセット数をラウンドごとに交互に並べる', () => {
    const a = makeWorkout([
      { id: 'a1', weight: null, recordValue: null },
      { id: 'a2', weight: null, recordValue: null },
    ]);
    const b = { ...makeWorkout([{ id: 'b1', weight: null, recordValue: null }]), id: 'w2' };
    expect(interleaveWorkoutSets([a, b]).map((row) => row.set.id)).toEqual(['a1', 'b1', 'a2']);
    expect(interleaveWorkoutSets([])).toEqual([]);
  });
});

describe('ホームのグループパネル', () => {
  it('同日・同グループを1つにまとめ、最初の位置と種目の選択順を維持する', () => {
    const a = { ...makeWorkout([]), id: 'a', multiSetGroupId: 'g1', multiSetOrder: 1 };
    const b = { ...a, id: 'b', multiSetOrder: 0 };
    const single = { ...makeWorkout([]), id: 'single' };
    const otherDay = { ...a, id: 'otherDay', date: '2026-10-17' };
    expect(
      groupWorkoutPanels([a, single, b, otherDay]).map((members) => members.map((item) => item.id)),
    ).toEqual([['b', 'a'], ['single'], ['otherDay']]);
    expect(groupWorkoutPanels([])).toEqual([]);
  });
});
