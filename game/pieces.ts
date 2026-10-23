import { WORLD, pieceEnds, type Level, type PlacedPiece } from '../physics';
import { nearLauncher } from './aim';

// Piece tray and placement, as in reference/prototype.html. Pure: no UI imports, so Vitest covers it.
// Every function returns new values and never mutates its inputs.

/** One of the level's pieces: in the tray, or on the board at (x, y) rotated by `deg` whole degrees. */
export interface Slot extends PlacedPiece {
  onBoard: boolean;
}

/** Touch within this distance of the selected piece's end handle rotates it. */
export const ROTATE_GRAB = 22;
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
 * Tapping tray chip k: place it (and select it), select it, or remove it if it's already selected.
 */
export function tapChip(slots: Slot[], selected: number | null, k: number): { slots: Slot[]; selected: number | null } {
  const slot = slots[k];
  if (!slot.onBoard) {
    return { slots: replace(slots, k, { ...slot, onBoard: true, ...trayDrop(k) }), selected: k };
  }
  if (selected === k) return { slots: replace(slots, k, { ...slot, onBoard: false }), selected: null };
  return { slots, selected: k };
}

export type Drag =
  | { mode: 'rotate'; k: number }
  | { mode: 'move'; k: number; ox: number; oy: number }
  | { mode: 'aim' };

/**
 * A finger lands on the board. In order: the selected piece's rotate handle, any piece, the launcher
 * (when aiming is allowed), otherwise empty board, which deselects.
 */
export function pressAt(
  slots: Slot[], selected: number | null, p: { x: number; y: number }, canAim: boolean,
): { drag: Drag | null; selected: number | null } {
  if (selected != null && slots[selected].onBoard) {
    const [, , x2, y2] = pieceEnds(slots[selected]);
    if (Math.hypot(p.x - x2, p.y - y2) < ROTATE_GRAB) return { drag: { mode: 'rotate', k: selected }, selected };
  }
  const hit = slots.findIndex((s) => s.onBoard && distToSegment(p, pieceEnds(s)) < PIECE_GRAB);
  if (hit >= 0) {
    const s = slots[hit];
    return { drag: { mode: 'move', k: hit, ox: p.x - s.x, oy: p.y - s.y }, selected: hit };
  }
  if (canAim && nearLauncher(p)) return { drag: { mode: 'aim' }, selected };
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
    return replace(slots, drag.k, { ...s, deg: Math.round((Math.atan2(p.y - s.y, p.x - s.x) * 180) / Math.PI) });
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
