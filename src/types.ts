export type Screen =
  | 'auth'
  | 'home'
  | 'select'
  | 'exerciseEdit'
  | 'detail'
  | 'exerciseHistory'
  | 'goalAchievements'
  | 'presetEdit'
  | 'presetExerciseSelect'
  | 'trainingMenu'
  | 'analysis'
  | 'partEdit'
  | 'exerciseManage'
  | 'settings'
  | 'notificationSettings'
  | 'privacyPolicy'
  | 'termsOfService'
  | 'accountManagement'
  | 'forgotPassword'
  | 'backup';

export type MeasurementType = 'reps' | 'seconds';

export type SetIntensity = 1 | 2 | 3 | 4 | 5;

export type SetAchievement = 'achieved' | 'missed';

export const gripTypes = ['normal', 'reverse', 'parallel', 'alternate'] as const;

export type GripType = (typeof gripTypes)[number];

export const gripStyleTypes = ['thumbAround', 'thumbLess', 'thumbUp', 'hook'] as const;

export type GripStyleType = (typeof gripStyleTypes)[number];

export type WeightUnit = 'kg' | 'lbs';

export type ThemeMode = 'dark' | 'light';

export type NotificationSettings = {
  enabled: boolean;
};

export const restTimerPresetSeconds = [30, 60, 90, 120] as const;
export const defaultRestTimerSeconds = 60;
export const defaultRestTimerAlertVolume = 100;

export type RestTimerSettings = {
  autoStartOnIntensity: boolean;
  defaultSeconds: number;
  alertVolume: number;
};

/**
 * 種目の器具カテゴリ。種目リスト内をさらに分類して表示・設定するために使う
 */
export type ExerciseCategory = 'free' | 'machine' | 'dumbbell' | 'cable' | 'bodyweight';

export type ExerciseGoal = {
  weight: number;
  recordValue: number;
};

export type ExerciseGoalAchievement = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  measurementType: MeasurementType;
  date: string;
  weight: number;
  recordValue: number;
  goalWeight: number;
  goalRecordValue: number;
};

export type Exercise = {
  id: string;
  part: string;
  name: string;
  note?: string;
  measurementType: MeasurementType;
  category: ExerciseCategory;
  availableGrips?: GripType[];
  availableGripStyles?: GripStyleType[];
  goal?: ExerciseGoal;
};

export type WorkoutSet = {
  id: string;
  weight: number | null;
  recordValue: number | null;
  targetRecordValue?: number | null;
  achievement?: SetAchievement;
  intensity?: SetIntensity;
};

export type Workout = {
  id: string;
  exerciseId: string;
  date: string;
  name: string;
  part: string;
  measurementType: MeasurementType;
  grip?: GripType;
  gripStyle?: GripStyleType;
  sets: WorkoutSet[];
  note: string;
  usageElapsedSeconds: number;
  usageStartedAt?: string;
};

export type Preset = {
  id: string;
  name: string;
  exerciseIds: string[];
  schedule?: PresetSchedule;
};

export type TrainingDay = {
  date: string;
  parts: string[];
};

export type TrainingPlanMode = 'weekly' | 'interval';

export type PresetSchedule = {
  mode: TrainingPlanMode;
  weekdays: number[];
  intervalDays: number;
  startDate: string;
};

export type TrainingPlan = {
  id: string;
  part: string;
  mode: TrainingPlanMode;
  weekdays: number[];
  intervalDays: number;
  startDate: string;
};

/**
 * 部位ごとの表示設定。並び順は配列の順序で表し、color に表示色(HEX)を持つ
 */
export type PartSetting = {
  name: string;
  color: string;
};

export type State = {
  schemaVersion: number;
  updatedAt: string;
  exercises: Exercise[];
  goalAchievements: ExerciseGoalAchievement[];
  workouts: Workout[];
  workoutStartTimes: Record<string, string>;
  workoutEndTimes: Record<string, string>;
  presets: Preset[];
  trainingDays: TrainingDay[];
  trainingPlans: TrainingPlan[];
  parts: PartSetting[];
  hiddenParts: string[];
  weightUnit: WeightUnit;
  themeMode: ThemeMode;
  notificationSettings: NotificationSettings;
  restTimerSettings: RestTimerSettings;
  catalogVersion: number;
};

export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
};
