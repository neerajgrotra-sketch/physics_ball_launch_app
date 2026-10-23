import { buildWorld, simulate, inputGrid, ANGLE_STEP, POWER_STEP, type Level } from '../physics';

/**
 * Exhaustive proof over the real input space: every angle (0–90) and power (0–100) the UI can
 * produce, in 0.1 steps, with no pieces placed. Returns the first direct shot that lands, or null.
 */
export function findDirectShot(level: Level): { angle: number; power: number } | null {
  const world = buildWorld(level, []);
  const angles = inputGrid(0, 90, ANGLE_STEP), powers = inputGrid(0, 100, POWER_STEP);
  for (const angle of angles) for (const power of powers)
    if (simulate(world, angle, power, Infinity).success) return { angle, power };
  return null;
}
