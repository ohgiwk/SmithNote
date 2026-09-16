import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { State } from '../types';
import { normalizeState } from '../storage';
import { usePresetActions } from './usePresetActions';

const date = '2026-09-16';
const preset = { id: 'menu-1', name: '胸の日', color: '#326bc4', exerciseIds: ['e1'] };

function setup() {
  return renderHook(() => {
    const [state, saveState] = useState(
      () =>
        normalizeState({
          exercises: [
            {
              id: 'e1',
              name: 'ベンチプレス',
              part: '胸',
              measurementType: 'reps',
              category: 'free',
            },
          ],
          workouts: [],
          presets: [preset],
        })!,
    );
    const actions = usePresetActions({
      state,
      saveState,
      selectedDate: date,
      showToast: vi.fn(),
      showScreen: vi.fn(),
    });
    return { state, actions };
  });
}

describe('メニューからの開始', () => {
  it.each(['startPreset', 'saveAndStartPreset'] as const)(
    '%s はメニューと色を再読み込み後も保持する',
    (action) => {
      const { result } = setup();
      act(() => {
        if (action === 'startPreset') result.current.actions.startPreset(preset.id);
        else result.current.actions.saveAndStartPreset(preset);
      });
      const restored = normalizeState(JSON.parse(JSON.stringify(result.current.state)) as State)!;
      expect(restored.workouts).toHaveLength(1);
      expect(restored.workouts[0]).toMatchObject({ presetId: preset.id, date });
      expect(restored.presets.find((item) => item.id === preset.id)?.color).toBe(preset.color);
      expect(restored.workoutStartTimes[date]).toMatch(/^\d{2}:\d{2}$/);
    },
  );

  it('古いデータや不正な色を既定色で読み込める', () => {
    for (const color of [undefined, 'invalid']) {
      const restored = normalizeState({
        exercises: [],
        workouts: [],
        presets: [{ ...preset, color }],
      })!;
      expect(restored.presets[0].color).toBe('#c43d3d');
    }
  });
});
