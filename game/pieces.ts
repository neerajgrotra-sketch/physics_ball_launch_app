import { WORLD, pieceEnds, type Level, type PlacedPiece } from '../physics';
import { grabAimLine, nearLauncher, type LineGrab } from './aim';
import { illegalPieces, legalPlacement } from './placement';

// Piece tray and placement, as in reference/prototype.html. Pure: no UI imports, so Vitest covers it.
// Every function returns new values and never mutates its inputs.

/** One of the level's pieces: in the tray, or on the board at (x, y) rotated by `deg` whole degrees. */
export interface Slot extends PlacedPiece {
  onBoard: boolean;
}

/** Touch within this distance of the selected piece's rotate handle (its dotted lever) rotates it. */
export const ROTATE_GRAB = 22;
/**
 * The rotate handle: a dotted lever sticking out of one end of the selected bar, this long, with the
 * rotate icon at its tip. Turning it from out there keeps the finger off the bar, and the longer reach
 * gives finer control. Tapping the bar's other end moves the lever there.
 */
export const LEVER = 60;
export type End = 1 | 2;

/** The lever on end `end` of a piece: [end x, end y, tip x, tip y]. End 2 is the (x2, y2) end of pieceEnds. */
export function leverLine(p: PlacedPiece, end: End): [number, number, number, number] {
  const [x1, y1, x2, y2] = pieceEnds(p);
  const a = (p.deg * Math.PI) / 180, s = end === 2 ? 1 : -1;
  const [ex, ey] = end === 2 ? [x2, y2] : [x1, y1];
  return [ex, ey, ex + s * Math.cos(a) * LEVER, ey + s * Math.sin(a) * LEVER];
}

/** Which end to put the lever on when a bar is selected: end 2, unless its tip would be off the board. */
export function leverEnd(p: PlacedPiece): End {
  const inside = (e: End) => {
    const [, , tx, ty] = leverLine(p, e);
    return tx > 8 && tx < WORLD.width - 8 && ty > 8 && ty < WORLD.ground - 8;
  };
  return inside(2) || !inside(1) ? 2 : 1;
}

const bearing = (p: { x: number; y: number }, c: { x: number; y: number }) => (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
/** Touch within this distance of a piece picks it up. */
export const PIECE_GRAB = 16;
/** Moved pieces keep their centre this far inside the board. */
const EDGE = 10;

/** Where a piece lands when you tap its tray chip: k-th piece at (120, 220 + 70k), flat. */
function trayDrop(k: number) {
  return { x: 120, y: 220 + k * 70, deg: 0 };
}

export function emptySlots(level: Level): Slot[] {
  return level.pieces.map((p, k) => ({ len: p.len, restitution: p.restitution, onBoard: false, ...trayDrop(k) }));
}

/** The stored solution's placement. Pieces it doesn't use go back to the tray. */
export function solutionSlots(level: Level): Slot[] {
  const s = level.solution;
  return emptySlots(level).map((slot, k) => {
    const sp = s?.pieces[k];
    return sp ? { ...slot, ...sp, onBoard: true } : slot;
  });
}

/** Pieces on the board, ready for buildWorld and the Board's `pieces` prop. */
export function boardPieces(slots: Slot[]): PlacedPiece[] {
  return slots.filter((s) => s.onBoard).map(({ onBoard: _, ...p }) => p);
}

/** Index of slot `k` among the on-board pieces, for the Board's `selected` prop. */
export function boardIndex(slots: Slot[], k: number | null): number | null {
  if (k == null || !slots[k]?.onBoard) return null;
  return slots.slice(0, k).filter((s) => s.onBoard).length;
}

/**
 * Tapping tray chip k: place it (and select it), select it, or deselect it if it's already selected.
 * Removing a bar is the Remove button in the rotation controls (removeBar).
 */
export function tapChip(
  slots: Slot[], selected: number | null, k: number, level?: Level,
): { slots: Slot[]; selected: number | null } {
  const slot = slots[k];
  if (!slot.onBoard) {
    // With a level, the bar lands at the nearest spot where it's allowed (see game/placement).
    const spot = level ? dropSpot(level, slots, k) : trayDrop(k);
    return { slots: replace(slots, k, { ...slot, onBoard: true, ...spot }), selected: k };
  }
  if (selected === k) return { slots, selected: null };
  return { slots, selected: k };
}

/** Takes bar k off the board, back into the tray. */
export function removeBar(slots: Slot[], k: number): { slots: Slot[]; selected: null } {
  return { slots: replace(slots, k, { ...slots[k], onBoard: false }), selected: null };
}

/**
 * A drag in progress. Rotate: turning piece k by the lever on `end` (default 2); `offset` (degrees,
 * default 0) keeps the bar from jumping when the lever is grabbed away from its exact line.
 */
export type Drag =
  | { mode: 'rotate'; k: number; end?: End; offset?: number }
  | { mode: 'move'; k: number; ox: number; oy: number }
  | { mode: 'aim' }
  | { mode: 'swing'; grab: LineGrab };

/**
 * A finger lands on the board. In order: the selected piece's lever (on `lever`, its current end) or its
 * other end (which moves the lever there, returned as `lever`), any piece, the launcher (when aiming is
 * allowed), the dotted aim line, otherwise empty board, which deselects.
 */
export function pressAt(
  slots: Slot[], selected: number | null, p: { x: number; y: number }, canAim: boolean,
  aim?: { angle: number; power: number }, lever: End = 2,
): { drag: Drag | null; selected: number | null; lever?: End } {
  if (selected != null && slots[selected].onBoard) {
    const s = slots[selected];
    const rotate = (end: End): Drag => ({ mode: 'rotate', k: selected, end, offset: s.deg - bearing(p, s) - (end === 1 ? 180 : 0) });
    if (distToSegment(p, leverLine(s, lever)) < ROTATE_GRAB) return { drag: rotate(lever), selected };
    const other: End = lever === 2 ? 1 : 2;
    const [ox, oy] = leverLine(s, other);
    if (Math.hypot(p.x - ox, p.y - oy) < ROTATE_GRAB) return { drag: rotate(other), selected, lever: other };
  }
  const hit = slots.findIndex((s) => s.onBoard && distToSegment(p, pieceEnds(s)) < PIECE_GRAB);
  if (hit >= 0) {
    const s = slots[hit];
    return { drag: { mode: 'move', k: hit, ox: p.x - s.x, oy: p.y - s.y }, selected: hit };
  }
  if (canAim && nearLauncher(p)) return { drag: { mode: 'aim' }, selected };
  const grab = canAim && aim ? grabAimLine(p, aim.angle, aim.power) : null;
  if (grab) return { drag: { mode: 'swing', grab }, selected };
  return { drag: null, selected: null };
}

/** A move or rotate drag follows the finger. Aim drags are handled by game/aim. */
export function dragTo(slots: Slot[], drag: Drag, p: { x: number; y: number }): Slot[] {
  if (drag.mode === 'move') {
    const s = slots[drag.k];
    return replace(slots, drag.k, {
      ...s,
      x: clamp(p.x - drag.ox, EDGE, WORLD.width - EDGE),
      y: clamp(p.y - drag.oy, EDGE, WORLD.ground - EDGE),
    });
  }
  if (drag.mode === 'rotate') {
    const s = slots[drag.k];
    const deg = Math.round(bearing(p, s) + (drag.end === 1 ? 180 : 0) + (drag.offset ?? 0));
    return replace(slots, drag.k, { ...s, deg: ((deg + 180) % 360 + 360) % 360 - 180 });
  }
  return slots;
}

export function distToSegment(p: { x: number; y: number }, [x1, y1, x2, y2]: [number, number, number, number]): number {
  const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey;
  const u = L2 ? clamp(((p.x - x1) * ex + (p.y - y1) * ey) / L2, 0, 1) : 0;
  return Math.hypot(p.x - x1 - ex * u, p.y - y1 - ey * u);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function replace<T>(xs: T[], i: number, v: T): T[] {
  const out = xs.slice();
  out[i] = v;
  return out;
}

/**
 * A bar's rotation as shown to the player: 0–179°, counter-clockwise from flat (a bar looks the same
 * turned 180°). Matches the label on the board. `deg` itself is the physics rotation, clockwise.
 */
export function shownAngle(deg: number): number {
  return ((-deg % 180) + 180) % 180;
}

/** Set slot k to a shown angle (whole degrees, wrapped into 0–179). */
export function rotateTo(slots: Slot[], k: number, shown: number): Slot[] {
  const a = ((Math.round(shown) % 180) + 180) % 180;
  return replace(slots, k, { ...slots[k], deg: a === 0 ? 0 : -a });
}

/** Turn slot k by whole degrees (positive = counter-clockwise), wrapping past 179 and below 0. */
export function rotateBy(slots: Slot[], k: number, by: number): Slot[] {
  return rotateTo(slots, k, shownAngle(slots[k].deg) + by);
}

/** Bar numbers (1-based, as on the tray chips) of the pieces on the board, in board order. */
export function boardNumbers(slots: Slot[]): number[] {
  return slots.flatMap((s, k) => (s.onBoard ? [k + 1] : []));
}

/** Whether every bar on the board is somewhere it's allowed (game/placement). */
export function slotsLegal(level: Level, slots: Slot[]): boolean {
  return legalPlacement(level, boardPieces(slots));
}

/** Per on-board bar (board order), whether it's somewhere it isn't allowed: drawn red. */
export function illegalBars(level: Level, slots: Slot[]): boolean[] {
  return illegalPieces(level, boardPieces(slots));
}

/**
 * Where bar k lands when placed from the tray: its usual drop spot if that's allowed, otherwise the
 * nearest allowed spot to it (flat, then upright), searching a 10-unit grid.
 */
export function dropSpot(level: Level, slots: Slot[], k: number): { x: number; y: number; deg: number } {
  const home = trayDrop(k);
  const fits = (x: number, y: number, deg: number) =>
    slotsLegal(level, replace(slots, k, { ...slots[k], onBoard: true, x, y, deg }));
  if (fits(home.x, home.y, home.deg)) return home;
  for (const deg of [0, 90]) {
    let best: { x: number; y: number; d: number } | null = null;
    for (let x = 20; x <= WORLD.width - 20; x += 10) for (let y = 20; y <= WORLD.ground - 20; y += 10) {
      const d = Math.hypot(x - home.x, y - home.y);
      if ((!best || d < best.d) && fits(x, y, deg)) best = { x, y, d };
    }
    if (best) return { x: best.x, y: best.y, deg };
  }
  return home; // nowhere fits: show it (red) at home rather than not at all
}

/** rotateBy, skipping any angle where bar k would break the rule. Unchanged if none fits. */
export function rotateLegal(level: Level, slots: Slot[], k: number, by: 1 | -1): Slot[] {
  for (let step = 1; step < 180; step++) {
    const next = rotateBy(slots, k, by * step);
    if (slotsLegal(level, next)) return next;
  }
  return slots;
}

/** rotateTo, but only if bar k is allowed there; otherwise it stays where it was. */
export function rotateToLegal(level: Level, slots: Slot[], k: number, shown: number): Slot[] {
  const next = rotateTo(slots, k, shown);
  return slotsLegal(level, next) ? next : slots;
}

/** Whether bar k sits exactly where the stored solution puts it. */
export function atSolution(level: Level, slots: Slot[], k: number): boolean {
  const p = level.solution?.pieces[k], s = slots[k];
  return !!p && s.onBoard && s.x === p.x && s.y === p.y && s.deg === p.deg;
}

/**
 * A hint: the next bar that isn't already where the stored solution has it goes there. Any other bar
 * that then clashes with something goes back to the tray (solution spots never clash with each other).
 * Returns null when every bar is already in place, leaving only the full solution (the aim) to give.
 */
export function hintSlots(level: Level, slots: Slot[]): { slots: Slot[]; k: number } | null {
  const sol = level.solution;
  if (!sol) return null;
  const k = sol.pieces.findIndex((_, i) => !atSolution(level, slots, i));
  if (k < 0) return null;
  let next = replace(slots, k, { ...slots[k], ...sol.pieces[k], onBoard: true });
  while (!slotsLegal(level, next)) {
    const onBoard = next.map((s, i) => (s.onBoard ? i : -1)).filter((i) => i >= 0);
    const bad = illegalBars(level, next);
    const j = onBoard.find((i, b) => bad[b] && !atSolution(level, next, i));
    if (j === undefined) break;
    next = replace(next, j, { ...next[j], onBoard: false });
  }
  return { slots: next, k };
}
