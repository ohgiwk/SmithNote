import { describe, expect, it } from 'vitest';
import {
  createWorkout,
  buildExerciseCounts,
  buildExerciseGrowthSeries,
  buildExerciseBestRecords,
  buildOrderedParts,
  buildPartCounts,
  buildWeeklyVolumeSeries,
  buildVisibleHistory,
  plannedPartsForDate,
  scheduledPresetsForDate,
} from './smithNoteSelectors';
import { Preset, TrainingPlan, Workout } from '../types';

const workout: Workout = {
  id: 'w1',
  exerciseId: 'e1',
  date: '2026-06-20',
  name: 'ベンチプレス',
  part: '胸',
  measurementType: 'reps',
  sets: [],
  note: '',
  usageElapsedSeconds: 0,
};

const plans: TrainingPlan[] = [
  {
    id: 'p1',
    part: '胸',
    mode: 'weekly',
    weekdays: [6],
    intervalDays: 1,
    startDate: '',
  },
  {
    id: 'p2',
    part: '脚',
    mode: 'interval',
    weekdays: [],
    intervalDays: 3,
    startDate: '2026-06-20',
  },
];

const presets: Preset[] = [
  {
    id: 'preset-1',
    name: '上半身',
    exerciseIds: [],
    schedule: {
      mode: 'weekly',
      weekdays: [6],
      intervalDays: 1,
      startDate: '',
    },
  },
  {
    id: 'preset-2',
    name: '下半身',
    exerciseIds: [],
    schedule: {
      mode: 'interval',
      weekdays: [],
      intervalDays: 3,
      startDate: '2026-06-20',
    },
  },
];

describe('history selectors', () => {
  it('履歴を日付ごとにまとめて部位で絞り込む', () => {
    const result = buildVisibleHistory([workout], [{ date: '2026-06-19', parts: ['背中'] }], '胸');
    expect(result).toEqual([
      {
        date: '2026-06-20',
        parts: ['胸'],
        workoutNames: ['ベンチプレス'],
      },
    ]);
  });

  it('曜日指定と間隔指定の予定をまとめる', () => {
    expect(plannedPartsForDate('2026-06-20', plans)).toEqual(['胸', '脚']);
    expect(plannedPartsForDate('2026-06-23', plans)).toEqual(['脚']);
  });

  it('曜日指定と間隔指定に一致するプリセットを一覧順で返す', () => {
    expect(scheduledPresetsForDate('2026-06-20', presets).map((preset) => preset.id)).toEqual([
      'preset-1',
      'preset-2',
    ]);
    expect(scheduledPresetsForDate('2026-06-23', presets).map((preset) => preset.id)).toEqual([
      'preset-2',
    ]);
  });
});

describe('part selectors', () => {
  it('非表示部位は過去記録や予定に残っていても表示部位へ復活させない', () => {
    const result = buildOrderedParts(
      [{ name: '胸', color: '#111111' }],
      [],
      [{ ...workout, part: '背中' }],
      [{ date: '2026-06-21', parts: ['背中'] }],
      [{ ...plans[0], id: 'p-hidden', part: '背中' }],
      ['背中'],
    );

    expect(result.map((part) => part.name)).toEqual(['胸']);
  });
});

describe('analysis selectors', () => {
  it('reps 種目の総ボリュームを週ごとに集計する', () => {
    const result = buildWeeklyVolumeSeries([
      {
        ...workout,
        id: 'w1',
        date: '2026-06-20',
        sets: [{ id: 's1', weight: 60, recordValue: 10 }],
      },
      {
        ...workout,
        id: 'w2',
        date: '2026-06-21',
        sets: [{ id: 's2', weight: 50, recordValue: 8 }],
      },
      {
        ...workout,
        id: 'w3',
        date: '2026-06-22',
        sets: [{ id: 's3', weight: 70, recordValue: 5 }],
      },
      {
        ...workout,
        id: 'w4',
        measurementType: 'seconds',
        sets: [{ id: 's4', weight: 10, recordValue: 60 }],
      },
      {
        ...workout,
        id: 'w5',
        date: '2026-06-23',
        sets: [{ id: 's5', weight: null, recordValue: null }],
      },
    ]);

    expect(result).toEqual([
      { weekStart: '2026-06-15', weekEnd: '2026-06-21', value: 1000 },
      { weekStart: '2026-06-22', weekEnd: '2026-06-28', value: 350 },
    ]);
  });

  it('種目ごとの自己ベストを集計する', () => {
    const result = buildExerciseBestRecords([
      {
        ...workout,
        id: 'w1',
        date: '2026-06-20',
        sets: [
          { id: 's1', weight: 60, recordValue: 10 },
          { id: 's2', weight: 70, recordValue: 5 },
        ],
      },
      {
        ...workout,
        id: 'w2',
        date: '2026-06-22',
        sets: [{ id: 's3', weight: 72.5, recordValue: 6 }],
      },
      {
        ...workout,
        id: 'w3',
        exerciseId: 'e2',
        date: '2026-06-21',
        name: 'プランク',
        part: '体幹',
        measurementType: 'seconds',
        sets: [
          { id: 's4', weight: null, recordValue: 45 },
          { id: 's5', weight: null, recordValue: 60 },
        ],
      },
      {
        ...workout,
        id: 'w4',
        exerciseId: 'e2',
        date: '2026-06-23',
        name: 'プランク',
        part: '体幹',
        measurementType: 'seconds',
        sets: [{ id: 's6', weight: null, recordValue: 90 }],
      },
    ]);

    expect(result).toEqual([
      {
        exerciseId: 'e1',
        part: '胸',
        name: 'ベンチプレス',
        measurementType: 'reps',
        date: '2026-06-22',
        mainLabel: 'MAX 1RM',
        mainValue: 87,
        subRecords: [
          { label: '最大重量', value: 72.5, unit: 'weight' },
          { label: '最大回数', value: 10, unit: 'count' },
          { label: '最大負荷量', value: 950, unit: 'weight' },
        ],
      },
      {
        exerciseId: 'e2',
        part: '体幹',
        name: 'プランク',
        measurementType: 'seconds',
        date: '2026-06-23',
        mainLabel: '最長記録',
        mainValue: 90,
        subRecords: [
          { label: '最大重量', value: 0, unit: 'weight' },
          { label: '最大合計秒数', value: 105, unit: 'seconds' },
        ],
      },
    ]);
  });

  it('種目ごとの成長推移を日付順にまとめる', () => {
    const result = buildExerciseGrowthSeries([
      {
        ...workout,
        id: 'w2',
        date: '2026-06-22',
        sets: [{ id: 's2', weight: 70, recordValue: 8 }],
      },
      {
        ...workout,
        id: 'w1',
        date: '2026-06-20',
        sets: [{ id: 's1', weight: 60, recordValue: 10 }],
      },
      {
        ...workout,
        id: 'w3',
        date: '2026-06-22',
        sets: [{ id: 's3', weight: 72.5, recordValue: 6 }],
      },
      {
        ...workout,
        id: 'w4',
        exerciseId: 'e2',
        date: '2026-06-22',
        name: 'プランク',
        part: '体幹',
        measurementType: 'seconds',
        sets: [{ id: 's4', weight: null, recordValue: 60 }],
      },
    ]);

    expect(result).toEqual([
      {
        exerciseId: 'e1',
        part: '胸',
        name: 'ベンチプレス',
        measurementType: 'reps',
        metric: 'rm',
        points: [
          { date: '2026-06-20', value: 80 },
          { date: '2026-06-22', value: 88.7 },
        ],
      },
      {
        exerciseId: 'e2',
        part: '体幹',
        name: 'プランク',
        measurementType: 'seconds',
        metric: 'seconds',
        points: [{ date: '2026-06-22', value: 60 }],
      },
    ]);
  });

  it('記録済みワークアウトだけを種目別に集計し、回数の多い順に並べる', () => {
    const result = buildExerciseCounts([
      { ...workout, sets: [{ id: 's1', weight: 60, recordValue: 10 }] },
      {
        ...workout,
        id: 'w2',
        date: '2026-06-19',
        sets: [{ id: 's2', weight: null, recordValue: 8 }],
      },
      {
        ...workout,
        id: 'w3',
        exerciseId: 'e2',
        name: 'スクワット',
        part: '脚',
        sets: [{ id: 's3', weight: 80, recordValue: 8 }],
      },
      {
        ...workout,
        id: 'w4',
        exerciseId: 'e3',
        name: '懸垂',
        part: '背中',
        sets: [{ id: 's4', weight: null, recordValue: null }],
      },
    ]);

    expect(result).toEqual([
      { exerciseId: 'e1', part: '胸', name: 'ベンチプレス', count: 2 },
      { exerciseId: 'e2', part: '脚', name: 'スクワット', count: 1 },
    ]);
  });

  it('記録済みワークアウトだけを部位別に集計する', () => {
    const result = buildPartCounts([
      { ...workout, sets: [{ id: 's1', weight: 60, recordValue: 10 }] },
      {
        ...workout,
        id: 'w2',
        exerciseId: 'e2',
        name: 'ダンベルフライ',
        sets: [{ id: 's2', weight: 20, recordValue: 10 }],
      },
      {
        ...workout,
        id: 'w3',
        exerciseId: 'e3',
        name: 'スクワット',
        part: '脚',
        sets: [{ id: 's3', weight: 80, recordValue: 8 }],
      },
      {
        ...workout,
        id: 'w4',
        exerciseId: 'e4',
        name: '懸垂',
        part: '背中',
        sets: [{ id: 's4', weight: null, recordValue: null }],
      },
    ]);

    expect(result).toEqual([
      { part: '胸', count: 2 },
      { part: '脚', count: 1 },
    ]);
  });
});

describe('回数の初期値', () => {
  it('回数種目の新規セットだけに適用し、重量と秒数は空欄を維持する', () => {
    const exercise = { id: 'e1', name: 'ベンチ', part: '胸', category: 'free' as const };
    const reps = createWorkout({ ...exercise, measurementType: 'reps' }, '2026-10-17', 12);
    expect(reps.sets).toHaveLength(5);
    expect(reps.sets.every((set) => set.recordValue === 12 && set.weight === null)).toBe(true);
    const seconds = createWorkout({ ...exercise, measurementType: 'seconds' }, '2026-10-17', 12);
    expect(seconds.sets.every((set) => set.recordValue === null)).toBe(true);
    const unset = createWorkout({ ...exercise, measurementType: 'reps' }, '2026-10-17');
    expect(unset.sets.every((set) => set.recordValue === null)).toBe(true);
  });
});
