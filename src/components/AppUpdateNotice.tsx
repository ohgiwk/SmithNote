import { useAppUpdate } from '../hooks/useAppUpdate';

export function AppUpdateNotice() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const { updateAvailable, dismiss } = useAppUpdate(
    __APP_BUILD_ID__,
    import.meta.env.PROD && import.meta.env.MODE !== 'capacitor' && standalone,
  );
  if (!updateAvailable) return null;

  return (
    <aside className="app-update-notice" aria-label="アプリの更新">
      <p role="status">新しいバージョンがあります</p>
      <p className="app-update-description">編集中の内容を保存してから更新してください。</p>
      <div className="confirm-actions">
        <button className="small-outline" type="button" onClick={dismiss}>
          あとで
        </button>
        <button className="primary-button" type="button" onClick={() => window.location.reload()}>
          更新する
        </button>
      </div>
    </aside>
  );
}
