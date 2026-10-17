import {
  GripStyleType,
  GripType,
  Screen,
  SetAchievement,
  SetIntensity,
  State,
  Workout,
  WorkoutSet,
} from '../types';
import {
  uid,
  formatTimeOfDay,
  isUnstartedWorkout,
  newSet,
  normalizeDefaultSetCount,
  workoutUsageElapsedSeconds,
} from '../utils';
import { createWorkout } from '../selectors/smithNoteSelectors';

type WorkoutActionsDeps = {
  state: State;
  saveState: (updater: (draft: State) => State) => void;
  showToast: (message: string, action?: { actionLabel?: string; onAction?: () => void }) => void;
  showScreen: (next: Screen) => void;
  selectedDate: string;
  currentWorkout: Workout | null;
  currentWorkoutId: string | null;
  setCurrentWorkoutId: (workoutId: string | null) => void;
  selectedWorkouts: Workout[];
};

/**
 * ワークアウトとセットの追加・更新・削除・並び替えを担うフック
 */
export function useWorkoutActions({
  state,
  saveState,
  showToast,
  showScreen,
  selectedDate,
  currentWorkoutId,
  setCurrentWorkoutId,
  selectedWorkouts,
}: WorkoutActionsDeps) {
  function pauseUsageTimer(workout: Workout, now: number): Workout {
    if (!workout.usageStartedAt) return workout;
    const nextWorkout = {
      ...workout,
      usageElapsedSeconds: workoutUsageElapsedSeconds(workout, now),
    };
    delete nextWorkout.usageStartedAt;
    return nextWorkout;
  }

  /**
   * 指定日のトレーニングが終了済みか判定する
   */
  function isWorkoutDayEnded(date: string) {
    return Boolean(state.workoutEndTimes[date]);
  }

  function findWorkoutBySetId(setId: string, workouts = state.workouts) {
    return workouts.find((workout) => workout.sets.some((set) => set.id === setId));
  }

  /**
   * セット単位の更新で共通する検索と差し替えをまとめる
   */
  function updateWorkoutSet(setId: string, buildSet: (set: WorkoutSet) => WorkoutSet) {
    const target = findWorkoutBySetId(setId);
    if (!target || isWorkoutDayEnded(target.date)) return;
    saveState((prev) => {
      const workoutIndex = prev.workouts.findIndex((workout) =>
        workout.sets.some((set) => set.id === setId),
      );
      const workout = prev.workouts[workoutIndex];
      if (!workout || prev.workoutEndTimes[workout.date]) return prev;
      const setIndex = workout.sets.findIndex((set) => set.id === setId);
      if (setIndex === -1) return prev;
      const sets = [...workout.sets];
      sets[setIndex] = buildSet(sets[setIndex]);
      const workouts = [...prev.workouts];
      workouts[workoutIndex] = { ...workout, sets };
      return { ...prev, workouts };
    });
  }

  /**
   * トレーニング終了時刻を保存し、保存した時刻を返す
   */
  function endWorkoutDay(removeUnstartedWorkouts = false) {
    if (!state.workoutStartTimes[selectedDate]) return null;
    const endTime = formatTimeOfDay(new Date());
    saveState((prev) => ({
      ...prev,
      workouts: (removeUnstartedWorkouts
        ? prev.workouts.filter(
            (workout) => workout.date !== selectedDate || !isUnstartedWorkout(workout),
          )
        : prev.workouts
      ).map((workout) =>
        workout.date === selectedDate ? pauseUsageTimer(workout, Date.now()) : workout,
      ),
      workoutEndTimes: {
        ...prev.workoutEndTimes,
        [selectedDate]: endTime,
      },
    }));
    return endTime;
  }

  /**
   * 選択日の終了時刻を削除し、トレーニングを編集可能な状態へ戻す
   */
  function resumeWorkoutDay() {
    saveState((prev) => {
      const workoutEndTimes = { ...prev.workoutEndTimes };
      delete workoutEndTimes[selectedDate];
      return { ...prev, workoutEndTimes };
    });
  }

  /**
   * 指定した種目記録を対象に履歴一覧を開く
   */
  function openWorkoutHistory(workoutId: string) {
    if (!state.workouts.some((item) => item.id === workoutId)) return;
    setCurrentWorkoutId(workoutId);
    showScreen('exerciseHistory');
  }

  /**
   * 詳細画面を開き、設定したデフォルトのセット数まで不足分を補充する
   */
  function openWorkoutDetail(workoutId: string) {
    const target = state.workouts.find((workout) => workout.id === workoutId);
    if (!target) return;
    if (isWorkoutDayEnded(target.date)) {
      setCurrentWorkoutId(workoutId);
      showScreen('detail');
      return;
    }
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) => {
        const setCount = normalizeDefaultSetCount(prev.defaultSetCount);
        const belongsToDetail =
          workout.id === workoutId ||
          Boolean(
            target.multiSetGroupId &&
            workout.date === target.date &&
            workout.multiSetGroupId === target.multiSetGroupId,
          );
        if (!belongsToDetail || workout.sets.length >= setCount) return workout;
        return {
          ...workout,
          sets: [
            ...workout.sets,
            ...Array.from({ length: setCount - workout.sets.length }, () =>
              newSet(workout.measurementType === 'reps' ? prev.defaultReps : null),
            ),
          ],
        };
      }),
    }));
    setCurrentWorkoutId(workoutId);
    showScreen('detail');
  }

  /**
   * 選択日に種目を追加する。既にあれば再利用してその詳細を開く
   */
  function addExerciseToToday(exerciseId: string) {
    if (isWorkoutDayEnded(selectedDate)) return;
    const exercise = state.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const startTime = formatTimeOfDay(new Date());
    const existing = state.workouts.find(
      (item) => item.date === selectedDate && item.exerciseId === exerciseId,
    );
    const workout =
      existing || createWorkout(exercise, selectedDate, state.defaultReps, state.defaultSetCount);
    saveState((prev) => {
      const hasWorkoutsForDate = prev.workouts.some((item) => item.date === selectedDate);
      const workoutStartTimes =
        hasWorkoutsForDate && prev.workoutStartTimes[selectedDate]
          ? prev.workoutStartTimes
          : {
              ...prev.workoutStartTimes,
              [selectedDate]: startTime,
            };
      return {
        ...prev,
        workouts: existing ? prev.workouts : [...prev.workouts, workout],
        workoutStartTimes,
      };
    });
    if (existing) {
      openWorkoutDetail(workout.id);
      return;
    }
    setCurrentWorkoutId(workout.id);
    showScreen('detail');
  }

  /**
   * 選択順に種目をグループ化し、既存記録を保持して詳細へ進む
   */
  function startMultiSet(exerciseIds: string[]) {
    if (isWorkoutDayEnded(selectedDate)) return;
    const exercises = [...new Set(exerciseIds)].flatMap((id) => {
      const exercise = state.exercises.find((item) => item.id === id);
      return exercise ? [exercise] : [];
    });
    if (exercises.length < 2) return;
    const groupId = uid();
    const grouped = exercises.map((exercise, index) => ({
      ...(state.workouts.find(
        (item) => item.date === selectedDate && item.exerciseId === exercise.id,
      ) ?? createWorkout(exercise, selectedDate, state.defaultReps, state.defaultSetCount)),
      multiSetGroupId: groupId,
      multiSetOrder: index,
    }));
    const replacedIds = new Set(grouped.map((item) => item.id));
    const oldGroups = new Set(
      grouped
        .map((item) => state.workouts.find((old) => old.id === item.id)?.multiSetGroupId)
        .filter(Boolean),
    );
    saveState((prev) => ({
      ...prev,
      workouts: [
        ...prev.workouts
          .filter((item) => !replacedIds.has(item.id))
          .map((item) => {
            if (
              item.date !== selectedDate ||
              !item.multiSetGroupId ||
              !oldGroups.has(item.multiSetGroupId)
            )
              return item;
            const next = { ...item };
            delete next.multiSetGroupId;
            delete next.multiSetOrder;
            return next;
          }),
        ...grouped,
      ],
      workoutStartTimes: {
        ...prev.workoutStartTimes,
        [selectedDate]:
          prev.workouts.some((item) => item.date === selectedDate) &&
          prev.workoutStartTimes[selectedDate]
            ? prev.workoutStartTimes[selectedDate]
            : formatTimeOfDay(new Date()),
      },
    }));
    setCurrentWorkoutId(grouped[0].id);
    showScreen('detail');
  }

  /**
   * 同じグループの各種目を次のラウンドまで補充する
   */
  function addMultiSetRound(workoutId: string) {
    const target = state.workouts.find((item) => item.id === workoutId);
    if (!target?.multiSetGroupId || isWorkoutDayEnded(target.date)) return;
    saveState((prev) => {
      const members = prev.workouts.filter(
        (item) => item.date === target.date && item.multiSetGroupId === target.multiSetGroupId,
      );
      const count = Math.max(...members.map((item) => item.sets.length)) + 1;
      return {
        ...prev,
        workouts: prev.workouts.map((item) =>
          members.some((member) => member.id === item.id)
            ? {
                ...item,
                sets: [
                  ...item.sets,
                  ...Array.from({ length: count - item.sets.length }, () =>
                    newSet(item.measurementType === 'reps' ? prev.defaultReps : null),
                  ),
                ],
              }
            : item,
        ),
      };
    });
  }

  /**
   * 指定ワークアウトに空のセットを1つ追加する
   */
  function addSet(workoutId: string) {
    const target = state.workouts.find((workout) => workout.id === workoutId);
    if (!target || isWorkoutDayEnded(target.date)) return;
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) =>
        workout.id === workoutId
          ? {
              ...workout,
              sets: [
                ...workout.sets,
                newSet(workout.measurementType === 'reps' ? prev.defaultReps : null),
              ],
            }
          : workout,
      ),
    }));
    setCurrentWorkoutId(workoutId);
    showScreen('detail');
  }

  /**
   * 前回記録の重量・回数を今回の同じセット番号へコピーする
   */
  function copyWorkoutSetValues(workoutId: string, sourceSets: Workout['sets']) {
    const target = state.workouts.find((workout) => workout.id === workoutId);
    if (!target || isWorkoutDayEnded(target.date)) return;
    saveState((prev) => {
      const workoutIndex = prev.workouts.findIndex((workout) => workout.id === workoutId);
      const workout = prev.workouts[workoutIndex];
      if (!workout || prev.workoutEndTimes[workout.date]) return prev;
      const sets = [...workout.sets];
      sourceSets.forEach((sourceSet, index) => {
        const targetSet = sets[index] ?? newSet();
        sets[index] = {
          ...targetSet,
          weight: sourceSet.weight,
          recordValue: sourceSet.recordValue,
        };
      });
      const workouts = [...prev.workouts];
      workouts[workoutIndex] = { ...workout, sets };
      return { ...prev, workouts };
    });
    setCurrentWorkoutId(workoutId);
    showScreen('detail');
  }

  /**
   * セットの重量・回数(秒数)を更新する
   */
  function updateSet(setId: string, field: 'weight' | 'recordValue', value: number | null) {
    updateWorkoutSet(setId, (set) => ({ ...set, [field]: value }));
  }

  /**
   * セットの目標達成状態を記録し、未達なら実績入力欄を空に戻す
   */
  function updateSetAchievement(setId: string, achievement: SetAchievement) {
    updateWorkoutSet(setId, (set) => {
      const targetRecordValue = set.targetRecordValue ?? set.recordValue;
      return {
        ...set,
        achievement,
        targetRecordValue,
        recordValue: achievement === 'missed' ? null : set.recordValue,
      };
    });
  }

  /**
   * セットの達成判定を取り消し、判定前の目標入力へ戻す
   */
  function resetSetAchievement(setId: string) {
    updateWorkoutSet(setId, (set) => {
      const nextSet = {
        ...set,
        recordValue: set.targetRecordValue ?? set.recordValue,
      };
      delete nextSet.targetRecordValue;
      delete nextSet.achievement;
      delete nextSet.intensity;
      return nextSet;
    });
  }

  /**
   * ワークアウト単位のメモを更新する
   */
  function updateWorkoutNote(workoutId: string, note: string) {
    const target = state.workouts.find((workout) => workout.id === workoutId);
    if (!target || isWorkoutDayEnded(target.date)) return;
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) =>
        workout.id === workoutId ? { ...workout, note } : workout,
      ),
    }));
  }

  /**
   * 対象種目の実施時間を開始し、他の種目で動作中のタイマーを停止する
   */
  function startWorkoutUsage(workoutId: string) {
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    saveState((prev) => {
      const target = prev.workouts.find((workout) => workout.id === workoutId);
      if (!target || prev.workoutEndTimes[target.date]) return prev;
      return {
        ...prev,
        workouts: prev.workouts.map((workout) => {
          if (workout.id === workoutId) {
            return workout.usageStartedAt ? workout : { ...workout, usageStartedAt: startedAt };
          }
          return pauseUsageTimer(workout, now);
        }),
      };
    });
  }

  /**
   * 対象種目の実施時間を累積値へ確定して停止する
   */
  function pauseWorkoutUsage(workoutId: string) {
    const now = Date.now();
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) =>
        workout.id === workoutId ? pauseUsageTimer(workout, now) : workout,
      ),
    }));
  }

  /**
   * 詳細画面外に残っているすべての種目実施タイマーを停止する
   */
  function pauseAllWorkoutUsage() {
    const now = Date.now();
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) => pauseUsageTimer(workout, now)),
    }));
  }

  /**
   * 対象種目の実施時間を0秒へ戻して停止する
   */
  function resetWorkoutUsage(workoutId: string) {
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) => {
        if (workout.id !== workoutId || prev.workoutEndTimes[workout.date]) return workout;
        const nextWorkout = { ...workout, usageElapsedSeconds: 0 };
        delete nextWorkout.usageStartedAt;
        return nextWorkout;
      }),
    }));
  }

  /**
   * セットの強度を設定する。未指定(undefined)なら強度を解除する
   */
  function updateSetIntensity(setId: string, intensity?: SetIntensity) {
    updateWorkoutSet(setId, (set) => {
      const nextSet = { ...set };
      if (intensity) {
        nextSet.intensity = intensity;
      } else {
        delete nextSet.intensity;
      }
      return nextSet;
    });
  }

  /**
   * 種目記録の握りの向きを設定する。未指定(undefined)なら選択を解除する
   */
  function updateWorkoutGrip(workoutId: string, grip?: GripType) {
    const target = state.workouts.find((workout) => workout.id === workoutId);
    if (!target || isWorkoutDayEnded(target.date)) return;
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) => {
        if (workout.id !== workoutId) return workout;
        if (!grip) {
          const nextWorkout = { ...workout };
          delete nextWorkout.grip;
          return nextWorkout;
        }
        return { ...workout, grip };
      }),
    }));
  }

  /**
   * 種目記録の握り方を設定する。未指定(undefined)なら選択を解除する
   */
  function updateWorkoutGripStyle(workoutId: string, gripStyle?: GripStyleType) {
    const target = state.workouts.find((workout) => workout.id === workoutId);
    if (!target || isWorkoutDayEnded(target.date)) return;
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) => {
        if (workout.id !== workoutId) return workout;
        if (!gripStyle) {
          const nextWorkout = { ...workout };
          delete nextWorkout.gripStyle;
          return nextWorkout;
        }
        return { ...workout, gripStyle };
      }),
    }));
  }

  /**
   * 現在のワークアウトから指定セットを削除する
   */
  function deleteSet(setId: string) {
    const target = findWorkoutBySetId(setId);
    if (!target || isWorkoutDayEnded(target.date)) return;
    const setIndex = target.sets.findIndex((set) => set.id === setId);
    const deletedSet = target.sets[setIndex];
    if (!deletedSet) return;
    saveState((prev) => ({
      ...prev,
      workouts: prev.workouts.map((workout) =>
        workout.id === target.id
          ? { ...workout, sets: workout.sets.filter((set) => set.id !== setId) }
          : workout,
      ),
    }));
    showToast('セットを削除しました', {
      actionLabel: '元に戻す',
      onAction: () => {
        saveState((prev) => ({
          ...prev,
          workouts: prev.workouts.map((workout) => {
            if (workout.id !== target.id || workout.sets.some((set) => set.id === setId)) {
              return workout;
            }
            const sets = [...workout.sets];
            sets.splice(Math.min(setIndex, sets.length), 0, deletedSet);
            return { ...workout, sets };
          }),
        }));
        setCurrentWorkoutId(target.id);
        showToast('セットを戻しました');
      },
    });
  }

  /**
   * ワークアウトを削除し、グループの場合は同日の全メンバーをまとめて削除する
   */
  function deleteWorkout(workoutId: string) {
    const targetIndex = state.workouts.findIndex((workout) => workout.id === workoutId);
    const target = state.workouts[targetIndex];
    if (!target || isWorkoutDayEnded(target.date)) return;
    const targets = state.workouts.flatMap((item, index) =>
      item.id === workoutId ||
      (target.multiSetGroupId &&
        item.date === target.date &&
        item.multiSetGroupId === target.multiSetGroupId)
        ? [{ workout: item, index }]
        : [],
    );
    const ids = new Set(targets.map((item) => item.workout.id));
    saveState((prev) => ({ ...prev, workouts: prev.workouts.filter((item) => !ids.has(item.id)) }));
    if (currentWorkoutId && ids.has(currentWorkoutId)) setCurrentWorkoutId(null);
    showToast(targets.length > 1 ? 'グループの記録を削除しました' : '種目の記録を削除しました', {
      actionLabel: '元に戻す',
      onAction: () => {
        saveState((prev) => {
          const workouts = [...prev.workouts];
          targets.forEach(({ workout, index }) => {
            if (!workouts.some((item) => item.id === workout.id))
              workouts.splice(Math.min(index, workouts.length), 0, workout);
          });
          return { ...prev, workouts };
        });
        setCurrentWorkoutId(target.id);
        showToast('種目の記録を戻しました');
      },
    });
  }

  /**
   * 選択日内でのワークアウトの並び順を1つ前後に入れ替える
   */
  function moveWorkout(workoutId: string, direction: number) {
    if (isWorkoutDayEnded(selectedDate)) return;
    const index = selectedWorkouts.findIndex((workout) => workout.id === workoutId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedWorkouts.length) return;
    saveState((prev) => {
      const currentGlobalIndex = prev.workouts.findIndex(
        (workout) => workout.id === selectedWorkouts[index].id,
      );
      const nextGlobalIndex = prev.workouts.findIndex(
        (workout) => workout.id === selectedWorkouts[nextIndex].id,
      );
      const workouts = [...prev.workouts];
      [workouts[currentGlobalIndex], workouts[nextGlobalIndex]] = [
        workouts[nextGlobalIndex],
        workouts[currentGlobalIndex],
      ];
      return { ...prev, workouts };
    });
  }

  return {
    startMultiSet,
    addMultiSetRound,
    openWorkoutHistory,
    openWorkoutDetail,
    endWorkoutDay,
    resumeWorkoutDay,
    addExerciseToToday,
    addSet,
    copyWorkoutSetValues,
    updateSet,
    updateSetAchievement,
    resetSetAchievement,
    updateWorkoutNote,
    startWorkoutUsage,
    pauseWorkoutUsage,
    pauseAllWorkoutUsage,
    resetWorkoutUsage,
    updateSetIntensity,
    updateWorkoutGrip,
    updateWorkoutGripStyle,
    deleteSet,
    deleteWorkout,
    moveWorkout,
  };
}
