import { useCallback, useRef, useState } from 'react';
import { useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LAUNCHER, type Vec } from '../../physics';

/** Path points played back per second. simulate() records every 2nd step at 240 Hz, so this is real time. */
export const POINTS_PER_SECOND = 120;

/** A launch being played back. Ball position and how much of the path to draw live on the UI thread. */
export interface Flight {
  path: Vec[];
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** Fraction of the path's length drawn so far, for Skia's path trim. */
  end: SharedValue<number>;
  /** Path indices where the ball came out of a portal: no line is drawn into them. */
  jumps: number[];
}

/**
 * Plays a precomputed path back with a frame callback. Physics never steps per frame: the caller runs
 * simulate() once, hands the whole path to play(), and gets onDone when the ball reaches the last point.
 * Optional events (path indices, e.g. bounces) call onEvent(k) as the ball passes the k-th one.
 * skip() jumps to the end: the shot finishes exactly as if it had played out (onDone runs, so the whole
 * path becomes a trail and the outcome counts); only the remaining events are dropped.
 */
export function usePlayback() {
  const x = useSharedValue<number>(LAUNCHER.x);
  const y = useSharedValue<number>(LAUNCHER.y);
  const end = useSharedValue(0);
  const pts = useSharedValue<number[]>([]); // flat [x0, y0, x1, y1, ...]
  const cum = useSharedValue<number[]>([]); // cumulative length to each point, as a fraction of the total
  const start = useSharedValue(-1);
  const running = useSharedValue(false);
  const events = useSharedValue<number[]>([]); // path index of each event, ascending
  const nextEvent = useSharedValue(0);
  const [path, setPath] = useState<Vec[] | null>(null);
  const [jumpAt, setJumpAt] = useState<number[]>([]);
  const onDone = useRef<(() => void) | null>(null);
  const onEvent = useRef<((k: number) => void) | null>(null);

  // All callbacks are stable: useFrameCallback re-registers whenever its callback changes identity.
  const fireEvent = useCallback((k: number) => onEvent.current?.(k), []);

  // Runs once per shot, whether playback reached the end or was skipped (whichever comes first).
  const finish = useCallback(() => {
    frame.setActive(false);
    const done = onDone.current;
    if (!done) return;
    onDone.current = null;
    onEvent.current = null;
    setPath(null);
    done?.();
  }, []);

  const step = useCallback((f: FrameInfo) => {
    'worklet';
    if (!running.value) return;
    if (start.value < 0) start.value = f.timestamp;
    const n = pts.value.length / 2;
    const i = Math.max(0, Math.floor(((f.timestamp - start.value) / 1000) * POINTS_PER_SECOND));
    // Every event the ball has reached by now (including any at the very end), each exactly once.
    while (nextEvent.value < events.value.length && events.value[nextEvent.value] <= i) {
      scheduleOnRN(fireEvent, nextEvent.value);
      nextEvent.value += 1;
    }
    if (i >= n - 1) {
      running.value = false;
      x.value = pts.value[2 * (n - 1)];
      y.value = pts.value[2 * (n - 1) + 1];
      end.value = 1;
      scheduleOnRN(finish);
      return;
    }
    x.value = pts.value[2 * i];
    y.value = pts.value[2 * i + 1];
    end.value = cum.value[i];
  }, []);
  const frame = useFrameCallback(step, false);

  const play = (p: Vec[], done: () => void, eventAt: number[] = [], onEventAt?: (k: number) => void, jumps: number[] = []) => {
    const flat: number[] = [];
    const lengths: number[] = [0];
    for (let i = 0; i < p.length; i++) {
      flat.push(p[i][0], p[i][1]);
      // A trip through a portal is a jump, not distance travelled: it adds nothing to the drawn length.
      if (i > 0) lengths.push(lengths[i - 1] + (jumps.includes(i) ? 0 : Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])));
    }
    const total = lengths[lengths.length - 1];
    pts.value = flat;
    cum.value = lengths.map((l) => (total ? l / total : 0));
    x.value = p[0][0];
    y.value = p[0][1];
    end.value = 0;
    start.value = -1;
    events.value = eventAt;
    nextEvent.value = 0;
    running.value = true;
    onDone.current = done;
    onEvent.current = onEventAt ?? null;
    setJumpAt(jumps);
    setPath(p);
    frame.setActive(true);
  };

  /** Fast-forward the current shot to its end. No-op when nothing is playing. */
  const skip = () => {
    if (!onDone.current) return;
    onEvent.current = null; // bounce sounds still queued for the skipped stretch stay silent
    running.value = false;
    finish();
  };

  const flight: Flight | null = path ? { path, x, y, end, jumps: jumpAt } : null;
  return { flight, flying: path !== null, play, skip };
}
