import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppUpdate } from './useAppUpdate';

afterEach(() => vi.unstubAllGlobals());

function response(buildId: unknown) {
  return { ok: true, json: () => Promise.resolve({ buildId }) };
}

describe('useAppUpdate', () => {
  it('同一版は通知せず、復帰後の新版を通知し、あとでは同じ版を再通知しない', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('current'));
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() => useAppUpdate('current', true));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.updateAvailable).toBe(false);
    fetchMock.mockResolvedValue(response('next'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
    act(() => result.current.dismiss());
    expect(result.current.updateAvailable).toBe(false);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(result.current.updateAvailable).toBe(false);
    fetchMock.mockResolvedValue(response('newer'));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
    unmount();
    const calls = fetchMock.mock.calls.length;
    window.dispatchEvent(new Event('online'));
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it('通信失敗・不正なレスポンスでは通知せず、再接続で再試行する', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAppUpdate('current', true));
    await act(async () => {});
    expect(result.current.updateAvailable).toBe(false);
    fetchMock.mockResolvedValue(response(null));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(result.current.updateAvailable).toBe(false);
    fetchMock.mockResolvedValue(response('next'));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
  });

  it('対象外では通信しない', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useAppUpdate('current', false));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
