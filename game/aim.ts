import { ANGLE_STEP, LAUNCHER, POWER_STEP, speedFor } from '../physics';

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

/**
 * The dotted aim preview: the first 0.3 s of free flight only (never bounces), oldest dot first, `a` its
 * opacity. Same gravity as the board draws it with.
 */
export function aimPreview(angle: number, power: number): { x: number; y: number; a: number }[] {
  const ang = (angle * Math.PI) / 180, sp = speedFor(power);
  const vx = Math.cos(ang) * sp, vy = -Math.sin(ang) * sp;
  const dots: { x: number; y: number; a: number }[] = [];
  for (let t = 0.03; t <= 0.3; t += 0.03) {
    dots.push({ x: LAUNCHER.x + vx * t, y: LAUNCHER.y + vy * t + 450 * t * t, a: 1 - t * 2.6 });
  }
  return dots;
}

/** A finger this close (world units) to the dotted line grabs it to swing the aim. */
export const LINE_GRAB = 26;

const bearing = (p: { x: number; y: number }) => (Math.atan2(LAUNCHER.y - p.y, p.x - LAUNCHER.x) * 180) / Math.PI;

/** A grab on the dotted line: what the aim was, and where the finger took hold of it. */
export interface LineGrab { offset: number; dist: number; speed: number }

/**
 * Grabbing the dotted line lets the finger steer it like a rubber band: moving round the launcher swings
 * the angle, and moving away from or towards it stretches or shrinks the power. Returns what's needed
 * to keep the line from jumping under the finger (the dots curve under gravity), or null if the line
 * wasn't touched.
 */
export function grabAimLine(p: { x: number; y: number }, angle: number, power: number): LineGrab | null {
  const near = aimPreview(angle, power).some((d) => Math.hypot(p.x - d.x, p.y - d.y) < LINE_GRAB);
  const dist = Math.hypot(p.x - LAUNCHER.x, p.y - LAUNCHER.y);
  return near && dist > 1 ? { offset: angle - bearing(p), dist, speed: speedFor(power) } : null;
}

/**
 * Angle and power for a line drag. Angle: the finger's bearing from the launcher plus the grab offset.
 * Power: launch speed scales with the finger's distance from the launcher, so the dot under the finger
 * stays (about) under it as the line stretches.
 */
export function swingTo(p: { x: number; y: number }, g: LineGrab): { angle: number; power: number } {
  const speed = (g.speed * Math.hypot(p.x - LAUNCHER.x, p.y - LAUNCHER.y)) / g.dist;
  return {
    angle: toGrid(clamp(bearing(p) + g.offset, ANGLE_MIN, ANGLE_MAX)),
    power: toGrid(clamp((speed - speedFor(0)) / (speedFor(1) - speedFor(0)), POWER_MIN, POWER_MAX)),
  };
}

/** The −/+ buttons: one 0.1 step, kept in range. */
export function nudgeAngle(angle: number, dir: 1 | -1): number {
  return toGrid(clamp(angle + dir * ANGLE_STEP, ANGLE_MIN, ANGLE_MAX));
}

export function nudgePower(power: number, dir: 1 | -1): number {
  return toGrid(clamp(power + dir * POWER_STEP, POWER_MIN, POWER_MAX));
}
