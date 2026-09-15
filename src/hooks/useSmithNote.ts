import { useCallback, useEffect, useMemo } from 'react';
import { useBackup } from './useBackup';
import { useExerciseActions } from './useExerciseActions';
import { useSmithNoteCore } from './useSmithNoteCore';
import { useSmithNoteSelectors } from './useSmithNoteSelectors';
import { useSmithNoteUi } from './useSmithNoteUi';
import { useNavigation } from './useNavigation';
import { usePartActions } from './usePartActions';
import { usePresetActions } from './usePresetActions';
import { useWorkoutActions } from './useWorkoutActions';
import {
  cancelWorkoutReminderNotification,
  requestWorkoutReminderPermission,
  sendTestWorkoutReminderNotification,
  syncWorkoutReminderNotification,
} from '../notifications';
import {
  defaultRestTimerAlertVolume,
  defaultRestTimerSeconds,
  Preset,
  ThemeMode,
  WeightUnit,
} from '../types';
import { uid } from '../utils';

/**
 * 各フックを束ね、画面に渡す state・派生値・操作(actions)をまとめる統合フック
 */
export function useSmithNote() {
  const core = useSmithNoteCore();
  const ui = useSmithNoteUi();
  const nav = useNavigation({
    state: core.state,
    saveState: core.saveState,
    setEditMode: ui.setEditMode,
    setGoalAchievement: ui.setGoalAchievement,
  });
  const selectors = useSmithNoteSelectors(core.state, nav.selectedDate);

  const presets = usePresetActions({
    state: core.state,
    saveState: core.saveState,
    showToast: core.showToast,
    showScreen: nav.showScreen,
    selectedDate: nav.selectedDate,
  });

  const workout = useWorkoutActions({
    state: core.state,
    saveState: core.saveState,
    showToast: core.showToast,
    showScreen: nav.showScreen,
    selectedDate: nav.selectedDate,
    currentWorkout: nav.currentWorkout,
    currentWorkoutId: nav.currentWorkoutId,
    setCurrentWorkoutId: nav.setCurrentWorkoutId,
    selectedWorkouts: nav.selectedWorkouts,
  });

  useEffect(() => {
    if (nav.screen === 'detail') return;
    if (!core.state.workouts.some((item) => item.usageStartedAt)) return;
    workout.pauseAllWorkoutUsage();
  }, [core.state.workouts, nav.screen, workout]);

  const exercise = useExerciseActions({
    state: core.state,
    saveState: core.saveState,
    showToast: core.showToast,
  });

  const part = usePartActions({
    state: core.state,
    saveState: core.saveState,
    showToast: core.showToast,
  });

  const backup = useBackup({
    state: core.state,
    setState: core.setState,
    flushState: core.flushState,
    showToast: core.showToast,
    selectedDate: nav.selectedDate,
    setSelectedDate: nav.setSelectedDate,
    setCurrentWorkoutId: nav.setCurrentWorkoutId,
    setCurrentPresetId: presets.setCurrentPresetId,
  });

  const setWeightUnit = useCallback(
    (weightUnit: WeightUnit) => {
      core.saveState((current) => ({ ...current, weightUnit }));
    },
    [core],
  );

  const setThemeMode = useCallback(
    (themeMode: ThemeMode) => {
      core.saveState((current) => ({ ...current, themeMode }));
    },
    [core],
  );

  const setRestTimerAutoStart = useCallback(
    (autoStartOnIntensity: boolean) => {
      core.saveState((current) => ({
        ...current,
        restTimerSettings: {
          ...(current.restTimerSettings ?? {
            autoStartOnIntensity: true,
            defaultSeconds: defaultRestTimerSeconds,
            alertVolume: defaultRestTimerAlertVolume,
          }),
          autoStartOnIntensity,
        },
      }));
    },
    [core],
  );

  const setRestTimerDefaultSeconds = useCallback(
    (defaultSeconds: number) => {
      const seconds = Math.max(1, Math.min(999, Number(defaultSeconds) || defaultRestTimerSeconds));
      core.saveState((current) => ({
        ...current,
        restTimerSettings: {
          ...(current.restTimerSettings ?? {
            autoStartOnIntensity: true,
            defaultSeconds: defaultRestTimerSeconds,
            alertVolume: defaultRestTimerAlertVolume,
          }),
          defaultSeconds: seconds,
        },
      }));
    },
    [core],
  );

  const setRestTimerAlertVolume = useCallback(
    (alertVolume: number) => {
      const volume = Math.max(0, Math.min(100, Math.round(Number(alertVolume))));
      core.saveState((current) => ({
        ...current,
        restTimerSettings: {
          ...current.restTimerSettings,
          alertVolume: volume,
        },
      }));
    },
    [core],
  );

  const setWorkoutReminderEnabled = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        await cancelWorkoutReminderNotification();
        core.saveState((current) => ({
          ...current,
          notificationSettings: { ...current.notificationSettings, enabled: false },
        }));
        core.showToast('通知をオフにしました');
        return;
      }

      const permission = await requestWorkoutReminderPermission();
      if (permission !== 'granted') {
        core.saveState((current) => ({
          ...current,
          notificationSettings: { ...current.notificationSettings, enabled: false },
        }));
        core.showToast(
          permission === 'unsupported'
            ? 'この環境では通知を利用できません'
            : '通知が許可されませんでした',
        );
        return;
      }

      core.saveState((current) => ({
        ...current,
        notificationSettings: { ...current.notificationSettings, enabled: true },
      }));
      core.showToast('通知をオンにしました');
    },
    [core],
  );

  const sendWorkoutReminderTestNotification = useCallback(async () => {
    const permission = await sendTestWorkoutReminderNotification();
    if (permission !== 'granted') {
      core.showToast(
        permission === 'unsupported'
          ? 'この環境では通知を利用できません'
          : '通知が許可されませんでした',
      );
      return;
    }

    core.showToast('テスト通知を送信しました');
  }, [core]);

  useEffect(() => {
    void syncWorkoutReminderNotification(core.state);
  }, [core.state]);

  const openExerciseEditor = useCallback(
    (part: string, exerciseId: string | null = null) => {
      ui.setExerciseEditor({ part, exerciseId });
      nav.showScreen('exerciseEdit');
    },
    [nav, ui],
  );

  const closeExerciseEditor = useCallback(() => {
    ui.setExerciseEditor(null);
    nav.goBack();
  }, [nav, ui]);

  /**
   * 分析画面を通常表示で開く
   */
  const openAnalysis = useCallback(() => {
    ui.setAnalysisTargetExerciseId(null);
    nav.showScreen('analysis');
  }, [nav, ui]);

  /**
   * 指定種目の成長グラフを選択した状態で分析画面を開く
   */
  const openExerciseGrowthAnalysis = useCallback(
    (exerciseId: string) => {
      ui.setAnalysisTargetExerciseId(exerciseId);
      nav.showScreen('analysis');
    },
    [nav, ui],
  );

  /**
   * 新規プリセットの下書きを作成して編集画面を開く
   */
  const createPresetDraft = useCallback(() => {
    ui.setPresetDraftMode('menu');
    ui.setPresetDraft({ id: uid(), name: '新規メニュー', exerciseIds: [] });
    nav.showScreen('presetEdit');
  }, [nav, ui]);

  /**
   * ホームの開始導線から、新規メニューの下書きを開く
   */
  const createPresetDraftForStart = useCallback(() => {
    ui.setPresetDraftMode('start');
    ui.setPresetDraft({ id: uid(), name: '新規メニュー', exerciseIds: [] });
    nav.showScreen('presetEdit');
  }, [nav, ui]);

  /**
   * 既存プリセットを複製した下書きで編集画面を開く
   */
  const editPreset = useCallback(
    (presetId: string) => {
      const preset = core.state.presets.find((item) => item.id === presetId);
      if (!preset) return;
      ui.setPresetDraftMode('menu');
      ui.setPresetDraft({
        ...preset,
        exerciseIds: [...preset.exerciseIds],
        schedule: preset.schedule
          ? { ...preset.schedule, weekdays: [...preset.schedule.weekdays] }
          : undefined,
      });
      nav.showScreen('presetEdit');
    },
    [core.state.presets, nav, ui],
  );

  /**
   * ホームの開始導線から、選択中メニューの下書きを開く
   */
  const editPresetForStart = useCallback(
    (presetId: string) => {
      const preset = core.state.presets.find((item) => item.id === presetId);
      if (!preset) return;
      ui.setPresetDraftMode('start');
      ui.setPresetDraft({
        ...preset,
        exerciseIds: [...preset.exerciseIds],
        schedule: preset.schedule
          ? { ...preset.schedule, weekdays: [...preset.schedule.weekdays] }
          : undefined,
      });
      nav.showScreen('presetEdit');
    },
    [core.state.presets, nav, ui],
  );

  /**
   * プリセット下書きの一部を更新する
   */
  const updatePresetDraft = useCallback(
    (update: Partial<Preset>) => {
      ui.setPresetDraft((current) => (current ? { ...current, ...update } : current));
    },
    [ui],
  );

  /**
   * プリセット下書きの種目を追加・解除する
   */
  const togglePresetDraftExercise = useCallback(
    (exerciseId: string) => {
      ui.setPresetDraft((current) => {
        if (!current) return current;
        const exerciseIds = current.exerciseIds.includes(exerciseId)
          ? current.exerciseIds.filter((id) => id !== exerciseId)
          : [...current.exerciseIds, exerciseId];
        return { ...current, exerciseIds };
      });
    },
    [ui],
  );

  /**
   * プリセット下書きを保存してトレーニングメニュー画面へ戻る
   */
  const savePresetDraft = useCallback(() => {
    if (!ui.presetDraft) return;
    if (ui.presetDraftMode === 'start') {
      presets.saveAndStartPreset(ui.presetDraft);
      ui.setPresetDraft(null);
      ui.setPresetDraftMode('menu');
      return;
    }
    presets.savePreset(ui.presetDraft);
    ui.setPresetDraft(null);
    ui.setPresetDraftMode('menu');
    nav.showScreen('trainingMenu');
  }, [nav, presets, ui]);

  /**
   * プリセット下書きを破棄してトレーニングメニュー画面へ戻る
   */
  const cancelPresetDraft = useCallback(() => {
    ui.setPresetDraft(null);
    ui.setPresetDraftMode('menu');
    nav.goBack();
  }, [nav, ui]);

  const actions = useMemo(
    () => ({
      addExerciseToPart: exercise.addExerciseToPart,
      addExerciseToToday: workout.addExerciseToToday,
      addSet: workout.addSet,
      copyWorkoutSetValues: workout.copyWorkoutSetValues,
      reorderPartExercises: exercise.reorderPartExercises,
      createPresetDraft,
      createPresetDraftForStart,
      deleteExercise: exercise.deleteExercise,
      deletePreset: presets.deletePreset,
      deleteSet: workout.deleteSet,
      deleteWorkout: workout.deleteWorkout,
      endWorkoutDay: workout.endWorkoutDay,
      exportState: backup.exportState,
      importState: backup.importState,
      pendingImport: backup.pendingImport,
      confirmImportState: backup.confirmImportState,
      cancelImportState: backup.cancelImportState,
      cloud: backup.cloud,
      moveDate: nav.moveDate,
      moveMonth: nav.moveMonth,
      moveWorkout: workout.moveWorkout,
      openWorkoutDetail: workout.openWorkoutDetail,
      openAnalysis,
      openExerciseGrowthAnalysis,
      openExerciseEditor,
      editPreset,
      editPresetForStart,
      updatePresetDraft,
      togglePresetDraftExercise,
      savePresetDraft,
      cancelPresetDraft,
      resumeWorkoutDay: workout.resumeWorkoutDay,
      selectDate: nav.setSelectedDate,
      selectPreset: presets.setCurrentPresetId,
      setCurrentWorkoutId: nav.setCurrentWorkoutId,
      setScreen: nav.showScreen,
      goBack: nav.goBack,
      setEditMode: ui.setEditMode,
      setWeightUnit,
      setThemeMode,
      setRestTimerAutoStart,
      setRestTimerAlertVolume,
      setRestTimerDefaultSeconds,
      setWorkoutReminderEnabled,
      sendWorkoutReminderTestNotification,
      startPreset: presets.startPreset,
      addPart: part.addPart,
      deletePart: part.deletePart,
      reorderParts: part.reorderParts,
      setPartColor: part.setPartColor,
      selectPart: ui.selectPart,
      updateExercise: exercise.updateExercise,
      updateExerciseGoal: exercise.updateExerciseGoal,
      updateExerciseNote: exercise.updateExerciseNote,
      clearGoalAchievement: () => ui.setGoalAchievement(null),
      clearScreenTransition: nav.clearScreenTransition,
      clearToast: core.clearToast,
      closeExerciseEditor,
      updateSet: workout.updateSet,
      updateSetAchievement: workout.updateSetAchievement,
      resetSetAchievement: workout.resetSetAchievement,
      updateWorkoutNote: workout.updateWorkoutNote,
      startWorkoutUsage: workout.startWorkoutUsage,
      pauseWorkoutUsage: workout.pauseWorkoutUsage,
      resetWorkoutUsage: workout.resetWorkoutUsage,
      updateSetIntensity: workout.updateSetIntensity,
      updateWorkoutGrip: workout.updateWorkoutGrip,
      updateWorkoutGripStyle: workout.updateWorkoutGripStyle,
    }),
    [
      backup,
      cancelPresetDraft,
      closeExerciseEditor,
      core.clearToast,
      createPresetDraft,
      createPresetDraftForStart,
      editPreset,
      editPresetForStart,
      exercise,
      nav,
      openAnalysis,
      openExerciseEditor,
      openExerciseGrowthAnalysis,
      part,
      presets,
      savePresetDraft,
      sendWorkoutReminderTestNotification,
      setRestTimerAutoStart,
      setRestTimerAlertVolume,
      setRestTimerDefaultSeconds,
      setThemeMode,
      setWeightUnit,
      setWorkoutReminderEnabled,
      togglePresetDraftExercise,
      ui,
      updatePresetDraft,
      workout,
    ],
  );

  return useMemo(
    () => ({
      currentPreset: presets.currentPreset,
      currentWorkout: nav.currentWorkout,
      editMode: ui.editMode,
      presetDraft: ui.presetDraft,
      presetDraftMode: ui.presetDraftMode,
      activePart: ui.activePart,
      exerciseEditor: ui.exerciseEditor,
      analysisTargetExerciseId: ui.analysisTargetExerciseId,
      groupedExercises: selectors.groupedExercises,
      partRecentLabels: selectors.partRecentLabels,
      orderedParts: selectors.orderedParts,
      partColors: selectors.partColors,
      screen: nav.screen,
      transitionFrom: nav.transitionFrom,
      transitionDirection: nav.transitionDirection,
      selectedDate: nav.selectedDate,
      selectedScheduledPresets: selectors.selectedScheduledPresets,
      selectedWorkouts: nav.selectedWorkouts,
      splitPartOptions: selectors.splitPartOptions,
      state: core.state,
      toast: core.toast,
      goalAchievement: ui.goalAchievement,
      actions,
    }),
    [actions, core, nav, presets, selectors, ui],
  );
}
