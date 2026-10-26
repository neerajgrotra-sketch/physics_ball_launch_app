import type { Level } from '../physics';

// The aim hints on the Solve card (components/board/HelpCard.tsx): besides placing the next bar, the player can watch an ad for the
// stored answer's launch angle, or its launch power, each on its own. Pure: no UI imports, so Vitest covers it.

export type AimHint = 'angle' | 'power';

/** Which aim hints are still worth offering: one is left out once the aim already matches the answer's (or there is no answer). */
export function aimHints(level: Level, angle: number, power: number): Record<AimHint, boolean> {
  const s = level.solution;
  return { angle: !!s && angle !== s.angle, power: !!s && power !== s.power };
}

/** The value an aim hint sets, from the stored answer. */
export function aimHintValue(level: Level, which: AimHint): number | null {
  const s = level.solution;
  return s ? (which === 'angle' ? s.angle : s.power) : null;
}

/** What the board says once an aim hint is used. The answer's aim only lands with the answer's bars, so it says so. */
export function aimHintNotice(which: AimHint, value: number, bars: number): string {
  const set = which === 'angle' ? `Angle set to ${value.toFixed(1)}°` : `Power set to ${value.toFixed(1)}`;
  const barsText = bars === 1 ? 'the bar' : bars === 2 ? 'both bars' : `all ${bars} bars`;
  return `${set}, as in the answer. It lands with ${barsText} where the answer puts ${bars === 1 ? 'it' : 'them'}.`;
}
