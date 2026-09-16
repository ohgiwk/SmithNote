import { presetColor } from './utils';
import { defaultPartColor, paletteColorAt } from './data/partColors';
import { starterCatalogVersion, starterExercises } from './data/starterExercises';
import {
  ExerciseCategory,
  ExerciseGoal,
  ExerciseGoalAchievement,
  GripStyleType,
  defaultRestTimerAlertVolume,
  defaultRestTimerSeconds,
  gripStyleTypes,
  GripType,
  gripTypes,
  MeasurementType,
  PartSetting,
  Preset,
  PresetSchedule,
  SetIntensity,
  State,
  ThemeMode,
  TrainingPlanMode,
  WeightUnit,
  WorkoutSet,
} from './types';
import { defaultExerciseCategory, uid } from './utils';

const REST_PART = 'レスト';
export const stateSchemaVersion = 4;
const defaultPresets: Preset[] = [
  { id: 'preset-chest-day', name: '胸の日', exerciseIds: [] },
  { id: 'preset-back-day', name: '背中の日', exerciseIds: [] },
  { id: 'preset-leg-day', name: '脚の日', exerciseIds: [] },
  { id: 'preset-shoulder-day', name: '肩の日', exerciseIds: [] },
];
const exerciseKey = (part: string, name: string) => `${part.trim()}::${name.trim()}`;
const starterCategoryByKey = new Map(
  starterExercises.map((exercise) => [
    exerciseKey(exercise.part, exercise.name),
    exercise.category,
  ]),
);

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredValue(value: unknown): value is string | number {
  return (typeof value === 'string' || typeof value === 'number') && String(value).trim() !== '';
}

function buildPartsFromNames(names: string[]): PartSetting[] {
  const parts: PartSetting[] = [];
  const seen = new Set<string>();
  names.forEach((value) => {
    const name = value.trim();
    if (!name || name === REST_PART || seen.has(name)) return;
    seen.add(name);
    parts.push({ name, color: paletteColorAt(parts.length) });
  });
  return parts;
}

export function createDefaultState(): State {
  return {
    schemaVersion: stateSchemaVersion,
    updatedAt: new Date(0).toISOString(),
    exercises: starterExercises,
    goalAchievements: [],
    workouts: [],
    workoutStartTimes: {},
    workoutEndTimes: {},
    presets: defaultPresets,
    trainingDays: [],
    trainingPlans: [],
    parts: buildPartsFromNames(starterExercises.map((exercise) => exercise.part)),
    hiddenParts: [],
    weightUnit: 'kg',
    themeMode: 'dark',
    notificationSettings: { enabled: false },
    restTimerSettings: {
      autoStartOnIntensity: true,
      defaultSeconds: defaultRestTimerSeconds,
      alertVolume: defaultRestTimerAlertVolume,
    },
    catalogVersion: starterCatalogVersion,
  };
}

type SavedStateShape = Partial<State> & Record<string, unknown>;

function migrateState(saved: SavedStateShape): SavedStateShape {
  const sourceVersion = normalizeSchemaVersion(saved.schemaVersion);
  return stateMigrations
    .filter((migration) => sourceVersion < migration.version)
    .reduce((current, migration) => migration.up(current), saved);
}

const stateMigrations: {
  version: number;
  up: (state: SavedStateShape) => SavedStateShape;
}[] = [
  {
    version: 2,
    up: (state) => state,
  },
  {
    version: 3,
    up: migrateExerciseNotes,
  },
  {
    version: 4,
    up: migrateWorkoutUsageTimers,
  },
];

/**
 * 旧ワークアウトへ種目実施時間の初期値を追加する
 */
function migrateWorkoutUsageTimers(state: SavedStateShape): SavedStateShape {
  if (!Array.isArray(state.workouts)) return state;
  return {
    ...state,
    workouts: state.workouts.map((value) => {
      const workout = recordOf(value);
      return workout && typeof workout.usageElapsedSeconds !== 'number'
        ? { ...workout, usageElapsedSeconds: 0 }
        : value;
    }) as State['workouts'],
  };
}

/**
 * 旧ワークアウトメモの最新値を種目共通メモへ移し、日別メモ欄を空で新設する
 */
function migrateExerciseNotes(state: SavedStateShape): SavedStateShape {
  if (!Array.isArray(state.exercises) || !Array.isArray(state.workouts)) return state;
  const latestNoteByExercise = new Map<string, { date: string; note: string }>();
  state.workouts.forEach((value) => {
    const workout = recordOf(value);
    if (!workout || typeof workout.exerciseId !== 'string' || typeof workout.note !== 'string') {
      return;
    }
    const note = workout.note.trim();
    const date = typeof workout.date === 'string' ? workout.date : '';
    const current = latestNoteByExercise.get(workout.exerciseId);
    if (note && (!current || date >= current.date)) {
      latestNoteByExercise.set(workout.exerciseId, { date, note: workout.note });
    }
  });
  return {
    ...state,
    exercises: state.exercises.map((value) => {
      const exercise = recordOf(value);
      if (!exercise || typeof exercise.id !== 'string') return value;
      const existingNote = typeof exercise.note === 'string' ? exercise.note : '';
      return {
        ...exercise,
        note: existingNote || latestNoteByExercise.get(exercise.id)?.note || '',
      };
    }) as State['exercises'],
    workouts: state.workouts.map((value) => {
      const workout = recordOf(value);
      return workout ? { ...workout, note: '' } : value;
    }) as State['workouts'],
  };
}

export function normalizeState(saved: Partial<State> | null | undefined): State | null {
  if (!saved?.exercises || !saved?.workouts) return null;
  const migrated = migrateState(saved);
  const catalogVersion = typeof migrated.catalogVersion === 'number' ? migrated.catalogVersion : 1;
  const normalizedExercises = normalizeExercises(migrated.exercises);
  const exercises =
    catalogVersion < 4
      ? normalizedExercises.map((exercise) => ({
          ...exercise,
          availableGrips: [...gripTypes],
        }))
      : normalizedExercises;
  const exercisesWithGripStyles =
    catalogVersion < 5
      ? exercises.map((exercise) => ({
          ...exercise,
          availableGripStyles: [...gripStyleTypes],
        }))
      : exercises;
  const mergedExercises =
    catalogVersion < starterCatalogVersion
      ? mergeStarterExercises(exercisesWithGripStyles)
      : exercisesWithGripStyles;
  const workouts = normalizeWorkouts(migrated.workouts);
  const trainingDays = normalizeTrainingDays(migrated.trainingDays);
  const trainingPlans = normalizeTrainingPlans(migrated.trainingPlans);
  return {
    schemaVersion: stateSchemaVersion,
    updatedAt: normalizeUpdatedAt(migrated.updatedAt),
    exercises: mergedExercises,
    goalAchievements: normalizeGoalAchievements(migrated.goalAchievements),
    workouts,
    workoutStartTimes: normalizeWorkoutTimes(migrated.workoutStartTimes),
    workoutEndTimes: normalizeWorkoutTimes(migrated.workoutEndTimes),
    presets: normalizePresets(migrated.presets),
    trainingDays,
    trainingPlans,
    parts: normalizePartSettings(
      migrated.parts,
      mergedExercises,
      workouts,
      trainingDays,
      trainingPlans,
    ),
    hiddenParts: normalizeHiddenParts(migrated.hiddenParts),
    weightUnit: normalizeWeightUnit(migrated.weightUnit),
    themeMode: normalizeThemeMode(migrated.themeMode),
    notificationSettings: normalizeNotificationSettings(migrated.notificationSettings),
    restTimerSettings: normalizeRestTimerSettings(migrated.restTimerSettings),
    catalogVersion: starterCatalogVersion,
  };
}

export function parseImportedState(json: string): State | null {
  return normalizeState(JSON.parse(json) as Partial<State> | null);
}

function normalizeWeightUnit(value: unknown): WeightUnit {
  return value === 'lbs' ? 'lbs' : 'kg';
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}

function normalizeNotificationSettings(value: unknown): State['notificationSettings'] {
  const item = recordOf(value);
  return {
    enabled: item?.enabled === true,
  };
}

function normalizeRestTimerSettings(value: unknown): State['restTimerSettings'] {
  const item = recordOf(value);
  return {
    autoStartOnIntensity: item?.autoStartOnIntensity !== false,
    defaultSeconds: normalizeRestTimerSeconds(item?.defaultSeconds),
    alertVolume: normalizeRestTimerAlertVolume(item?.alertVolume),
  };
}

function normalizeRestTimerAlertVolume(value: unknown): number {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return defaultRestTimerAlertVolume;
  return Math.max(0, Math.min(100, Math.round(volume)));
}

function normalizeRestTimerSeconds(value: unknown): number {
  return Math.max(1, Math.min(999, Number(value) || defaultRestTimerSeconds));
}

function normalizeSchemaVersion(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

function normalizeUpdatedAt(value: unknown): string {
  if (typeof value !== 'string') return new Date(0).toISOString();
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date(0).toISOString();
}

function normalizeHiddenParts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const hiddenParts: string[] = [];
  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const name = item.trim();
    if (!name || name === REST_PART || hiddenParts.includes(name)) return;
    hiddenParts.push(name);
  });
  return hiddenParts;
}

function normalizeGoalAchievements(value: unknown): ExerciseGoalAchievement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((achievement) => {
    const item = recordOf(achievement);
    if (
      !item ||
      typeof item.id !== 'string' ||
      typeof item.exerciseId !== 'string' ||
      typeof item.exerciseName !== 'string' ||
      typeof item.date !== 'string' ||
      !requiredValue(item.weight) ||
      !requiredValue(item.recordValue) ||
      !requiredValue(item.goalWeight) ||
      !requiredValue(item.goalRecordValue)
    ) {
      return [];
    }
    const measurementType = normalizeMeasurementType(item.measurementType);
    const weight = Number(item.weight);
    const recordValue = Number(item.recordValue);
    const goalWeight = Number(item.goalWeight);
    const goalRecordValue = Number(item.goalRecordValue);
    if (
      !Number.isFinite(weight) ||
      !Number.isFinite(recordValue) ||
      !Number.isFinite(goalWeight) ||
      !Number.isFinite(goalRecordValue) ||
      weight < 0 ||
      recordValue <= 0 ||
      goalWeight < 0 ||
      goalRecordValue <= 0
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        measurementType,
        date: item.date,
        weight,
        recordValue,
        goalWeight,
        goalRecordValue,
      },
    ];
  });
}

function normalizePartSettings(
  saved: unknown,
  exercises: State['exercises'],
  workouts: State['workouts'],
  trainingDays: State['trainingDays'],
  trainingPlans: State['trainingPlans'],
): PartSetting[] {
  const parts: PartSetting[] = [];
  const seen = new Set<string>();
  if (Array.isArray(saved)) {
    saved.forEach((value) => {
      const item = recordOf(value);
      if (!item) return;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name || name === REST_PART || seen.has(name)) return;
      const color = typeof item.color === 'string' && item.color ? item.color : defaultPartColor;
      seen.add(name);
      parts.push({ name, color });
    });
  }

  const derived = new Set<string>();
  const collect = (value: string) => {
    const name = value.trim();
    if (name && name !== REST_PART && !seen.has(name)) derived.add(name);
  };
  exercises.forEach((exercise) => collect(exercise.part));
  workouts.forEach((workout) => collect(workout.part));
  trainingDays.forEach((day) => day.parts.forEach(collect));
  trainingPlans.forEach((plan) => collect(plan.part));
  derived.forEach((name) => {
    seen.add(name);
    parts.push({ name, color: paletteColorAt(parts.length) });
  });
  return parts;
}

function normalizePresets(value: unknown): Preset[] {
  if (!Array.isArray(value)) return defaultPresets;
  const presets = value.map((preset) => {
    const item = recordOf(preset) ?? {};
    return {
      id: typeof item.id === 'string' ? item.id : uid(),
      name: typeof item.name === 'string' ? item.name : '名称未設定',
      exerciseIds: Array.isArray(item.exerciseIds)
        ? item.exerciseIds.filter((id): id is string => typeof id === 'string')
        : [],
      color: presetColor(item.color),
      schedule: normalizePresetSchedule(item.schedule),
    };
  });
  const existingNames = new Set(presets.map((preset) => preset.name));
  return [...presets, ...defaultPresets.filter((preset) => !existingNames.has(preset.name))];
}

function normalizePresetSchedule(value: unknown): PresetSchedule | undefined {
  const item = recordOf(value);
  if (!item || (item.mode !== 'weekly' && item.mode !== 'interval')) return undefined;
  const weekdays = Array.isArray(item.weekdays)
    ? [
        ...new Set(
          item.weekdays.filter(
            (weekday): weekday is number =>
              typeof weekday === 'number' &&
              Number.isInteger(weekday) &&
              weekday >= 0 &&
              weekday <= 6,
          ),
        ),
      ].sort((a, b) => a - b)
    : [];
  const intervalDays =
    typeof item.intervalDays === 'number' && Number.isFinite(item.intervalDays)
      ? Math.max(1, Math.round(item.intervalDays))
      : 1;
  const startDate = typeof item.startDate === 'string' ? item.startDate : '';
  return {
    mode: item.mode,
    weekdays: item.mode === 'weekly' ? weekdays : [],
    intervalDays: item.mode === 'interval' ? intervalDays : 1,
    startDate,
  };
}

function normalizeTrainingDays(value: unknown): State['trainingDays'] {
  if (!Array.isArray(value)) return [];
  const byDate = new Map<string, Set<string>>();
  value.forEach((trainingDay) => {
    const item = recordOf(trainingDay);
    if (!item || typeof item.date !== 'string') return;
    const parts = normalizeParts(item.parts ?? item.part);
    if (!parts.length) return;
    const existingParts = byDate.get(item.date) ?? new Set<string>();
    parts.forEach((part) => existingParts.add(part));
    byDate.set(item.date, existingParts);
  });
  return [...byDate].map(([date, parts]) => ({ date, parts: [...parts] }));
}

function normalizeWorkoutTimes(value: unknown): State['workoutStartTimes'] {
  const record = recordOf(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && /^\d{2}:\d{2}$/.test(entry[1]),
    ),
  );
}

function normalizeParts(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values.flatMap((item) => {
        if (typeof item !== 'string') return [];
        const part = item.trim();
        return part ? [part] : [];
      }),
    ),
  ];
}

function normalizeTrainingPlans(value: unknown): State['trainingPlans'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((trainingPlan) => {
    const item = recordOf(trainingPlan);
    if (!item) return [];
    const part = typeof item.part === 'string' ? item.part.trim() : '';
    if (!part) return [];
    return [
      {
        id: typeof item.id === 'string' ? item.id : uid(),
        part,
        mode: normalizeTrainingPlanMode(item.mode),
        weekdays: normalizeWeekdays(item.weekdays),
        intervalDays: normalizeIntervalDays(item.intervalDays),
        startDate: typeof item.startDate === 'string' ? item.startDate : '',
      },
    ];
  });
}

function normalizeTrainingPlanMode(value: unknown): TrainingPlanMode {
  return value === 'interval' ? 'interval' : 'weekly';
}

function normalizeWeekdays(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)),
  ].sort();
}

function normalizeIntervalDays(value: unknown) {
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? Math.round(days) : 1;
}

function normalizeExercises(value: unknown): State['exercises'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((exercise) => {
    const item = recordOf(exercise);
    if (
      !item ||
      typeof item.id !== 'string' ||
      typeof item.part !== 'string' ||
      typeof item.name !== 'string'
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        part: item.part,
        name: item.name,
        note: typeof item.note === 'string' ? item.note : '',
        measurementType: normalizeMeasurementType(item.measurementType),
        category: normalizeExerciseCategory(item.category, item.part, item.name),
        availableGrips: normalizeGrips(item.availableGrips),
        availableGripStyles: normalizeGripStyles(item.availableGripStyles),
        goal: normalizeExerciseGoal(item.goal),
      },
    ];
  });
}

function normalizeExerciseGoal(value: unknown): ExerciseGoal | undefined {
  const item = recordOf(value);
  if (!item || !requiredValue(item.weight) || !requiredValue(item.recordValue)) return undefined;
  const weight = Number(item.weight);
  const recordValue = Number(item.recordValue);
  if (!Number.isFinite(weight) || weight < 0) return undefined;
  if (!Number.isFinite(recordValue) || recordValue <= 0) return undefined;
  return { weight, recordValue };
}

function normalizeExerciseCategory(value: unknown, part: string, name: string): ExerciseCategory {
  if (
    value === 'free' ||
    value === 'machine' ||
    value === 'dumbbell' ||
    value === 'cable' ||
    value === 'bodyweight'
  ) {
    return value;
  }
  return starterCategoryByKey.get(exerciseKey(part, name)) ?? defaultExerciseCategory;
}

function normalizeWorkouts(value: unknown): State['workouts'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((workout) => {
    const item = recordOf(workout);
    if (
      !item ||
      typeof item.id !== 'string' ||
      typeof item.exerciseId !== 'string' ||
      typeof item.date !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.part !== 'string'
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        exerciseId: item.exerciseId,
        presetId: typeof item.presetId === 'string' ? item.presetId : undefined,
        date: item.date,
        name: item.name,
        part: item.part,
        measurementType: normalizeMeasurementType(item.measurementType),
        grip: normalizeGrip(item.grip),
        gripStyle: normalizeGripStyle(item.gripStyle),
        sets: normalizeSets(item.sets),
        note: typeof item.note === 'string' ? item.note : '',
        usageElapsedSeconds: normalizeUsageElapsedSeconds(item.usageElapsedSeconds),
        usageStartedAt: normalizeUsageStartedAt(item.usageStartedAt),
      },
    ];
  });
}

function normalizeUsageElapsedSeconds(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
}

function normalizeUsageStartedAt(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function normalizeSets(value: unknown): WorkoutSet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((set) => {
    const item = recordOf(set);
    if (!item || typeof item.id !== 'string') return [];
    return [
      {
        id: item.id,
        weight: normalizeSetValue(item.weight),
        recordValue: normalizeSetValue(item.recordValue ?? item.reps),
        targetRecordValue: normalizeSetValue(item.targetRecordValue),
        achievement: normalizeSetAchievement(item.achievement),
        intensity: normalizeIntensity(item.intensity),
      },
    ];
  });
}

function normalizeSetValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeMeasurementType(value: unknown): MeasurementType {
  return value === 'seconds' ? 'seconds' : 'reps';
}

function normalizeSetAchievement(value: unknown) {
  return value === 'achieved' || value === 'missed' ? value : undefined;
}

function normalizeGrips(value: unknown): GripType[] {
  if (!Array.isArray(value)) return [...gripTypes];
  return [...new Set(value.map(normalizeGrip).filter((grip): grip is GripType => Boolean(grip)))];
}

function normalizeGrip(value: unknown): GripType | undefined {
  return gripTypes.includes(value as GripType) ? (value as GripType) : undefined;
}

function normalizeGripStyles(value: unknown): GripStyleType[] {
  if (!Array.isArray(value)) return [...gripStyleTypes];
  return [
    ...new Set(
      value
        .map(normalizeGripStyle)
        .filter((gripStyle): gripStyle is GripStyleType => Boolean(gripStyle)),
    ),
  ];
}

function normalizeGripStyle(value: unknown): GripStyleType | undefined {
  return gripStyleTypes.includes(value as GripStyleType) ? (value as GripStyleType) : undefined;
}

function normalizeIntensity(value: unknown): SetIntensity | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : undefined;
}

function mergeStarterExercises(exercises: State['exercises']) {
  const existingKeys = new Set(
    exercises.map((exercise) => exerciseKey(exercise.part, exercise.name)),
  );
  return [
    ...exercises,
    ...starterExercises.filter(
      (exercise) => !existingKeys.has(exerciseKey(exercise.part, exercise.name)),
    ),
  ];
}
