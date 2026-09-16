import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnalysisIcon, CalendarIcon, MenuIcon, SettingsIcon, TrophyIcon } from '../icons';
import { useHomeCalendar } from '../hooks/useHomeCalendar';
import { localDate, presetColor, weekdayLabels } from '../utils';
import { Preset, Workout } from '../types';
import { useSmithNoteContext } from '../hooks/useSmithNoteContext';
import { ConfirmDialog } from './ConfirmDialog';

type CloudActions = ReturnType<typeof useSmithNoteContext>['actions']['cloud'];

type HomeCalendarProps = {
  selectedDate: string;
  workouts: Workout[];
  presets: Preset[];
  onSelectDate: (date: string) => void;
  onOpenTrainingMenu: () => void;
  onOpenAnalysis: () => void;
  onOpenSettings: () => void;
  onOpenGoalAchievements: () => void;
  onOpenAuth: (mode: 'signIn' | 'signUp') => void;
  onOverlayStateChange: (state: HomeCalendarOverlayState) => void;
  cloud: CloudActions;
};

export type HomeCalendarOverlayState = {
  calendarBackdropState: 'closed' | 'open' | 'closing';
  drawerState: 'closed' | 'open' | 'closing';
};

export function HomeCalendar({
  selectedDate,
  workouts,
  presets,
  onSelectDate,
  onOpenTrainingMenu,
  onOpenAnalysis,
  onOpenSettings,
  onOpenGoalAchievements,
  onOpenAuth,
  onOverlayStateChange,
  cloud,
}: HomeCalendarProps) {
  const [drawerState, setDrawerState] = useState<'closed' | 'open' | 'closing'>('closed');
  const [backdropState, setBackdropState] = useState<'closed' | 'open' | 'closing'>('closed');
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const pendingDrawerActionRef = useRef<(() => void) | null>(null);
  const calendar = useHomeCalendar(selectedDate, onSelectDate);
  const trainedDates = useMemo(() => new Set(workouts.map((workout) => workout.date)), [workouts]);
  const trainedColors = useMemo(() => {
    const colors = new Map<string, string>();
    for (const workout of workouts) {
      if (!workout.presetId || colors.has(workout.date)) continue;
      colors.set(
        workout.date,
        presetColor(presets.find((preset) => preset.id === workout.presetId)?.color),
      );
    }
    return colors;
  }, [workouts, presets]);
  const today = localDate(new Date());
  const drawerVisible = drawerState !== 'closed';
  const backdropVisible = backdropState !== 'closed';

  const finishDrawerClose = useCallback(() => {
    setDrawerState('closed');
    const action = pendingDrawerActionRef.current;
    pendingDrawerActionRef.current = null;
    action?.();
  }, []);

  useEffect(() => {
    if (drawerState !== 'closing') return undefined;
    const timeoutId = window.setTimeout(finishDrawerClose, 260);
    return () => window.clearTimeout(timeoutId);
  }, [drawerState, finishDrawerClose]);

  useEffect(() => {
    if (calendar.mode === 'month') {
      setBackdropState('open');
      return;
    }
    setBackdropState((current) => (current === 'closed' ? 'closed' : 'closing'));
  }, [calendar.mode]);

  useEffect(() => {
    if (backdropState !== 'closing') return undefined;
    const timeoutId = window.setTimeout(() => {
      setBackdropState('closed');
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [backdropState]);

  useEffect(() => {
    onOverlayStateChange({ calendarBackdropState: backdropState, drawerState });
  }, [backdropState, drawerState, onOverlayStateChange]);

  function openDrawer() {
    pendingDrawerActionRef.current = null;
    setDrawerState('open');
  }

  function closeDrawer(action?: () => void) {
    pendingDrawerActionRef.current = action || null;
    setDrawerState((current) => (current === 'closed' ? 'closed' : 'closing'));
  }

  function openFromDrawer(action: () => void) {
    closeDrawer(action);
  }

  const drawerLayer = drawerVisible ? (
    <div
      className={`drawer-layer ${drawerState}`}
      role="presentation"
      onClick={() => closeDrawer()}
    >
      <aside
        className={`home-drawer ${drawerState}`}
        role="dialog"
        aria-modal="true"
        aria-label="メニュー"
        onClick={(event) => event.stopPropagation()}
        onAnimationEnd={(event) => {
          if (event.currentTarget !== event.target) return;
          if (event.animationName !== 'drawer-slide-out') return;
          finishDrawerClose();
        }}
      >
        <div className="drawer-head">
          <div className="drawer-brand">
            <img className="drawer-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
            <strong>メニュー</strong>
          </div>
          <button className="drawer-close" type="button" onClick={() => closeDrawer()}>
            閉じる
          </button>
        </div>
        <button
          className="drawer-link"
          type="button"
          onClick={() => openFromDrawer(onOpenTrainingMenu)}
        >
          <CalendarIcon />
          <span>トレーニングメニュー</span>
        </button>
        <button
          className="drawer-link"
          type="button"
          onClick={() => openFromDrawer(onOpenGoalAchievements)}
        >
          <TrophyIcon />
          <span>目標達成記録</span>
        </button>
        <button
          className="drawer-link"
          type="button"
          onClick={() => openFromDrawer(onOpenAnalysis)}
        >
          <AnalysisIcon />
          <span>分析</span>
        </button>
        <button
          className="drawer-link"
          type="button"
          onClick={() => openFromDrawer(onOpenSettings)}
        >
          <SettingsIcon />
          <span>設定</span>
        </button>
        <div className="drawer-spacer" aria-hidden="true" />
        {cloud.signedIn ? (
          <>
            <div className="drawer-account" aria-label="ログイン状態">
              <div>
                <span>ログイン中</span>
                <strong>{cloud.userEmail}</strong>
              </div>
              <button
                className="drawer-logout"
                type="button"
                disabled={cloud.loading}
                onClick={() => closeDrawer(() => setLogoutConfirmationOpen(true))}
              >
                ログアウト
              </button>
            </div>
          </>
        ) : (
          <div className="drawer-auth-actions">
            <button
              className="drawer-login"
              type="button"
              onClick={() => openFromDrawer(() => onOpenAuth('signIn'))}
            >
              ログイン
            </button>
            <button
              className="drawer-signup"
              type="button"
              onClick={() => openFromDrawer(() => onOpenAuth('signUp'))}
            >
              新規登録
            </button>
          </div>
        )}
      </aside>
    </div>
  ) : null;
  const backdropLayer =
    backdropState !== 'closed' ? (
      <button
        className={`home-calendar-backdrop ${backdropState}`}
        type="button"
        aria-label="カレンダーを閉じる"
        onClick={calendar.closeMonth}
      />
    ) : null;

  return (
    <>
      {backdropLayer}
      <header
        className={`home-calendar-shell ${calendar.mode} ${backdropVisible ? 'backdrop-visible' : ''}`}
      >
        <div className="home-calendar-head">
          <button
            className="home-menu-btn"
            type="button"
            aria-label="メニューを開く"
            aria-expanded={drawerVisible}
            onClick={openDrawer}
          >
            <MenuIcon />
          </button>
          <button className="home-calendar-title" type="button" onClick={calendar.toggleMode}>
            <span>{calendar.monthLabel}</span>
          </button>
          <button
            className="home-today-btn"
            type="button"
            onClick={calendar.jumpToToday}
            aria-label="今日の日付へ移動"
          >
            今日
          </button>
        </div>
        {drawerLayer && typeof document !== 'undefined' && createPortal(drawerLayer, document.body)}
        <div className="home-calendar-body">
          <div className="home-calendar-reserved" aria-hidden="true">
            <div className="home-calendar-grid">
              {weekdayLabels.map((day) => (
                <div className="weekday" key={day}>
                  {day}
                </div>
              ))}
              {weekdayLabels.map((day) => (
                <div className="day-cell" key={day} />
              ))}
            </div>
            <span className="calendar-drag-handle" />
          </div>
          <div className="home-calendar-panel">
            <div
              className="home-calendar-viewport"
              onPointerDown={calendar.startSwipe}
              onPointerMove={calendar.moveSwipe}
              onPointerUp={calendar.finishSwipe}
              onPointerCancel={calendar.cancelSwipe}
            >
              <div
                className={`home-calendar-track ${calendar.animating ? 'animating' : ''}`}
                style={{ transform: `translateX(${calendar.dragOffset}px)` }}
                onTransitionEnd={calendar.finishTransition}
              >
                {calendar.pages.map((page) => (
                  <div className="home-calendar-page" key={page.key}>
                    <div className="home-calendar-grid">
                      {weekdayLabels.map((day) => (
                        <div className="weekday" key={day}>
                          {day}
                        </div>
                      ))}
                      {page.days.map((cell) => {
                        const trained = trainedDates.has(cell.date);
                        const selected = cell.date === selectedDate;
                        const isToday = cell.date === today;
                        return (
                          <div
                            className={`day-cell ${cell.inMonth ? '' : 'other'}`}
                            key={cell.date}
                          >
                            {cell.inMonth ? (
                              <button
                                className={`day-btn ${trained ? 'trained' : ''} ${
                                  isToday ? 'today' : ''
                                } ${selected ? 'selected' : ''}`}
                                type="button"
                                style={
                                  {
                                    '--training-color':
                                      trainedColors.get(cell.date) ?? 'var(--red)',
                                  } as CSSProperties
                                }
                                onClick={() => calendar.selectDate(cell.date)}
                              >
                                {cell.day}
                              </button>
                            ) : (
                              <span aria-hidden="true" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="calendar-drag-handle"
              type="button"
              aria-label="カレンダーの週表示と月表示を切り替え"
              onClick={calendar.toggleMode}
              onPointerDown={calendar.startHandleSwipe}
              onPointerUp={calendar.finishHandleSwipe}
              onPointerCancel={calendar.cancelHandleSwipe}
            />
          </div>
        </div>
      </header>
      {logoutConfirmationOpen && (
        <ConfirmDialog
          title="ローカルデータを削除しますか？"
          labelledBy="logout-local-data-title"
          onClose={() => setLogoutConfirmationOpen(false)}
        >
          <p>この端末に保存されているトレーニング記録と設定を削除できます。</p>
          <div className="confirm-actions">
            <button
              className="small-outline"
              type="button"
              onClick={() => {
                setLogoutConfirmationOpen(false);
                void cloud.signOut(false);
              }}
            >
              いいえ
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                setLogoutConfirmationOpen(false);
                void cloud.signOut(true);
              }}
            >
              はい
            </button>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
