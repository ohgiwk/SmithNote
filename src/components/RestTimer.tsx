import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { createPortal } from 'react-dom';
import {
  cancelRestTimerNotification,
  scheduleRestTimerNotification,
} from '../restTimerNotification';
import { defaultRestTimerSeconds, restTimerPresetSeconds } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

const exitAnimationMilliseconds = 420;
const alarmSoundPath = `${import.meta.env.BASE_URL}Clock-Alarm.wav`;
export const restTimerStartEvent = 'smithnote:start-rest-timer';

type RestTimerProps = {
  defaultSeconds: number;
  autoStartOnIntensity: boolean;
  alertVolume: number;
  showIdle: boolean;
  onChangeDefaultSeconds: (seconds: number) => void;
  onChangeAutoStart: (enabled: boolean) => void;
  onChangeAlertVolume: (volume: number) => void;
};

export function RestTimer({
  defaultSeconds,
  autoStartOnIntensity,
  alertVolume,
  showIdle,
  onChangeDefaultSeconds,
  onChangeAutoStart,
  onChangeAlertVolume,
}: RestTimerProps) {
  const initialSeconds = clampSeconds(defaultSeconds);
  const [selectedSeconds, setSelectedSeconds] = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [remainingMilliseconds, setRemainingMilliseconds] = useState(initialSeconds * 1000);
  const [durationMilliseconds, setDurationMilliseconds] = useState(initialSeconds * 1000);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [showRunningTimer, setShowRunningTimer] = useState(false);
  const [timerExiting, setTimerExiting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSeconds, setSettingsSeconds] = useState(String(initialSeconds));
  const [settingsAutoStart, setSettingsAutoStart] = useState(autoStartOnIntensity);
  const [settingsAlertVolume, setSettingsAlertVolume] = useState(alertVolume);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmBufferRef = useRef<AudioBuffer | null>(null);
  const alarmBufferPromiseRef = useRef<Promise<AudioBuffer | null> | null>(null);
  const alarmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const alertVolumeRef = useRef(alertVolume);
  alertVolumeRef.current = alertVolume;
  const exitTimeoutRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const expiredWhileHiddenRef = useRef(false);

  const running = endTime !== null;
  const exiting = timerExiting;
  const progressOffset = showRunningTimer
    ? Math.min(100, Math.max(0, 100 - (remainingMilliseconds / durationMilliseconds) * 100))
    : 0;

  useEffect(() => {
    function trackHiddenExpiration() {
      const currentEndTime = endTimeRef.current;
      if (
        document.visibilityState === 'visible' &&
        currentEndTime !== null &&
        currentEndTime <= Date.now()
      ) {
        expiredWhileHiddenRef.current = true;
      }
    }

    document.addEventListener('visibilitychange', trackHiddenExpiration);
    return () => {
      document.removeEventListener('visibilitychange', trackHiddenExpiration);
      clearExitTimeout();
      stopAlarmSource();
      void cancelRestTimerNotification();
    };
  }, []);

  useEffect(() => {
    if (running) return;
    const nextSeconds = clampSeconds(defaultSeconds);
    setSelectedSeconds(nextSeconds);
    setRemaining(nextSeconds);
  }, [defaultSeconds]);

  useEffect(() => {
    if (!showIdle) setSettingsOpen(false);
  }, [showIdle]);

  useEffect(() => {
    window.addEventListener(restTimerStartEvent, startTimer);
    return () => window.removeEventListener(restTimerStartEvent, startTimer);
  });

  useEffect(() => {
    if (!endTime) return;
    const runId = runIdRef.current;

    const timer = window.setInterval(() => {
      if (runId !== runIdRef.current) {
        window.clearInterval(timer);
        return;
      }
      const nextRemainingMilliseconds = Math.max(0, endTime - Date.now());
      const nextRemaining = Math.ceil(nextRemainingMilliseconds / 1000);
      setRemainingMilliseconds(nextRemainingMilliseconds);
      setRemaining(nextRemaining);
      if (nextRemaining === 0) {
        window.clearInterval(timer);
        hideRunningTimer();
        setEndTime(null);
        endTimeRef.current = null;
        void cancelRestTimerNotification();
        const notificationHandledAlert =
          Capacitor.isNativePlatform() && expiredWhileHiddenRef.current;
        if (!notificationHandledAlert) {
          void playAlert(
            audioContextRef.current,
            alarmBufferRef.current,
            alarmBufferPromiseRef.current,
            runId,
            runIdRef,
            alarmSourceRef,
            alertVolumeRef.current,
          );
        }
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [endTime]);

  function openSettings() {
    setSettingsSeconds(String(defaultSeconds));
    setSettingsAutoStart(autoStartOnIntensity);
    setSettingsAlertVolume(alertVolume);
    setSettingsOpen(true);
  }

  function updateSettingsSeconds(value: string) {
    setSettingsSeconds(value.replace(/[^\d]/g, '').slice(0, 3));
  }

  function saveSettings() {
    const seconds = clampSeconds(settingsSeconds);
    setSelectedSeconds(seconds);
    setRemaining(seconds);
    onChangeDefaultSeconds(seconds);
    onChangeAutoStart(settingsAutoStart);
    onChangeAlertVolume(settingsAlertVolume);
    setSettingsOpen(false);
  }

  function toggleTimer() {
    if (running) {
      stopTimer();
      return;
    }

    startTimer();
  }

  function startTimer() {
    ++runIdRef.current;
    stopAlarmSource();
    expiredWhileHiddenRef.current = false;
    const seconds = clampSeconds(selectedSeconds);
    const context = getAudioContext(audioContextRef.current);
    audioContextRef.current = context;
    void context?.resume();
    if (context) {
      alarmBufferPromiseRef.current = prepareAlertSound(context, alarmBufferRef.current).then(
        (buffer) => {
          alarmBufferRef.current = buffer;
          return buffer;
        },
      );
    }
    const duration = seconds * 1000;
    setSelectedSeconds(seconds);
    setRemaining(seconds);
    setRemainingMilliseconds(duration);
    setDurationMilliseconds(duration);
    showActiveTimer();
    const nextEndTime = Date.now() + duration;
    endTimeRef.current = nextEndTime;
    setEndTime(nextEndTime);
    void scheduleRestTimerNotification(new Date(nextEndTime));
  }

  function stopTimer() {
    ++runIdRef.current;
    endTimeRef.current = null;
    stopAlarmSource();
    void cancelRestTimerNotification();
    hideRunningTimer();
    setEndTime(null);
  }

  function showActiveTimer() {
    clearExitTimeout();
    setShowRunningTimer(true);
    setTimerExiting(false);
  }

  function hideRunningTimer() {
    setTimerExiting(true);
    clearExitTimeout();
    exitTimeoutRef.current = window.setTimeout(() => {
      setShowRunningTimer(false);
      setTimerExiting(false);
      exitTimeoutRef.current = null;
    }, exitAnimationMilliseconds);
  }

  function clearExitTimeout() {
    if (exitTimeoutRef.current === null) return;
    window.clearTimeout(exitTimeoutRef.current);
    exitTimeoutRef.current = null;
  }

  function stopAlarmSource() {
    const source = alarmSourceRef.current;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      alarmSourceRef.current = null;
    }
    alarmSourceRef.current = null;
  }

  const timer = (
    <>
      {(showRunningTimer || showIdle) && (
        <div
          className={`rest-timer ${showRunningTimer ? 'running' : ''} ${exiting ? 'exiting' : ''}`}
          aria-label="レストタイマー"
        >
          {showRunningTimer ? (
            <>
              <span className="rest-timer-running-label">REST</span>
              <strong className="rest-timer-running-seconds" aria-live="polite">
                {remaining}
                <small>秒</small>
              </strong>
              <button className="rest-timer-stop-button" type="button" onClick={toggleTimer}>
                STOP
              </button>
              <div className="rest-timer-progress" aria-hidden="true">
                <span style={{ width: `${100 - progressOffset}%` }} />
              </div>
            </>
          ) : (
            <>
              <TimerIcon />
              <button
                className="rest-timer-seconds-button"
                type="button"
                aria-label={`レストタイマー設定、現在${selectedSeconds}秒`}
                onClick={openSettings}
              >
                {selectedSeconds}
              </button>
              <span>秒</span>
              <button type="button" onClick={toggleTimer}>
                START
              </button>
            </>
          )}
        </div>
      )}
      {settingsOpen && showIdle && (
        <ConfirmDialog
          className="rest-timer-settings-dialog"
          title="レストタイマー設定"
          labelledBy="rest-timer-settings-title"
          onClose={() => setSettingsOpen(false)}
        >
          <div className="rest-timer-settings-field">
            <span>デフォルト秒数</span>
            <div className="rest-timer-preset-buttons" aria-label="デフォルト秒数">
              {restTimerPresetSeconds.map((seconds) => (
                <button
                  className={settingsSeconds === String(seconds) ? 'active' : ''}
                  type="button"
                  key={seconds}
                  aria-pressed={settingsSeconds === String(seconds)}
                  onClick={() => setSettingsSeconds(String(seconds))}
                >
                  {seconds}秒
                </button>
              ))}
            </div>
            <label className="rest-timer-custom-seconds">
              <span>自由入力</span>
              <span className="rest-timer-custom-seconds-input">
                <input
                  aria-label="レストタイマーのデフォルト秒数を入力"
                  type="number"
                  min="1"
                  max="999"
                  inputMode="numeric"
                  value={settingsSeconds}
                  onChange={(event) => updateSettingsSeconds(event.target.value)}
                />
                <span>秒</span>
              </span>
            </label>
          </div>
          <div className="rest-timer-settings-field">
            <span>強度入力時に開始</span>
            <div className="unit-switch" role="group" aria-label="強度入力時の自動開始">
              <button
                className={`unit-switch-button ${settingsAutoStart ? 'active' : ''}`}
                type="button"
                aria-pressed={settingsAutoStart}
                onClick={() => setSettingsAutoStart(true)}
              >
                ON
              </button>
              <button
                className={`unit-switch-button ${settingsAutoStart ? '' : 'active'}`}
                type="button"
                aria-pressed={!settingsAutoStart}
                onClick={() => setSettingsAutoStart(false)}
              >
                OFF
              </button>
            </div>
          </div>
          <label className="rest-timer-settings-field rest-timer-volume-field">
            <span>
              アラート音量
              <strong>{settingsAlertVolume}%</strong>
            </span>
            <input
              aria-label="レストタイマーのアラート音量"
              type="range"
              min="0"
              max="100"
              step="5"
              value={settingsAlertVolume}
              onChange={(event) => setSettingsAlertVolume(Number(event.target.value))}
            />
          </label>
          <div className="confirm-actions">
            <button className="small-outline" type="button" onClick={() => setSettingsOpen(false)}>
              キャンセル
            </button>
            <button className="small-primary" type="button" onClick={saveSettings}>
              保存
            </button>
          </div>
        </ConfirmDialog>
      )}
    </>
  );

  return createPortal(timer, document.body);
}

function TimerIcon() {
  return (
    <svg className="rest-timer-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M9 3h6" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function clampSeconds(value: string | number) {
  return Math.max(1, Math.min(999, Number(value) || defaultRestTimerSeconds));
}

function getAudioContext(context: AudioContext | null) {
  if (context) return context;
  if (!window.AudioContext) return null;
  return new window.AudioContext();
}

async function prepareAlertSound(context: AudioContext, currentBuffer: AudioBuffer | null) {
  if (currentBuffer) return currentBuffer;

  try {
    const response = await fetch(alarmSoundPath);
    const arrayBuffer = await response.arrayBuffer();
    return context.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  }
}

async function playAlert(
  context: AudioContext | null,
  currentBuffer: AudioBuffer | null,
  bufferPromise: Promise<AudioBuffer | null> | null,
  runId: number,
  runIdRef: { current: number },
  sourceRef: { current: AudioBufferSourceNode | null },
  alertVolume: number,
) {
  if (!context) return;
  try {
    await context.resume();
  } catch {
    return;
  }
  if (runId !== runIdRef.current) return;
  const buffer = currentBuffer ?? (await bufferPromise);
  if (!buffer || runId !== runIdRef.current) return;

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = Math.max(0, Math.min(1, alertVolume / 100));
  source.connect(gain);
  gain.connect(context.destination);
  sourceRef.current = source;
  source.onended = () => {
    if (sourceRef.current === source) sourceRef.current = null;
  };
  source.start();
}
