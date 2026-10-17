import { ScreenHeader } from '../components/ScreenHeader';
import {
  AccountIcon,
  EditIcon,
  ExportIcon,
  NotificationIcon,
  PartsIcon,
  PrivacyIcon,
} from '../icons';
import { ThemeMode, WeightUnit } from '../types';
import { normalizeDefaultReps, weightUnitLabel } from '../utils';
import { useSmithNoteContext } from '../hooks/useSmithNoteContext';
import { appVersion } from '../version';

const unitOptions: WeightUnit[] = ['kg', 'lbs'];
const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'ダーク' },
  { value: 'light', label: 'ライト' },
];

/**
 * 設定画面が必要とする state・操作を Context から組み立てる view-model フック
 */
function useSettingsScreenModel() {
  const { state, actions } = useSmithNoteContext();

  return {
    defaultSetCount: state.defaultSetCount ?? 5,
    onChangeDefaultSetCount: actions.setDefaultSetCount,
    defaultReps: state.defaultReps ?? null,
    onChangeDefaultReps: actions.setDefaultReps,
    weightUnit: state.weightUnit,
    themeMode: state.themeMode,
    onEditParts: () => actions.setScreen('partEdit'),
    onEditExercises: () => actions.setScreen('exerciseManage'),
    onChangeWeightUnit: actions.setWeightUnit,
    onChangeThemeMode: actions.setThemeMode,
    onOpenNotificationSettings: () => actions.setScreen('notificationSettings'),
    onOpenBackup: () => actions.setScreen('backup'),
    onOpenAccountSettings: () => actions.setScreen('accountManagement'),
    onOpenPrivacyPolicy: () => actions.setScreen('privacyPolicy'),
    onOpenTermsOfService: () => actions.setScreen('termsOfService'),
  };
}

/**
 * アプリ全体の表示・入力設定を変更する画面
 */
export function SettingsScreen() {
  const {
    defaultSetCount,
    onChangeDefaultSetCount,
    defaultReps,
    onChangeDefaultReps,
    weightUnit,
    themeMode,
    onEditParts,
    onEditExercises,
    onChangeWeightUnit,
    onChangeThemeMode,
    onOpenNotificationSettings,
    onOpenBackup,
    onOpenAccountSettings,
    onOpenPrivacyPolicy,
    onOpenTermsOfService,
  } = useSettingsScreenModel();
  return (
    <section className="screen active settings-screen">
      <ScreenHeader title="設定" />
      <div className="settings-content">
        <section className="settings-section" aria-labelledby="display-settings-title">
          <h2 className="settings-section-title" id="display-settings-title">
            表示設定
          </h2>
          <div className="settings-row">
            <div className="settings-label">
              <span>外観</span>
              <strong>{themeMode === 'dark' ? 'ダークモード' : 'ライトモード'}</strong>
            </div>
            <div className="unit-switch theme-switch" role="group" aria-label="外観モード">
              {themeOptions.map((theme) => (
                <button
                  className={`unit-switch-button ${themeMode === theme.value ? 'active' : ''}`}
                  key={theme.value}
                  type="button"
                  aria-pressed={themeMode === theme.value}
                  onClick={() => onChangeThemeMode(theme.value)}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-label">
              <span>単位</span>
              <strong>{weightUnitLabel(weightUnit)}</strong>
            </div>
            <div className="unit-switch" role="group" aria-label="重量単位">
              {unitOptions.map((unit) => (
                <button
                  className={`unit-switch-button ${weightUnit === unit ? 'active' : ''}`}
                  key={unit}
                  type="button"
                  aria-pressed={weightUnit === unit}
                  onClick={() => onChangeWeightUnit(unit)}
                >
                  {weightUnitLabel(unit)}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="settings-section" aria-labelledby="input-settings-title">
          <h2 className="settings-section-title" id="input-settings-title">
            入力設定
          </h2>
          <label className="settings-row">
            <div className="settings-label">
              <span>デフォルトのセット数</span>
              <strong>種目追加・セット補充に使用</strong>
            </div>
            <select
              className="settings-default-reps"
              aria-label="デフォルトのセット数"
              value={defaultSetCount}
              onChange={(event) => onChangeDefaultSetCount(Number(event.target.value))}
            >
              {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <div className="settings-label">
              <span>回数の初期値</span>
              <strong>空欄で自動入力なし</strong>
            </div>
            <input
              className="settings-default-reps"
              type="number"
              inputMode="numeric"
              min="1"
              max="999"
              step="1"
              aria-label="回数の初期値"
              placeholder="未設定"
              value={defaultReps ?? ''}
              onChange={(event) =>
                onChangeDefaultReps(
                  normalizeDefaultReps(
                    event.target.value === '' ? null : Number(event.target.value),
                  ),
                )
              }
            />
          </label>
        </section>
        <section className="settings-section" aria-labelledby="master-management-title">
          <h2 className="settings-section-title" id="master-management-title">
            マスタ管理
          </h2>
          <button className="settings-link-row" type="button" onClick={onEditParts}>
            <PartsIcon />
            <span>部位を編集</span>
          </button>
          <button className="settings-link-row" type="button" onClick={onEditExercises}>
            <EditIcon />
            <span>種目を編集</span>
          </button>
        </section>
        <section className="settings-section" aria-labelledby="data-management-title">
          <h2 className="settings-section-title" id="data-management-title">
            データ管理
          </h2>
          <button className="settings-link-row" type="button" onClick={onOpenBackup}>
            <ExportIcon />
            <span>バックアップ</span>
          </button>
        </section>
        <section className="settings-section" aria-labelledby="account-settings-title">
          <h2 className="settings-section-title" id="account-settings-title">
            アカウント
          </h2>
          <button className="settings-link-row" type="button" onClick={onOpenAccountSettings}>
            <AccountIcon />
            <span>アカウント設定</span>
          </button>
        </section>
        <section className="settings-section" aria-labelledby="notification-settings-title">
          <h2 className="settings-section-title" id="notification-settings-title">
            通知
          </h2>
          <button className="settings-link-row" type="button" onClick={onOpenNotificationSettings}>
            <NotificationIcon />
            <span>通知設定</span>
          </button>
        </section>
        <section className="settings-section" aria-labelledby="about-app-title">
          <h2 className="settings-section-title" id="about-app-title">
            アプリ情報
          </h2>
          <button className="settings-link-row" type="button" onClick={onOpenPrivacyPolicy}>
            <PrivacyIcon />
            <span>プライバシーポリシー</span>
          </button>
          <button className="settings-link-row" type="button" onClick={onOpenTermsOfService}>
            <PrivacyIcon />
            <span>利用規約</span>
          </button>
        </section>
        <div className="settings-version" aria-label={`アプリバージョン ${appVersion}`}>
          {appVersion}
        </div>
      </div>
    </section>
  );
}
