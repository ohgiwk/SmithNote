import { useEffect, useState } from 'react';

/**
 * 公開ビルドの識別子を確認し、PWA 内で更新を案内する。
 * 通信失敗時は現在の画面を維持し、次回の確認で再試行する。
 */
export function useAppUpdate(buildId: string, enabled: boolean) {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let controller: AbortController | null = null;
    const check = async () => {
      if (document.visibilityState === 'hidden' || controller) return;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}app-version.json?t=${Date.now()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (
          !disposed &&
          typeof data === 'object' &&
          data !== null &&
          'buildId' in data &&
          typeof data.buildId === 'string' &&
          data.buildId.trim()
        ) {
          setAvailableVersion(data.buildId === buildId ? null : data.buildId);
        }
      } catch {
        /**
         * オフラインや公開処理中の一時エラーは通知せず、次の確認を待つ。
         */
      } finally {
        window.clearTimeout(timeout);
        controller = null;
      }
    };
    const checkNow = () => void check();
    checkNow();
    const interval = window.setInterval(checkNow, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', checkNow);
    window.addEventListener('online', checkNow);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkNow);
      window.removeEventListener('online', checkNow);
    };
  }, [buildId, enabled]);

  return {
    updateAvailable: availableVersion !== null && availableVersion !== dismissedVersion,
    dismiss: () => setDismissedVersion(availableVersion),
  };
}
