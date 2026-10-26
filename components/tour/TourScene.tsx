import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LAUNCHER, WORLD, buildWorld, simulate, type Hit, type Level, type PlacedPiece, type SimResult } from '../../physics';
import { LEVELS } from '../../levels';
import { TOUR_VIEW, type TourPicture } from '../../game/tour';
import type { End } from '../../game/pieces';
import { FONTS, useColors } from '../../theme/colors';
import { Board, type Trail } from '../board/Board';
import { usePlayback } from '../board/usePlayback';
import { useFeedback } from '../feedback/useFeedback';
import { SCENES } from './scenes';

/** A pill drawn over the board (a tray chip, Launch, Solve…), centred at (x, y) in world units. */
export interface SceneButton { id: string; label: string; x: number; y: number; w: number; kind: 'chip' | 'primary'; on?: boolean }

/** Everything a scene shows. Scripts change it through the Ctx below; the board and overlays draw it. */
export interface SceneState {
  pieces: PlacedPiece[];
  numbers: number[];
  selected: number | null;
  lever: End;
  ghosts: PlacedPiece[];
  trails: Trail[];
  angle: number;
  power: number;
  /** The ball rests where the last trail ended (a win). */
  done: boolean;
  /** The ghost finger, its fingertip at (x, y) in world units. */
  finger: { x: number; y: number; down: boolean; shown: boolean };
  buttons: SceneButton[];
  /** Top-left readout, like the board's own (angle and power). */
  readout: string;
  /** A short line at the top centre ("Bar 1 missed", "2 bounces · par 2"). */
  note: { text: string; color: 'ink' | 'red' | 'pencil' } | null;
  /** The stars popping in: each 0 (hidden) to 1 (shown). */
  stars: number[];
}

/** What a scene's script can do. Every wait rejects once the scene has gone, which ends the script. */
export interface Ctx {
  level: Level;
  get(): SceneState;
  set(patch: Partial<SceneState> | ((s: SceneState) => Partial<SceneState>)): void;
  wait(ms: number): Promise<void>;
  /** Calls f with an eased 0 → 1 over ms. */
  tween(ms: number, f: (k: number) => void): Promise<void>;
  /** Glides the finger (not pressing) to (x, y). */
  move(x: number, y: number, ms?: number): Promise<void>;
  /** Presses and lifts the finger where it is. */
  tap(): Promise<void>;
  /** Fires the shot set up on the board, plays it back with its sounds, and resolves when the ball stops. */
  shoot(onHit?: (h: Hit) => void): Promise<SimResult>;
  feedback: ReturnType<typeof useFeedback>;
}

const CANCELLED = Symbol('scene gone');
const smooth = (k: number) => k * k * (3 - 2 * k);
export const levelById = (id: string): Level => LEVELS.find((l) => l.id === id)!;

export function freshState(level: Level): SceneState {
  const s = level.solution!;
  return {
    pieces: [], numbers: [], selected: null, lever: 2, ghosts: [], trails: [], angle: s.angle, power: s.power, done: false,
    finger: { x: LAUNCHER.x + 120, y: LAUNCHER.y - 60, down: false, shown: false },
    buttons: [], readout: '', note: null, stars: [0, 0, 0],
  };
}

/**
 * One tour page's picture as a live scene: the real board (cropped to TOUR_VIEW) playing the page's script from scenes.ts over and
 * over, with real shots from simulate() and their sounds, and a ghost finger acting out the controls. It never takes touches, so the
 * tour's swipe still works over it.
 */
export function TourScene({ kind, width }: { kind: Exclude<TourPicture, 'pieces'>; width: number }) {
  const c = useColors();
  const scene = SCENES[kind];
  const level = useMemo(() => levelById(scene.level), [scene.level]);
  const [state, setState] = useState<SceneState>(() => scene.setup(freshState(level), level));
  const live = useRef(state);
  const feedback = useFeedback();
  const { flight, play } = usePlayback();
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    let alive = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const set: Ctx['set'] = (patch) => {
      if (!alive) return;
      live.current = { ...live.current, ...(typeof patch === 'function' ? patch(live.current) : patch) };
      setState(live.current);
    };
    const wait = (ms: number) => new Promise<void>((resolve, reject) => {
      if (!alive) { reject(CANCELLED); return; }
      const id = setTimeout(() => { timers.delete(id); if (alive) resolve(); else reject(CANCELLED); }, ms);
      timers.add(id);
    });
    const tween = (ms: number, f: (k: number) => void) => new Promise<void>((resolve, reject) => {
      const t0 = Date.now();
      const step = () => {
        if (!alive) { reject(CANCELLED); return; }
        const k = Math.min(1, (Date.now() - t0) / ms);
        f(smooth(k));
        if (k < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
    const ctx: Ctx = {
      level, set, wait, tween, feedback,
      get: () => live.current,
      async move(x, y, ms = 450) {
        const f = live.current.finger;
        if (!f.shown) { set({ finger: { x, y, down: false, shown: true } }); await wait(250); return; }
        await tween(ms, (k) => set({ finger: { ...f, x: f.x + (x - f.x) * k, y: f.y + (y - f.y) * k, down: false } }));
      },
      async tap() {
        set((s) => ({ finger: { ...s.finger, down: true } }));
        await wait(160);
        set((s) => ({ finger: { ...s.finger, down: false } }));
        await wait(120);
      },
      shoot(onHit) {
        const s = live.current;
        const res = simulate(buildWorld(level, s.pieces), s.angle, s.power);
        set({ done: false });
        feedback.launched();
        return new Promise((resolve, reject) => {
          playRef.current(res.path, () => {
            if (!alive) { reject(CANCELLED); return; }
            set((t) => ({ trails: [...t.trails, { path: res.path, ok: res.success, end: res.end, jumps: res.jumps }].slice(-4), done: res.success }));
            if (res.success) feedback.landed();
            resolve(res);
          }, res.hits.map((h) => h.i), (k) => {
            if (!alive) return;
            feedback.hit(res.hits[k]);
            onHit?.(res.hits[k]);
          }, res.jumps);
        });
      },
    };
    (async () => {
      try {
        for (;;) {
          set(scene.setup(freshState(level), level));
          await wait(500);
          await scene.run(ctx);
          await wait(1800);
        }
      } catch (e) {
        if (e !== CANCELLED) throw e;
      }
    })();
    return () => { alive = false; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // The board is drawn at full size and shifted up inside a frame that shows only the view's rows.
  const sc = width / WORLD.width;
  const px = (x: number) => x * sc;
  const py = (y: number) => (y - TOUR_VIEW.top) * sc;
  const { finger, note } = state;
  const noteColor = note ? c[note.color] : c.ink;

  return (
    <View style={{ width, height: TOUR_VIEW.height * sc, overflow: 'hidden' }} pointerEvents="none">
      <View style={{ position: 'absolute', left: 0, top: -TOUR_VIEW.top * sc, width, height: WORLD.height * sc }}>
        <Board
          level={level} pieces={state.pieces} numbers={state.numbers} selected={state.selected} lever={state.lever} ghosts={state.ghosts}
          trails={state.trails} angle={state.angle} power={state.power} tries={0} flight={flight} done={state.done && !flight}
        />
      </View>

      {state.readout !== '' && (
        <Text style={[styles.readout, { color: c.muted, left: px(12), top: py(TOUR_VIEW.top + 8), fontSize: Math.max(11, 15 * sc) }]}>
          {state.readout}
        </Text>
      )}
      {note && (
        <Text style={[styles.note, { color: noteColor, top: py(TOUR_VIEW.top + 44), fontSize: Math.max(13, 19 * sc) }]}>{note.text}</Text>
      )}
      {state.stars.some((k) => k > 0) && (
        <View style={[styles.stars, { top: py(TOUR_VIEW.top + 66) }]}>
          {state.stars.map((k, i) => (
            <Text key={i} style={[styles.star, { color: c.red, fontSize: 40 * sc, opacity: Math.min(1, k * 2), transform: [{ scale: 0.4 + 0.6 * k + 0.25 * Math.sin(k * Math.PI) }] }]}>★</Text>
          ))}
        </View>
      )}

      {state.buttons.map((b) => {
        const h = 30;
        const filled = b.kind === 'primary' || b.on;
        return (
          <View
            key={b.id}
            style={[styles.button, {
              left: px(b.x - b.w / 2), top: py(b.y - h / 2), width: px(b.w), height: px(h), borderRadius: px(h / 2),
              backgroundColor: filled ? (b.kind === 'primary' ? c.red : c.pencil) : c.paper, borderColor: b.kind === 'primary' ? c.red : c.pencil,
            }]}
          >
            <Text style={[styles.buttonText, { color: filled ? '#fff' : c.pencil, fontSize: Math.max(11, 15 * sc) }]}>{b.label}</Text>
          </View>
        );
      })}

      {finger.shown && (
        <>
          {finger.down && <View style={[styles.ripple, { left: px(finger.x) - 17, top: py(finger.y) - 17, borderColor: c.pencil }]} />}
          <View style={[styles.finger, { left: px(finger.x) - 13, top: py(finger.y) - 2, transform: [{ scale: finger.down ? 0.9 : 1 }, { translateY: finger.down ? 0 : 6 }] }]}>
            <Text style={styles.hand}>👆</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { position: 'absolute', fontFamily: FONTS.condensed },
  note: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: FONTS.condensedBold },
  stars: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  star: { fontFamily: FONTS.condensedBold },
  button: { position: 'absolute', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: FONTS.condensedBold },
  ripple: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 3, opacity: 0.6 },
  finger: { position: 'absolute' },
  hand: { fontSize: 34, lineHeight: 40, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } },
});
