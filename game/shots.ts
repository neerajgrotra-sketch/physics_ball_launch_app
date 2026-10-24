// The player's last winning shot on each level, kept so the level list can draw it. Only the inputs are
// stored (bars, angle, power): physics is deterministic, so the path is re-simulated when drawn. Pure.

export const SHOTS_KEY = 'bank-shot/shots';

export interface Shot { pieces: { x: number; y: number; deg: number; len: number }[]; angle: number; power: number }
export type ShotsByLevel = Record<string, Shot>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Read stored shots, dropping anything malformed. */
export function parseShots(raw: string | null): ShotsByLevel {
  try {
    const o = JSON.parse(raw ?? '{}');
    const out: ShotsByLevel = {};
    if (o && typeof o === 'object') for (const [id, s] of Object.entries(o as Record<string, Partial<Shot>>)) {
      if (s && isNum(s.angle) && isNum(s.power) && Array.isArray(s.pieces)
        && s.pieces.every((p) => p && isNum(p.x) && isNum(p.y) && isNum(p.deg) && isNum(p.len)))
        out[id] = { pieces: s.pieces, angle: s.angle, power: s.power };
    }
    return out;
  } catch {
    return {};
  }
}

/** Every nth point of a path (always keeping the last), for a small drawing. */
export function thin<T>(path: T[], every: number): T[] {
  const out = path.filter((_, i) => i % every === 0);
  if (path.length && out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1]);
  return out;
}
