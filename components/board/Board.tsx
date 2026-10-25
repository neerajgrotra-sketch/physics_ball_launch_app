import { Canvas, Circle, DashPathEffect, Group, Path, Rect, Text, useCanvasRef, useFont, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  BALL_RADIUS, LAUNCHER, WORLD, blockCorners, glassBox, pieceEnds, SPIKE_LENGTH,
  type EndReason, type Level, type PlacedPiece, type Vec,
} from '../../physics';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useColors, type Palette } from '../../theme/colors';
import {
  blockPath, padChevrons, crossPath, hazardPaths, deadPaths, gridPaths, handleArcPath, moveIconPath, launcherPath, linePath, polyPath,
} from './paths';
import type { Flight } from './usePlayback';
import { leverLine, moveArms, type End } from '../../game/pieces';
import { aimPreview } from '../../game/aim';

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
  /** Which end of the selected piece has the rotate lever (game/pieces leverLine). */
  lever?: End;
  /** Dashed outlines of where pieces should go (the tutorial's guide). */
  ghosts?: PlacedPiece[];
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
  /** How energised the ball is (0–1), after a spring pad has kicked it. */
  charge?: SharedValue<number>;
  /** The latest pad kick: `t` runs 0 → 1 for the burst ring and the pad's flash, at (x, y). */
  kick?: { t: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number> };
  /** The level is won: the ball rests where the last trail ended. */
  done?: boolean;
  /** Touches on the board, in world units. One drag is a 'down', any number of 'move's, then an 'up'. */
  onTouch?: (phase: TouchPhase, p: { x: number; y: number }) => void;
}

export type TouchPhase = 'down' | 'move' | 'up';

const condensed600 = require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf');
const condensed500 = require('@expo-google-fonts/barlow-condensed/500Medium/BarlowCondensed_500Medium.ttf');

const SPARKS = 10;

/** One spark of the explosion: flies out from (x, y) along its angle while `t` runs 0 → 1, shrinking and fading. */
function Spark({ t, x, y, k, color }: { t: SharedValue<number>; x: number; y: number; k: number; color: string }) {
  const a = (k / SPARKS) * Math.PI * 2 + (k % 2) * 0.2, reach = 26 + (k % 3) * 9;
  const cx = useDerivedValue(() => x + Math.cos(a) * reach * t.value);
  const cy = useDerivedValue(() => y + Math.sin(a) * reach * t.value);
  const r = useDerivedValue(() => (k % 2 ? 2.6 : 1.8) * (1 - t.value) + 0.2);
  const o = useDerivedValue(() => 1 - t.value);
  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={o} />;
}

/**
 * The game board, drawn in Skia in world units (WORLD, 400 × 560) and scaled uniformly to fit its container.
 * Pure rendering: everything it shows comes from props. Matches draw() in reference/prototype.html.
 */
export function Board(props: BoardProps) {
  const { level, pieces, numbers = [], illegal = [], selected = null, lever = 2, ghosts = [], trails, angle, power, tries, flight = null, charge, kick, done = false, onTouch } = props;
  const c = useColors();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const hudFont = useFont(condensed600, 15);
  const subFont = useFont(condensed500, 13);
  const labelFont = useFont(condensed600, 13);

  const grid = useMemo(() => gridPaths(), []);
  const dead = useMemo(() => deadPaths(level.fixed), [level]);
  const hazards = useMemo(() => (level.hazards ?? []).map((h) => hazardPaths(blockCorners(h), SPIKE_LENGTH)), [level]);
  const pads = useMemo(() => (level.pads ?? []).map((b) => ({ body: blockPath(blockCorners(b)), chevrons: padChevrons(b) })), [level]);
  const blocks = useMemo(() => (level.blocks ?? []).map((b) => blockPath(blockCorners(b))), [level]);
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
    ghosts.map((g) => `${g.x},${g.y},${g.deg}`).join(';'),
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

  // The ball bursts where it was destroyed: a ring and sparks, about half a second, once per dead shot.
  const burst = useSharedValue(1);
  const burstKey = deadEnd ? trails.length : 0;
  useEffect(() => {
    if (!burstKey) return;
    burst.value = 0;
    burst.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.quad) });
  }, [burstKey, burst]);
  const ringR = useDerivedValue(() => 6 + 30 * burst.value);
  const ringO = useDerivedValue(() => 0.9 * (1 - burst.value));
  const [bx, by] = deadEnd ?? [0, 0];

  const ang = (angle * Math.PI) / 180;
  // Aim preview: the first 0.3 s of free flight only. Never preview bounces.
  const aimDots = !flight && !done ? aimPreview(angle, power) : [];

  // At rest the ball sits on the launcher, or where it settled after a win. In flight it moves on the UI thread.
  let ball: Vec = [L.x, L.y];
  if (done && last) ball = last.path[last.path.length - 1];

  const sel = selected != null ? pieces[selected] : null;
  const selColor = selected != null && illegal[selected] ? c.red : c.pencil;
  const selEnds = sel ? pieceEnds(sel) : null;
  // The rotate lever: dots out from the active end to the rotate icon at its tip, and a small ring on the
  // other end to show it can take the lever instead.
  const leverAt = sel ? leverLine(sel, lever) : null;
  const leverDots = leverAt
    ? Array.from({ length: 5 }, (_, i) => {
        const t = (i + 1) / 6;
        return { x: leverAt[0] + (leverAt[2] - leverAt[0]) * t, y: leverAt[1] + (leverAt[3] - leverAt[1]) * t };
      })
    : [];
  // The move handles: dotted arms along x and y out of the centre, a two-way arrow grip on each tip.
  const arms = sel ? moveArms(sel, lever) : null;
  const armDots = sel && arms
    ? arms.flatMap(([tx, ty], j) => Array.from({ length: 5 }, (_, i) => {
        const t = (i + 1) / 6;
        return { key: `mv${j}${i}`, x: sel.x + (tx - sel.x) * t, y: sel.y + (ty - sel.y) * t };
      }))
    : [];
  const otherEnd = sel && selEnds ? (lever === 2 ? [selEnds[0], selEnds[1]] : [selEnds[2], selEnds[3]]) : null;
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
                {/* Hazards first, then blocks over them: a thin hazard laid along a block's edge shows spikes on the outside only. */}
                {hazards.map((h, i) => (
                  <Group key={`hz${i}`}>
                    <Path path={h.body} color={c.red} />
                    <Path path={h.spikes} color={c.red} />
                    <Path path={h.body} color={c.paper} style="stroke" strokeWidth={1.2} opacity={0.5} />
                  </Group>
                ))}
                {blocks.map((b, i) => (
                  <Group key={`blk${i}`}>
                    <Path path={b} color={c.steel} />
                    <Path path={b} color={c.ink} style="stroke" strokeWidth={2.5} strokeJoin="round" />
                  </Group>
                ))}
                {pads.map((p, i) => (
                  <Group key={`pad${i}`}>
                    <Path path={p.body} color="#ffb020" opacity={0.92} />
                    <Path path={p.chevrons} color={c.ink} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" opacity={0.75} />
                    <Path path={p.body} color={c.ink} style="stroke" strokeWidth={2.5} strokeJoin="round" />
                    {kick && <PadFlash path={p.body} t={kick.t} />}
                  </Group>
                ))}
                <Path path={dead.bars} color={c.muted} style="stroke" strokeWidth={6} strokeCap="round" />
                <Path path={dead.hatch} color={c.paper} style="stroke" strokeWidth={1.4} strokeCap="round" />

                {/* where the last shot died */}
                {deadEnd && (
                  <Path path={crossPath(deadEnd[0], deadEnd[1])} color={c.red} style="stroke" strokeWidth={2} strokeCap="round" />
                )}

                {kick && <KickRing t={kick.t} x={kick.x} y={kick.y} />}
                {deadEnd && (
                  <Group>
                    <Circle cx={bx} cy={by} r={ringR} color={c.red} style="stroke" strokeWidth={2.5} opacity={ringO} />
                    {Array.from({ length: SPARKS }, (_, k) => <Spark key={k} t={burst} x={bx} y={by} k={k} color={c.red} />)}
                  </Group>
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
                    <Group key={i}>
                      {(p.restitution ?? 0) > 1 && <Path path={linePath(x1, y1, x2, y2)} color={c.ink} style="stroke" strokeWidth={10} strokeCap="round" />}
                      <Path path={linePath(x1, y1, x2, y2)} color={illegal[i] ? c.red : (p.restitution ?? 0) > 1 ? '#ffb020' : c.pencil} style="stroke" strokeWidth={6} strokeCap="round" />
                    </Group>
                  );
                })}
                {ghosts.map((g, i) => {
                  const [x1, y1, x2, y2] = pieceEnds(g);
                  return (
                    <Group key={`gh${i}`}>
                      <Path path={linePath(x1, y1, x2, y2)} color={c.red} style="stroke" strokeWidth={16} strokeCap="round" opacity={0.14} />
                      <Path path={linePath(x1, y1, x2, y2)} color={c.red} style="stroke" strokeWidth={9} strokeCap="round" opacity={0.85}>
                        <DashPathEffect intervals={[10, 8]} />
                      </Path>
                    </Group>
                  );
                })}
                {sel && selEnds && (
                  <Group>
                    <Path
                      path={linePath(selEnds[0], selEnds[1], selEnds[2], selEnds[3])}
                      color={selColor} style="stroke" strokeWidth={22} strokeCap="round" opacity={0.25}
                    />
                    {leverDots.map((d, i) => <Circle key={`lv${i}`} cx={d.x} cy={d.y} r={2.6} color={selColor} />)}
                    {armDots.map((d) => <Circle key={d.key} cx={d.x} cy={d.y} r={2.2} color={selColor} opacity={0.75} />)}
                    {arms && arms.map(([tx, ty], j) => (
                      <Group key={`grip${j}`}>
                        <Circle cx={tx} cy={ty} r={11} color={c.paper} />
                        <Circle cx={tx} cy={ty} r={11} color={selColor} style="stroke" strokeWidth={2.5} />
                        <Path path={moveIconPath(tx, ty, j === 0)} color={selColor} style="stroke" strokeWidth={1.8} strokeCap="round" strokeJoin="round" />
                      </Group>
                    ))}
                    {otherEnd && <Circle cx={otherEnd[0]} cy={otherEnd[1]} r={6} color={selColor} style="stroke" strokeWidth={1.5} opacity={0.6} />}
                    {leverAt && (
                      <Group>
                        <Circle cx={leverAt[2]} cy={leverAt[3]} r={11} color={c.paper} />
                        <Circle cx={leverAt[2]} cy={leverAt[3]} r={11} color={selColor} style="stroke" strokeWidth={2.5} />
                        <Path path={handleArcPath(leverAt[2], leverAt[3])} color={selColor} style="stroke" strokeWidth={2.5} strokeCap="round" />
                      </Group>
                    )}
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
                {flight ? <FlyingBall x={flight.x} y={flight.y} c={c} charge={charge} /> : <Ball x={ball[0]} y={ball[1]} c={c} />}

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
/** A pad flashes white-hot when it kicks the ball. */
function PadFlash({ path, t }: { path: SkPath; t: SharedValue<number> }) {
  const o = useDerivedValue(() => 0.9 * (1 - t.value));
  return <Path path={path} color="#ffffff" opacity={o} />;
}

/** The burst where the ball was kicked: two expanding rings and eight sparks. */
function KickRing({ t, x, y }: { t: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number> }) {
  const r1 = useDerivedValue(() => 8 + 34 * t.value);
  const r2 = useDerivedValue(() => 6 + 20 * t.value);
  const o = useDerivedValue(() => (1 - t.value) * 0.9);
  const o2 = useDerivedValue(() => (1 - t.value) * 0.6);
  return (
    <Group>
      <Circle cx={x} cy={y} r={r1} color="#ffb020" style="stroke" strokeWidth={3} opacity={o} />
      <Circle cx={x} cy={y} r={r2} color="#ffffff" style="stroke" strokeWidth={2} opacity={o2} />
      {Array.from({ length: 8 }, (_, k) => <KickSpark key={k} t={t} x={x} y={y} k={k} />)}
    </Group>
  );
}

function KickSpark({ t, x, y, k }: { t: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number>; k: number }) {
  const a = (k / 8) * Math.PI * 2 + 0.3, reach = 30 + (k % 2) * 14;
  const cx = useDerivedValue(() => x.value + Math.cos(a) * reach * t.value);
  const cy = useDerivedValue(() => y.value + Math.sin(a) * reach * t.value);
  const r = useDerivedValue(() => 2.8 * (1 - t.value) + 0.3);
  const o = useDerivedValue(() => 1 - t.value);
  return <Circle cx={cx} cy={cy} r={r} color={k % 2 ? '#ffb020' : '#ffe9a8'} opacity={o} />;
}

function FlyingBall({ x, y, c, charge }: { x: SharedValue<number>; y: SharedValue<number>; c: Palette; charge?: SharedValue<number> }) {
  const hx = useDerivedValue(() => x.value - 2.6);
  const hy = useDerivedValue(() => y.value - 2.6);
  // Energised: a warm glow that breathes while the charge lasts, and a hot ring round the steel.
  const glowR = useDerivedValue(() => R + 5 + 7 * (charge?.value ?? 0) + 1.5 * Math.sin(Date.now() / 60));
  const glowO = useDerivedValue(() => 0.5 * (charge?.value ?? 0));
  const haloR = useDerivedValue(() => R + 14 + 8 * (charge?.value ?? 0));
  const haloO = useDerivedValue(() => 0.2 * (charge?.value ?? 0));
  const ringO = useDerivedValue(() => Math.min(1, (charge?.value ?? 0) * 1.4));
  return (
    <Group>
      <Circle cx={x} cy={y} r={haloR} color="#ffb020" opacity={haloO} />
      <Circle cx={x} cy={y} r={glowR} color="#ffcf4a" opacity={glowO} />
      <Circle cx={x} cy={y} r={R} color={c.steel} />
      <Circle cx={x} cy={y} r={R} color={c.ink} style="stroke" strokeWidth={1.2} />
      <Circle cx={x} cy={y} r={R + 1} color="#ff9a00" style="stroke" strokeWidth={2} opacity={ringO} />
      <Circle cx={hx} cy={hy} r={2.4} color="rgba(255,255,255,0.75)" />
    </Group>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The prototype's canvas: rounded corners and a 1.5px ring in the line colour.
  board: { borderRadius: 6, overflow: 'hidden', outlineWidth: 1.5, outlineStyle: 'solid' },
});
