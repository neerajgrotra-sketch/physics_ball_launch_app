import { Canvas, Circle, Group, Path, Rect, Text, useCanvasRef, useFont } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  BALL_RADIUS, LAUNCHER, WORLD, glassBox, pieceEnds, speedFor,
  type EndReason, type Level, type PlacedPiece, type Vec,
} from '../../physics';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useColors, type Palette } from '../../theme/colors';
import {
  crossPath, deadPaths, gridPaths, handleArcPath, launcherPath, linePath, polyPath,
} from './paths';
import type { Flight } from './usePlayback';

const { width: W, height: H, ground: GROUND } = WORLD;
const R = BALL_RADIUS;
const L = LAUNCHER;

/** A finished launch, kept on screen as a fading ghost trail. */
export interface Trail { path: Vec[]; ok: boolean; end?: EndReason }

export interface BoardProps {
  level: Level;
  /** Pieces currently on the board. */
  pieces: PlacedPiece[];
  /** Index into `pieces` of the selected piece, if any. */
  selected?: number | null;
  /** Each on-board piece's bar number (as on its tray chip), drawn beside it. */
  numbers?: number[];
  /** Per on-board piece, whether it's somewhere it isn't allowed (game/placement): drawn red. */
  illegal?: boolean[];
  /** Last few launches, oldest first. */
  trails: Trail[];
  angle: number;
  power: number;
  tries: number;
  /** The launch being played back (see usePlayback). */
  flight?: Flight | null;
  /** The level is won: the ball rests where the last trail ended. */
  done?: boolean;
  /** Touches on the board, in world units. One drag is a 'down', any number of 'move's, then an 'up'. */
  onTouch?: (phase: TouchPhase, p: { x: number; y: number }) => void;
}

export type TouchPhase = 'down' | 'move' | 'up';

const condensed600 = require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf');
const condensed500 = require('@expo-google-fonts/barlow-condensed/500Medium/BarlowCondensed_500Medium.ttf');

/**
 * The game board, drawn in Skia in world units (WORLD, 400 × 560) and scaled uniformly to fit its container.
 * Pure rendering: everything it shows comes from props. Matches draw() in reference/prototype.html.
 */
export function Board(props: BoardProps) {
  const { level, pieces, numbers = [], illegal = [], selected = null, trails, angle, power, tries, flight = null, done = false, onTouch } = props;
  const c = useColors();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const hudFont = useFont(condensed600, 15);
  const subFont = useFont(condensed500, 13);
  const labelFont = useFont(condensed600, 13);

  const grid = useMemo(() => gridPaths(), []);
  const dead = useMemo(() => deadPaths(level.fixed), [level]);
  const trailPaths = useMemo(() => trails.map((t) => polyPath(t.path)), [trails]);
  const launcher = useMemo(() => launcherPath(L.x, L.y), []);
  const flightPath = useMemo(() => (flight ? polyPath(flight.path) : null), [flight?.path]);

  const scale = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0;

  // On web, Safari can draw Skia's first frame before its WebGL surface is ready, and Skia only draws
  // again on its next update, so the board stayed blank until the first touch. Ask for a few more frames
  // just after the board appears.
  const canvasRef = useCanvasRef();
  const shown = scale > 0;

  // Safari can also drop the frame right after a change (a skipped shot kept showing the ball mid-air;
  // a snapped-back bar stayed where it was dropped). Skia's redraw() didn't help, but a second React
  // update did, so whenever what the board shows changes, re-render once more on the next frame.
  const drawKey = [
    trails.length, trails.at(-1)?.path.length ?? 0, flight ? 1 : 0, done ? 1 : 0, selected ?? -1,
    pieces.map((p) => `${p.x},${p.y},${p.deg}`).join(';'), illegal.join(','), angle, power, tries,
  ].join('|');
  const [, setFollowUp] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = requestAnimationFrame(() => {
      setFollowUp((n) => n + 1);
      canvasRef.current?.redraw();
    });
    const later = setTimeout(() => canvasRef.current?.redraw(), 100);
    return () => { cancelAnimationFrame(id); clearTimeout(later); };
  }, [drawKey, canvasRef]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !shown) return;
    const timers = [50, 250, 750].map((ms) => setTimeout(() => canvasRef.current?.redraw(), ms));
    return () => timers.forEach(clearTimeout);
  }, [shown, canvasRef]);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  // Touches are tracked from the moment a finger lands (minDistance 0), like the prototype's pointer events.
  // The handler and scale go through a ref so a gesture always sees the latest render's state.
  const lastTouch = useRef({ x: 0, y: 0 });
  const touch = useRef({ onTouch, scale });
  touch.current = { onTouch, scale };
  const send = (phase: TouchPhase, x?: number, y?: number) => {
    const { onTouch: handler, scale: s } = touch.current;
    if (x != null && y != null) lastTouch.current = { x: x / s, y: y / s };
    handler?.(phase, lastTouch.current);
  };
  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    onBegin: (e) => send('down', e.x, e.y),
    onUpdate: (e) => send('move', e.x, e.y),
    onFinalize: () => send('up'),
  });

  const g = glassBox(level.glass);
  const last = trails[trails.length - 1];
  // Only a dead (grey) hit gets the ×.
  const deadEnd = last && last.end === 'dead' && !flight ? last.path[last.path.length - 1] : null;

  const ang = (angle * Math.PI) / 180;
  const sp = speedFor(power);
  const vx = Math.cos(ang) * sp, vy = -Math.sin(ang) * sp;
  // Aim preview: the first 0.3 s of free flight only. Never preview bounces.
  const aimDots: { x: number; y: number; a: number }[] = [];
  if (!flight && !done) {
    for (let t = 0.03; t <= 0.3; t += 0.03) {
      aimDots.push({ x: L.x + vx * t, y: L.y + vy * t + 450 * t * t, a: 1 - t * 2.6 });
    }
  }

  // At rest the ball sits on the launcher, or where it settled after a win. In flight it moves on the UI thread.
  let ball: Vec = [L.x, L.y];
  if (done && last) ball = last.path[last.path.length - 1];

  const sel = selected != null ? pieces[selected] : null;
  const selColor = selected != null && illegal[selected] ? c.red : c.pencil;
  const selEnds = sel ? pieceEnds(sel) : null;
  // Each bar gets its number beside it (above it), and the selected one its rotation too: "2 · 137°".
  const labels = labelFont ? pieces.map((p, i) => {
    const text = i === selected ? `${numbers[i] ?? i + 1} · ${((-p.deg % 180) + 180) % 180}°` : String(numbers[i] ?? i + 1);
    const a = (p.deg * Math.PI) / 180;
    let nx = Math.sin(a), ny = -Math.cos(a); // a normal to the bar
    if (ny > 0) { nx = -nx; ny = -ny; }        // the one pointing up
    const gap = i === selected ? 20 : 14;
    const w = labelFont.measureText(text).width;
    return { text, x: p.x + nx * gap - w / 2, y: p.y + ny * gap + 4 };
  }) : [];

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {scale > 0 && (
        <GestureDetector gesture={pan}>
          <View style={[styles.board, { width: W * scale, height: H * scale, outlineColor: c.line }]}>
            <Canvas ref={canvasRef} style={{ width: W * scale, height: H * scale }}>
              <Group transform={[{ scale }]}>
                {/* paper and grid */}
                <Rect x={0} y={0} width={W} height={H} color={c.paper} />
                <Path path={grid.fine} color={c.grid} style="stroke" strokeWidth={0.6} />
                <Path path={grid.major} color={c.grid} style="stroke" strokeWidth={1.1} />

                {/* ghost trails, oldest faintest */}
                {trails.map((t, i) => (
                  <Path
                    key={i}
                    path={trailPaths[i]}
                    color={t.ok ? c.red : c.pencil}
                    style="stroke"
                    strokeWidth={1.4}
                    strokeCap="round"
                    strokeJoin="round"
                    opacity={0.16 + 0.14 * (i + 4 - trails.length)}
                  />
                ))}

                {/* floor and board edges bounce: solid ink. Fixed obstacles are dead: grey and hatched. */}
                <Rect x={1.5} y={1.5} width={W - 3} height={GROUND - 1.5} color={c.ink} style="stroke" strokeWidth={3} />
                <Path path={linePath(0, GROUND, W, GROUND)} color={c.ink} style="stroke" strokeWidth={4} strokeCap="round" />
                <Path path={dead.bars} color={c.muted} style="stroke" strokeWidth={6} strokeCap="round" />
                <Path path={dead.hatch} color={c.paper} style="stroke" strokeWidth={1.4} strokeCap="round" />

                {/* where the last shot died */}
                {deadEnd && (
                  <Path path={crossPath(deadEnd[0], deadEnd[1])} color={c.red} style="stroke" strokeWidth={2} strokeCap="round" />
                )}

                {/* glass */}
                <Rect x={g.l} y={g.rim} width={g.r - g.l} height={g.base - g.rim} color={c.red} opacity={0.1} />
                <Path path={linePath(g.l, g.rim, g.l, g.base)} color={c.red} style="stroke" strokeWidth={3} strokeCap="round" />
                <Path path={linePath(g.r, g.rim, g.r, g.base)} color={c.red} style="stroke" strokeWidth={3} strokeCap="round" />
                <Path path={linePath(g.l - 8, g.base, g.r + 8, g.base)} color={c.red} style="stroke" strokeWidth={3} strokeCap="round" />

                {/* player's pieces */}
                {pieces.map((p, i) => {
                  const [x1, y1, x2, y2] = pieceEnds(p);
                  return (
                    <Path key={i} path={linePath(x1, y1, x2, y2)} color={illegal[i] ? c.red : c.pencil} style="stroke" strokeWidth={6} strokeCap="round" />
                  );
                })}
                {sel && selEnds && (
                  <Group>
                    <Path
                      path={linePath(selEnds[0], selEnds[1], selEnds[2], selEnds[3])}
                      color={selColor} style="stroke" strokeWidth={22} strokeCap="round" opacity={0.25}
                    />
                    <Circle cx={selEnds[2]} cy={selEnds[3]} r={11} color={c.paper} />
                    <Circle cx={selEnds[2]} cy={selEnds[3]} r={11} color={selColor} style="stroke" strokeWidth={2.5} />
                    <Path path={handleArcPath(selEnds[2], selEnds[3])} color={selColor} style="stroke" strokeWidth={2.5} strokeCap="round" />
                  </Group>
                )}
                {labelFont && labels.map((l, i) => (
                  <Text key={`n${i}`} x={l.x} y={l.y} text={l.text} font={labelFont} color={illegal[i] ? c.red : c.pencil} />
                ))}

                {/* launcher */}
                <Path path={launcher} color={c.muted} />
                <Path
                  path={linePath(L.x, L.y, L.x + Math.cos(ang) * 26, L.y - Math.sin(ang) * 26)}
                  color={c.ink} style="stroke" strokeWidth={6} strokeCap="round"
                />
                {aimDots.map((d, i) => (
                  <Circle key={i} cx={d.x} cy={d.y} r={2} color={c.ink} opacity={d.a} />
                ))}

                {/* current flight */}
                {flight && flightPath && (
                  <Path
                    path={flightPath}
                    end={flight.end}
                    color={c.pencil} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" opacity={0.95}
                  />
                )}

                {/* ball */}
                {flight ? <FlyingBall x={flight.x} y={flight.y} c={c} /> : <Ball x={ball[0]} y={ball[1]} c={c} />}

                {/* HUD */}
                {hudFont && (
                  <Text x={12} y={24} text={`Try ${String(tries).padStart(2, '0')}`} font={hudFont} color={c.ink} />
                )}
                {subFont && (
                  <Text x={12} y={42} text={`${angle.toFixed(1)}°   power ${power.toFixed(1)}`} font={subFont} color={c.muted} />
                )}
              </Group>
            </Canvas>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

function Ball({ x, y, c }: { x: number; y: number; c: Palette }) {
  return (
    <Group>
      <Circle cx={x} cy={y} r={R} color={c.steel} />
      <Circle cx={x} cy={y} r={R} color={c.ink} style="stroke" strokeWidth={1.2} />
      <Circle cx={x - 2.6} cy={y - 2.6} r={2.4} color="rgba(255,255,255,0.75)" />
    </Group>
  );
}

/** The ball during playback: its position comes from shared values, so moving it never re-renders React. */
function FlyingBall({ x, y, c }: { x: SharedValue<number>; y: SharedValue<number>; c: Palette }) {
  const hx = useDerivedValue(() => x.value - 2.6);
  const hy = useDerivedValue(() => y.value - 2.6);
  return (
    <Group>
      <Circle cx={x} cy={y} r={R} color={c.steel} />
      <Circle cx={x} cy={y} r={R} color={c.ink} style="stroke" strokeWidth={1.2} />
      <Circle cx={hx} cy={hy} r={2.4} color="rgba(255,255,255,0.75)" />
    </Group>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The prototype's canvas: rounded corners and a 1.5px ring in the line colour.
  board: { borderRadius: 6, overflow: 'hidden', outlineWidth: 1.5, outlineStyle: 'solid' },
});
