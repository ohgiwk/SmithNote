import {
  CalendarCell,
  Exercise,
  ExerciseCategory,
  ExerciseGoal,
  GripStyleType,
  gripStyleTypes,
  GripType,
  gripTypes,
  MeasurementType,
  SetIntensity,
  WeightUnit,
  Workout,
  WorkoutSet,
} from './types';

/**
 * 種目の器具カテゴリの表示順とラベル。
 * 種目選択画面の小見出しやカテゴリ選択でこの順序を使う
 */
export const exerciseCategories: { value: ExerciseCategory; label: string }[] = [
  { value: 'free', label: 'フリーウエイト種目' },
  { value: 'machine', label: 'マシン種目' },
  { value: 'dumbbell', label: 'ダンベル種目' },
  { value: 'cable', label: 'ケーブル種目' },
  { value: 'bodyweight', label: '自重種目' },
];

/**
 * 種目のカテゴリ未設定時に使う既定カテゴリ
 */
export const defaultExerciseCategory: ExerciseCategory = 'free';

/**
 * 選択中の部位から、記録回数と最終実施日を基準によく行う種目を抽出する
 */
export function frequentExercisesForPart(exercises: Exercise[], workouts: Workout[], limit = 6) {
  const stats = new Map<string, { count: number; lastDate: string }>();
  workouts.forEach((workout) => {
    if (!workout.sets.some(isRecordedSet)) return;
    const current = stats.get(workout.exerciseId);
    stats.set(workout.exerciseId, {
      count: (current?.count ?? 0) + 1,
      lastDate: current && current.lastDate > workout.date ? current.lastDate : workout.date,
    });
  });
  return exercises
    .filter((exercise) => stats.has(exercise.id))
    .sort((left, right) => {
      const leftStats = stats.get(left.id)!;
      const rightStats = stats.get(right.id)!;
      return (
        rightStats.count - leftStats.count || rightStats.lastDate.localeCompare(leftStats.lastDate)
      );
    })
    .slice(0, limit);
}

/**
 * 保存済みの累積時間と計測開始日時から、現在の種目実施秒数を求める
 */
export function workoutUsageElapsedSeconds(workout: Workout, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor(workout.usageElapsedSeconds || 0));
  if (!workout.usageStartedAt) return elapsed;
  const startedAt = Date.parse(workout.usageStartedAt);
  if (!Number.isFinite(startedAt)) return elapsed;
  return elapsed + Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * 種目実施時間を1時間未満は M:SS、1時間以上は H:MM:SS で表示する
 */
export function formatWorkoutUsageTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export const gripOptions: { value: GripType; label: string }[] = [
  { value: 'normal', label: 'ノーマルグリップ' },
  { value: 'reverse', label: 'リバースグリップ' },
  { value: 'parallel', label: 'パラレルグリップ' },
  { value: 'alternate', label: 'オルタネイトグリップ' },
];

export const allGripTypes: GripType[] = [...gripTypes];

export function gripLabel(grip: GripType) {
  return gripOptions.find((option) => option.value === grip)?.label ?? grip;
}

export const gripStyleOptions: { value: GripStyleType; label: string }[] = [
  { value: 'thumbAround', label: 'サムアラウンドグリップ' },
  { value: 'thumbLess', label: 'サムレスグリップ' },
  { value: 'thumbUp', label: 'サムアップグリップ' },
  { value: 'hook', label: 'フックグリップ' },
];

export const allGripStyleTypes: GripStyleType[] = [...gripStyleTypes];

export function gripStyleLabel(gripStyle: GripStyleType) {
  return gripStyleOptions.find((option) => option.value === gripStyle)?.label ?? gripStyle;
}

export function groupExercises(exercises: Exercise[]) {
  return exercises.reduce((groups, exercise) => {
    if (!groups.has(exercise.part)) groups.set(exercise.part, []);
    groups.get(exercise.part)?.push(exercise);
    return groups;
  }, new Map<string, Exercise[]>());
}

export function calendarCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date: localDate(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

export function compactCalendarCells(year: number, month: number): CalendarCell[] {
  const cells = calendarCells(year, month);
  const lastInMonthIndex = cells.map((cell) => cell.inMonth).lastIndexOf(true);
  const visibleCellCount = Math.ceil((lastInMonthIndex + 1) / 7) * 7;
  return cells.slice(0, visibleCellCount);
}

export const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

export function newSet(): WorkoutSet {
  return { id: uid(), weight: null, recordValue: null };
}

export const intensityOptions: { value: SetIntensity; label: string }[] = [
  { value: 1, label: '余裕' },
  { value: 2, label: '普通' },
  { value: 3, label: 'きつい' },
  { value: 4, label: 'かなりきつい' },
  { value: 5, label: '限界' },
];

export function calcRm(weight: number, reps: number) {
  if (!weight || !reps) return '0.0';
  return (weight * (1 + reps / 30)).toFixed(reps > 3 ? 1 : 2);
}

export function weightUnitLabel(unit: WeightUnit) {
  return unit === 'lbs' ? 'Lbs' : 'kg';
}

export function convertWeightFromKg(value: string | number | null, unit: WeightUnit) {
  const weight = number(value);
  return unit === 'lbs' ? weight * 2.20462 : weight;
}

export function convertWeightToKg(value: string | number | null, unit: WeightUnit) {
  const weight = number(value);
  return unit === 'lbs' ? weight / 2.20462 : weight;
}

export function measurementUnit(measurementType: MeasurementType) {
  return measurementType === 'seconds' ? '秒' : '回';
}

export function measurementLabel(measurementType: MeasurementType) {
  return measurementType === 'seconds' ? '秒数' : '回数';
}

export function isRepsMeasurement(measurementType: MeasurementType) {
  return measurementType === 'reps';
}

export function number(value: string | number | null | undefined) {
  return Number(value) || 0;
}

export function isBlank(value: string | number | null | undefined) {
  return String(value ?? '').trim() === '';
}

/**
 * 重量または回数・秒数が入力されているセットか判定する
 */
export function isRecordedSet(set: WorkoutSet) {
  return !isBlank(set.weight) || !isBlank(set.recordValue);
}

/**
 * 重量・回数以外も含めて、記録として意味のあるセットか判定する
 */
export function isMeaningfulSet(set: WorkoutSet) {
  return isRecordedSet(set) || typeof set.intensity === 'number';
}

/**
 * HH:mm 形式の開始・終了時刻から経過分数を求める
 */
export function calculateWorkoutDurationMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end >= start ? end - start : 24 * 60 - start + end;
}

/**
 * 経過分数をトレーニング時間の表示文言へ整形する
 */
export function formatWorkoutDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}分`;
  if (!remainingMinutes) return `${hours}時間`;
  return `${hours}時間${remainingMinutes}分`;
}

/**
 * HH:mm 形式の時刻を日本語の時分表記へ整形する
 */
export function formatWorkoutTime(time: string) {
  const [hours, minutes] = time.split(':');
  return `${hours}時${minutes}分`;
}

/**
 * Date を保存用の HH:mm 形式へ整形する
 */
export function formatTimeOfDay(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 入力済みセットの重量と回数・秒数が、種目目標の両方に到達しているか判定する
 */
export function isExerciseGoalAchieved(sets: WorkoutSet[], goal: ExerciseGoal) {
  return Boolean(findExerciseGoalAchievementSet(sets, goal));
}

/**
 * 種目目標を満たすセットのうち、重量、回数・秒数の順に目標を最も上回るセットを返す
 */
export function findExerciseGoalAchievementSet(sets: WorkoutSet[], goal: ExerciseGoal) {
  return sets
    .filter(
      (set) =>
        !isBlank(set.weight) &&
        !isBlank(set.recordValue) &&
        number(set.weight) >= goal.weight &&
        number(set.recordValue) >= goal.recordValue,
    )
    .reduce<WorkoutSet | undefined>((best, set) => {
      if (!best) return set;
      const weightDifference = number(set.weight) - number(best.weight);
      if (weightDifference !== 0) return weightDifference > 0 ? set : best;
      return number(set.recordValue) > number(best.recordValue) ? set : best;
    }, undefined);
}

export function formatWeight(value: string | number | null, unit: WeightUnit = 'kg') {
  return convertWeightFromKg(value, unit).toFixed(1);
}

export function formatStoredWeightInput(value: number | null, unit: WeightUnit) {
  if (isBlank(value)) return '';
  if (unit === 'kg') return String(value);
  return formatWeight(value, unit);
}

export function formatWeightForStorageInput(value: string, unit: WeightUnit): number | null {
  if (value.trim() === '') return null;
  if (unit === 'kg') {
    const stored = Number(value);
    return Number.isFinite(stored) ? stored : null;
  }
  const converted = convertWeightToKg(value, unit);
  if (!Number.isFinite(converted)) return null;
  if (converted === 0) return 0;
  return Number(converted.toFixed(4));
}

export function isUnstartedWorkout(workout: Workout) {
  return (
    !workout.grip &&
    !workout.gripStyle &&
    workout.note.trim() === '' &&
    workout.sets.every((set) => !isMeaningfulSet(set))
  );
}

export function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function prevMonthLabel(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  return `${String(date.getMonth() + 1).padStart(2, '0')}月`;
}

export function nextMonthLabel(year: number, month: number) {
  const date = new Date(year, month + 1, 1);
  return `${String(date.getMonth() + 1).padStart(2, '0')}月`;
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const presetColors = [
  { value: '#c43d3d', label: '赤' },
  { value: '#b85c19', label: 'オレンジ' },
  { value: '#927000', label: '黄' },
  { value: '#27804b', label: '緑' },
  { value: '#087e8b', label: '青緑' },
  { value: '#326bc4', label: '青' },
  { value: '#8154bb', label: '紫' },
  { value: '#b83e80', label: 'ピンク' },
];

/**
 * 保存データの色を検証し、未設定や不正な値には既定の赤を使う
 */
export function presetColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : presetColors[0].value;
}
