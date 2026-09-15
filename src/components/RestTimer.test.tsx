import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RestTimer } from './RestTimer';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RestTimer settings', () => {
  it('秒数ボタンから設定を開き、プリセットまたは自由入力と自動開始を保存できる', async () => {
    const user = userEvent.setup();
    const onChangeDefaultSeconds = vi.fn();
    const onChangeAutoStart = vi.fn();
    const onChangeAlertVolume = vi.fn();

    render(
      <RestTimer
        defaultSeconds={60}
        autoStartOnIntensity
        alertVolume={100}
        showIdle
        onChangeDefaultSeconds={onChangeDefaultSeconds}
        onChangeAutoStart={onChangeAutoStart}
        onChangeAlertVolume={onChangeAlertVolume}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'レストタイマー設定、現在60秒' }));

    const secondsInput = screen.getByRole('spinbutton', {
      name: 'レストタイマーのデフォルト秒数を入力',
    });
    await user.click(screen.getByRole('button', { name: '90秒' }));
    expect((secondsInput as HTMLInputElement).value).toBe('90');

    await user.clear(secondsInput);
    await user.type(secondsInput, '75');
    await user.click(screen.getByRole('button', { name: 'OFF' }));
    fireEvent.change(screen.getByRole('slider', { name: 'レストタイマーのアラート音量' }), {
      target: { value: '65' },
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onChangeDefaultSeconds).toHaveBeenCalledWith(75);
    expect(onChangeAutoStart).toHaveBeenCalledWith(false);
    expect(onChangeAlertVolume).toHaveBeenCalledWith(65);
    expect(screen.queryByRole('dialog', { name: 'レストタイマー設定' })).toBeNull();
  });

  it('開始後は待機中表示を隠しても操作を遮らないミニバーを維持する', () => {
    vi.useFakeTimers();
    const props = {
      defaultSeconds: 60,
      autoStartOnIntensity: true,
      alertVolume: 100,
      onChangeDefaultSeconds: vi.fn(),
      onChangeAutoStart: vi.fn(),
      onChangeAlertVolume: vi.fn(),
    };
    const { rerender } = render(<RestTimer {...props} showIdle />);

    fireEvent.click(screen.getByRole('button', { name: 'START' }));
    rerender(<RestTimer {...props} showIdle={false} />);

    expect(screen.getByText('REST')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'STOP' })).toBeTruthy();
    expect(document.querySelector('.rest-timer-overlay')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
    act(() => {
      vi.advanceTimersByTime(420);
    });

    expect(document.querySelector('.rest-timer')).toBeNull();
  });
});
