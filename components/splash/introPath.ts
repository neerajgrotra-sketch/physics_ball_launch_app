// The intro's timeline and the one shot it plays (components/splash/Intro.tsx). Positions are in a unit
// square (the stage), scaled to the screen; times are in ms from the start. The shot echoes the app icon:
// launch, bank off the underside of a bar, drop into the glass. Pure functions, callable from worklets.

/** The animation's length. It then waits on the finished picture for "Let's go". */
export const INTRO_MS = 2700;

/** Everything stands on this floor line. */
export const FLOOR = 0.86;
/** The launcher: a dome on the floor at `x`, its barrel `len` long from a pivot `lift` above the floor, aimed `deg` (clockwise from +x). */
export const LAUNCHER = { x: 0.12, len: 0.11, lift: 0.025, deg: -77 };
const RAD = (LAUNCHER.deg * Math.PI) / 180;
/** The ball leaves from the barrel's muzzle. */
export const LAUNCH = { x: LAUNCHER.x + LAUNCHER.len * Math.cos(RAD), y: FLOOR - LAUNCHER.lift + LAUNCHER.len * Math.sin(RAD) };
/** The bar: flat, centre and length in stage units, `th` thick. `hitX/Y` is the point on its underside the ball strikes. */
export const BAR = { cx: 0.48, cy: 0.26, len: 0.3, th: 0.035, deg: 0, hitX: 0.44, hitY: 0.26 + 0.0175 };
export const GLASS = { l: 0.67, r: 0.91, top: 0.6, base: FLOOR };

type P = [number, number];
const R = 0.045;
// Where the ball's centre is at the moment it touches the bar's underside, then a true reflection:
// it arrives rising at about 27° and leaves falling at the same angle, curving down into the glass.
export const CONTACT: P = [BAR.hitX, BAR.cy + BAR.th / 2 + R];
const A: [P, P, P] = [[LAUNCH.x, LAUNCH.y], [CONTACT[0] - 0.222, CONTACT[1] + 0.115], CONTACT]; // up to the bar
const B: [P, P, P] = [CONTACT, [0.75, 0.48], [0.79, FLOOR - 0.06]];                             // down into the glass

export const BALL = {
  r: R,
  rest: [0.79, FLOOR - 0.06] as P,
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

/** Dots of the trail: where the ball was every 25 ms in flight, and when it got there. */
export const TRAIL: { x: number; y: number; ms: number }[] = [];
for (let ms = BALL.launch + 25; ms < BALL.land; ms += 25) {
  const [x, y] = ballAt(ms);
  TRAIL.push({ x, y, ms });
}
