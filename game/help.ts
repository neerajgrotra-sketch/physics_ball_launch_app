import type { Level } from '../physics';

// The Solve card's one Hint button (components/board/HelpCard.tsx) gives the stored answer a step at a time, in order: each bar in
// turn (game/pieces.ts hintSlots), then the launch angle, then the launch power. Pure: no UI imports, so Vitest covers it.

export type NextHint = { kind: 'bar'; bar: number } | { kind: 'angle'; value: number } | { kind: 'power'; value: number };

/**
 * The next hint: the first bar not yet where the answer has it (`nextBar`, its index, or null when every bar is in place), then the
 * answer's angle, then its power, each skipped once the board already matches it. Null when there is nothing left to hint.
 */
export function nextHint(level: Level, nextBar: number | null, angle: number, power: number): NextHint | null {
  const s = level.solution;
  if (!s) return null;
  if (nextBar != null) return { kind: 'bar', bar: nextBar + 1 };
  if (angle !== s.angle) return { kind: 'angle', value: s.angle };
  if (power !== s.power) return { kind: 'power', value: s.power };
  return null;
}

/** The Hint button's label. */
export function hintLabel(h: NextHint): string {
  return h.kind === 'bar' ? `Hint: place Bar ${h.bar}` : h.kind === 'angle' ? 'Hint: launch angle' : 'Hint: launch power';
}

/** What the board says after an angle or power hint. */
export function aimHintNotice(h: NextHint): string | null {
  if (h.kind === 'angle') return `Angle set to ${h.value.toFixed(1)}°, as in the answer.`;
  if (h.kind === 'power') return `Power set to ${h.value.toFixed(1)}, as in the answer. Launch!`;
  return null;
}

/** What Solve says, instead of opening the card, once the board already matches the answer in every step (`won`: after the win). */
export function solvedNudge(won: boolean): string {
  return won ? 'That was the answer. Tap Replay ▶ to watch it again.' : 'The answer is already set up: every bar, the angle and the power. Just launch!';
}

/** How many steps of the answer are still missing: bars not where the answer has them, then the angle and the power if they differ. */
export function stepsLeft(level: Level, barsLeft: number, angle: number, power: number): number {
  const s = level.solution;
  if (!s) return 0;
  return barsLeft + (angle !== s.angle ? 1 : 0) + (power !== s.power ? 1 : 0);
}
