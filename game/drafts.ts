// A level left part-way: the bars, the aim, the tries so far and the last few launches, saved so the player can leave and come back
// to exactly where they were (the level screen saves it as they play and drops it on a win or Start over). Only inputs are stored:
// physics is deterministic, so the ghost trails are re-simulated from each launch's bars and aim. Pure: no UI imports.

export const DRAFTS_KEY = 'bank-shot/drafts';

/** A bar: where it sits, or null while it's in the tray. */
export type DraftBar = { x: number; y: number; deg: number } | null;
export interface DraftShot { pieces: { x: number; y: number; deg: number; len: number; restitution?: number }[]; angle: number; power: number }
export interface Draft {
  bars: DraftBar[];
  angle: number;
  power: number;
  tries: number;
  /** A hint or Solve was used, so a win stays unscored after coming back. */
  helped: boolean;
  /** The launches whose ghost trails are on the board, oldest first. */
  launches: DraftShot[];
}
export type DraftsByLevel = Record<string, Draft>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPlace = (p: unknown): p is { x: number; y: number; deg: number } =>
  !!p && typeof p === 'object' && isNum((p as any).x) && isNum((p as any).y) && isNum((p as any).deg);

/** Read stored drafts, dropping anything malformed. */
export function parseDrafts(raw: string | null): DraftsByLevel {
  try {
    const o = JSON.parse(raw ?? '{}');
    const out: DraftsByLevel = {};
    if (!o || typeof o !== 'object') return out;
    for (const [id, d] of Object.entries(o as Record<string, Partial<Draft>>)) {
      if (!d || !isNum(d.angle) || !isNum(d.power) || !Array.isArray(d.bars) || !d.bars.every((b) => b === null || isPlace(b))) continue;
      const launches = Array.isArray(d.launches)
        ? d.launches.filter((s) => s && isNum(s.angle) && isNum(s.power) && Array.isArray(s.pieces) && s.pieces.every((p) => isPlace(p) && isNum(p.len)))
        : [];
      out[id] = { bars: d.bars, angle: d.angle, power: d.power, tries: isNum(d.tries) ? d.tries : 0, helped: d.helped === true, launches };
    }
    return out;
  } catch {
    return {};
  }
}

/** Whether a draft is worth keeping: anything changed from a fresh level (a bar out, the aim moved, or a try made). */
export function worthKeeping(d: Draft, fresh: { angle: number; power: number }): boolean {
  return d.tries > 0 || d.bars.some((b) => b) || d.angle !== fresh.angle || d.power !== fresh.power;
}
