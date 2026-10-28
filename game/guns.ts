// Gun skins: how the launcher looks, picked in Settings ("Your gun") and saved on the device, like the ball skins (game/skins.ts).
// Purely a look: the ball always leaves from LAUNCHER at the chosen angle and power, so a gun never changes any shot or answer.
// Each design is a list of simple shapes worked out from the aim (gunShapes), which every drawing of the gun uses: the board, the
// level cards, the share poster and the picker. Pure: no UI imports, so Vitest covers it.
import { BALL_RADIUS, LAUNCHER, WORLD } from '../physics';

export const GUN_KEY = 'bank-shot/gun';

export interface GunSkin { id: string; name: string }

export const GUNS: GunSkin[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'brass', name: 'Brass cannon' },
  { id: 'pirate', name: 'Pirate cannon' },
  { id: 'blaster', name: 'Blaster' },
  { id: 'slingshot', name: 'Slingshot' },
  { id: 'cue', name: 'Pool cue' },
];

export const DEFAULT_GUN = GUNS[0];

export function parseGun(raw: string | null | undefined): GunSkin {
  return GUNS.find((g) => g.id === raw) ?? DEFAULT_GUN;
}

/** Theme colours a design may use (the classic gun follows the board theme; the others have their own colours). */
export interface GunColors { ink: string; muted: string; paper: string }

export type Pt = [number, number];
/** One shape of a gun, in world units. Drawn in order: later shapes on top. */
export type GunShape =
  | { kind: 'poly'; points: Pt[]; fill: string; stroke?: string; width?: number; alpha?: number }
  | { kind: 'line'; from: Pt; to: Pt; color: string; width: number; alpha?: number }
  | { kind: 'circle'; at: Pt; r: number; fill?: string; stroke?: string; width?: number; alpha?: number };

const G = WORLD.ground;
const L: Pt = [LAUNCHER.x, LAUNCHER.y];

/**
 * The shapes of a gun aimed at `angle` degrees with `power` (0–100). u points along the barrel (screen y is down), n across it.
 * The ball itself is drawn on top by the caller, resting at LAUNCHER.
 */
export function gunShapes(gun: GunSkin, angle: number, power: number, c: GunColors): GunShape[] {
  const a = (angle * Math.PI) / 180;
  const u: Pt = [Math.cos(a), -Math.sin(a)];
  const n: Pt = [-u[1], u[0]];
  const at = (along: number, across = 0, from: Pt = L): Pt => [from[0] + u[0] * along + n[0] * across, from[1] + u[1] * along + n[1] * across];
  // A tube along the barrel from `back` to `front`, `w0` wide at the back and `w1` at the front.
  const tube = (back: number, front: number, w0: number, w1: number): Pt[] => [at(back, -w0 / 2), at(front, -w1 / 2), at(front, w1 / 2), at(back, w0 / 2)];
  const cross = (along: number, w: number): [Pt, Pt] => [at(along, -w / 2), at(along, w / 2)];
  const stand: Pt[] = [[L[0] - 14, G], [L[0] + 14, G], [L[0] + 4, L[1]], [L[0] - 4, L[1]]];

  switch (gun.id) {
    case 'brass': {
      const gold = '#d4a536', dark = '#8a6514', wood = '#7a4a24';
      return [
        { kind: 'poly', points: [[L[0] - 16, G], [L[0] + 16, G], [L[0] + 8, L[1] + 6], [L[0] - 8, L[1] + 6]], fill: wood, stroke: '#4a2c14', width: 1.5 },
        { kind: 'poly', points: tube(-8, 30, 14, 10), fill: gold, stroke: dark, width: 1.5 },
        { kind: 'line', ...pair(cross(4, 14)), color: dark, width: 2 },
        { kind: 'line', ...pair(cross(18, 12)), color: dark, width: 2 },
        { kind: 'poly', points: tube(27, 32, 13, 13), fill: gold, stroke: dark, width: 1.5 },
        { kind: 'circle', at: [L[0], G - 9], r: 9, fill: wood, stroke: '#4a2c14', width: 2 },
        { kind: 'line', from: [L[0] - 9, G - 9], to: [L[0] + 9, G - 9], color: '#4a2c14', width: 1.5 },
        { kind: 'line', from: [L[0], G - 18], to: [L[0], G], color: '#4a2c14', width: 1.5 },
        { kind: 'circle', at: [L[0], G - 9], r: 2.5, fill: gold },
      ];
    }
    case 'pirate': {
      const iron = '#2b2e33', wood = '#8b5a2b';
      return [
        { kind: 'poly', points: [[L[0] - 17, G - 4], [L[0] + 17, G - 4], [L[0] + 12, L[1] + 8], [L[0] - 12, L[1] + 8]], fill: wood, stroke: '#4a2c14', width: 1.5 },
        { kind: 'poly', points: tube(-9, 30, 15, 11), fill: iron, stroke: '#111317', width: 1.5 },
        { kind: 'poly', points: tube(27, 33, 15, 15), fill: iron, stroke: '#111317', width: 1.5 },
        { kind: 'circle', at: at(-9), r: 4, fill: iron, stroke: '#111317', width: 1 },
        { kind: 'circle', at: [L[0] - 10, G - 4], r: 5, fill: '#3a2410', stroke: '#1d1208', width: 1.5 },
        { kind: 'circle', at: [L[0] + 10, G - 4], r: 5, fill: '#3a2410', stroke: '#1d1208', width: 1.5 },
      ];
    }
    case 'blaster': {
      const body = '#3a3f4b', glow = '#39ff6a';
      return [
        { kind: 'poly', points: [[L[0] - 15, G], [L[0] + 15, G], [L[0] + 6, L[1] + 4], [L[0] - 6, L[1] + 4]], fill: body, stroke: '#1e2129', width: 1.5 },
        { kind: 'line', from: [L[0] - 10, G - 3], to: [L[0] + 10, G - 3], color: glow, width: 2, alpha: 0.8 },
        { kind: 'poly', points: [at(-6, -6), at(22, -4), at(30, -2), at(30, 2), at(22, 4), at(-6, 6)], fill: body, stroke: '#1e2129', width: 1.5 },
        { kind: 'line', from: at(0), to: at(24), color: glow, width: 1.6, alpha: 0.9 },
        { kind: 'circle', at: at(31), r: 6, fill: glow, alpha: 0.25 },
        { kind: 'circle', at: at(31), r: 3, fill: glow },
      ];
    }
    case 'slingshot': {
      const wood = '#8b5a2b', band = '#c0392b';
      const fork: Pt = [L[0], L[1] + 10];
      const tips: [Pt, Pt] = [[L[0] - 11, L[1] - 9], [L[0] + 11, L[1] - 9]];
      // The pouch sits behind the ball and pulls further back the more power there is.
      const pouch = at(-(BALL_RADIUS + 2 + power * 0.14));
      return [
        { kind: 'line', from: [L[0], G], to: fork, color: wood, width: 6 },
        { kind: 'line', from: fork, to: tips[0], color: wood, width: 5 },
        { kind: 'line', from: fork, to: tips[1], color: wood, width: 5 },
        { kind: 'line', from: tips[0], to: pouch, color: band, width: 2.2 },
        { kind: 'line', from: tips[1], to: pouch, color: band, width: 2.2 },
        { kind: 'circle', at: pouch, r: 3.5, fill: '#5a2a1a' },
      ];
    }
    case 'cue': {
      // The cue lies behind the ball, pointing at it, and draws back further for more power. A small felt tee holds the ball. (Aimed
      // steeply its far end dips under the floor line: the gun stands only 28 units above it.)
      const tip = BALL_RADIUS + 3 + power * 0.18;
      return [
        { kind: 'poly', points: [[L[0] - 12, G], [L[0] + 12, G], [L[0] + 3, L[1] + 6], [L[0] - 3, L[1] + 6]], fill: '#2e7d4f', stroke: '#1d4f32', width: 1.5 },
        { kind: 'poly', points: tube(-(tip + 56), -(tip + 34), 7, 6), fill: '#5b3a1e', stroke: '#2e1d0e', width: 1 },
        { kind: 'poly', points: tube(-(tip + 34), -(tip + 3), 6, 4), fill: '#e8c88a', stroke: '#a8874f', width: 1 },
        { kind: 'poly', points: tube(-(tip + 3), -tip, 4, 4), fill: '#3b6bb5' },
      ];
    }
    default:
      return [
        { kind: 'poly', points: stand, fill: c.muted },
        { kind: 'line', from: L, to: at(26), color: c.ink, width: 6 },
      ];
  }
}

const pair = ([from, to]: [Pt, Pt]) => ({ from, to });
