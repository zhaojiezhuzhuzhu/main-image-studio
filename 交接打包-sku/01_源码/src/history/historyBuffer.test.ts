import { describe, expect, it } from 'vitest';
import { HistoryBuffer } from './historyBuffer';

describe('撤销历史', () => {
  it('undoes and redoes committed edits', () => {
    const history = new HistoryBuffer({ value: 'A' }, 'A', 30);
    history.commit({ value: 'B' }, 'B');
    history.commit({ value: 'C' }, 'C');

    expect(history.undo({ value: 'C' }, 'C')).toEqual({ value: 'B' });
    expect(history.undo({ value: 'B' }, 'B')).toEqual({ value: 'A' });
    expect(history.redo('A')).toEqual({ value: 'B' });
  });

  it('treats an unsettled continuous edit as one undo step', () => {
    const history = new HistoryBuffer({ x: 10 }, '10', 30);

    expect(history.undo({ x: 42 }, '42')).toEqual({ x: 10 });
    expect(history.redo('10')).toEqual({ x: 42 });
  });

  it('drops the oldest edit beyond the configured limit', () => {
    const history = new HistoryBuffer(0, '0', 2);
    history.commit(1, '1');
    history.commit(2, '2');
    history.commit(3, '3');

    expect(history.undo(3, '3')).toBe(2);
    expect(history.undo(2, '2')).toBe(1);
    expect(history.undo(1, '1')).toBeUndefined();
  });

  it('clears redo entries after a new edit', () => {
    const history = new HistoryBuffer(0, '0');
    history.commit(1, '1');
    history.undo(1, '1');
    history.commit(2, '2');

    expect(history.redo('2')).toBeUndefined();
  });

  it('seeds a limited crash-recovery history', () => {
    const history = new HistoryBuffer(3, '3', 2);
    history.seed([
      { value: 0, key: '0' },
      { value: 1, key: '1' },
      { value: 2, key: '2' },
    ], 3, '3');

    expect(history.undo(3, '3')).toBe(2);
    expect(history.undo(2, '2')).toBe(1);
    expect(history.undo(1, '1')).toBeUndefined();
  });
});
