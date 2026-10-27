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

/** The point a drag from the launcher would need to reach for this angle and power (the inverse of aimAt). */
export function aimPoint(angle: number, power: number): { x: number; y: number } {
  const r = 20 + 2.6 * power, a = (angle * Math.PI) / 180;
  return { x: LAUNCHER.x + Math.cos(a) * r, y: LAUNCHER.y - Math.sin(a) * r };
}

/**
 * A swipe on empty board moves the aim along with the finger, from wherever it is (no jump on touch): the finger's movement
 * (dx, dy, world units) moves the aim point. Away from the gun is more power, towards it less, round it turns the gun.
 */
export function aimBy(angle: number, power: number, dx: number, dy: number): { angle: number; power: number } {
  const at = aimPoint(angle, power);
  return aimAt({ x: at.x + dx, y: at.y + dy });
}

/**
 * The dotted aim preview: the first 0.3 s of free flight only (never bounces), oldest dot first, `a` its
 * opacity, `t` its time since launch. Same gravity as the board draws it with.
 */
export function aimPreview(angle: number, power: number): { x: number; y: number; a: number; t: number }[] {
  const ang = (angle * Math.PI) / 180, sp = speedFor(power);
  const vx = Math.cos(ang) * sp, vy = -Math.sin(ang) * sp;
  const dots: { x: number; y: number; a: number; t: number }[] = [];
  for (let t = 0.03; t <= 0.3; t += 0.03) {
    dots.push({ x: LAUNCHER.x + vx * t, y: LAUNCHER.y + vy * t + GRAVITY_HALF * t * t, a: 1 - t * 2.6, t });
  }
  return dots;
}

/** Half the board's gravity (900 px/s²): the y drop of a free-flying ball is GRAVITY_HALF · t². */
const GRAVITY_HALF = 450;

/** A finger this close (world units) to the dotted line grabs it to steer the aim. */
export const LINE_GRAB = 26;

/** A grab on the dotted line: which dot (its time since launch) the finger took, and how far the dot was from it. */
export interface LineGrab { t: number; ox: number; oy: number }

/**
 * Grabbing the dotted line works like a rubber band: the dot you took stays under your finger. Moving it
 * round the launcher turns the angle, pulling it out or pushing it in changes the power, and any
 * mix of the two works, with nothing else drifting (the dots curve under gravity, which a plain
 * "distance from the launcher" would get wrong). Returns the nearest dot's time and its offset from the
 * finger (so the line doesn't jump if the touch was a little off), or null if the line wasn't touched.
 */
export function grabAimLine(p: { x: number; y: number }, angle: number, power: number): LineGrab | null {
  let best: LineGrab | null = null, bestD = LINE_GRAB;
  for (const d of aimPreview(angle, power)) {
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if (dist < bestD) { bestD = dist; best = { t: d.t, ox: d.x - p.x, oy: d.y - p.y }; }
  }
  return best;
}

/**
 * Angle and power for a line drag: the launch velocity that puts the grabbed dot where the finger is
 * (plus the grab offset). Angle is held to 0–90 like everywhere else (a finger behind the launcher
 * pins to the nearest legal angle) and power to 0–100.
 */
export function swingTo(p: { x: number; y: number }, g: LineGrab): { angle: number; power: number } {
  const dx = p.x + g.ox - LAUNCHER.x, dy = p.y + g.oy - LAUNCHER.y - GRAVITY_HALF * g.t * g.t;
  const vx = dx / g.t, vy = -dy / g.t; // vy up-positive
  let ang = (Math.atan2(vy, vx) * 180) / Math.PI;
  if (vx < 0) ang = vy > 0 ? 90 : 0;
  const speed = Math.hypot(vx, vy);
  return {
    angle: toGrid(clamp(ang, ANGLE_MIN, ANGLE_MAX)),
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
