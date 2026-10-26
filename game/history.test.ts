import { describe, expect, it } from 'vitest';
import { GROUP_MS, HISTORY_LIMIT, emptyHistory, record, undo } from './history';

describe('undo history', () => {
  it('remembers the state before each separate change and steps back through them', () => {
    let h = emptyHistory<string>();
    h = record(h, 'a', 1000);          // a → b
    h = record(h, 'b', 1000 + GROUP_MS + 1); // b → c, later
    expect(h.past).toEqual(['a', 'b']);
    const first = undo(h)!;
    expect(first.state).toBe('b');
    const second = undo(first.history)!;
    expect(second.state).toBe('a');
    expect(undo(second.history)).toBeNull();
  });

  it('groups changes that follow each other quickly into one step (a drag)', () => {
    let h = emptyHistory<number>();
    h = record(h, 0, 1000);
    for (let i = 1; i < 20; i++) h = record(h, i, 1000 + i * 16); // 20 moves in a drag
    expect(h.past).toEqual([0]);
    expect(undo(h)!.state).toBe(0);
  });

  it('keeps only the latest steps', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = record(h, i, i * 5000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[h.past.length - 1]).toBe(HISTORY_LIMIT + 9);
  });

  it('has nothing to undo at the start', () => {
    expect(undo(emptyHistory())).toBeNull();
  });
});
