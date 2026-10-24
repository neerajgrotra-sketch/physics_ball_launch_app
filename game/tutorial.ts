import type { Level, PlacedPiece } from '../physics';
import { aimPreview } from './aim';
import type { TutorialState } from './coach';
import type { Slot } from './pieces';

// The tutorial level plays against its own stored solution: dashed outlines show where each bar goes, and a
// bar or the aim that's close snaps onto it, so the guided shot always lands. Pure; Vitest covers it.

/** A bar dropped within this many units of its spot snaps onto it. */
export const SNAP_POS = 32;
/** A bar turned to within this many degrees of its angle snaps to it (a bar is the same line every 180°). */
export const SNAP_DEG = 14;
/** The aim snaps to the solution's angle within this many degrees, and to its power within this much. */
export const SNAP_ANGLE = 2.5;
export const SNAP_POWER = 6;

/** Degrees between two bar rotations, as lines (0–90). */
export function degDiff(a: number, b: number): number {
  const d = (((a - b) % 180) + 180) % 180;
  return d > 90 ? 180 - d : d;
}

/** Bar k's spot in the stored solution, ready to draw as an outline; null if the level has none. */
export function ghostFor(level: Level, k: number): PlacedPiece | null {
  const p = level.solution?.pieces[k];
  return p ? { ...p, len: level.pieces[k].len, restitution: level.pieces[k].restitution } : null;
}

/** Snap bar k's position (after it's moved) or rotation (after it's turned) onto the solution if close. */
export function snapBar(level: Level, slots: Slot[], k: number, what: 'pos' | 'deg'): Slot[] {
  const p = level.solution?.pieces[k], s = slots[k];
  if (!p || !s?.onBoard) return slots;
  let next = s;
  if (what === 'pos' && Math.hypot(s.x - p.x, s.y - p.y) < SNAP_POS) next = { ...s, x: p.x, y: p.y };
  if (what === 'deg' && degDiff(s.deg, p.deg) < SNAP_DEG) next = { ...s, deg: p.deg };
  return next === s ? slots : slots.map((x, i) => (i === k ? next : x));
}

/** Snap the aim onto the solution's angle and power, each independently, when close. */
export function snapAim(level: Level, angle: number, power: number): { angle: number; power: number } {
  const s = level.solution;
  if (!s) return { angle, power };
  return {
    angle: Math.abs(angle - s.angle) < SNAP_ANGLE ? s.angle : angle,
    power: Math.abs(power - s.power) < SNAP_POWER ? s.power : power,
  };
}

/** How the setup compares with the solution, for game/coach tutorialPlan. */
export function tutorialState(level: Level, slots: Slot[], selected: number | null, angle: number, power: number): TutorialState {
  const sol = level.solution;
  return {
    onBoard: slots.map((s) => s.onBoard),
    posOk: slots.map((s, k) => { const p = sol?.pieces[k]; return !!p && Math.hypot(s.x - p.x, s.y - p.y) < 0.5; }),
    degOk: slots.map((s, k) => { const p = sol?.pieces[k]; return !!p && degDiff(s.deg, p.deg) < 0.5; }),
    selected,
    angleOk: !!sol && Math.abs(angle - sol.angle) < 0.05,
    powerOk: !!sol && Math.abs(power - sol.power) < 0.05,
  };
}

/**
 * How far, in world units, the dotted aim line's tip must move to go from the current aim to the target
 * (for the finger to demonstrate): `angle` swings at the current power, `power` stretches at the target angle.
 */
export function aimDemo(level: Level, angle: number, power: number, step: 'angle' | 'power'): { from: { x: number; y: number }; dx: number; dy: number } {
  const tip = (a: number, p: number) => { const d = aimPreview(a, p); return d[d.length - 1]; };
  const sol = level.solution;
  const from = tip(angle, power);
  const to = !sol ? from : step === 'angle' ? tip(sol.angle, power) : tip(sol.angle, sol.power);
  return { from: { x: from.x, y: from.y }, dx: to.x - from.x, dy: to.y - from.y };
}
