import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import type { HomeCalendarOverlayState } from './components/HomeCalendar';
import { SmithNoteProvider } from './hooks/SmithNoteContext';
import { useSmithNoteContext } from './hooks/useSmithNoteContext';
import { DetailScreen } from './screens/DetailScreen';
import { ExerciseHistoryScreen } from './screens/ExerciseHistoryScreen';
import { ExerciseEditScreen } from './screens/ExerciseEditScreen';
import { HomeScreen } from './screens/HomeScreen';
import { GoalAchievementScreen } from './screens/GoalAchievementScreen';
import { PartEditScreen } from './screens/PartEditScreen';
import { PresetEditScreen } from './screens/PresetEditScreen';
import { PresetExerciseSelectScreen } from './screens/PresetExerciseSelectScreen';
import { ExerciseManageScreen, SelectScreen } from './screens/SelectScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { NotificationSettingsScreen } from './screens/NotificationSettingsScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { TermsOfServiceScreen } from './screens/TermsOfServiceScreen';
import { BackupScreen } from './screens/BackupScreen';
import { AuthScreen } from './screens/AuthScreen';
import { AccountManagementScreen } from './screens/AccountManagementScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { AnalysisScreen } from './screens/AnalysisScreen';
import { TrainingMenuScreen } from './screens/TrainingMenuScreen';
import { PlusIcon } from './icons';
import { RestTimer } from './components/RestTimer';
import type { Screen } from './types';
import { screenPaths } from './routes';
import { completeAuthIntro, hasCompletedAuthIntro } from './authState';
import {
  formatStoredWeightInput,
  formatWeightForStorageInput,
  measurementUnit,
  number,
  weightUnitLabel,
} from './utils';

export function App() {
  return (
    <SmithNoteProvider>
      <AppShell />
    </SmithNoteProvider>
  );
}

/**
 * 画面の切り替えとトーストを担当する外枠。
 * 各画面に渡す値は Context から各画面が自分で取得するため props は持たせない
 */
function AppShell() {
  const {
    screen,
    transitionFrom,
    transitionDirection,
    currentWorkout,
    selectedDate,
    selectedWorkouts,
    groupedExercises,
    activePart,
    toast,
    goalAchievement,
    state,
    actions,
  } = useSmithNoteContext();
  const appRef = useRef<HTMLElement>(null);
  const [fabFaded, setFabFaded] = useState(false);
  const [partAddDialogOpen, setPartAddDialogOpen] = useState(false);
  const [homeOverlayState, setHomeOverlayState] = useState<HomeCalendarOverlayState>({
    calendarBackdropState: 'closed',
    drawerState: 'closed',
  });
  const workoutEndTime = state.workoutEndTimes[selectedDate];
  const cloud = actions.cloud;
  const currentExerciseManagePart =
    activePart && groupedExercises.has(activePart) ? activePart : [...groupedExercises.keys()][0];
  const showHomeFab = screen === 'home' && !workoutEndTime && selectedWorkouts.length > 0;
  const showExerciseManageFab = screen === 'exerciseManage' && Boolean(currentExerciseManagePart);
  const showTrainingMenuFab = screen === 'trainingMenu';
  const showPartEditFab = screen === 'partEdit';
  const showFab = showHomeFab || showExerciseManageFab || showTrainingMenuFab || showPartEditFab;
  const showRestTimerIdle =
    screen === 'detail' &&
    Boolean(currentWorkout) &&
    !state.workoutEndTimes[currentWorkout?.date ?? ''];
  const drawerOverlayVisible = homeOverlayState.drawerState !== 'closed';
  const drawerOverlayClass = homeOverlayState.drawerState;
  let fabKey = '';
  let fabLabel = '';
  let fabAction: (() => void) | null = null;

  if (showHomeFab) {
    fabKey = 'home-add-exercise';
    fabLabel = '種目を追加';
    fabAction = () => actions.setScreen('select');
  } else if (showExerciseManageFab && currentExerciseManagePart) {
    fabKey = `exercise-manage-add-${currentExerciseManagePart}`;
    fabLabel = `${currentExerciseManagePart}に種目を追加`;
    fabAction = () => actions.openExerciseEditor(currentExerciseManagePart);
  } else if (showTrainingMenuFab) {
    fabKey = 'training-menu-add';
    fabLabel = 'トレーニングメニューを追加';
    fabAction = actions.createPresetDraft;
  } else if (showPartEditFab) {
    fabKey = 'part-edit-add';
    fabLabel = '部位を追加';
    fabAction = () => setPartAddDialogOpen(true);
  }

  useLayoutEffect(() => {
    appRef.current?.scrollTo({ top: 0 });
  }, [screen]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = state.themeMode;
  }, [state.themeMode]);

  useEffect(() => {
    if (!transitionFrom) return undefined;
    const timeoutId = window.setTimeout(actions.clearScreenTransition, 320);
    return () => window.clearTimeout(timeoutId);
  }, [actions.clearScreenTransition, transitionFrom]);

  useLayoutEffect(() => {
    if (!showFab) {
      setFabFaded(false);
      return undefined;
    }

    const app = appRef.current;
    if (!app) return undefined;

    let frameId = 0;

    const checkFabOverlap = () => {
      const fab = document.querySelector<HTMLElement>('.fab');
      const editRows = document.querySelectorAll<HTMLElement>('.exercise-option.edit-row');
      const presetRows = document.querySelectorAll<HTMLElement>('.preset-plan-row');
      const partRows = document.querySelectorAll<HTMLElement>('.part-edit-row');
      let target: HTMLElement | null | undefined = null;

      if (screen === 'home') {
        target = document.querySelector<HTMLElement>('.workout-action-button.primary');
      } else if (screen === 'exerciseManage') {
        target = editRows[editRows.length - 1];
      } else if (screen === 'trainingMenu') {
        target = presetRows[presetRows.length - 1];
      } else if (screen === 'partEdit') {
        target = partRows[partRows.length - 1];
      }

      if (!fab || !target) {
        setFabFaded(false);
        return;
      }

      const fabRect = fab.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const margin = 12;
      const overlaps =
        targetRect.bottom > fabRect.top - margin &&
        targetRect.top < fabRect.bottom + margin &&
        targetRect.right > fabRect.left - margin &&
        targetRect.left < fabRect.right + margin;

      setFabFaded(overlaps);
    };

    const scheduleCheck = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(checkFabOverlap);
    };

    scheduleCheck();
    app.addEventListener('scroll', scheduleCheck, { capture: true, passive: true });
    window.addEventListener('resize', scheduleCheck);

    return () => {
      window.cancelAnimationFrame(frameId);
      app.removeEventListener('scroll', scheduleCheck, true);
      window.removeEventListener('resize', scheduleCheck);
    };
  }, [
    activePart,
    currentExerciseManagePart,
    screen,
    selectedWorkouts.length,
    showFab,
    workoutEndTime,
  ]);

  useEffect(() => {
    if (screen !== 'partEdit') setPartAddDialogOpen(false);
  }, [screen]);

  useEffect(() => {
    if (!cloud.authReady) return;
    if (cloud.signedIn) {
      completeAuthIntro();
      if (screen === 'auth') actions.setScreen('home');
      return;
    }
    if (!hasCompletedAuthIntro() && screen !== 'auth') actions.setScreen('auth');
  }, [actions, cloud.authReady, cloud.signedIn, screen]);

  useEffect(() => {
    if (screen === 'home') return;
    setHomeOverlayState({ calendarBackdropState: 'closed', drawerState: 'closed' });
  }, [screen]);

  function clearScreenTransition(event: AnimationEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return;
    actions.clearScreenTransition();
  }

  function renderScreen(targetScreen: Screen) {
    if (targetScreen === 'auth') {
      return (
        <div className="auth-overlay-stack">
          <div className="auth-home-background" aria-hidden="true" inert>
            <HomeScreen onOverlayStateChange={setHomeOverlayState} />
          </div>
          <AuthScreen />
        </div>
      );
    }
    if (targetScreen === 'home') {
      return <HomeScreen onOverlayStateChange={setHomeOverlayState} />;
    }
    if (targetScreen === 'select') return <SelectScreen />;
    if (targetScreen === 'exerciseEdit') return <ExerciseEditScreen />;
    if (targetScreen === 'detail') {
      return currentWorkout ? <DetailScreen /> : <Navigate replace to={screenPaths.home} />;
    }
    if (targetScreen === 'exerciseHistory') {
      return currentWorkout ? (
        <ExerciseHistoryScreen />
      ) : (
        <Navigate replace to={screenPaths.home} />
      );
    }
    if (targetScreen === 'goalAchievements') return <GoalAchievementScreen />;
    if (targetScreen === 'presetEdit') return <PresetEditScreen />;
    if (targetScreen === 'presetExerciseSelect') return <PresetExerciseSelectScreen />;
    if (targetScreen === 'trainingMenu') return <TrainingMenuScreen />;
    if (targetScreen === 'analysis') return <AnalysisScreen />;
    if (targetScreen === 'partEdit') {
      return (
        <PartEditScreen
          addDialogOpen={partAddDialogOpen}
          onCloseAddDialog={() => setPartAddDialogOpen(false)}
        />
      );
    }
    if (targetScreen === 'exerciseManage') return <ExerciseManageScreen />;
    if (targetScreen === 'settings') return <SettingsScreen />;
    if (targetScreen === 'notificationSettings') return <NotificationSettingsScreen />;
    if (targetScreen === 'privacyPolicy') return <PrivacyPolicyScreen />;
    if (targetScreen === 'termsOfService') return <TermsOfServiceScreen />;
    if (targetScreen === 'backup') return <BackupScreen />;
    if (targetScreen === 'accountManagement') return <AccountManagementScreen />;
    if (targetScreen === 'forgotPassword') return <ForgotPasswordScreen />;
    return null;
  }

  function renderRoutes() {
    return (
      <Routes>
        {(Object.entries(screenPaths) as [Screen, string][]).map(([routeScreen, path]) => (
          <Route path={path} element={renderScreen(routeScreen)} key={routeScreen} />
        ))}
        <Route path="*" element={<Navigate replace to={screenPaths.home} />} />
      </Routes>
    );
  }

  return (
    <>
      <main className={`app ${showRestTimerIdle ? 'rest-timer-visible' : ''}`} ref={appRef}>
        <div className={`screen-transition-stage ${transitionFrom ? 'covering' : ''}`}>
          {transitionFrom && (
            <div
              className={`screen-layer previous ${
                transitionDirection === 'back' ? 'back-exit' : ''
              }`}
              aria-hidden="true"
              onAnimationEnd={transitionDirection === 'back' ? clearScreenTransition : undefined}
            >
              {renderScreen(transitionFrom)}
            </div>
          )}
          <div
            className={`screen-layer current ${transitionDirection === 'forward' ? 'forward' : ''}`}
            key={screen}
            onAnimationEnd={transitionDirection === 'forward' ? clearScreenTransition : undefined}
          >
            {renderRoutes()}
          </div>
        </div>
      </main>

      {screen !== 'auth' && (
        <RestTimer
          defaultSeconds={state.restTimerSettings.defaultSeconds}
          autoStartOnIntensity={state.restTimerSettings.autoStartOnIntensity}
          alertVolume={state.restTimerSettings.alertVolume}
          showIdle={showRestTimerIdle}
          onChangeDefaultSeconds={actions.setRestTimerDefaultSeconds}
          onChangeAutoStart={actions.setRestTimerAutoStart}
          onChangeAlertVolume={actions.setRestTimerAlertVolume}
        />
      )}
      {drawerOverlayVisible && (
        <div className={`home-app-backdrop ${drawerOverlayClass}`} aria-hidden="true" />
      )}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        {toast && (
          <div className="toast-content" key={toast.id}>
            <span>{toast.message}</span>
            {toast.onAction && (
              <button
                className="toast-action"
                type="button"
                onClick={() => {
                  const undo = toast.onAction;
                  if (!undo) return;
                  actions.clearToast();
                  undo();
                }}
              >
                {toast.actionLabel || '元に戻す'}
              </button>
            )}
            <button
              className="toast-close"
              type="button"
              aria-label="通知を閉じる"
              onClick={actions.clearToast}
            >
              ×
            </button>
          </div>
        )}
      </div>
      {cloud.conflict && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-conflict-title"
          >
            <div className="confirm-title" id="cloud-conflict-title">
              {cloud.conflictKind === 'restore'
                ? 'クラウドから復元しますか？'
                : '使用する記録を選択'}
            </div>
            <p>
              {cloud.conflictKind === 'restore'
                ? 'この端末にはローカルデータがありません。クラウドに保存されているデータを復元できます。'
                : 'クラウドに既存のバックアップがあります。自動バックアップを始める前に、使用するデータを選んでください。'}
            </p>
            <div className="confirm-actions cloud-conflict-actions">
              <button
                className="small-outline"
                type="button"
                disabled={cloud.loading}
                onClick={() => void cloud.resolveConflict('device')}
              >
                {cloud.conflictKind === 'restore' ? '復元しない' : 'この端末を優先'}
              </button>
              <button
                className={cloud.conflictKind === 'restore' ? 'danger-button' : 'primary-button'}
                type="button"
                disabled={cloud.loading}
                onClick={() => void cloud.resolveConflict('cloud')}
              >
                {cloud.conflictKind === 'restore' ? '復元する' : 'クラウドから復元'}
              </button>
            </div>
          </div>
        </div>
      )}
      {fabAction && (
        <button
          key={fabKey}
          className={`fab ${fabFaded ? 'faded' : ''}`}
          type="button"
          aria-label={fabLabel}
          onClick={fabAction}
        >
          <PlusIcon />
        </button>
      )}
      {goalAchievement && (
        <NextGoalDialog
          achievement={goalAchievement}
          weightUnit={state.weightUnit}
          onClose={actions.clearGoalAchievement}
          onSave={(goal) => {
            actions.updateExerciseGoal(goalAchievement.exerciseId, goal);
            actions.clearGoalAchievement();
          }}
        />
      )}
    </>
  );
}

function NextGoalDialog({
  achievement,
  weightUnit,
  onClose,
  onSave,
}: {
  achievement: NonNullable<ReturnType<typeof useSmithNoteContext>['goalAchievement']>;
  weightUnit: 'kg' | 'lbs';
  onClose: () => void;
  onSave: (goal: { weight: number; recordValue: number }) => void;
}) {
  const [weight, setWeight] = useState('');
  const [recordValue, setRecordValue] = useState('');

  useEffect(() => {
    const achievedWeight = number(formatStoredWeightInput(achievement.setWeight, weightUnit));
    setWeight(String(achievedWeight + (weightUnit === 'lbs' ? 5 : 2.5)));
    setRecordValue(String(achievement.setRecordValue));
  }, [achievement, weightUnit]);

  const storedWeight = formatWeightForStorageInput(weight, weightUnit);
  const canSave =
    weight.trim() !== '' &&
    recordValue.trim() !== '' &&
    Number(storedWeight) >= 0 &&
    Number(recordValue) > 0;

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className="confirm-dialog goal-achievement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-achievement-title"
      >
        <div className="goal-achievement-mark" aria-hidden="true">
          🎉
        </div>
        <div>
          <div className="goal-achievement-kicker">GOAL ACHIEVED</div>
          <h2 className="confirm-title" id="goal-achievement-title">
            目標達成、おめでとうございます！
          </h2>
        </div>
        <p>
          {achievement.exerciseName}で、目標の
          {formatStoredWeightInput(achievement.goal.weight, weightUnit)}
          {weightUnitLabel(weightUnit)} × {achievement.goal.recordValue}
          {measurementUnit(achievement.measurementType)}を達成しました。
        </p>
        <div className="next-goal-fields">
          <label>
            <span>次の重量</span>
            <div className="goal-input">
              <input
                type="number"
                min="0"
                step={weightUnit === 'lbs' ? '1' : '0.5'}
                inputMode="decimal"
                value={weight}
                autoFocus
                onChange={(event) => setWeight(event.target.value)}
              />
              <span>{weightUnitLabel(weightUnit)}</span>
            </div>
          </label>
          <label>
            <span>次の{achievement.measurementType === 'seconds' ? '秒数' : '回数'}</span>
            <div className="goal-input">
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={recordValue}
                onChange={(event) => setRecordValue(event.target.value)}
              />
              <span>{measurementUnit(achievement.measurementType)}</span>
            </div>
          </label>
        </div>
        <div className="confirm-actions">
          <button className="small-outline" type="button" onClick={onClose}>
            あとで
          </button>
          <button
            className="small-primary"
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                weight: number(storedWeight),
                recordValue: number(recordValue),
              })
            }
          >
            次の目標にする
          </button>
        </div>
      </div>
    </div>
  );
}
