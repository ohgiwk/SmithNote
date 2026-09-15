import { beforeEach, describe, expect, it } from 'vitest';
import {
  corruptStoreKey,
  loadState,
  normalizeState,
  parseImportedState,
  storeKey,
} from './storage';
import { deviceIdKey, getDeviceId } from './device';
import { starterCatalogVersion, starterExercises } from './data/starterExercises';
import { stateSchemaVersion } from './storageNormalization';
import { State } from './types';

/**
 * テスト用に最小限の正しい保存データを作る
 */
function makeValidSaved() {
  return {
    exercises: [{ id: 'e1', part: '胸', name: 'ベンチプレス', measurementType: 'reps' }],
    workouts: [],
    workoutStartTimes: {},
    workoutEndTimes: {},
    presets: [],
    trainingDays: [],
    trainingPlans: [],
    catalogVersion: starterCatalogVersion,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('loadState', () => {
  it('保存データが無ければ初期状態を返す(復旧扱いにしない)', () => {
    const result = loadState();
    expect(result.recoveredFromCorruption).toBe(false);
    expect(result.state.exercises.length).toBeGreaterThan(0);
    expect(result.state.workouts).toEqual([]);
  });

  it("'null' が保存されていても初期状態を返す", () => {
    localStorage.setItem(storeKey, 'null');
    const result = loadState();
    expect(result.recoveredFromCorruption).toBe(false);
    expect(result.state.workouts).toEqual([]);
  });

  it('正しい保存データはそのまま読み込む', () => {
    localStorage.setItem(storeKey, JSON.stringify(makeValidSaved()));
    const result = loadState();
    expect(result.recoveredFromCorruption).toBe(false);
    expect(result.state.schemaVersion).toBe(stateSchemaVersion);
    expect(result.state.exercises).toHaveLength(1);
    expect(result.state.exercises[0].name).toBe('ベンチプレス');
  });

  it('壊れた JSON はデータを消さず退避し、初期状態へ復帰する', () => {
    localStorage.setItem(storeKey, '{broken');
    const result = loadState();
    expect(result.recoveredFromCorruption).toBe(true);
    expect(result.state.exercises.length).toBeGreaterThan(0);
    expect(localStorage.getItem(corruptStoreKey)).toBe('{broken');
    expect(localStorage.getItem(storeKey)).toBe('{broken');
  });

  it('必須フィールドを欠く JSON も退避して復帰する', () => {
    localStorage.setItem(storeKey, JSON.stringify({ foo: 1 }));
    const result = loadState();
    expect(result.recoveredFromCorruption).toBe(true);
    expect(localStorage.getItem(corruptStoreKey)).toBe(JSON.stringify({ foo: 1 }));
  });
});

describe('normalizeState', () => {
  it('null や空オブジェクトは null を返す', () => {
    expect(normalizeState(null)).toBeNull();
    expect(normalizeState({})).toBeNull();
  });

  it('schemaVersion が無い旧データには現在のバージョンを補完する', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.schemaVersion).toBe(stateSchemaVersion);
  });

  it('旧形式の最新ワークアウトメモを種目メモへ移し、日別メモを空にする', () => {
    const saved = {
      ...makeValidSaved(),
      schemaVersion: 2,
      workouts: [
        {
          id: 'w1',
          exerciseId: 'e1',
          date: '2026-01-01',
          name: 'ベンチプレス',
          part: '胸',
          measurementType: 'reps',
          sets: [],
          note: '古いメモ',
        },
        {
          id: 'w2',
          exerciseId: 'e1',
          date: '2026-02-01',
          name: 'ベンチプレス',
          part: '胸',
          measurementType: 'reps',
          sets: [],
          note: '最新のメモ',
        },
      ],
    };
    const result = normalizeState(saved as unknown as Partial<State>);

    expect(result?.exercises[0].note).toBe('最新のメモ');
    expect(result?.workouts.map((workout) => workout.note)).toEqual(['', '']);
  });

  it('実施時間が無い旧ワークアウトは0秒として読み込む', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.workouts.every((workout) => workout.usageElapsedSeconds === 0)).toBe(true);
  });

  it('updatedAt が無い旧データには既定日時を補完する', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('非表示部位を trim と重複排除で保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      hiddenParts: [' 胸 ', 'レスト', '', '胸', '背中'],
    } as unknown as Partial<State>);

    expect(result?.hiddenParts).toEqual(['胸', '背中']);
  });

  it('reps を recordValue へ移行する', () => {
    const saved = {
      exercises: [{ id: 'e1', part: '胸', name: 'ベンチ', measurementType: 'reps' }],
      workouts: [
        {
          id: 'w1',
          exerciseId: 'e1',
          date: '2026-01-01',
          name: 'ベンチ',
          part: '胸',
          measurementType: 'reps',
          sets: [{ id: 's1', weight: 50, reps: 10, intensity: 9 }],
        },
      ],
      catalogVersion: starterCatalogVersion,
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.workouts[0].sets[0].recordValue).toBe(10);
  });

  it('不正な強度は undefined にする', () => {
    const saved = {
      exercises: [{ id: 'e1', part: '胸', name: 'ベンチ', measurementType: 'reps' }],
      workouts: [
        {
          id: 'w1',
          exerciseId: 'e1',
          date: '2026-01-01',
          name: 'ベンチ',
          part: '胸',
          measurementType: 'reps',
          sets: [{ id: 's1', weight: 50, recordValue: 10, intensity: 9 }],
        },
      ],
      catalogVersion: starterCatalogVersion,
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.workouts[0].sets[0].intensity).toBeUndefined();
  });

  it('種目の候補と種目記録の握り設定を正規化する', () => {
    const saved = {
      ...makeValidSaved(),
      exercises: [
        {
          id: 'e1',
          part: '背中',
          name: 'ラットプルダウン',
          measurementType: 'reps',
          availableGrips: ['normal', 'parallel', 'alternate', 'normal', 'invalid'],
          availableGripStyles: ['thumbAround', 'hook', 'thumbAround', 'invalid'],
        },
      ],
      workouts: [
        {
          id: 'w1',
          exerciseId: 'e1',
          date: '2026-06-21',
          name: 'ラットプルダウン',
          part: '背中',
          measurementType: 'reps',
          grip: 'parallel',
          gripStyle: 'hook',
          sets: [
            { id: 's1', weight: 50, recordValue: 10 },
            { id: 's2', weight: 45, recordValue: 10 },
          ],
        },
      ],
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.exercises[0].availableGrips).toEqual(['normal', 'parallel', 'alternate']);
    expect(result?.exercises[0].availableGripStyles).toEqual(['thumbAround', 'hook']);
    expect(result?.workouts[0].grip).toBe('parallel');
    expect(result?.workouts[0].gripStyle).toBe('hook');
    expect(result?.workouts[0].sets[0]).not.toHaveProperty('grip');
    expect(result?.workouts[0].sets[0]).not.toHaveProperty('gripStyle');
  });

  it('旧セット単位の握り設定は種目記録へ移行しない', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      workouts: [
        {
          id: 'w1',
          exerciseId: 'e1',
          date: '2026-06-21',
          name: 'ベンチプレス',
          part: '胸',
          measurementType: 'reps',
          sets: [
            {
              id: 's1',
              weight: 50,
              recordValue: 10,
              grip: 'reverse',
              gripStyle: 'thumbLess',
            },
            {
              id: 's2',
              weight: 45,
              recordValue: 10,
              grip: 'parallel',
              gripStyle: 'hook',
            },
          ],
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.workouts[0].grip).toBeUndefined();
    expect(result?.workouts[0].gripStyle).toBeUndefined();
    expect(result?.workouts[0].sets[0]).not.toHaveProperty('grip');
    expect(result?.workouts[0].sets[0]).not.toHaveProperty('gripStyle');
  });

  it('グリップ設定がない旧データは全候補を有効にして読み込む', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.exercises[0].availableGrips).toEqual([
      'normal',
      'reverse',
      'parallel',
      'alternate',
    ]);
  });

  it('catalogVersion 4 未満のグリップ候補は全て有効に移行する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      catalogVersion: 3,
      exercises: [
        {
          id: 'e1',
          part: '胸',
          name: 'ベンチプレス',
          measurementType: 'reps',
          availableGrips: ['normal'],
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.exercises[0].availableGrips).toEqual([
      'normal',
      'reverse',
      'parallel',
      'alternate',
    ]);
  });

  it('catalogVersion 5 未満の握り方候補は全て有効に移行する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      catalogVersion: 4,
      exercises: [
        {
          id: 'e1',
          part: '胸',
          name: 'ベンチプレス',
          measurementType: 'reps',
          availableGripStyles: ['hook'],
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.exercises[0].availableGripStyles).toEqual([
      'thumbAround',
      'thumbLess',
      'thumbUp',
      'hook',
    ]);
  });

  it('現行の日別メモを保持し、旧セットメモは破棄する', () => {
    const saved = {
      schemaVersion: stateSchemaVersion,
      exercises: [{ id: 'e1', part: '胸', name: 'ベンチ', measurementType: 'reps' }],
      workouts: [
        {
          id: 'w1',
          exerciseId: 'e1',
          date: '2026-01-01',
          name: 'ベンチ',
          part: '胸',
          measurementType: 'reps',
          note: 'フォームを意識',
          sets: [{ id: 's1', weight: 50, recordValue: 10, note: '旧セットメモ' }],
        },
      ],
      catalogVersion: starterCatalogVersion,
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.workouts[0].note).toBe('フォームを意識');
    expect(result?.workouts[0].sets[0]).not.toHaveProperty('note');
  });

  it('trainingDays の part を parts へ移行する', () => {
    const saved = {
      exercises: [{ id: 'e1', part: '胸', name: 'ベンチ', measurementType: 'reps' }],
      workouts: [],
      trainingDays: [{ date: '2026-01-01', part: '胸' }],
      catalogVersion: starterCatalogVersion,
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.trainingDays[0]).toEqual({ date: '2026-01-01', parts: ['胸'] });
  });

  it('開始時刻を日付ごとに正規化する', () => {
    const saved = {
      exercises: [{ id: 'e1', part: '胸', name: 'ベンチ', measurementType: 'reps' }],
      workouts: [],
      workoutStartTimes: {
        '2026-01-01': '09:30',
        '2026-01-02': '9:30',
        broken: 123,
      },
      catalogVersion: starterCatalogVersion,
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.workoutStartTimes).toEqual({ '2026-01-01': '09:30' });
  });

  it('終了時刻を日付ごとに正規化する', () => {
    const saved = {
      ...makeValidSaved(),
      workoutEndTimes: {
        '2026-01-01': '10:45',
        '2026-01-02': '10:5',
        broken: null,
      },
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.workoutEndTimes).toEqual({ '2026-01-01': '10:45' });
  });

  it('catalogVersion は常に最新へ更新される', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.catalogVersion).toBe(starterCatalogVersion);
  });

  it('単位設定が無い保存データは kg として読み込む', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.weightUnit).toBe('kg');
  });

  it('単位設定が lbs なら保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      weightUnit: 'lbs',
    } as unknown as Partial<State>);
    expect(result?.weightUnit).toBe('lbs');
  });

  it('外観設定が無い保存データはダークモードとして読み込む', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.themeMode).toBe('dark');
  });

  it('外観設定が light なら保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      themeMode: 'light',
    } as unknown as Partial<State>);
    expect(result?.themeMode).toBe('light');
  });

  it('通知設定が無い保存データは通知オフとして読み込む', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.notificationSettings).toEqual({ enabled: false });
  });

  it('通知設定が有効なら保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      notificationSettings: { enabled: true },
    } as unknown as Partial<State>);
    expect(result?.notificationSettings).toEqual({ enabled: true });
  });

  it('不正な通知設定は通知オフとして読み込む', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      notificationSettings: { enabled: 'yes' },
    } as unknown as Partial<State>);
    expect(result?.notificationSettings).toEqual({ enabled: false });
  });

  it('レストタイマー設定が無い保存データは強度入力時の自動開始をオンにする', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.restTimerSettings).toEqual({
      autoStartOnIntensity: true,
      defaultSeconds: 60,
      alertVolume: 100,
    });
  });

  it('レストタイマーの自動開始オフ設定を保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      restTimerSettings: { autoStartOnIntensity: false, defaultSeconds: 90, alertVolume: 35 },
    } as unknown as Partial<State>);
    expect(result?.restTimerSettings).toEqual({
      autoStartOnIntensity: false,
      defaultSeconds: 90,
      alertVolume: 35,
    });
  });

  it('不正なレストタイマー秒数は60秒として読み込む', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      restTimerSettings: { autoStartOnIntensity: true, defaultSeconds: 'many' },
    } as unknown as Partial<State>);
    expect(result?.restTimerSettings).toEqual({
      autoStartOnIntensity: true,
      defaultSeconds: 60,
      alertVolume: 100,
    });
  });

  it('プリセットのスケジュールを正規化して保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      presets: [
        {
          id: 'preset-1',
          name: '上半身',
          exerciseIds: ['e1'],
          schedule: {
            mode: 'weekly',
            weekdays: [6, 1, 6, 9],
            intervalDays: 8,
            startDate: '2026-06-20',
          },
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.presets[0].schedule).toEqual({
      mode: 'weekly',
      weekdays: [1, 6],
      intervalDays: 1,
      startDate: '2026-06-20',
    });
  });

  it('種目目標を正規化して保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      exercises: [
        {
          id: 'e1',
          part: '胸',
          name: 'ベンチプレス',
          measurementType: 'reps',
          goal: { weight: '80', recordValue: '10' },
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.exercises[0].goal).toEqual({ weight: 80, recordValue: 10 });
  });

  it('不正な種目目標は破棄する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      exercises: [
        {
          id: 'e1',
          part: '胸',
          name: 'ベンチプレス',
          measurementType: 'reps',
          goal: { weight: -1, recordValue: 0 },
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.exercises[0].goal).toBeUndefined();
  });

  it('目標達成記録を正規化して保持する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      goalAchievements: [
        {
          id: 'a1',
          exerciseId: 'e1',
          exerciseName: 'ベンチプレス',
          measurementType: 'reps',
          date: '2026-06-18',
          weight: '82.5',
          recordValue: '10',
          goalWeight: '80',
          goalRecordValue: '10',
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.goalAchievements).toEqual([
      {
        id: 'a1',
        exerciseId: 'e1',
        exerciseName: 'ベンチプレス',
        measurementType: 'reps',
        date: '2026-06-18',
        weight: 82.5,
        recordValue: 10,
        goalWeight: 80,
        goalRecordValue: 10,
      },
    ]);
  });

  it('目標達成記録がない旧データは空配列として読み込む', () => {
    const result = normalizeState(makeValidSaved() as unknown as Partial<State>);
    expect(result?.goalAchievements).toEqual([]);
  });

  it('不正な目標達成記録は破棄する', () => {
    const result = normalizeState({
      ...makeValidSaved(),
      goalAchievements: [
        {
          id: 'a1',
          exerciseId: 'e1',
          exerciseName: 'ベンチプレス',
          date: '2026-06-18',
          weight: 80,
          recordValue: 0,
          goalWeight: 80,
          goalRecordValue: 10,
        },
      ],
    } as unknown as Partial<State>);
    expect(result?.goalAchievements).toEqual([]);
  });

  it('古い catalogVersion では初期種目を補完する', () => {
    const saved = {
      exercises: [{ id: 'custom', part: 'カスタム', name: '独自種目', measurementType: 'reps' }],
      workouts: [],
      catalogVersion: 1,
    };
    const result = normalizeState(saved as unknown as Partial<State>);
    expect(result?.exercises).toHaveLength(1 + starterExercises.length);
  });
});

describe('parseImportedState', () => {
  it('正しい JSON 文字列を State へ変換する', () => {
    const result = parseImportedState(JSON.stringify(makeValidSaved()));
    expect(result).not.toBeNull();
    expect(result?.exercises).toHaveLength(1);
  });

  it('必須フィールドが無い JSON は null を返す', () => {
    expect(parseImportedState('{}')).toBeNull();
  });
});

describe('getDeviceId', () => {
  it('端末IDを作成して localStorage に保持する', () => {
    const first = getDeviceId();
    const second = getDeviceId();
    expect(first).toBe(second);
    expect(localStorage.getItem(deviceIdKey)).toBe(first);
  });
});
