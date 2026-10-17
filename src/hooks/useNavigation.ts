import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Screen, State } from '../types';
import { isBlank, localDate, parseDate } from '../utils';
import { findCurrentWorkout } from '../selectors/smithNoteSelectors';
import { screenFromPath, screenPaths } from '../routes';
import { GoalAchievement } from './useSmithNoteUi';
import { appendGoalAchievement, findGoalAchievement } from './goalAchievement';

export type ScreenTransitionDirection = 'forward' | 'back' | 'none';

type NavigationDeps = {
  state: State;
  saveState: (updater: (draft: State) => State) => void;
  setEditMode: (value: boolean) => void;
  setGoalAchievement: (value: GoalAchievement | null) => void;
};

const screenDepth: Record<Screen, number> = {
  auth: 0,
  home: 0,
  select: 1,
  trainingMenu: 1,
  goalAchievements: 1,
  analysis: 1,
  settings: 1,
  notificationSettings: 2,
  privacyPolicy: 2,
  termsOfService: 2,
  backup: 2,
  accountManagement: 3,
  forgotPassword: 3,
  detail: 1,
  exerciseEdit: 3,
  presetEdit: 2,
  partEdit: 2,
  exerciseManage: 2,
  exerciseHistory: 2,
  presetExerciseSelect: 3,
};

const fallbackBackScreens: Record<Screen, Screen> = {
  auth: 'home',
  home: 'home',
  select: 'home',
  trainingMenu: 'home',
  goalAchievements: 'home',
  analysis: 'home',
  settings: 'home',
  detail: 'home',
  exerciseEdit: 'select',
  exerciseHistory: 'detail',
  presetEdit: 'trainingMenu',
  presetExerciseSelect: 'presetEdit',
  partEdit: 'settings',
  exerciseManage: 'settings',
  notificationSettings: 'settings',
  privacyPolicy: 'settings',
  termsOfService: 'settings',
  backup: 'settings',
  accountManagement: 'settings',
  forgotPassword: 'backup',
};

function getTransitionDirection(current: Screen, next: Screen): ScreenTransitionDirection {
  if (current === next) return 'none';
  if (current === 'auth' || next === 'auth') return 'none';
  return screenDepth[next] > screenDepth[current] ? 'forward' : 'back';
}

/**
 * 画面遷移・選択中の日付・対象ワークアウトなど、ナビゲーション状態を管理するフック
 */
export function useNavigation({
  state,
  saveState,
  setEditMode,
  setGoalAchievement,
}: NavigationDeps) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeScreen = screenFromPath(location.pathname);
  const screen = routeScreen ?? 'home';
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date()));
  const [transitionFrom, setTransitionFrom] = useState<Screen | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<ScreenTransitionDirection>('none');
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(null);
  const previousScreen = useRef(screen);
  const pendingScreen = useRef<Screen | null>(null);
  const pendingBack = useRef(false);
  const handleScreenExitRef = useRef<(source: Screen, next: Screen) => void>(() => undefined);

  /**
   * 選択中の日付に紐づくワークアウト一覧
   */
  const selectedWorkouts = useMemo(
    () => state.workouts.filter((workout) => workout.date === selectedDate),
    [selectedDate, state.workouts],
  );
  /**
   * 詳細画面などで操作対象となっているワークアウト
   */
  const currentWorkout = useMemo(
    () => findCurrentWorkout(state.workouts, currentWorkoutId, selectedDate, selectedWorkouts),
    [currentWorkoutId, selectedDate, selectedWorkouts, state.workouts],
  );

  useEffect(() => {
    if (routeScreen) return;
    void navigate(screenPaths.home, { replace: true });
  }, [navigate, routeScreen]);

  useEffect(() => {
    const previous = previousScreen.current;
    previousScreen.current = screen;
    if (previous === screen) return;
    if (pendingScreen.current === screen) {
      pendingScreen.current = null;
      return;
    }
    handleScreenExitRef.current(previous, screen);
    setTransitionFrom(previous);
    setTransitionDirection(pendingBack.current ? 'back' : getTransitionDirection(previous, screen));
    pendingBack.current = false;
  }, [screen]);

  /**
   * 詳細画面を離れる際、未入力のままの空セットを取り除く
   */
  function cleanupBlankDetailSets(sourceScreen: Screen) {
    if (sourceScreen !== 'detail' || !currentWorkout || currentWorkout.multiSetGroupId) return;
    if (state.workoutEndTimes[currentWorkout.date]) return;
    saveState((prev) => {
      const workout = prev.workouts.find((item) => item.id === currentWorkout.id);
      if (!workout) return prev;
      const recordedSets = workout.sets.filter(
        (set) => !isBlank(set.weight) || !isBlank(set.recordValue),
      );
      if (!recordedSets.length) return prev;
      if (recordedSets.length === workout.sets.length) return prev;
      const workouts = prev.workouts.map((item) =>
        item.id === workout.id ? { ...item, sets: recordedSets } : item,
      );
      return { ...prev, workouts };
    });
  }

  /**
   * 画面を離れる際の後片付けと編集モード解除を行う
   */
  function handleScreenExit(sourceScreen: Screen, next: Screen) {
    const isReadOnlyWorkout = Boolean(currentWorkout && state.workoutEndTimes[currentWorkout.date]);
    if (sourceScreen === 'detail' && next !== 'detail' && currentWorkout) {
      if (isReadOnlyWorkout) {
        if (next !== 'select') setEditMode(false);
        return;
      }
      const goalResult = findGoalAchievement(state, currentWorkout);
      if (goalResult) {
        saveState((prev) => appendGoalAchievement(prev, currentWorkout, goalResult));
        setGoalAchievement(goalResult.achievement);
      }
    }
    if (next !== 'detail' && next !== 'exerciseHistory') cleanupBlankDetailSets(sourceScreen);
    if (next !== 'select' && next !== 'exerciseEdit') setEditMode(false);
  }

  handleScreenExitRef.current = handleScreenExit;

  /**
   * 画面を切り替える。離脱処理後にURL履歴へ遷移先を追加する
   */
  function showScreen(next: Screen) {
    handleScreenExit(screen, next);
    const replacesExerciseSelection = screen === 'select' && next === 'detail';
    const returnsFromSavedPresetEditor = screen === 'presetEdit' && next === 'trainingMenu';
    const direction = replacesExerciseSelection ? 'forward' : getTransitionDirection(screen, next);
    setTransitionFrom(direction === 'none' ? null : screen);
    setTransitionDirection(direction);
    pendingScreen.current = next;
    if (returnsFromSavedPresetEditor) {
      void navigate(-1);
      return;
    }
    void navigate(screenPaths[next], { replace: replacesExerciseSelection });
  }

  /**
   * React Router の履歴を戻り、直接アクセス時だけ既定画面へ置き換える
   */
  function goBack() {
    if (screen === 'home') return;
    const historyState: unknown = window.history.state;
    const historyIndex =
      typeof historyState === 'object' && historyState !== null && 'idx' in historyState
        ? historyState.idx
        : null;
    const hasPreviousEntry =
      location.key !== 'default' || (typeof historyIndex === 'number' && historyIndex > 0);
    if (hasPreviousEntry) {
      pendingBack.current = true;
      void navigate(-1);
      return;
    }

    const next = fallbackBackScreens[screen];
    handleScreenExit(screen, next);
    setTransitionFrom(screen);
    setTransitionDirection('back');
    pendingScreen.current = next;
    void navigate(screenPaths[next], { replace: true });
  }

  /**
   * 選択日を指定日数ぶん前後に動かしてホームへ戻る
   */
  function moveDate(days: number) {
    const next = parseDate(selectedDate);
    next.setDate(next.getDate() + days);
    setSelectedDate(localDate(next));
    setCurrentWorkoutId(null);
    showScreen('home');
  }

  /**
   * カレンダー表示を指定月ぶん前後に動かす
   */
  function moveMonth(delta: number) {
    const next = parseDate(selectedDate);
    next.setMonth(next.getMonth() + delta, 1);
    setSelectedDate(localDate(next));
    setCurrentWorkoutId(null);
  }

  return {
    selectedDate,
    setSelectedDate,
    screen,
    transitionFrom,
    transitionDirection,
    clearScreenTransition: () => setTransitionFrom(null),
    showScreen,
    goBack,
    currentWorkoutId,
    setCurrentWorkoutId,
    selectedWorkouts,
    currentWorkout,
    moveDate,
    moveMonth,
  };
}
