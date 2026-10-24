// The intro's timeline and the one shot it plays (components/splash/Intro.tsx). Positions are in a unit
// square (the stage), scaled to the screen; times are in ms from the start. The shot echoes the app icon:
// launch, bank off the underside of a bar, drop into the glass. Pure functions, callable from worklets.

/** The animation's length. It then waits on the finished picture for "Let's go". */
export const INTRO_MS = 2700;

export const LAUNCH = { x: 0.12, y: 0.86 };
/** The launcher's barrel points the way the ball leaves (degrees, clockwise from +x). */
export const BARREL_DEG = -80;
/** The bar, centre and length in stage units, tilted `deg` (clockwise). `hitX/Y` is where the ball strikes. */
export const BAR = { cx: 0.51, cy: 0.27, len: 0.33, deg: 25, hitX: 0.5, hitY: 0.265 };
export const GLASS = { l: 0.64, r: 0.88, top: 0.6, base: 0.86 };

type P = [number, number];
const A: [P, P, P] = [[LAUNCH.x, LAUNCH.y], [0.22, 0.3], [0.48, 0.31]]; // up to the bar's underside
const B: [P, P, P] = [[0.48, 0.31], [0.7, 0.46], [0.76, 0.8]];           // banked down into the glass

export const BALL = {
  r: 0.045,
  rest: [0.76, 0.8] as P,
  launch: 750,  // leaves the launcher
  hitBar: 1150, // strikes the bar
  land: 1550,   // reaches the bottom of the glass
  settled: 1850,
};

export const TITLE = { start: 1500, stagger: 45, end: 2300 };
export const GO_BUTTON = { start: 2250, end: 2650 };

export function clamp01(v: number) {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function quad([p0, p1, p2]: [P, P, P], u: number): P {
  'worklet';
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
}

/** Overshoot-and-settle easing (like CSS "back out"). */
export function backOut(k: number, s: number) {
  'worklet';
  const u = k - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

export function quadOut(k: number) {
  'worklet';
  return 1 - (1 - k) * (1 - k);
}

/** Ball centre at time t: rising and slowing to the bar, then speeding down into the glass, then a small hop. */
export function ballAt(t: number): P {
  'worklet';
  if (t < BALL.launch) return [LAUNCH.x, LAUNCH.y];
  if (t < BALL.hitBar) return quad(A, quadOut((t - BALL.launch) / (BALL.hitBar - BALL.launch)));
  if (t < BALL.land) {
    const k = (t - BALL.hitBar) / (BALL.land - BALL.hitBar);
    return quad(B, 0.35 * k + 0.65 * k * k);
  }
  // Two shrinking hops on the glass floor.
  const k = clamp01((t - BALL.land) / (BALL.settled - BALL.land));
  const hop = k < 0.6 ? Math.sin((k / 0.6) * Math.PI) * 0.05 : Math.sin(((k - 0.6) / 0.4) * Math.PI) * 0.015;
  return [BALL.rest[0], BALL.rest[1] - hop];
}

/** Dots of the trail: where the ball was every 40 ms in flight, and when it got there. */
export const TRAIL: { x: number; y: number; ms: number }[] = [];
for (let ms = BALL.launch + 40; ms < BALL.land; ms += 40) {
  const [x, y] = ballAt(ms);
  TRAIL.push({ x, y, ms });
}
