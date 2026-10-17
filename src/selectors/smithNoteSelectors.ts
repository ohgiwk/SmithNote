import { Exercise, PartSetting, Preset, State, Workout } from '../types';
import { defaultPartColor } from '../data/partColors';
import { calcRm, isRecordedSet, newSet, number, parseDate, uid } from '../utils';

/**
 * トレーニング日などで使う特別な部位。並びや色管理の対象外にする
 */
export const REST_PART = 'レスト';

export type ExerciseCount = {
  exerciseId: string;
  part: string;
  name: string;
  count: number;
};

export type PartCount = {
  part: string;
  count: number;
};

export type WorkoutSummaryIndex = {
  exerciseCounts: ExerciseCount[];
  partCounts: PartCount[];
  latestWorkoutDateByPart: Map<string, string>;
};

export function buildWorkoutSummaryIndex(workouts: Workout[]): WorkoutSummaryIndex {
  const exerciseCounts = new Map<string, ExerciseCount>();
  const partCounts = new Map<string, number>();
  const latestWorkoutDateByPart = new Map<string, string>();

  workouts.forEach((workout) => {
    if (!workout.sets.some(isRecordedSet)) return;
    const key = workout.exerciseId || workout.name;
    const currentExercise = exerciseCounts.get(key);
    if (currentExercise) {
      currentExercise.count += 1;
      currentExercise.part = workout.part;
      currentExercise.name = workout.name;
    } else {
      exerciseCounts.set(key, {
        exerciseId: key,
        part: workout.part,
        name: workout.name,
        count: 1,
      });
    }

    const part = workout.part.trim();
    if (part && part !== REST_PART) {
      partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
      const latestDate = latestWorkoutDateByPart.get(part);
      if (!latestDate || workout.date > latestDate) latestWorkoutDateByPart.set(part, workout.date);
    }
  });

  return {
    exerciseCounts: [...exerciseCounts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'),
    ),
    partCounts: [...partCounts.entries()]
      .map(([part, count]) => ({ part, count }))
      .sort((a, b) => b.count - a.count || a.part.localeCompare(b.part, 'ja')),
    latestWorkoutDateByPart,
  };
}

export type ExerciseGrowthMetric = 'rm' | 'reps' | 'seconds';

export type ExerciseGrowthPoint = {
  date: string;
  value: number;
};

export type ExerciseGrowthSeries = {
  exerciseId: string;
  part: string;
  name: string;
  measurementType: Workout['measurementType'];
  metric: ExerciseGrowthMetric;
  points: ExerciseGrowthPoint[];
};

export type WeeklyVolumePoint = {
  weekStart: string;
  weekEnd: string;
  value: number;
};

export type ExerciseBestRecord = {
  exerciseId: string;
  part: string;
  name: string;
  measurementType: Workout['measurementType'];
  date: string;
  mainLabel: string;
  mainValue: number;
  subRecords: {
    label: string;
    value: number;
    unit: 'weight' | 'count' | 'seconds';
  }[];
};

/**
 * 記録済みセットを持つワークアウトを種目別に集計する
 */
export function buildExerciseCounts(workouts: Workout[]): ExerciseCount[] {
  return buildWorkoutSummaryIndex(workouts).exerciseCounts;
}

/**
 * 記録済みセットを持つワークアウトを部位別に集計する
 */
export function buildPartCounts(workouts: Workout[]): PartCount[] {
  return buildWorkoutSummaryIndex(workouts).partCounts;
}

/**
 * 実施済みワークアウトから種目ごとの成長推移を作る
 */
export function buildExerciseGrowthSeries(workouts: Workout[]): ExerciseGrowthSeries[] {
  const groups = new Map<string, ExerciseGrowthSeries>();
  const sortedWorkouts = [...workouts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );

  sortedWorkouts.forEach((workout) => {
    const recordedSets = workout.sets.filter(isRecordedSet);
    if (!recordedSets.length) return;
    const key = workout.exerciseId || workout.name;
    const weightedSets = recordedSets.filter((set) => number(set.weight) > 0);
    const isSeconds = workout.measurementType === 'seconds';
    const metric: ExerciseGrowthMetric = isSeconds
      ? 'seconds'
      : weightedSets.length
        ? 'rm'
        : 'reps';
    const sourceSets = metric === 'rm' ? weightedSets : recordedSets;
    const value = sourceSets.reduce((max, set) => {
      if (metric === 'rm') {
        return Math.max(max, Number(calcRm(number(set.weight), number(set.recordValue))));
      }
      return Math.max(max, number(set.recordValue));
    }, 0);
    if (value <= 0) return;

    const current = groups.get(key);
    if (current) {
      current.part = workout.part;
      current.name = workout.name;
      current.measurementType = workout.measurementType;
      current.metric = current.metric === 'rm' || metric === 'rm' ? 'rm' : metric;
      current.points.push({ date: workout.date, value });
      return;
    }

    groups.set(key, {
      exerciseId: key,
      part: workout.part,
      name: workout.name,
      measurementType: workout.measurementType,
      metric,
      points: [{ date: workout.date, value }],
    });
  });

  return [...groups.values()]
    .map((series) => ({
      ...series,
      points: series.points
        .reduce<ExerciseGrowthPoint[]>((points, point) => {
          const sameDate = points.find((item) => item.date === point.date);
          if (sameDate) {
            sameDate.value = Math.max(sameDate.value, point.value);
            return points;
          }
          points.push({ ...point });
          return points;
        }, [])
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.part.localeCompare(b.part, 'ja') || a.name.localeCompare(b.name, 'ja'));
}

/**
 * reps 種目の重量×回数を週ごとに集計する
 */
export function buildWeeklyVolumeSeries(workouts: Workout[]): WeeklyVolumePoint[] {
  const volumes = new Map<string, WeeklyVolumePoint>();

  workouts.forEach((workout) => {
    if (workout.measurementType !== 'reps') return;
    const value = workout.sets.reduce((sum, set) => {
      const weight = number(set.weight);
      const recordValue = number(set.recordValue);
      return weight > 0 && recordValue > 0 ? sum + weight * recordValue : sum;
    }, 0);
    if (value <= 0) return;

    const weekStart = formatDateKey(startOfWeek(parseDate(workout.date)));
    const weekEnd = formatDateKey(addDays(parseDate(weekStart), 6));
    const current = volumes.get(weekStart);
    if (current) {
      current.value += value;
      return;
    }
    volumes.set(weekStart, { weekStart, weekEnd, value });
  });

  return [...volumes.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * 種目ごとの自己ベストを一覧表示用に集計する
 */
export function buildExerciseBestRecords(workouts: Workout[]): ExerciseBestRecord[] {
  const grouped = new Map<string, Workout[]>();
  workouts.forEach((workout) => {
    if (!workout.sets.some(isRecordedSet)) return;
    const key = workout.exerciseId || workout.name;
    grouped.set(key, [...(grouped.get(key) ?? []), workout]);
  });

  return [...grouped.entries()]
    .map<ExerciseBestRecord | null>(([exerciseId, histories]) => {
      const sortedHistories = histories.sort(
        (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
      );
      const latest = sortedHistories[0];
      const sets = sortedHistories.flatMap((workout) =>
        workout.sets.filter(isRecordedSet).map((set) => ({ date: workout.date, workout, set })),
      );
      if (!sets.length) return null;

      if (latest.measurementType === 'reps') {
        const bestRm = sets.reduce(
          (best, item) => {
            const value = Number(calcRm(number(item.set.weight), number(item.set.recordValue)));
            return value > best.value ? { date: item.date, value } : best;
          },
          { date: latest.date, value: 0 },
        );
        const maxWeight = sets.reduce((max, item) => Math.max(max, number(item.set.weight)), 0);
        const maxReps = sets.reduce((max, item) => Math.max(max, number(item.set.recordValue)), 0);
        const maxVolume = sortedHistories.reduce((max, workout) => {
          const value = workout.sets
            .filter(isRecordedSet)
            .reduce((sum, set) => sum + number(set.weight) * number(set.recordValue), 0);
          return Math.max(max, value);
        }, 0);
        if (bestRm.value <= 0 && maxReps <= 0) return null;
        const record: ExerciseBestRecord = {
          exerciseId,
          part: latest.part,
          name: latest.name,
          measurementType: latest.measurementType,
          date: bestRm.date,
          mainLabel: 'MAX 1RM',
          mainValue: bestRm.value,
          subRecords: [
            { label: '最大重量', value: maxWeight, unit: 'weight' },
            { label: '最大回数', value: maxReps, unit: 'count' },
            { label: '最大負荷量', value: maxVolume, unit: 'weight' },
          ],
        };
        return record;
      }

      const bestSeconds = sets.reduce(
        (best, item) => {
          const value = number(item.set.recordValue);
          return value > best.value ? { date: item.date, value } : best;
        },
        { date: latest.date, value: 0 },
      );
      const maxWeight = sets.reduce((max, item) => Math.max(max, number(item.set.weight)), 0);
      const maxTotalSeconds = sortedHistories.reduce((max, workout) => {
        const value = workout.sets
          .filter(isRecordedSet)
          .reduce((sum, set) => sum + number(set.recordValue), 0);
        return Math.max(max, value);
      }, 0);
      if (bestSeconds.value <= 0) return null;
      const record: ExerciseBestRecord = {
        exerciseId,
        part: latest.part,
        name: latest.name,
        measurementType: latest.measurementType,
        date: bestSeconds.date,
        mainLabel: '最長記録',
        mainValue: bestSeconds.value,
        subRecords: [
          { label: '最大重量', value: maxWeight, unit: 'weight' },
          { label: '最大合計秒数', value: maxTotalSeconds, unit: 'seconds' },
        ],
      };
      return record;
    })
    .filter((record): record is ExerciseBestRecord => Boolean(record))
    .sort((a, b) => a.part.localeCompare(b.part, 'ja') || a.name.localeCompare(b.name, 'ja'));
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 明示的な部位設定(順序・色)に、データ上だけ存在する部位を補って
 * 表示順つきの完全な部位一覧を作る。
 * - 先頭は state.parts の順序をそのまま使う
 * - その後ろに、種目などに現れるが未登録の部位を五十音順で既定色で追加する
 * - 「レスト」は対象外にする
 */
export function buildOrderedParts(
  parts: PartSetting[],
  exercises: Exercise[],
  workouts: Workout[],
  trainingDays: State['trainingDays'],
  trainingPlans: State['trainingPlans'],
  hiddenParts: string[] = [],
): PartSetting[] {
  const result: PartSetting[] = [];
  const seen = new Set<string>();
  const hidden = new Set(hiddenParts.map((part) => part.trim()).filter(Boolean));
  parts.forEach((part) => {
    const name = part.name.trim();
    if (!name || name === REST_PART || hidden.has(name) || seen.has(name)) return;
    seen.add(name);
    result.push({ name, color: part.color || defaultPartColor });
  });

  const implicit: string[] = [];
  const collect = (value: string) => {
    const name = value.trim();
    if (!name || name === REST_PART || hidden.has(name) || seen.has(name) || implicit.includes(name)) {
      return;
    }
    implicit.push(name);
  };
  exercises.forEach((exercise) => collect(exercise.part));
  workouts.forEach((workout) => collect(workout.part));
  trainingDays.forEach((day) => day.parts.forEach(collect));
  trainingPlans.forEach((plan) => collect(plan.part));
  implicit.sort((a, b) => a.localeCompare(b, 'ja'));
  implicit.forEach((name) => {
    seen.add(name);
    result.push({ name, color: defaultPartColor });
  });
  return result;
}

/**
 * 部位名から表示色を引けるマップを作る
 */
export function buildPartColorMap(orderedParts: PartSetting[]): Map<string, string> {
  return new Map(orderedParts.map((part) => [part.name, part.color]));
}

export function findCurrentWorkout(
  workouts: Workout[],
  currentWorkoutId: string | null,
  selectedDate: string,
  selectedWorkouts: Workout[],
) {
  if (!currentWorkoutId) return null;
  const current = workouts.find((workout) => workout.id === currentWorkoutId);
  if (current?.date === selectedDate) return current;
  return selectedWorkouts.find((workout) => workout.id === currentWorkoutId) || null;
}

export function findCurrentPreset(presets: Preset[], currentPresetId: string | null) {
  return presets.find((preset) => preset.id === currentPresetId) || presets[0] || null;
}

export function scheduledPresetsForDate(date: string, presets: Preset[]) {
  const target = parseDate(date);
  const weekday = target.getDay();
  return presets.filter((preset) => {
    const schedule = preset.schedule;
    if (!schedule) return false;
    if (schedule.mode === 'weekly') return schedule.weekdays.includes(weekday);
    if (!schedule.startDate) return false;
    const start = parseDate(schedule.startDate);
    const days = Math.floor((target.getTime() - start.getTime()) / 86400000);
    return days >= 0 && days % schedule.intervalDays === 0;
  });
}

export function buildSplitPartOptions(
  exercises: Exercise[],
  workouts: Workout[],
  trainingDays: State['trainingDays'],
  trainingPlans: State['trainingPlans'],
) {
  const parts = new Set<string>();
  exercises.forEach((exercise) => parts.add(exercise.part));
  workouts.forEach((workout) => parts.add(workout.part));
  trainingDays.forEach((day) => day.parts.forEach((part) => parts.add(part)));
  trainingPlans.forEach((plan) => parts.add(plan.part));
  parts.delete('');
  return [...parts].sort((a, b) => a.localeCompare(b, 'ja'));
}

export function plannedPartsForDate(date: string, trainingPlans: State['trainingPlans']) {
  const target = parseDate(date);
  const weekday = target.getDay();
  return [
    ...new Set(
      trainingPlans.flatMap((plan) => {
        if (plan.mode === 'weekly') return plan.weekdays.includes(weekday) ? [plan.part] : [];
        const start = plan.startDate ? parseDate(plan.startDate) : target;
        const days = Math.floor((target.getTime() - start.getTime()) / 86400000);
        return days >= 0 && days % plan.intervalDays === 0 ? [plan.part] : [];
      }),
    ),
  ];
}

export type HistoryDay = {
  date: string;
  parts: string[];
  workoutNames: string[];
};

export function buildVisibleHistory(
  workouts: Workout[],
  trainingDays: State['trainingDays'],
  partFilter: string,
): HistoryDay[] {
  const byDate = new Map<string, { date: string; parts: Set<string>; workoutNames: string[] }>();
  trainingDays.forEach((day) => {
    byDate.set(day.date, { date: day.date, parts: new Set(day.parts), workoutNames: [] });
  });
  workouts.forEach((workout) => {
    const day = byDate.get(workout.date) ?? {
      date: workout.date,
      parts: new Set<string>(),
      workoutNames: [],
    };
    day.parts.add(workout.part);
    day.workoutNames.push(workout.name);
    byDate.set(workout.date, day);
  });
  return [...byDate.values()]
    .filter((day) => partFilter === 'ALL' || day.parts.has(partFilter))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((day) => ({ ...day, parts: [...day.parts] }));
}

export function buildPartRecentLabels(
  groupedExercises: Map<string, Exercise[]>,
  workouts: Workout[],
  selectedDate: string,
) {
  const selectedTime = parseDate(selectedDate).getTime();
  const labels = new Map<string, string>();
  const latestWorkoutDateByPart = buildWorkoutSummaryIndex(
    workouts.filter((workout) => workout.date <= selectedDate),
  ).latestWorkoutDateByPart;
  groupedExercises.forEach((exercises, part) => {
    const exerciseParts = new Set(exercises.map((exercise) => exercise.part));
    const latestDate = [...exerciseParts]
      .map((exercisePart) => latestWorkoutDateByPart.get(exercisePart))
      .filter((date): date is string => Boolean(date))
      .sort((a, b) => b.localeCompare(a))[0];

    if (!latestDate) {
      labels.set(part, '履歴なし');
      return;
    }

    const daysAgo = Math.max(
      0,
      Math.round((selectedTime - parseDate(latestDate).getTime()) / 86400000),
    );
    labels.set(part, daysAgo === 0 ? '今日' : `${daysAgo}日前`);
  });
  return labels;
}

export function createWorkout(
  exercise: Exercise,
  date: string,
  defaultReps?: number | null,
): Workout {
  return {
    id: uid(),
    exerciseId: exercise.id,
    date,
    name: exercise.name,
    part: exercise.part,
    measurementType: exercise.measurementType,
    sets: Array.from({ length: 5 }, () =>
      newSet(exercise.measurementType === 'reps' ? defaultReps : null),
    ),
    note: '',
    usageElapsedSeconds: 0,
  };
}
