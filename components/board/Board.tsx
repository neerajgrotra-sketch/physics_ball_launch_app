import { trailOpacity } from '../../game/trails';
import { BlurMask, Canvas, Skia, Circle, DashPathEffect, Group, Path, Rect, Text, useCanvasRef, useFont, type SkPath, type Transforms3d } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  BALL_RADIUS, LAUNCHER, PORTAL_RADIUS, WORLD, blockCorners, glassBox, pieceEnds, SPIKE_LENGTH,
  type EndReason, type Level, type PlacedPiece, type Vec,
} from '../../physics';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useColors, type Palette } from '../../theme/colors';
import { composeShareCard, type ShareCard } from './shareCard';
import { LIGHT, NEON } from '../../theme/palettes';
import {
  blockPath, padChevrons, crossPath, hazardPaths, deadPaths, gridPaths, handleArcPath, moveIconPath, linePath, polyPath, trashIconPath,
} from './paths';
import { POINTS_PER_SECOND, type Flight } from './usePlayback';
import { BallArt } from './BallArt';
import { GunArt } from './GunArt';
import { spinAlong, type BallSkin } from '../../game/skins';
import { useBallSkin } from '../settings/BallSkin';
import { useAsmr } from '../settings/Theme';
import { TouchSpot, setBoardTouching, useShowTouches, useSpot } from '../settings/ShowTouches';
import { leverLine, moveArms, trashObstacles, trashSpot, type End } from '../../game/pieces';
import { aimPreview } from '../../game/aim';
import { BLOCK_HIT } from '../../game/asmr';
import { blastPuffs, blastSparks, muzzle, recoilAt, type Puff as SmokeCloud, type Spark as BlastSpark } from '../../game/muzzle';
import { SHARD_GRAVITY, SHATTER_MS, SLOW, SHATTER_TIME, shatterPieces, type Ember, type Puff, type Shard } from '../../game/shatter';
import { FUSE_SHARE, confettiPieces, fuseGeometry } from '../../game/celebration';
import { BLOOM_PHASES, emberAt, embers, fireflies, fireflyAt, phase, rose, spirograph, type BloomTier, type Ember as RisingEmber, type Firefly } from '../../game/bloom';

const { width: W, height: H, ground: GROUND } = WORLD;
const R = BALL_RADIUS;
const L = LAUNCHER;

/** A finished launch, kept on screen as a fading ghost trail. */
export interface Trail { path: Vec[]; ok: boolean; end?: EndReason; /** path indices where the ball came out of a portal */ jumps?: number[] }

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
  /** The "Try 01" and angle/power lines in the corner (off for a demo board that explains itself). */
  hud?: boolean;
  /** Each bar's number beside it (off where other numbers are on the board, like a replay's bounce marks). */
  barLabels?: boolean;
  /** Numbered markers at the shot's scored bounces (game/marks.ts), shown as they happen. */
  marks?: { x: number; y: number; n: number }[];
  /** The launch being played back (see usePlayback). */
  flight?: Flight | null;
  /** How energised the ball is (0–1), after a spring pad has kicked it. */
  charge?: SharedValue<number>;
  /** While a bar is being dragged: a strip under the floor to drop it on, and whether the finger is on it ('armed'). */
  dropZone?: 'off' | 'hint' | 'armed';
  /** The win celebration (game/celebration): `t` runs 0 → 1; the winning path to light, and how many confetti pieces to throw. */
  celebrate?: { t: SharedValue<number>; path: Vec[]; jumps: number[]; confetti: number; rings: number; bloom?: BloomTier; points?: { x: number; y: number; f: number }[] } | null;
  /** The latest pad kick: `t` runs 0 → 1 for the burst ring and the pad's flash, at (x, y). */
  kick?: { t: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number> };
  /** ASMR mode: the latest bounce, for a soft ring of light where it happened (`t` runs 0 → 1). */
  flash?: { t: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number>; /** what was struck (game/asmr.ts hitTarget) */ what?: SharedValue<number> };
  /** The latest launch, for the gun's kick and the muzzle blast (game/muzzle.ts): `t` runs 0 → 1 over BLAST_MS, aimed at `angle`. */
  blast?: { t: SharedValue<number>; angle: number };
  /** ASMR mode: the bar or block the last bounce struck (game/asmr.ts hitTarget), the only one given a flare. */
  struck?: number;
  /** The latest trip through a portal: `t` runs 0 → 1 for the ring where the ball comes out. */
  warp?: { t: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number> };
  /** A bar was turned into something: a red ring pulses where it bumps (a new `n` plays it again). Unmount it once played. */
  jam?: { x: number; y: number; n: number } | null;
  /** The level is won: the ball rests where the last trail ended. */
  done?: boolean;
  /** Touches on the board, in world units. One drag is a 'down', any number of 'move's, then an 'up'. */
  onTouch?: (phase: TouchPhase, p: { x: number; y: number }) => void;
  /** Filled with a function that returns a PNG (base64) poster of the round (the level, its bars and every trail), for sharing a win. */
  snapshot?: MutableRefObject<((card: ShareCard) => string | null) | null>;
}

export type TouchPhase = 'down' | 'move' | 'up';

const condensed600 = require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf');
const condensed500 = require('@expo-google-fonts/barlow-condensed/500Medium/BarlowCondensed_500Medium.ttf');

/**
 * The game board, drawn in Skia in world units (WORLD, 400 × 560) and scaled uniformly to fit its container.
 * Pure rendering: everything it shows comes from props (and the player's ball skin, from Settings). Matches draw() in reference/prototype.html.
 */
export function Board(props: BoardProps) {
  const { level, pieces, numbers = [], illegal = [], selected = null, lever = 2, ghosts = [], trails, angle, power, tries, hud = true, barLabels = true, marks = [], flight = null, charge, dropZone = 'off', celebrate = null, kick, flash, blast, struck = -1, warp, jam = null, done = false, onTouch, snapshot } = props;
  // ASMR mode (game/asmr.ts): neon glow under the walls, glass, bars and ball, a comet tail on the flight, a ring at each bounce.
  const [asmr] = useAsmr();
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
  const trailPaths = useMemo(() => trails.map((t) => polyPath(t.path, t.path.length, t.jumps)), [trails]);
  const flightPath = useMemo(() => (flight ? polyPath(flight.path, flight.path.length, flight.jumps) : null), [flight?.path]);

  const scale = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0;

  // Shapes are kept and reused across redraws: the board redraws on every finger movement during a drag, and building ~15 new
  // Skia paths each time (floor, glass, every bar, the handles, the gun) piled up native memory the JS garbage collector doesn't
  // see, so on a phone dragging got slower the longer you played. Now only what actually moved is built again.
  const shapes = useRef(new Map<string, SkPath>());
  const shape = (key: string, make: () => SkPath) => {
    const kept = shapes.current;
    let path = kept.get(key);
    if (!path) {
      if (kept.size > 240) kept.clear(); // a drag leaves a trail of old positions: drop them now and then
      path = make();
      kept.set(key, path);
    }
    return path;
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => shape(`l${x1},${y1},${x2},${y2}`, () => linePath(x1, y1, x2, y2));

  // On web, Safari can draw Skia's first frame before its WebGL surface is ready, and Skia only draws
  // again on its next update, so the board stayed blank until the first touch. Ask for a few more frames
  // just after the board appears.
  const canvasRef = useCanvasRef();
  const shown = scale > 0;
  if (snapshot) {
    snapshot.current = (card) => {
      try {
        if (!hudFont || !subFont) return null;
        // Sketchpad mode shares the game's own graph-paper look, whatever board theme the player picked (it's the game's calling card);
        // ASMR mode shares its neon look, glowing, as it was played (player feedback: the poster didn't look like the ASMR game).
        return composeShareCard(level, pieces, trails, card, hudFont, subFont, asmr ? NEON.palette : LIGHT, gun, power, asmr);
      } catch { return null; }
    };
  }

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
  // "Show touches" (Settings): on phones the gesture handler takes the board's drags from the app-wide fingertip, so the board shows
  // the same fingertip itself, in its own view's coordinates (the web's page-wide one covers the board already).
  const showTouches = useShowTouches() && Platform.OS !== 'web';
  const spot = useSpot();
  const send = (phase: TouchPhase, x?: number, y?: number) => {
    if (showTouches) {
      if (phase === 'down' && x != null && y != null) { setBoardTouching(true); spot.down(x, y); }
      else if (phase === 'move' && x != null && y != null) spot.move(x, y);
      else if (phase === 'up') { spot.up(); setTimeout(() => setBoardTouching(false), 280); }
    }
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

  // The ball shatters where it was destroyed, in slow motion (game/shatter.ts), once per dead shot. Its last velocity (the path is
  // recorded at POINTS_PER_SECOND) sends the pieces on the way it was going.
  const burst = useSharedValue(1);
  // Keyed by the dead shot's own path, so each death plays once (even when the trail count stays at its limit), and not for a
  // dead trail the board opened with (a level re-opened on its saved board replayed the shatter every time).
  const deadPath = deadEnd ? last.path : null;
  const openedWith = useRef(deadPath);
  const burstKey = deadPath && deadPath !== openedWith.current ? deadPath : null;
  // Only in the drawing while it plays: its ~40 pieces stayed drawn, invisibly, on every frame until the next shot.
  const [shattering, setShattering] = useState(false);
  useEffect(() => {
    if (!burstKey) return;
    burst.value = 0;
    burst.value = withTiming(1, { duration: SHATTER_MS, easing: Easing.linear });
    setShattering(true);
    const t = setTimeout(() => setShattering(false), SHATTER_MS + 50);
    return () => clearTimeout(t);
  }, [burstKey, burst]);
  const deadVel = useMemo<[number, number]>(() => {
    const p = last?.path;
    if (!deadEnd || !p || p.length < 2) return [0, 0];
    const a = p[p.length - 2], b = p[p.length - 1];
    return [(b[0] - a[0]) * POINTS_PER_SECOND, (b[1] - a[1]) * POINTS_PER_SECOND];
  }, [deadEnd, last]);

  // Aim preview: the first 0.3 s of free flight only. Never preview bounces.
  const aimDots = !flight && !done ? aimPreview(angle, power) : [];

  // At rest the ball sits on the launcher, or where it settled after a win. In flight it moves on the UI thread.
  let ball: Vec = [L.x, L.y];
  if (done && last) ball = last.path[last.path.length - 1];
  // The player's ball skin; after a win the ball keeps the turn it rolled to, so a design doesn't snap back upright.
  const { skin, gun } = useBallSkin();
  const restTurn = useMemo(() => (done && last ? spinAlong(last.path, R).at(-1) ?? 0 : 0), [done, last]);

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
  const trash = sel ? trashSpot(sel, lever, trashObstacles(level, pieces.filter((_, k) => k !== selected))) : null;
  const armDots = sel && arms
    ? arms.flatMap(([tx, ty], j) => Array.from({ length: 5 }, (_, i) => {
        const t = (i + 1) / 6;
        return { key: `mv${j}${i}`, x: sel.x + (tx - sel.x) * t, y: sel.y + (ty - sel.y) * t };
      }))
    : [];
  const otherEnd = sel && selEnds ? (lever === 2 ? [selEnds[0], selEnds[1]] : [selEnds[2], selEnds[3]]) : null;
  // Each bar gets its number beside it (above it), and the selected one its rotation too: "2 · 137°".
  const labels = labelFont && barLabels ? pieces.map((p, i) => {
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
                {asmr && trails.length > 0 && (
                  // ASMR mode: the newest trail glows, so a winning path lights up.
                  <Path path={trailPaths[trails.length - 1]} color={trails[trails.length - 1].ok ? c.red : c.pencil} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" opacity={0.35}>
                    <BlurMask blur={5} style="normal" />
                  </Path>
                )}
                {trails.map((t, i) => (
                  <Path
                    key={i}
                    path={trailPaths[i]}
                    color={t.ok ? c.red : c.pencil}
                    style="stroke"
                    strokeWidth={1.4}
                    strokeCap="round"
                    strokeJoin="round"
                    opacity={trailOpacity(i, trails.length)}
                  />
                ))}

                {/* floor and board edges bounce: solid ink. Fixed obstacles are dead: grey and hatched. */}
                {asmr && (
                  <Group opacity={0.55}>
                    <Rect x={1.5} y={1.5} width={W - 3} height={GROUND - 1.5} color={c.pencil} style="stroke" strokeWidth={8}><BlurMask blur={7} style="normal" /></Rect>
                  </Group>
                )}
                <Rect x={1.5} y={1.5} width={W - 3} height={GROUND - 1.5} color={c.ink} style="stroke" strokeWidth={3} />
                <Path path={line(0, GROUND, W, GROUND)} color={c.ink} style="stroke" strokeWidth={4} strokeCap="round" />
                {/* Hazards first, then blocks over them: a thin hazard laid along a block's edge shows spikes on the outside only. */}
                {hazards.map((h, i) => (
                  <Group key={`hz${i}`}>
                    <Path path={h.body} color={c.red} />
                    <Path path={h.spikes} color={c.red} />
                    <Path path={h.body} color={c.paper} style="stroke" strokeWidth={1.2} opacity={0.5} />
                  </Group>
                ))}
                {blocks.map((b, i) => asmr ? (
                  // ASMR mode: blocks are violet neon glass, not white slabs; one the ball strikes flares up.
                  <Group key={`blk${i}`}>
                    <Path path={b} color={NEON_BLOCK} style="stroke" strokeWidth={14} strokeJoin="round" opacity={0.14} />
                    <Path path={b} color={NEON_BLOCK} style="stroke" strokeWidth={7} strokeJoin="round" opacity={0.3} />
                    <Path path={b} color={NEON_BLOCK} opacity={0.16} />
                    {flash?.what && struck === BLOCK_HIT + i && <HitFlare path={b} t={flash.t} what={flash.what} me={BLOCK_HIT + i} color={NEON_BLOCK} fill />}
                    <Path path={b} color={NEON_BLOCK} style="stroke" strokeWidth={2.2} strokeJoin="round" />
                  </Group>
                ) : (
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
                  <Path path={shape(`x${deadEnd[0]},${deadEnd[1]}`, () => crossPath(deadEnd[0], deadEnd[1]))} color={c.red} style="stroke" strokeWidth={2} strokeCap="round" />
                )}

                {(level.portals ?? []).map((pr, n) => (
                  <Group key={`portal${n}`}>
                    <PortalRing x={pr.a.x} y={pr.a.y} color="#2f9bff" />
                    <PortalRing x={pr.b.x} y={pr.b.y} color="#ff7a1a" exit={pr.oneWay} />
                  </Group>
                ))}
                {kick && <KickRing t={kick.t} x={kick.x} y={kick.y} />}
                {warp && <KickRing t={warp.t} x={warp.x} y={warp.y} />}
                {deadEnd && shattering && <Shatter key={trails.length} t={burst} x={deadEnd[0]} y={deadEnd[1]} vx={deadVel[0]} vy={deadVel[1]} c={c} asmr={asmr} />}

                {/* glass */}
                {asmr && (
                  <Group opacity={0.8}>
                    <Path path={line(g.l, g.rim, g.l, g.base)} color={c.red} style="stroke" strokeWidth={10} strokeCap="round"><BlurMask blur={8} style="normal" /></Path>
                    <Path path={line(g.r, g.rim, g.r, g.base)} color={c.red} style="stroke" strokeWidth={10} strokeCap="round"><BlurMask blur={8} style="normal" /></Path>
                    <Path path={line(g.l - 8, g.base, g.r + 8, g.base)} color={c.red} style="stroke" strokeWidth={10} strokeCap="round"><BlurMask blur={8} style="normal" /></Path>
                  </Group>
                )}
                <Rect x={g.l} y={g.rim} width={g.r - g.l} height={g.base - g.rim} color={c.red} opacity={0.1} />
                <Path path={line(g.l, g.rim, g.l, g.base)} color={c.red} style="stroke" strokeWidth={3} strokeCap="round" />
                <Path path={line(g.r, g.rim, g.r, g.base)} color={c.red} style="stroke" strokeWidth={3} strokeCap="round" />
                <Path path={line(g.l - 8, g.base, g.r + 8, g.base)} color={c.red} style="stroke" strokeWidth={3} strokeCap="round" />

                {dropZone !== 'off' && (
                  <Group>
                    <Rect x={0} y={GROUND + 1.5} width={W} height={H - GROUND - 1.5} color={c.red} opacity={dropZone === 'armed' ? 0.5 : 0.16} />
                    {subFont && <Text x={W / 2 - subFont.measureText('Drop here to remove').width / 2} y={GROUND + 15} text="Drop here to remove" font={subFont} color={dropZone === 'armed' ? c.paper : c.red} />}
                  </Group>
                )}

                {/* player's pieces */}
                {pieces.map((p, i) => {
                  const [x1, y1, x2, y2] = pieceEnds(p);
                  return (
                    <Group key={i}>
                      {asmr && (
                        <Path path={line(x1, y1, x2, y2)} color={illegal[i] ? c.red : (p.restitution ?? 0) > 1 ? '#ffb020' : c.pencil} style="stroke" strokeWidth={16} strokeCap="round" opacity={0.7}>
                          <BlurMask blur={9} style="normal" />
                        </Path>
                      )}
                      {(p.restitution ?? 0) > 1 && <Path path={line(x1, y1, x2, y2)} color={c.ink} style="stroke" strokeWidth={10} strokeCap="round" />}
                      <Path path={line(x1, y1, x2, y2)} color={illegal[i] ? c.red : (p.restitution ?? 0) > 1 ? '#ffb020' : c.pencil} style="stroke" strokeWidth={6} strokeCap="round" />
                      {asmr && flash?.what && struck === i && <HitFlare path={line(x1, y1, x2, y2)} t={flash.t} what={flash.what} me={i} color={(p.restitution ?? 0) > 1 ? '#ffb020' : c.pencil} />}
                    </Group>
                  );
                })}
                {ghosts.map((g, i) => {
                  const [x1, y1, x2, y2] = pieceEnds(g);
                  return (
                    <Group key={`gh${i}`}>
                      <Path path={line(x1, y1, x2, y2)} color={c.red} style="stroke" strokeWidth={16} strokeCap="round" opacity={0.14} />
                      <Path path={line(x1, y1, x2, y2)} color={c.red} style="stroke" strokeWidth={9} strokeCap="round" opacity={0.85}>
                        <DashPathEffect intervals={[10, 8]} />
                      </Path>
                    </Group>
                  );
                })}
                {sel && selEnds && (
                  <Group>
                    <Path
                      path={line(selEnds[0], selEnds[1], selEnds[2], selEnds[3])}
                      color={selColor} style="stroke" strokeWidth={22} strokeCap="round" opacity={0.25}
                    />
                    {leverDots.map((d, i) => <Circle key={`lv${i}`} cx={d.x} cy={d.y} r={2.6} color={selColor} />)}
                    {armDots.map((d) => <Circle key={d.key} cx={d.x} cy={d.y} r={2.2} color={selColor} opacity={0.75} />)}
                    {arms && arms.map(([tx, ty], j) => (
                      <Group key={`grip${j}`}>
                        <Circle cx={tx} cy={ty} r={11} color={c.paper} />
                        <Circle cx={tx} cy={ty} r={11} color={selColor} style="stroke" strokeWidth={2.5} />
                        <Path path={shape(`m${tx},${ty},${j}`, () => moveIconPath(tx, ty, j === 0))} color={selColor} style="stroke" strokeWidth={1.8} strokeCap="round" strokeJoin="round" />
                      </Group>
                    ))}
                    {trash && (
                      // The remove badge (game/pieces trashSpot): tap to take the bar off.
                      <Group>
                        <Circle cx={trash[0]} cy={trash[1]} r={11} color={c.paper} />
                        <Circle cx={trash[0]} cy={trash[1]} r={11} color={c.red} style="stroke" strokeWidth={2.5} />
                        <Path path={shape(`t${trash[0]},${trash[1]}`, () => trashIconPath(trash[0], trash[1]))} color={c.red} style="stroke" strokeWidth={1.6} strokeCap="round" strokeJoin="round" />
                      </Group>
                    )}
                    {otherEnd && <Circle cx={otherEnd[0]} cy={otherEnd[1]} r={6} color={selColor} style="stroke" strokeWidth={1.5} opacity={0.6} />}
                    {leverAt && (
                      <Group>
                        <Circle cx={leverAt[2]} cy={leverAt[3]} r={11} color={c.paper} />
                        <Circle cx={leverAt[2]} cy={leverAt[3]} r={11} color={selColor} style="stroke" strokeWidth={2.5} />
                        <Path path={shape(`h${leverAt[2]},${leverAt[3]}`, () => handleArcPath(leverAt[2], leverAt[3]))} color={selColor} style="stroke" strokeWidth={2.5} strokeCap="round" />
                      </Group>
                    )}
                  </Group>
                )}
                {labelFont && labels.map((l, i) => (
                  <Text key={`n${i}`} x={l.x} y={l.y} text={l.text} font={labelFont} color={illegal[i] ? c.red : c.pencil} />
                ))}

                {/* bounce markers: a red disc with the bounce's number, where it happened */}
                {labelFont && marks.map((m) => {
                  const t = String(m.n), w = labelFont.measureText(t).width;
                  return (
                    <Group key={`mk${m.n}`}>
                      <Circle cx={m.x} cy={m.y} r={10} color={c.red} />
                      <Circle cx={m.x} cy={m.y} r={10} color={c.paper} style="stroke" strokeWidth={2} />
                      <Text x={m.x - w / 2} y={m.y + 4.5} text={t} font={labelFont} color={c.paper} />
                    </Group>
                  );
                })}

                {/* launcher: the player's gun (game/guns.ts), aimed */}
                <RecoilGroup blast={blast}>
                  <GunArt gun={gun} angle={angle} power={power} c={c} glow={asmr ? c.pencil : undefined} />
                </RecoilGroup>
                {blast && <MuzzleBlast t={blast.t} gunId={gun.id} angle={blast.angle} c={c} asmr={asmr} />}
                {aimDots.map((d, i) => (
                  <Circle key={i} cx={d.x} cy={d.y} r={2} color={c.ink} opacity={d.a} />
                ))}

                {/* current flight */}
                {flight && flightPath && asmr && (
                  <Path path={flightPath} end={flight.end} color={c.pencil} style="stroke" strokeWidth={6} strokeCap="round" strokeJoin="round" opacity={0.35}>
                    <BlurMask blur={5} style="normal" />
                  </Path>
                )}
                {flight && flightPath && (
                  <Path
                    path={flightPath}
                    end={flight.end}
                    color={c.pencil} style="stroke" strokeWidth={asmr ? 1.6 : 2} strokeCap="round" strokeJoin="round" opacity={0.95}
                  />
                )}
                {flight && flightPath && asmr && <CometTail flight={flight} path={flightPath} color={c.pencil} />}
                {flash && asmr && <BounceFlash t={flash.t} x={flash.x} y={flash.y} color={c.pencil} />}

                {jam && <JamMark key={jam.n} x={jam.x} y={jam.y} color={c.red} glow={asmr} />}

                {/* ball */}
                {asmr && <BallGlow x={flight ? flight.x : ball[0]} y={flight ? flight.y : ball[1]} color={c.pencil} />}
                {flight
                  ? <FlyingBall flight={flight} skin={skin} c={c} charge={charge} />
                  : <Ball x={ball[0]} y={ball[1]} turn={restTurn} skin={skin} c={c} />}

                {celebrate && (asmr && celebrate.bloom
                  ? <Bloom cele={celebrate} bloom={celebrate.bloom} glass={g} c={c} />
                  : <Celebration cele={celebrate} glass={g} c={c} />)}

                {/* HUD */}
                {hud && hudFont && (
                  <Text x={12} y={24} text={`Try ${String(tries).padStart(2, '0')}`} font={hudFont} color={c.ink} />
                )}
                {hud && subFont && (
                  <Text x={12} y={42} text={`${angle.toFixed(1)}°   power ${power.toFixed(1)}`} font={subFont} color={c.muted} />
                )}
              </Group>
            </Canvas>
            {showTouches && <TouchSpot x={spot.x} y={spot.y} shown={spot.shown} />}
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

/** The ball at rest, in the player's skin (game/skins.ts), turned as far as it rolled. */
function Ball({ x, y, turn, skin, c }: { x: number; y: number; turn: number; skin: BallSkin; c: Palette }) {
  return <BallArt skin={skin} c={c} at={[{ translateX: x }, { translateY: y }]} spun={[{ translateX: x }, { translateY: y }, { rotate: turn }]} />;
}

/** The ball during playback: its position comes from shared values, so moving it never re-renders React. */
/** One end of a portal: a glowing ring with a dark centre, breathing slowly. */
function PortalRing({ x, y, color, exit }: { x: number; y: number; color: string; exit?: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  const glow = useDerivedValue(() => PORTAL_RADIUS + 5 + 3 * pulse.value);
  const glowO = useDerivedValue(() => 0.25 + 0.2 * pulse.value);
  const inner = useDerivedValue(() => PORTAL_RADIUS - 4 - 2 * pulse.value);
  return (
    <Group>
      <Circle cx={x} cy={y} r={glow} color={color} opacity={glowO} />
      <Circle cx={x} cy={y} r={PORTAL_RADIUS} color="#14202e" />
      <Circle cx={x} cy={y} r={PORTAL_RADIUS - 1.5} color={color} style="stroke" strokeWidth={3.5} />
      <Circle cx={x} cy={y} r={inner} color={color} style="stroke" strokeWidth={1.6} opacity={0.8} />
      {exit && <Circle cx={x} cy={y} r={3} color={color} />}
    </Group>
  );
}

/**
 * "Light the fuse": a gold spark runs along the winning shot from the cannon to the glass (the first 60% of the time), then the glass
 * flashes, rings spread out of it and confetti flies up. Everything is driven by one shared value, so React never re-renders for it.
 */
function Celebration({ cele, glass, c }: { cele: NonNullable<BoardProps['celebrate']>; glass: { l: number; r: number; rim: number; base: number }; c: Palette }) {
  const { t, path, jumps, confetti, rings } = cele;
  const line = useMemo(() => polyPath(path, path.length, jumps), [path, jumps]);
  const geo = useMemo(() => fuseGeometry(path, jumps), [path, jumps]);
  const fuse = useDerivedValue(() => Math.min(1, t.value / FUSE_SHARE));
  const burst = useDerivedValue(() => Math.max(0, (t.value - FUSE_SHARE) / (1 - FUSE_SHARE)));
  const head = useDerivedValue(() => {
    const f = fuse.value, cum = geo.cum;
    let i = 0;
    while (i < cum.length - 1 && cum[i + 1] < f) i++;
    return [geo.flat[2 * i], geo.flat[2 * i + 1]];
  });
  const hx = useDerivedValue(() => head.value[0]);
  const hy = useDerivedValue(() => head.value[1]);
  const lineO = useDerivedValue(() => (t.value >= 1 ? 0 : 0.9 * (1 - Math.max(0, (t.value - 0.8) / 0.2))));
  const headO = useDerivedValue(() => (fuse.value >= 1 || t.value >= 1 ? 0 : 1));
  const flashO = useDerivedValue(() => (burst.value > 0 ? 0.55 * (1 - burst.value) : 0));
  const ring1 = useDerivedValue(() => 6 + 70 * burst.value);
  const ring1O = useDerivedValue(() => (burst.value > 0 ? 0.9 * (1 - burst.value) : 0));
  const ring2 = useDerivedValue(() => 4 + 44 * burst.value);
  const ring2O = useDerivedValue(() => (burst.value > 0 ? 0.8 * (1 - burst.value) : 0));
  const cx = (glass.l + glass.r) / 2, cy = glass.rim + 6;
  const pieces = useMemo(() => confettiPieces(confetti), [confetti]);
  const colors = ['#ffb020', c.red, '#2f9bff', c.ink, '#ffe9a8'];
  return (
    <Group>
      <Path path={line} end={fuse} color="#ffb020" style="stroke" strokeWidth={9} strokeCap="round" strokeJoin="round" opacity={useDerivedValue(() => lineO.value * 0.28)} />
      <Path path={line} end={fuse} color="#ffcf4a" style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" opacity={lineO} />
      <Circle cx={hx} cy={hy} r={11} color="#ffb020" opacity={useDerivedValue(() => headO.value * 0.35)} />
      <Circle cx={hx} cy={hy} r={5} color="#fffbe0" opacity={headO} />
      <Rect x={glass.l} y={glass.rim} width={glass.r - glass.l} height={glass.base - glass.rim} color="#ffcf4a" opacity={flashO} />
      <Circle cx={cx} cy={cy} r={ring1} color="#ffb020" style="stroke" strokeWidth={3} opacity={ring1O} />
      {rings > 1 && <Circle cx={cx} cy={cy} r={ring2} color={c.red} style="stroke" strokeWidth={2.5} opacity={ring2O} />}
      {pieces.map((p, k) => <Confetti key={k} burst={burst} x={cx} y={cy} angle={p.angle} speed={p.speed} color={colors[p.color]} wide={p.wide} />)}
    </Group>
  );
}

/** A closed Skia path through points, offset by (ox, oy). */
function loopPath(pts: Vec[], ox = 0, oy = 0): SkPath {
  const p = Skia.PathBuilder.Make();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x + ox, y + oy) : p.moveTo(x + ox, y + oy)));
  return p.detach();
}

/**
 * ASMR mode's win, "light bloom" (game/bloom.ts): a pulse of light runs the winning path, the glass fills with liquid light, two
 * spirograph mandalas draw themselves round it turning opposite ways, rings ripple out across the board, a column of light rises,
 * fireflies spiral in and are drawn into the glass, and the glass breathes out one last glow. `t` runs 0 → 1 over the tier's `ms`.
 * Only a three-star win gets all of it (the column and the white glow); two stars and one get less (game/bloom.ts BloomTier).
 */
function Bloom({ cele, bloom, glass, c }: { cele: NonNullable<BoardProps['celebrate']>; bloom: BloomTier; glass: { l: number; r: number; rim: number; base: number }; c: Palette }) {
  const { t, path, jumps } = cele;
  const cx = (glass.l + glass.r) / 2, cy = (glass.rim + glass.base) / 2, gw = glass.r - glass.l, gh = glass.base - glass.rim;
  // The mandalas and fireflies centre a little above the glass, kept on the board (a glass on the floor cut half of them off).
  const my = Math.min(Math.max(glass.rim - 30, 90), GROUND - 90);
  const hues = [c.pencil, c.red, '#b18cff', '#ffe27a'];
  // The echo: the winning path lit from the cannon to the glass, with a bright head.
  const line = useMemo(() => polyPath(path, path.length, jumps), [path, jumps]);
  const geo = useMemo(() => fuseGeometry(path, jumps), [path, jumps]);
  const echo = useDerivedValue(() => phase(t.value, BLOOM_PHASES.echo));
  const head = useDerivedValue(() => {
    const f = echo.value, cum = geo.cum;
    let i = 0;
    while (i < cum.length - 1 && cum[i + 1] < f) i++;
    return [geo.flat[2 * i], geo.flat[2 * i + 1]];
  });
  const hx = useDerivedValue(() => head.value[0]);
  const hy = useDerivedValue(() => head.value[1]);
  const headO = useDerivedValue(() => (echo.value > 0 && echo.value < 1 ? 1 : 0));
  const lineO = useDerivedValue(() => 0.9 * (1 - phase(t.value, [0.55, 0.95])));
  // The fill: liquid light rising in the glass, its surface rippling.
  const fill = useDerivedValue(() => phase(t.value, BLOOM_PHASES.fill));
  const fillY = useDerivedValue(() => glass.base - gh * bloom.fill * (1 - (1 - fill.value) ** 2));
  const fillH = useDerivedValue(() => glass.base - fillY.value);
  const fillO = useDerivedValue(() => (fill.value > 0 ? 0.55 * (1 - 0.6 * phase(t.value, [0.9, 1])) : 0));
  const wave = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    for (let i = 0; i <= 24; i++) {
      const x = glass.l + (gw * i) / 24, y = Math.sin((i / 24) * Math.PI * 4) * 1.6;
      if (i) p.lineTo(x, y); else p.moveTo(x, y);
    }
    return p.detach();
  }, [glass.l, gw]);
  const waveAt = useDerivedValue<Transforms3d>(() => [{ translateY: fillY.value }, { translateX: Math.sin(t.value * 40) * 2 }]);
  // The mandalas: two spirographs drawing themselves, turning opposite ways, fading at the end.
  const spiroA = useMemo(() => loopPath(spirograph(7, 4, 5, 78)), []);
  const spiroB = useMemo(() => loopPath(spirograph(5, 3, 4, 54)), []);
  const draw = useDerivedValue(() => phase(t.value, BLOOM_PHASES.mandala));
  const spinA = useDerivedValue<Transforms3d>(() => [{ translateX: cx }, { translateY: my }, { rotate: t.value * Math.PI * 0.9 }]);
  const spinB = useDerivedValue<Transforms3d>(() => [{ translateX: cx }, { translateY: my }, { rotate: -t.value * Math.PI * 1.3 }]);
  const mandO = useDerivedValue(() => (draw.value > 0 ? 0.85 * (1 - phase(t.value, [0.84, 1])) : 0));
  // The beam: a column of light over the glass, breathing.
  const beam = useDerivedValue(() => phase(t.value, BLOOM_PHASES.beam));
  const beamW = useDerivedValue(() => gw * 1.4 * Math.sin(Math.PI * beam.value));
  const beamX = useDerivedValue(() => cx - beamW.value / 2);
  const beamO = useDerivedValue(() => 0.35 * Math.sin(Math.PI * beam.value) * (0.8 + 0.2 * Math.sin(t.value * 60)));
  const coreW = useDerivedValue(() => beamW.value * 0.25);
  const coreX = useDerivedValue(() => cx - coreW.value / 2);
  // The breath: one last soft glow out of the glass.
  const breath = useDerivedValue(() => phase(t.value, BLOOM_PHASES.breath));
  const white = bloom.halo === 'white', warm = bloom.halo === 'warm';
  const breathO = useDerivedValue(() => (white ? 0.7 : warm ? 0.55 : 0.45) * Math.sin(Math.PI * breath.value));
  const breathR = useDerivedValue(() => 12 + (white ? 40 : warm ? 18 : 26) * breath.value);
  const flies = useMemo(() => fireflies(bloom.flies), [bloom.flies]);
  // 2 stars, the constellation: the shot's bounces as stars (lit as the echo passes them), then joined up.
  const pts = cele.points ?? [];
  const joinPath = useMemo(() => polyPath(pts.map((q) => [q.x, q.y] as Vec), pts.length, []), [pts]);
  const join = useDerivedValue(() => phase(t.value, BLOOM_PHASES.constellation));
  const starsO = useDerivedValue(() => 1 - phase(t.value, [0.86, 1]));
  // 2 stars, the flower: a five-petal rose drawing itself over the glass, a three-petal one inside it turning the other way.
  const petalsA = useMemo(() => loopPath(rose(5, 82)), []);
  const petalsB = useMemo(() => loopPath(rose(3, 46)), []);
  const bloomIn = useDerivedValue(() => phase(t.value, BLOOM_PHASES.flower));
  const flowerO = useDerivedValue(() => (bloomIn.value > 0 ? 0.9 * (1 - phase(t.value, [0.84, 1])) : 0));
  const turnA = useDerivedValue<Transforms3d>(() => [{ translateX: cx }, { translateY: my }, { rotate: t.value * Math.PI * 0.5 }, { scale: 0.7 + 0.3 * bloomIn.value }]);
  const turnB = useDerivedValue<Transforms3d>(() => [{ translateX: cx }, { translateY: my }, { rotate: -t.value * Math.PI * 0.8 }, { scale: 0.7 + 0.3 * bloomIn.value }]);
  // 1 star, the embers: a fountain rising out of the glass's mouth.
  const sparks = useMemo(() => embers(bloom.embers), [bloom.embers]);
  const emberHues = ['#ffb020', c.red, '#ffe27a'];
  // 1 star: the glass's mouth glows warm while the embers rise (one blurred shape).
  const emberGlow = useDerivedValue(() => (bloom.embers ? 0.45 * Math.sin(Math.PI * phase(t.value, BLOOM_PHASES.embers)) : 0));
  return (
    <Group>
      {bloom.beam && <Rect x={beamX} y={0} width={beamW} height={glass.rim} color={c.pencil} opacity={beamO}><BlurMask blur={14} style="normal" /></Rect>}
      {bloom.beam && <Rect x={coreX} y={0} width={coreW} height={glass.rim} color="#ffffff" opacity={beamO}><BlurMask blur={5} style="normal" /></Rect>}
      {Array.from({ length: bloom.rings }, (_, i) => <Ripple key={`rp${i}`} t={t} x={cx} y={cy} i={i} color={hues[i % hues.length]} />)}
      {bloom.mandalas === 2 && <Group transform={spinA} opacity={mandO}>
        <Path path={spiroA} end={draw} color={c.pencil} style="stroke" strokeWidth={4} opacity={0.5}><BlurMask blur={4} style="normal" /></Path>
        <Path path={spiroA} end={draw} color={c.pencil} style="stroke" strokeWidth={1.2} />
      </Group>}
      {bloom.mandalas === 2 && <Group transform={spinB} opacity={mandO}>
        <Path path={spiroB} end={draw} color={c.red} style="stroke" strokeWidth={4} opacity={0.5}><BlurMask blur={4} style="normal" /></Path>
        <Path path={spiroB} end={draw} color={c.red} style="stroke" strokeWidth={1.2} />
      </Group>}
      <Path path={line} end={echo} color={c.pencil} style="stroke" strokeWidth={7} strokeCap="round" strokeJoin="round" opacity={useDerivedValue(() => lineO.value * 0.4)}>
        <BlurMask blur={5} style="normal" />
      </Path>
      <Path path={line} end={echo} color="#ffffff" style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" opacity={lineO} />
      <Circle cx={hx} cy={hy} r={14} color={c.pencil} opacity={useDerivedValue(() => headO.value * 0.6)}><BlurMask blur={8} style="normal" /></Circle>
      <Circle cx={hx} cy={hy} r={5} color="#ffffff" opacity={headO} />
      <Rect x={glass.l} y={fillY} width={gw} height={fillH} color={c.red} opacity={fillO}><BlurMask blur={3} style="normal" /></Rect>
      <Group transform={waveAt} opacity={useDerivedValue(() => (fill.value > 0 ? 0.9 * (1 - phase(t.value, [0.9, 1])) : 0))}>
        <Path path={wave} color="#ffffff" style="stroke" strokeWidth={1.6} strokeCap="round"><BlurMask blur={1.5} style="normal" /></Path>
      </Group>
      {bloom.flower && <Group transform={turnA} opacity={flowerO}>
        <Path path={petalsA} end={bloomIn} color="#ffe27a" style="stroke" strokeWidth={5} opacity={0.5}><BlurMask blur={5} style="normal" /></Path>
        <Path path={petalsA} end={bloomIn} color="#ffe27a" style="stroke" strokeWidth={1.6} />
      </Group>}
      {bloom.flower && <Group transform={turnB} opacity={flowerO}>
        <Path path={petalsB} end={bloomIn} color={c.red} style="stroke" strokeWidth={4} opacity={0.45}><BlurMask blur={4} style="normal" /></Path>
        <Path path={petalsB} end={bloomIn} color={c.red} style="stroke" strokeWidth={1.4} />
      </Group>}
      {bloom.constellation && pts.length > 1 && (
        <Path path={joinPath} end={join} color="#ffe27a" style="stroke" strokeWidth={1.4} strokeJoin="round" opacity={useDerivedValue(() => 0.75 * starsO.value)} />
      )}
      {bloom.constellation && pts.map((q, k) => <BounceStar key={`bs${k}`} echo={echo} fade={starsO} x={q.x} y={q.y} f={q.f} />)}
      {bloom.embers > 0 && <Circle cx={cx} cy={glass.rim} r={gw * 0.9} color="#ffb020" opacity={emberGlow}><BlurMask blur={10} style="normal" /></Circle>}
      {sparks.map((e, k) => <RisingEmberDot key={`em${k}`} t={t} x={cx} y={glass.rim} e={e} color={emberHues[e.hue]} />)}
      {flies.map((f, k) => <FireflyDot key={`ff${k}`} t={t} x={cx} y={my} f={f} color={hues[f.hue]} />)}
      <Circle cx={cx} cy={cy} r={breathR} color={white ? '#ffffff' : warm ? '#ffb020' : c.pencil} opacity={breathO}><BlurMask blur={white ? 12 : 9} style="normal" /></Circle>
    </Group>
  );
}

/** One ripple of the bloom: a thin ring opening out across the board from the glass, the next a moment after the last. */
function Ripple({ t, x, y, i, color }: { t: SharedValue<number>; x: number; y: number; i: number; color: string }) {
  const start = BLOOM_PHASES.rings[0] + i * 0.07;
  const p = useDerivedValue(() => phase(t.value, [start, Math.min(1, start + 0.5)]));
  const r = useDerivedValue(() => 10 + 300 * (1 - (1 - p.value) ** 2));
  const o = useDerivedValue(() => (p.value > 0 && p.value < 1 ? 0.7 * (1 - p.value) : 0));
  return (
    <Circle cx={x} cy={y} r={r} color={color} style="stroke" strokeWidth={1.6} opacity={o} />
  );
}

/** 2 stars: one bounce of the winning shot, lit as a star when the echo's light reaches it, with a small pop and a cross of light. */
function BounceStar({ echo, fade, x, y, f }: { echo: SharedValue<number>; fade: SharedValue<number>; x: number; y: number; f: number }) {
  const pop = useDerivedValue(() => Math.min(1, Math.max(0, (echo.value - f) / 0.06)));
  const o = useDerivedValue(() => (pop.value > 0 ? fade.value : 0));
  const s = useDerivedValue(() => 1 + 0.8 * (1 - pop.value) * pop.value * 4);
  const r = useDerivedValue(() => 3 * s.value);
  const arm = useDerivedValue(() => 14 * s.value);
  const ax = useDerivedValue(() => x - arm.value), ay = useDerivedValue(() => y - arm.value), aw = useDerivedValue(() => arm.value * 2);
  return (
    <Group opacity={o}>
      {/* Plain translucent halos, no blur: a shot can have a dozen bounces. */}
      <Circle cx={x} cy={y} r={16} color="#ffe27a" opacity={0.25} />
      <Rect x={ax} y={y - 0.6} width={aw} height={1.2} color="#ffe27a" opacity={0.8} />
      <Rect x={x - 0.6} y={ay} width={1.2} height={aw} color="#ffe27a" opacity={0.8} />
      <Circle cx={x} cy={y} r={r} color="#ffffff" />
    </Group>
  );
}

/** 1 star: one ember rising out of the glass, wobbling and flickering, then going out (game/bloom.ts emberAt). */
function RisingEmberDot({ t, x, y, e, color }: { t: SharedValue<number>; x: number; y: number; e: RisingEmber; color: string }) {
  const at = useDerivedValue(() => emberAt(e, x, y, phase(t.value, BLOOM_PHASES.embers)));
  const px = useDerivedValue(() => at.value[0]), py = useDerivedValue(() => at.value[1]), o = useDerivedValue(() => at.value[2]);
  return (
    <Group opacity={o}>
      <Circle cx={px} cy={py} r={e.size * 4} color={color} opacity={0.22} />
      <Circle cx={px} cy={py} r={e.size * 1.8} color={color} opacity={0.5} />
      <Circle cx={px} cy={py} r={e.size} color="#fff6d8" />
    </Group>
  );
}

/** One firefly of the bloom: fades in on its ring, spirals into the glass and goes out there. */
function FireflyDot({ t, x, y, f, color }: { t: SharedValue<number>; x: number; y: number; f: Firefly; color: string }) {
  const p = useDerivedValue(() => phase(t.value, BLOOM_PHASES.fireflies));
  const at = useDerivedValue(() => fireflyAt(f, x, y, p.value));
  const cx = useDerivedValue(() => at.value[0]);
  const cy = useDerivedValue(() => at.value[1]);
  const o = useDerivedValue(() => (p.value <= 0 || p.value >= f.arrive ? 0 : Math.min(1, p.value / 0.12)));
  return (
    <Group opacity={o}>
      {/* Halos as plain translucent circles, not blur: there are up to 28 of these at once. */}
      <Circle cx={cx} cy={cy} r={f.size * 4} color={color} opacity={0.12} />
      <Circle cx={cx} cy={cy} r={f.size * 2.2} color={color} opacity={0.35} />
      <Circle cx={cx} cy={cy} r={f.size} color="#ffffff" />
    </Group>
  );
}

/** One piece of confetti: thrown up out of the glass, then pulled down, shrinking and fading. */
function Confetti({ burst, x, y, angle, speed, color, wide }: { burst: SharedValue<number>; x: number; y: number; angle: number; speed: number; color: string; wide: boolean }) {
  const px = useDerivedValue(() => x + Math.cos(angle) * speed * burst.value * 0.9);
  const py = useDerivedValue(() => y + Math.sin(angle) * speed * burst.value * 0.9 + 260 * burst.value * burst.value);
  const o = useDerivedValue(() => (burst.value <= 0 ? 0 : Math.max(0, 1 - burst.value * burst.value)));
  const w = wide ? 7 : 4, h = wide ? 3.2 : 4;
  const rx = useDerivedValue(() => px.value - w / 2);
  const ry = useDerivedValue(() => py.value - h / 2);
  return <Rect x={rx} y={ry} width={w} height={h} color={color} opacity={o} />;
}

/** The gun kicks back along its aim when it fires (game/muzzle.ts recoilAt). */
function RecoilGroup({ blast, children }: { blast?: { t: SharedValue<number>; angle: number }; children: ReactNode }) {
  const a = ((blast?.angle ?? 0) * Math.PI) / 180, ux = Math.cos(a), uy = -Math.sin(a);
  const kick = useDerivedValue<Transforms3d>(() => {
    const k = blast ? recoilAt(blast.t.value) : 0;
    return [{ translateX: -ux * k }, { translateY: -uy * k }];
  });
  return <Group transform={kick}>{children}</Group>;
}

/** The muzzle flash: a star of light longest along the aim, drawn pointing along +x (turned to the aim by its group). */
/** How long the flash lasts, as a share of BLAST_MS. */
const FLASH = 0.17;

function flashStar(): SkPath {
  const p = Skia.PathBuilder.Make();
  const rays = [[0, 46], [0.35, 14], [0.75, 22], [1.4, 11], [2.2, 7], [Math.PI, 6], [-2.2, 7], [-1.4, 11], [-0.75, 22], [-0.35, 14]];
  rays.forEach(([ang, len], i) => {
    const mid = ang + 0.17;
    const x = Math.cos(ang) * len, y = Math.sin(ang) * len;
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
    p.lineTo(Math.cos(mid) * 5, Math.sin(mid) * 5);
  });
  p.close();
  return p.detach();
}

/**
 * The launch blast at the end of the barrel (game/muzzle.ts): a star-shaped flash and a white-hot core, a shock ring, a cone of
 * sparks thrown forward and falling, and smoke rolling out along the aim and drifting up. In ASMR mode it's drawn in the neon colours.
 */
function MuzzleBlast({ t, gunId, angle, c, asmr }: { t: SharedValue<number>; gunId: string; angle: number; c: Palette; asmr: boolean }) {
  const { at, u } = useMemo(() => muzzle(gunId, angle), [gunId, angle]);
  const star = useMemo(flashStar, []);
  const sparks = useMemo(() => blastSparks(18), []);
  const puffs = useMemo(() => blastPuffs(6), []);
  const rot = Math.atan2(u[1], u[0]);
  const fp = useDerivedValue(() => Math.min(1, t.value / FLASH));
  const starAt = useDerivedValue<Transforms3d>(() => [{ translateX: at[0] }, { translateY: at[1] }, { rotate: rot }, { scale: 0.6 + 0.8 * Math.sqrt(fp.value) }]);
  const starO = useDerivedValue(() => (t.value > 0 && t.value < FLASH ? 1 - fp.value * fp.value : 0));
  const coreR = useDerivedValue(() => 6 + 14 * fp.value);
  const ringR = useDerivedValue(() => 6 + 48 * (1 - (1 - Math.min(1, t.value / 0.32)) ** 2));
  const ringO = useDerivedValue(() => (t.value > 0 && t.value < 0.32 ? 0.9 * (1 - t.value / 0.32) : 0));
  const ringW = useDerivedValue(() => 0.8 + 3.2 * Math.max(0, 1 - t.value / 0.32));
  // The barrel glows hot for a moment.
  const heatO = useDerivedValue(() => (t.value > 0 && t.value < 0.4 ? 0.7 * (1 - t.value / 0.4) : 0));
  const barrel = useMemo(() => linePath(at[0] - u[0] * 22, at[1] - u[1] * 22, at[0], at[1]), [at, u]);
  const hot = asmr ? c.pencil : '#ffb347';
  const sparkHues = asmr ? [c.pencil, c.red, '#ffffff'] : ['#ffd36b', '#ff8a3d', '#fff3c4'];
  return (
    <Group>
      {puffs.map((p, k) => <BlastSmoke key={`bs${k}`} t={t} at={at} u={u} p={p} color={asmr ? c.pencil : c.muted} asmr={asmr} />)}
      <Path path={barrel} color={hot} style="stroke" strokeWidth={12} strokeCap="round" opacity={heatO}><BlurMask blur={6} style="normal" /></Path>
      <Circle cx={at[0]} cy={at[1]} r={ringR} color={hot} style="stroke" strokeWidth={ringW} opacity={ringO} />
      <Group transform={starAt} opacity={starO}>
        <Path path={star} color={hot}><BlurMask blur={2} style="normal" /></Path>
      </Group>
      <Circle cx={at[0]} cy={at[1]} r={coreR} color="#ffffff" opacity={starO}><BlurMask blur={4} style="normal" /></Circle>
      {sparks.map((s, k) => <BlastSparkDot key={`sp${k}`} t={t} at={at} rot={rot} s={s} color={sparkHues[k % 3]} />)}
    </Group>
  );
}

/** One spark of the blast: thrown forward along its angle off the aim, falling, fading over the first half of the blast. */
function BlastSparkDot({ t, at, rot, s, color }: { t: SharedValue<number>; at: [number, number]; rot: number; s: BlastSpark; color: string }) {
  const dx = Math.cos(rot + s.off) * s.speed, dy = Math.sin(rot + s.off) * s.speed;
  const p = useDerivedValue(() => Math.min(1, t.value / 0.5));
  const ease = useDerivedValue(() => 1 - (1 - p.value) ** 2);
  const cx = useDerivedValue(() => at[0] + dx * ease.value * 0.42);
  const cy = useDerivedValue(() => at[1] + dy * ease.value * 0.42 + 110 * p.value * p.value);
  const o = useDerivedValue(() => (t.value > 0 && p.value < 1 ? 1 - p.value : 0));
  return (
    <Group opacity={o}>
      <Circle cx={cx} cy={cy} r={s.size * 3.2} color={color} opacity={0.28} />
      <Circle cx={cx} cy={cy} r={s.size * 1.3} color={color} />
    </Group>
  );
}

/** One puff of the blast's smoke: rolls out along the aim, swells, drifts up and thins away. */
function BlastSmoke({ t, at, u, p, color, asmr }: { t: SharedValue<number>; at: [number, number]; u: [number, number]; p: SmokeCloud; color: string; asmr: boolean }) {
  const q = useDerivedValue(() => Math.min(1, Math.max(0, (t.value - p.delay) / (1 - p.delay))));
  const ease = useDerivedValue(() => 1 - (1 - q.value) ** 2);
  const cx = useDerivedValue(() => at[0] + u[0] * p.along * ease.value - u[1] * p.side * ease.value);
  const cy = useDerivedValue(() => at[1] + u[1] * p.along * ease.value + u[0] * p.side * ease.value - 18 * q.value);
  const r = useDerivedValue(() => p.r * (0.4 + 1.3 * ease.value));
  const o = useDerivedValue(() => (q.value <= 0 || q.value >= 1 ? 0 : (asmr ? 0.22 : 0.32) * (1 - q.value) * Math.min(1, q.value / 0.06)));
  return (
    <Circle cx={cx} cy={cy} r={r} color={color} opacity={o}>
      <BlurMask blur={5} style="normal" />
    </Circle>
  );
}

/** Where shards come to rest: on the floor, less a little so they sit on its line. */
const SHARD_FLOOR = GROUND - 3;

/**
 * The ball shattering on a hazard, in slow motion (game/shatter.ts): a white flash, two shockwave rings, shards that burst out
 * with the ball's momentum, tumble, land and skid on the floor, embers drifting up, and a puff of smoke. `t` runs 0 → 1 over
 * SHATTER_MS; shatterClock turns that into slowed physics time. In ASMR mode the pieces glow in the neon colours.
 */
function Shatter({ t, x, y, vx, vy, c, asmr }: { t: SharedValue<number>; x: number; y: number; vx: number; vy: number; c: Palette; asmr: boolean }) {
  const { shards, embers, puffs } = useMemo(() => shatterPieces(x, y, vx, vy, SHARD_FLOOR), [x, y, vx, vy]);
  const flashR = useDerivedValue(() => 5 + 24 * Math.min(1, t.value / 0.12));
  const flashO = useDerivedValue(() => (t.value < 0.12 ? 0.95 * (1 - t.value / 0.12) : 0));
  const r1 = useDerivedValue(() => 8 + 74 * Math.min(1, t.value / 0.45));
  const o1 = useDerivedValue(() => 0.85 * Math.max(0, 1 - t.value / 0.45));
  const w1 = useDerivedValue(() => 0.6 + 3 * Math.max(0, 1 - t.value / 0.45));
  const r2 = useDerivedValue(() => 6 + 46 * Math.min(1, Math.max(0, (t.value - 0.06) / 0.5)));
  const o2 = useDerivedValue(() => (t.value < 0.06 ? 0 : 0.6 * Math.max(0, 1 - (t.value - 0.06) / 0.5)));
  const hot = asmr ? c.red : '#ff8a3d';
  const tones = asmr ? [c.pencil, c.red, '#ffffff'] : [c.steel, hot, c.ink];
  return (
    <Group>
      {puffs.map((p, k) => <SmokePuff key={`p${k}`} t={t} x={x} y={y} p={p} color={c.muted} />)}
      <Circle cx={x} cy={y} r={r1} color={hot} style="stroke" strokeWidth={w1} opacity={o1}>
        {asmr && <BlurMask blur={2} style="normal" />}
      </Circle>
      <Circle cx={x} cy={y} r={r2} color={asmr ? c.pencil : c.red} style="stroke" strokeWidth={1.5} opacity={o2} />
      {shards.map((s, k) => <ShardPiece key={`s${k}`} t={t} x={x} y={y} s={s} fill={tones[s.tone]} edge={c.ink} glow={asmr || s.tone === 1} />)}
      {embers.map((e, k) => <EmberDot key={`e${k}`} t={t} x={x} y={y} e={e} color={asmr ? (k % 2 ? c.red : c.pencil) : k % 3 ? '#ffb347' : '#ffe2a8'} />)}
      <Circle cx={x} cy={y} r={flashR} color="#ffffff" opacity={flashO}>
        <BlurMask blur={6} style="normal" />
      </Circle>
    </Group>
  );
}

function ShardPiece({ t, x, y, s, fill, edge, glow }: { t: SharedValue<number>; x: number; y: number; s: Shard; fill: string; edge: string; glow: boolean }) {
  const path = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(s.pts[0][0], s.pts[0][1]);
    p.lineTo(s.pts[1][0], s.pts[1][1]);
    p.lineTo(s.pts[2][0], s.pts[2][1]);
    p.close();
    return p.detach();
  }, [s]);
  const { vx, vy, spin, land } = s;
  const at = useDerivedValue<Transforms3d>(() => {
    // shatterClock and shardAt (game/shatter.ts), inlined so they run on the UI thread.
    const u = Math.min(1, Math.max(0, t.value));
    const time = SHATTER_TIME * (1 - (1 - u) ** SLOW);
    const air = Math.min(time, land);
    const slide = Math.max(0, time - land);
    const px = x + vx * air + vx * 0.2 * Math.min(slide, 0.25);
    const py = Math.min(SHARD_FLOOR, y + vy * air + 0.5 * SHARD_GRAVITY * air * air);
    return [{ translateX: px }, { translateY: py }, { rotate: spin * air }];
  });
  const o = useDerivedValue(() => (t.value < 0.8 ? 1 : Math.max(0, (1 - t.value) / 0.2)));
  return (
    <Group transform={at} opacity={o}>
      {glow && <Path path={path} color={fill} opacity={0.8}><BlurMask blur={3} style="normal" /></Path>}
      <Path path={path} color={fill} />
      <Path path={path} color={edge} style="stroke" strokeWidth={0.7} opacity={0.6} />
    </Group>
  );
}

function EmberDot({ t, x, y, e, color }: { t: SharedValue<number>; x: number; y: number; e: Ember; color: string }) {
  const cx = useDerivedValue(() => {
    const time = SHATTER_TIME * (1 - (1 - Math.min(1, t.value)) ** SLOW);
    return x + e.vx * time + Math.sin(e.phase + time * 6) * e.wobble;
  });
  const cy = useDerivedValue(() => y + e.vy * SHATTER_TIME * (1 - (1 - Math.min(1, t.value)) ** SLOW));
  const o = useDerivedValue(() => (t.value < 0.05 ? t.value / 0.05 : 0.9 * Math.max(0, 1 - t.value)));
  return (
    <Circle cx={cx} cy={cy} r={e.r} color={color} opacity={o}>
      <BlurMask blur={1.5} style="normal" />
    </Circle>
  );
}

function SmokePuff({ t, x, y, p, color }: { t: SharedValue<number>; x: number; y: number; p: Puff; color: string }) {
  const k = useDerivedValue(() => Math.min(1, t.value / 0.9));
  const cx = useDerivedValue(() => x + p.dx * (1 + k.value));
  const cy = useDerivedValue(() => y + p.dy - 28 * k.value);
  const r = useDerivedValue(() => p.r * (0.5 + 1.3 * k.value));
  const o = useDerivedValue(() => 0.38 * (1 - k.value) * Math.min(1, t.value / 0.08));
  return (
    <Circle cx={cx} cy={cy} r={r} color={color} opacity={o}>
      <BlurMask blur={6} style="normal" />
    </Circle>
  );
}

/** ASMR mode: a soft halo of light round the ball. */
function BallGlow({ x, y, color }: { x: number | SharedValue<number>; y: number | SharedValue<number>; color: string }) {
  return (
    <Circle cx={x} cy={y} r={R + 7} color={color} opacity={0.55}>
      <BlurMask blur={8} style="normal" />
    </Circle>
  );
}

/** How long the comet tail behind the ball is, in board units. */
const TAIL = 70;

/**
 * ASMR mode: a comet tail behind the flying ball, the last stretch of its path drawn in three layers that get wider and brighter
 * towards the ball, with a glow. Playback says how far along the path's length the ball is (`end`).
 */
function CometTail({ flight, path, color }: { flight: Flight; path: SkPath; color: string }) {
  const share = useMemo(() => {
    const p = flight.path;
    let total = 0;
    for (let i = 1; i < p.length; i++) if (!flight.jumps.includes(i)) total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return total > 0 ? TAIL / total : 0;
  }, [flight.path, flight.jumps]);
  const s1 = useDerivedValue(() => Math.max(0, flight.end.value - share));
  const s2 = useDerivedValue(() => Math.max(0, flight.end.value - share * 0.55));
  const s3 = useDerivedValue(() => Math.max(0, flight.end.value - share * 0.25));
  return (
    <Group>
      <Path path={path} start={s1} end={flight.end} color={color} style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round" opacity={0.25}>
        <BlurMask blur={3} style="normal" />
      </Path>
      <Path path={path} start={s2} end={flight.end} color={color} style="stroke" strokeWidth={8} strokeCap="round" strokeJoin="round" opacity={0.4}>
        <BlurMask blur={4} style="normal" />
      </Path>
      <Path path={path} start={s3} end={flight.end} color="#ffffff" style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" opacity={0.7} />
    </Group>
  );
}

/** ASMR mode: a ring of light opening out where the ball bounced, fading as it grows. */
function BounceFlash({ t, x, y, color }: { t: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number>; color: string }) {
  const r = useDerivedValue(() => 6 + 26 * t.value);
  const o = useDerivedValue(() => 0.9 * (1 - t.value));
  const core = useDerivedValue(() => 0.8 * (1 - t.value) ** 2);
  return (
    <Group>
      <Circle cx={x} cy={y} r={r} color={color} style="stroke" strokeWidth={2.5} opacity={o}>
        <BlurMask blur={2} style="normal" />
      </Circle>
      <Circle cx={x} cy={y} r={7} color="#ffffff" opacity={core}>
        <BlurMask blur={5} style="normal" />
      </Circle>
    </Group>
  );
}

/**
 * Where a bar turned into something bumps it: a red dot and two rings knocking outward, like a clunk, gone in 0.8 s (ASMR mode
 * adds a soft neon halo). Remounted (new
 * key) for each bump, so it starts from the top; no blur, it's drawn every frame while it plays.
 */
function JamMark({ x, y, color, glow = false }: { x: number; y: number; color: string; glow?: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }); }, [t]);
  const r1 = useDerivedValue(() => 5 + 20 * Math.min(1, t.value * 1.6));
  const o1 = useDerivedValue(() => 0.9 * Math.max(0, 1 - t.value * 1.6));
  const r2 = useDerivedValue(() => 5 + 20 * Math.max(0, t.value * 1.6 - 0.6));
  const o2 = useDerivedValue(() => (t.value < 0.375 ? 0 : 0.8 * (1 - t.value)));
  const dot = useDerivedValue(() => 0.9 * (1 - t.value));
  const halo1 = useDerivedValue(() => o1.value * 0.15);
  const halo2 = useDerivedValue(() => o1.value * 0.25);
  return (
    <Group>
      {/* ASMR mode: a soft neon halo round the first ring, as plain wide translucent bands (no blur: it's drawn every frame). */}
      {glow && <Circle cx={x} cy={y} r={r1} color={color} style="stroke" strokeWidth={12} opacity={halo1} />}
      {glow && <Circle cx={x} cy={y} r={r1} color={color} style="stroke" strokeWidth={7} opacity={halo2} />}
      <Circle cx={x} cy={y} r={r1} color={color} style="stroke" strokeWidth={3} opacity={o1} />
      <Circle cx={x} cy={y} r={r2} color={color} style="stroke" strokeWidth={2} opacity={o2} />
      <Circle cx={x} cy={y} r={4.5} color={color} opacity={dot} />
    </Group>
  );
}

/** ASMR mode's blocks: violet neon glass (the bars are cyan, the glass pink). */
const NEON_BLOCK = '#b18cff';

/**
 * ASMR mode: the bar or block the ball just struck (`what`, game/asmr.ts hitTarget, equal to `me`) flares up: a burst of glow round
 * it and a white-hot core (a block also brightens inside), fading as the bounce's flash runs out.
 */
function HitFlare({ path, t, what, me, color, fill = false }: { path: SkPath; t: SharedValue<number>; what: SharedValue<number>; me: number; color: string; fill?: boolean }) {
  const o = useDerivedValue(() => (what.value === me && t.value < 1 ? (1 - t.value) ** 1.5 : 0));
  const coreO = useDerivedValue(() => o.value * 0.9);
  const fillO = useDerivedValue(() => o.value * 0.45);
  // Plain bands, no blur: a blur here (and one hidden on every bar and block, waiting to be lit) slowed frames on phones enough to
  // put the bounce sounds out of step with the picture.
  return (
    <Group opacity={o}>
      <Path path={path} color={color} style="stroke" strokeWidth={22} strokeCap="round" strokeJoin="round" opacity={0.18} />
      <Path path={path} color={color} style="stroke" strokeWidth={12} strokeCap="round" strokeJoin="round" opacity={0.35} />
      {fill && <Path path={path} color={color} opacity={fillO} />}
      <Path path={path} color="#ffffff" style="stroke" strokeWidth={fill ? 2.5 : 3.5} strokeCap="round" strokeJoin="round" opacity={coreO} />
    </Group>
  );
}

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

/**
 * The ball in flight, in the player's skin, rolling with its travel (game/skins.ts spinAlong): playback says how far along the path's
 * length it is (`end`), which is looked up in the path's own lengths to find the turn at that point.
 */
function FlyingBall({ flight, skin, c, charge }: { flight: Flight; skin: BallSkin; c: Palette; charge?: SharedValue<number> }) {
  const { x, y, end } = flight;
  const { frac, turn } = useMemo(() => {
    const p = flight.path;
    const lengths = [0];
    for (let i = 1; i < p.length; i++) {
      lengths.push(lengths[i - 1] + (flight.jumps.includes(i) ? 0 : Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])));
    }
    const total = lengths[lengths.length - 1] || 1;
    return { frac: lengths.map((l) => l / total), turn: spinAlong(p, R) };
  }, [flight.path, flight.jumps]);
  const at = useDerivedValue<Transforms3d>(() => [{ translateX: x.value }, { translateY: y.value }]);
  const spun = useDerivedValue<Transforms3d>(() => {
    // The last path point whose share of the length is at or before `end`.
    let lo = 0, hi = frac.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frac[mid] <= end.value) lo = mid; else hi = mid - 1;
    }
    return [{ translateX: x.value }, { translateY: y.value }, { rotate: turn[lo] ?? 0 }];
  });
  // Energised: a warm glow that breathes while the charge lasts, and a hot ring round the ball.
  const glowR = useDerivedValue(() => R + 5 + 7 * (charge?.value ?? 0) + 1.5 * Math.sin(Date.now() / 60));
  const glowO = useDerivedValue(() => 0.5 * (charge?.value ?? 0));
  const haloR = useDerivedValue(() => R + 14 + 8 * (charge?.value ?? 0));
  const haloO = useDerivedValue(() => 0.2 * (charge?.value ?? 0));
  const ringO = useDerivedValue(() => Math.min(1, (charge?.value ?? 0) * 1.4));
  return (
    <Group>
      <Circle cx={x} cy={y} r={haloR} color="#ffb020" opacity={haloO} />
      <Circle cx={x} cy={y} r={glowR} color="#ffcf4a" opacity={glowO} />
      <BallArt skin={skin} c={c} at={at} spun={spun} />
      <Circle cx={x} cy={y} r={R + 1} color="#ff9a00" style="stroke" strokeWidth={2} opacity={ringO} />
    </Group>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The prototype's canvas: rounded corners and a 1.5px ring in the line colour.
  board: { borderRadius: 6, overflow: 'hidden', outlineWidth: 1.5, outlineStyle: 'solid' },
});
