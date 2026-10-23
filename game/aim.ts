import { ANGLE_STEP, LAUNCHER, POWER_STEP } from '../physics';

// Aim input, as in reference/prototype.html. Pure: no UI imports, so Vitest covers it.

export const ANGLE_MIN = 0, ANGLE_MAX = 90;
export const POWER_MIN = 0, POWER_MAX = 100;
/** A drag that starts within this many world units of the launcher aims; anything further is for pieces. */
export const AIM_GRAB_RADIUS = 90;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Round to one decimal, the only values a player can enter (same rounding as the prototype's toFixed(1)). */
export const toGrid = (v: number) => Number(v.toFixed(1));

export function nearLauncher(p: { x: number; y: number }): boolean {
  return Math.hypot(p.x - LAUNCHER.x, p.y - LAUNCHER.y) < AIM_GRAB_RADIUS;
}

/**
 * Angle and power for a drag point. Direction from the launcher sets the angle (pointing where the ball
 * should go), distance sets the power.
 */
export function aimAt(p: { x: number; y: number }): { angle: number; power: number } {
  const dx = p.x - LAUNCHER.x, dy = LAUNCHER.y - p.y;
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (dx < 0) a = dy > 0 ? 90 : 0;
  a = clamp(a, ANGLE_MIN, ANGLE_MAX);
  const pw = clamp((Math.hypot(dx, dy) - 20) / 2.6, POWER_MIN, POWER_MAX);
  return { angle: toGrid(a), power: toGrid(pw) };
}

/** The −/+ buttons: one 0.1 step, kept in range. */
export function nudgeAngle(angle: number, dir: 1 | -1): number {
  return toGrid(clamp(angle + dir * ANGLE_STEP, ANGLE_MIN, ANGLE_MAX));
}

export function nudgePower(power: number, dir: 1 | -1): number {
  return toGrid(clamp(power + dir * POWER_STEP, POWER_MIN, POWER_MAX));
}
