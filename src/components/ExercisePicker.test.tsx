import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExercisePicker } from './ExercisePicker';
import type { Exercise } from '../types';

describe('ExercisePicker search', () => {
  it('全部位から検索して追加でき、該当なしとクリアを扱う', () => {
    const onSelectExercise = vi.fn();
    const exercises: Exercise[] = [
      { id: 'chest', name: 'ベンチプレス', part: '胸', category: 'free', measurementType: 'reps' },
      { id: 'back', name: 'Ｔバーロウ', part: '背中', category: 'free', measurementType: 'reps' },
    ];
    render(
      <ExercisePicker
        activePart="胸"
        groupedExercises={
          new Map([
            ['胸', [exercises[0]]],
            ['背中', [exercises[1]]],
          ])
        }
        label="履歴なし"
        mode="single"
        partColors={new Map()}
        onSelectExercise={onSelectExercise}
        onSelectPart={vi.fn()}
      />,
    );
    const input = screen.getByRole('searchbox', { name: '種目名で検索' });
    fireEvent.change(input, { target: { value: ' tバー ' } });
    expect(screen.queryByRole('button', { name: 'ベンチプレス' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /背中\s*Ｔバーロウ/ }));
    expect(onSelectExercise).toHaveBeenCalledWith('back');
    fireEvent.change(input, { target: { value: '存在しない種目' } });
    expect(screen.getByRole('status').textContent).toBe('該当する種目がありません');
    fireEvent.click(screen.getByRole('button', { name: 'クリア' }));
    expect(screen.getByRole('button', { name: 'ベンチプレス' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '検索結果' })).toBeNull();
  });
});
