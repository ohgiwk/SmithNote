import { useEffect, useMemo, useState } from 'react';
import { Preset, Screen, State } from '../types';
import {
  createWorkout,
  findCurrentPreset,
  scheduledPresetsForDate,
} from '../selectors/smithNoteSelectors';
import { formatTimeOfDay, presetColor } from '../utils';

type PresetActionsDeps = {
  state: State;
  saveState: (updater: (draft: State) => State) => void;
  showToast: (message: string, action?: { actionLabel?: string; onAction?: () => void }) => void;
  showScreen: (next: Screen) => void;
  selectedDate: string;
};

/**
 * プリセット(よく使う種目のまとまり)の選択・編集・実行を担うフック
 */
export function usePresetActions({
  state,
  saveState,
  showToast,
  showScreen,
  selectedDate,
}: PresetActionsDeps) {
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null);

  /**
   * 現在選択中のプリセット
   */
  const currentPreset = useMemo(
    () => findCurrentPreset(state.presets, currentPresetId),
    [currentPresetId, state.presets],
  );
  const scheduledPresetId = useMemo(
    () => scheduledPresetsForDate(selectedDate, state.presets)[0]?.id ?? null,
    [selectedDate, state.presets],
  );
  /**
   * プリセットの増減に合わせて選択中 ID を補正する
   */
  useEffect(() => {
    if (!currentPreset && state.presets.length) setCurrentPresetId(state.presets[0].id);
    if (!state.presets.length) setCurrentPresetId(null);
  }, [currentPreset, state.presets]);

  /**
   * 選択日に予定されたプリセットがあればホームの既定選択へ反映する
   */
  useEffect(() => {
    if (scheduledPresetId) setCurrentPresetId(scheduledPresetId);
  }, [scheduledPresetId, selectedDate]);

  /**
   * 編集画面の下書きを保存可能なプリセットへ整える
   */
  function normalizePreset(preset: Preset): Preset {
    return {
      ...preset,
      color: presetColor(preset.color),
      name: preset.name.trim() || '名称未設定',
      exerciseIds: [...new Set(preset.exerciseIds)],
      schedule: preset.schedule
        ? {
            mode: preset.schedule.mode,
            weekdays:
              preset.schedule.mode === 'weekly'
                ? [...new Set(preset.schedule.weekdays)]
                    .filter((weekday) => weekday >= 0 && weekday <= 6)
                    .sort((a, b) => a - b)
                : [],
            intervalDays:
              preset.schedule.mode === 'interval'
                ? Math.max(1, Math.round(preset.schedule.intervalDays || 1))
                : 1,
            startDate: preset.schedule.startDate || selectedDate,
          }
        : undefined,
    };
  }

  function collectPresetExercises(exerciseIds: string[]) {
    const todayExerciseIds = new Set(
      state.workouts
        .filter((workout) => workout.date === selectedDate)
        .map((workout) => workout.exerciseId),
    );
    const queuedExerciseIds = new Set<string>();
    const exercisesToAdd = exerciseIds.flatMap((exerciseId) => {
      if (todayExerciseIds.has(exerciseId) || queuedExerciseIds.has(exerciseId)) return [];
      const exercise = state.exercises.find((item) => item.id === exerciseId);
      if (!exercise) return [];
      queuedExerciseIds.add(exerciseId);
      return [exercise];
    });
    return { todayExerciseIds, exercisesToAdd };
  }

  function showPresetStartError(exerciseIds: string[], todayExerciseIds: Set<string>) {
    const hasExisting = exerciseIds.some((exerciseId) => todayExerciseIds.has(exerciseId));
    showScreen('home');
    showToast(hasExisting ? 'すでに追加されています' : 'プリセットの種目が見つかりません');
  }

  function buildWorkoutStartTimes(prev: State, startTime: string) {
    const hasWorkoutsForDate = prev.workouts.some((workout) => workout.date === selectedDate);
    return {
      ...prev.workoutStartTimes,
      [selectedDate]: hasWorkoutsForDate
        ? prev.workoutStartTimes[selectedDate] || startTime
        : startTime,
    };
  }

  /**
   * 編集画面の下書きを新規作成または既存プリセットへ反映する
   */
  function savePreset(preset: Preset) {
    const normalizedPreset = normalizePreset(preset);
    saveState((prev) => ({
      ...prev,
      presets: prev.presets.some((item) => item.id === normalizedPreset.id)
        ? prev.presets.map((item) => (item.id === normalizedPreset.id ? normalizedPreset : item))
        : [normalizedPreset, ...prev.presets],
    }));
    setCurrentPresetId(normalizedPreset.id);
  }

  /**
   * プリセットを削除し、選択・編集中の参照も解除する
   */
  function deletePreset(presetId: string) {
    const presetIndex = state.presets.findIndex((preset) => preset.id === presetId);
    const deletedPreset = state.presets[presetIndex];
    if (!deletedPreset) return;
    saveState((prev) => ({
      ...prev,
      presets: prev.presets.filter((preset) => preset.id !== presetId),
    }));
    if (currentPresetId === presetId) setCurrentPresetId(null);
    showToast(`${deletedPreset.name}を削除しました`, {
      actionLabel: '元に戻す',
      onAction: () => {
        saveState((prev) => {
          if (prev.presets.some((preset) => preset.id === presetId)) return prev;
          const presets = [...prev.presets];
          presets.splice(Math.min(presetIndex, presets.length), 0, deletedPreset);
          return { ...prev, presets };
        });
        setCurrentPresetId(deletedPreset.id);
        showToast(`${deletedPreset.name}を戻しました`);
      },
    });
  }

  /**
   * プリセットの種目を選択日に一括追加する(既に追加済みのものは除く)
   */
  function startPreset(presetId: string) {
    if (state.workoutEndTimes[selectedDate]) return;
    const preset = state.presets.find((item) => item.id === presetId);
    if (!preset || !preset.exerciseIds.length)
      return showToast('プリセットに種目を追加してください');
    const { todayExerciseIds, exercisesToAdd } = collectPresetExercises(preset.exerciseIds);
    if (!exercisesToAdd.length) {
      showPresetStartError(preset.exerciseIds, todayExerciseIds);
      return;
    }
    const newWorkouts = exercisesToAdd.map((exercise) => ({
      ...createWorkout(exercise, selectedDate),
      presetId: preset.id,
    }));
    const startTime = formatTimeOfDay(new Date());
    saveState((prev) => {
      return {
        ...prev,
        workouts: [...prev.workouts, ...newWorkouts],
        workoutStartTimes: buildWorkoutStartTimes(prev, startTime),
      };
    });
    showScreen('home');
    showToast(`${exercisesToAdd.length}種目を追加しました`);
  }

  /**
   * プリセット下書きを保存し、同じ更新で選択日のトレーニングを開始する
   */
  function saveAndStartPreset(preset: Preset) {
    if (state.workoutEndTimes[selectedDate]) return;
    const normalizedPreset = normalizePreset(preset);
    if (!normalizedPreset.exerciseIds.length)
      return showToast('プリセットに種目を追加してください');

    const { todayExerciseIds, exercisesToAdd } = collectPresetExercises(
      normalizedPreset.exerciseIds,
    );
    if (!exercisesToAdd.length) {
      showPresetStartError(normalizedPreset.exerciseIds, todayExerciseIds);
      return;
    }

    const newWorkouts = exercisesToAdd.map((exercise) => ({
      ...createWorkout(exercise, selectedDate),
      presetId: normalizedPreset.id,
    }));
    const startTime = formatTimeOfDay(new Date());
    saveState((prev) => {
      return {
        ...prev,
        presets: prev.presets.some((item) => item.id === normalizedPreset.id)
          ? prev.presets.map((item) => (item.id === normalizedPreset.id ? normalizedPreset : item))
          : [normalizedPreset, ...prev.presets],
        workouts: [...prev.workouts, ...newWorkouts],
        workoutStartTimes: buildWorkoutStartTimes(prev, startTime),
      };
    });
    setCurrentPresetId(normalizedPreset.id);
    showScreen('home');
    showToast(`${exercisesToAdd.length}種目を追加しました`);
  }

  return {
    currentPresetId,
    setCurrentPresetId,
    currentPreset,
    savePreset,
    saveAndStartPreset,
    deletePreset,
    startPreset,
  };
}
