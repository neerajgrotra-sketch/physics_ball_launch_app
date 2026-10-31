// Challenge a friend: a link that opens one level on the web site, with the sender's winning shot inside it, so a friend can play it
// in the browser at once (no install) and try to beat the sender's bounces. Only the inputs travel (bars, angle, power): physics is
// deterministic, so the friend's game re-runs the shot to learn its bounces and to check it really wins, rather than trusting a
// number in the link. The shot is lightly scrambled so the answer isn't readable at a glance. Pure: no UI imports.
import { buildWorld, simulate, type Level } from '../physics';
import { LEVELS } from '../levels';
import { shotPieces } from './pieces';

/** The public web site (Vercel, production). The web build uses its own address instead, so a preview or local build links to itself. */
export const SITE_URL = 'https://racing-cobalt-ydmy8we-neerajgrotra-7631s-projects.vercel.app';

export interface ChallengeShot { pieces: { x: number; y: number; deg: number }[]; angle: number; power: number }
export interface Challenge { levelId: string; from: string; shot: ChallengeShot }

const NAME_MAX = 20;
const KEY = 'bankshot';

// A tiny reversible scramble (xor with a fixed key, then base64url), so a link doesn't spell out where the bars go.
function scramble(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += String.fromCharCode(text.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unscramble(code: string): string | null {
  try {
    const raw = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    let out = '';
    for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
    return out;
  } catch {
    return null;
  }
}

/** The shot as a short code: "x,y,deg;x,y,deg|angle|power", scrambled. */
export function encodeShot(shot: ChallengeShot): string {
  const bars = shot.pieces.map((p) => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.deg)}`).join(';');
  return scramble(`${bars}|${shot.angle.toFixed(1)}|${shot.power.toFixed(1)}`);
}

export function decodeShot(code: string): ChallengeShot | null {
  const text = unscramble(code);
  if (!text) return null;
  const [bars, angle, power] = text.split('|');
  if (bars == null || angle == null || power == null) return null;
  const pieces = bars.split(';').map((b) => b.split(',').map(Number));
  if (!pieces.every((p) => p.length === 3 && p.every(Number.isFinite))) return null;
  const a = Number(angle), pw = Number(power);
  if (!Number.isFinite(a) || !Number.isFinite(pw) || a < 0 || a > 90 || pw < 0 || pw > 100) return null;
  return { pieces: pieces.map(([x, y, deg]) => ({ x, y, deg })), angle: a, power: pw };
}

/** The link's query part, e.g. "l=14-stilts&s=…&n=Neeraj". */
export function challengeQuery(c: Challenge): string {
  const name = c.from.trim().slice(0, NAME_MAX);
  return `l=${encodeURIComponent(c.levelId)}&s=${encodeShot(c.shot)}${name ? `&n=${encodeURIComponent(name)}` : ''}`;
}

export function challengeUrl(c: Challenge, site = SITE_URL): string {
  return `${site.replace(/\/$/, '')}/challenge?${challengeQuery(c)}`;
}

/** What a link holds, checked against the levels: undefined parts or a shot for the wrong number of bars give null. */
export function readChallenge(params: { l?: string; s?: string; n?: string }): (Challenge & { level: Level }) | null {
  const level = LEVELS.find((l) => l.id === params.l);
  if (!level || !params.s) return null;
  const shot = decodeShot(params.s);
  if (!shot || shot.pieces.length !== level.pieces.length) return null;
  return { levelId: level.id, from: (params.n ?? '').trim().slice(0, NAME_MAX), shot, level };
}

/** Re-runs the sender's shot: its bounces if it wins, or null if it doesn't (a broken or edited link). */
export function challengeBounces(level: Level, shot: ChallengeShot): number | null {
  const res = simulate(buildWorld(level, shotPieces(level, shot)), shot.angle, shot.power);
  return res.success ? res.bounces : null;
}

/** "Neeraj", or "your friend" when the link has no name (Capitalised at the start of a line). */
export const senderName = (from: string, start = false) => from || (start ? 'Your friend' : 'your friend');

/** The goal line under the board in a challenge: "Beat Neeraj's 3 bounces, off all 3 bars". */
export function challengeGoal(from: string, bounces: number, every: string): string {
  const who = from ? `${from}’s` : 'your friend’s';
  return `Beat ${who} ${bounces} bounce${bounces === 1 ? '' : 's'}, off ${every}`;
}

/** The message sent with the link. */
export function challengeMessage(opts: { levelNo: number; levelName: string; bounces: number; par: number; url: string }): string {
  const { levelNo, levelName, bounces, par, url } = opts;
  return [
    `⚔️ I got Bank Shot level ${levelNo} “${levelName}” in ${bounces} bounce${bounces === 1 ? '' : 's'} (par ${par}).`,
    'Can you beat me? Tap to play, no download needed:',
    url,
  ].join('\n');
}

export type ChallengeOutcome = 'beat' | 'tie' | 'lost';
export const outcome = (yours: number, theirs: number): ChallengeOutcome => (yours < theirs ? 'beat' : yours === theirs ? 'tie' : 'lost');

/** The win card's title and line for a challenge. */
export function challengeWinText(yours: number, theirs: number, from: string, helped = false): { title: string; detail: string } {
  const who = senderName(from);
  const line = `You ${yours}${helped ? ' (with help)' : ''} · ${senderName(from, true)} ${theirs} bounce${theirs === 1 ? '' : 's'}`;
  const o = outcome(yours, theirs);
  if (o === 'beat') return { title: `You beat ${who}!`, detail: line };
  if (o === 'tie') return { title: `Tied with ${who}!`, detail: `${line}. Fewer to win it.` };
  return { title: 'In! But not beaten yet', detail: `${line}. Try for fewer.` };
}
