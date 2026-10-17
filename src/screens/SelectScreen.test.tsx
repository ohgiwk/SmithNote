import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmithNoteContext, SmithNoteContextValue } from '../hooks/useSmithNoteContext';
import type { Exercise, Workout } from '../types';
import { frequentExercisesForPart } from '../utils';
import { ExerciseManageScreen, SelectScreen } from './SelectScreen';

const exercise: Exercise = {
  id: 'e1',
  part: '胸',
  name: 'ベンチプレス',
  measurementType: 'reps',
  category: 'free',
};

describe('ExerciseManageScreen', () => {
  it('確認ダイアログで了承した後に種目を削除する', () => {
    const deleteExercise = vi.fn();
    const value = {
      state: { workouts: [] },
      groupedExercises: new Map([['胸', [exercise]]]),
      partRecentLabels: new Map(),
      partColors: new Map([['胸', '#ef4444']]),
      activePart: '胸',
      actions: {
        setScreen: vi.fn(),
        addExerciseToToday: vi.fn(),
        reorderPartExercises: vi.fn(),
        deleteExercise,
        openExerciseEditor: vi.fn(),
        selectPart: vi.fn(),
      },
    } as unknown as SmithNoteContextValue;

    render(
      <SmithNoteContext.Provider value={value}>
        <ExerciseManageScreen />
      </SmithNoteContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '種目を削除' }));

    expect(deleteExercise).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: '種目を削除しますか？' });
    expect(within(dialog).getByText(/ベンチプレス/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(deleteExercise).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '種目を削除' }));
    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    expect(deleteExercise).toHaveBeenCalledWith('e1');
    expect(deleteExercise).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('frequentExercisesForPart', () => {
  it('記録の多い順に最大6種目を返し、未記録セットは数えない', () => {
    const exercises = Array.from({ length: 7 }, (_, index) => ({
      ...exercise,
      id: `e${index + 1}`,
      name: `種目${index + 1}`,
    }));
    const workouts = exercises.flatMap((item, index) =>
      Array.from({ length: index + 1 }, (_, workoutIndex) => ({
        id: `${item.id}-${workoutIndex}`,
        exerciseId: item.id,
        date: `2026-08-${String(workoutIndex + 1).padStart(2, '0')}`,
        sets: [{ id: 'set', weight: 10, recordValue: 10 }],
      })),
    ) as Workout[];
    workouts.push({
      id: 'blank',
      exerciseId: 'e1',
      date: '2026-09-01',
      sets: [{ id: 'blank-set', weight: null, recordValue: null }],
    } as Workout);

    expect(frequentExercisesForPart(exercises, workouts).map((item) => item.id)).toEqual([
      'e7',
      'e6',
      'e5',
      'e4',
      'e3',
      'e2',
    ]);
  });
});

describe('マルチセットの選択', () => {
  it('選択順で確定し、解除と通常モードへの復帰に対応する', () => {
    const startMultiSet = vi.fn();
    const addExerciseToToday = vi.fn();
    const exercises = [exercise, { ...exercise, id: 'e2', name: 'フライ' }];
    const value = {
      state: { workouts: [] },
      groupedExercises: new Map([['胸', exercises]]),
      partRecentLabels: new Map(),
      partColors: new Map(),
      activePart: '胸',
      actions: { startMultiSet, addExerciseToToday, setScreen: vi.fn(), selectPart: vi.fn() },
    } as unknown as SmithNoteContextValue;
    const view = render(
      <SmithNoteContext.Provider value={value}>
        <SelectScreen />
      </SmithNoteContext.Provider>,
    );
    const ui = within(view.container);
    fireEvent.click(ui.getByRole('button', { name: 'マルチセットモード' }));
    expect(ui.getByRole('button', { name: '0種目で確定' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(ui.getByRole('button', { name: /フライ/ }));
    fireEvent.click(ui.getByRole('button', { name: /ベンチプレス/ }));
    expect(addExerciseToToday).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: '2種目で確定' }));
    expect(startMultiSet).toHaveBeenCalledWith(['e2', 'e1']);
    fireEvent.click(ui.getByRole('button', { name: /フライ/ }));
    expect(ui.getByRole('button', { name: '1種目で確定' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(ui.getByRole('button', { name: '通常モードに戻す' }));
    expect(ui.queryByRole('button', { name: /種目で確定/ })).toBeNull();
  });
});
