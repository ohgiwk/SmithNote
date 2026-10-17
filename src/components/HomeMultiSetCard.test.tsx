import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Workout } from '../types';
import { HomeMultiSetCard } from './HomeMultiSetCard';

const first: Workout = {
  id: 'w1',
  exerciseId: 'e1',
  date: '2026-10-17',
  name: 'ベンチ',
  part: '胸',
  measurementType: 'reps',
  multiSetGroupId: 'g1',
  multiSetOrder: 0,
  sets: [
    { id: 'a1', weight: 50, recordValue: 10 },
    { id: 'a2', weight: 45, recordValue: 12 },
  ],
  note: '',
  usageElapsedSeconds: 0,
};
const second: Workout = {
  ...first,
  id: 'w2',
  exerciseId: 'e2',
  name: 'プランク',
  measurementType: 'seconds',
  multiSetOrder: 1,
  sets: [{ id: 'b1', weight: 0, recordValue: 30 }],
};

describe('ホームのスーパーセットパネル', () => {
  it('1つのパネルに種目名を改行表示し、詳細とグループ削除を操作できる', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    const view = render(
      <HomeMultiSetCard
        workouts={[first, second]}
        weightUnit="kg"
        readOnly={false}
        removingWorkoutId={null}
        onOpen={onOpen}
        onDelete={onDelete}
      />,
    );
    const ui = within(view.container);
    expect(
      [...view.container.querySelectorAll('h2 > span')].map((item) => item.textContent),
    ).toEqual(['胸｜ベンチ', '胸｜プランク']);
    expect(view.container.querySelector('.home-multi-set-info')).toBeNull();
    expect(view.container.querySelectorAll('article')).toHaveLength(1);
    expect(ui.getAllByRole('table')).toHaveLength(1);
    expect(
      [...view.container.querySelectorAll('.home-multi-set-row-label')].map(
        (row) => row.textContent,
      ),
    ).toEqual(['ベンチ', 'プランク', 'ベンチ']);
    expect(ui.getByRole('table').textContent).toContain('30');
    expect(ui.getByRole('table').textContent).toContain('秒');
    fireEvent.click(ui.getByRole('button', { name: 'スーパーセットの詳細を開く' }));
    expect(onOpen).toHaveBeenCalledWith('w1');
    fireEvent.click(ui.getByRole('button', { name: 'スーパーセットの種目をすべて削除' }));
    expect(onDelete.mock.calls[0][1]).toEqual(first);
  });
  it('終了日は種目削除を表示しない', () => {
    const view = render(
      <HomeMultiSetCard
        workouts={[first, second]}
        weightUnit="kg"
        readOnly
        removingWorkoutId={null}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(within(view.container).queryByRole('button', { name: /削除/ })).toBeNull();
  });
});
