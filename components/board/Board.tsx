import { Canvas, Circle, Group, Path, Rect, Text, useFont } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  BALL_RADIUS, LAUNCHER, WORLD, glassBox, pieceEnds, speedFor,
  type Level, type PlacedPiece, type Vec,
} from '../../physics';
import { useColors } from '../../theme/colors';
import {
  crossPath, deadPaths, gridPaths, handleArcPath, launcherPath, linePath, polyPath,
} from './paths';

const { width: W, height: H, ground: GROUND } = WORLD;
const R = BALL_RADIUS;
const L = LAUNCHER;

/** A finished launch, kept on screen as a fading ghost trail. */
export interface Trail { path: Vec[]; ok: boolean }

export interface BoardProps {
  level: Level;
  /** Pieces currently on the board. */
  pieces: PlacedPiece[];
  /** Index into `pieces` of the selected piece, if any. */
  selected?: number | null;
  /** Last few launches, oldest first. */
  trails: Trail[];
  angle: number;
  power: number;
  tries: number;
  /** The launch being played back, and how far through its path it is. */
  flight?: { path: Vec[]; idx: number } | null;
  /** The level is won: the ball rests where the last trail ended. */
  done?: boolean;
}

const condensed600 = require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf');
const condensed500 = require('@expo-google-fonts/barlow-condensed/500Medium/BarlowCondensed_500Medium.ttf');

/**
 * The game board, drawn in Skia in world units (400 × 720) and scaled uniformly to fit its container.
 * Pure rendering: everything it shows comes from props. Matches draw() in reference/prototype.html.
 */
export function Board(props: BoardProps) {
  const { level, pieces, selected = null, trails, angle, power, tries, flight = null, done = false } = props;
  const c = useColors();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const hudFont = useFont(condensed600, 15);
  const subFont = useFont(condensed500, 13);
  const labelFont = useFont(condensed600, 13);

  const grid = useMemo(() => gridPaths(), []);
  const dead = useMemo(() => deadPaths(level.fixed), [level]);
  const trailPaths = useMemo(() => trails.map((t) => polyPath(t.path)), [trails]);
  const launcher = useMemo(() => launcherPath(L.x, L.y), []);

  const scale = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  const g = glassBox(level.glass);
  const last = trails[trails.length - 1];
  const deadEnd = last && !last.ok && !flight ? last.path[last.path.length - 1] : null;

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

  let ball: Vec = [L.x, L.y];
  if (flight) ball = flight.path[flight.idx];
  else if (done && last) ball = last.path[last.path.length - 1];

  const sel = selected != null ? pieces[selected] : null;
  const selEnds = sel ? pieceEnds(sel) : null;
  const selLabel = sel ? `${((-sel.deg % 180) + 180) % 180}°` : '';
  const selLabelW = labelFont && sel ? labelFont.measureText(selLabel).width : 0;

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {scale > 0 && (
        <Canvas style={{ width: W * scale, height: H * scale }}>
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

            {/* dead surfaces: board edge, ground, fixed obstacles */}
            <Rect x={1.5} y={1.5} width={W - 3} height={GROUND - 1.5} color={c.muted} style="stroke" strokeWidth={3} />
            <Path path={linePath(0, GROUND, W, GROUND)} color={c.muted} style="stroke" strokeWidth={4} strokeCap="round" />
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
                <Path key={i} path={linePath(x1, y1, x2, y2)} color={c.pencil} style="stroke" strokeWidth={6} strokeCap="round" />
              );
            })}
            {sel && selEnds && (
              <Group>
                <Path
                  path={linePath(selEnds[0], selEnds[1], selEnds[2], selEnds[3])}
                  color={c.pencil} style="stroke" strokeWidth={22} strokeCap="round" opacity={0.25}
                />
                <Circle cx={selEnds[2]} cy={selEnds[3]} r={11} color={c.paper} />
                <Circle cx={selEnds[2]} cy={selEnds[3]} r={11} color={c.pencil} style="stroke" strokeWidth={2.5} />
                <Path path={handleArcPath(selEnds[2], selEnds[3])} color={c.pencil} style="stroke" strokeWidth={2.5} strokeCap="round" />
                {labelFont && (
                  <Text x={sel.x - selLabelW / 2} y={sel.y - 16} text={selLabel} font={labelFont} color={c.pencil} />
                )}
              </Group>
            )}

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
            {flight && (
              <Path
                path={polyPath(flight.path, flight.idx + 1)}
                color={c.pencil} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" opacity={0.95}
              />
            )}

            {/* ball */}
            <Circle cx={ball[0]} cy={ball[1]} r={R} color={c.steel} />
            <Circle cx={ball[0]} cy={ball[1]} r={R} color={c.ink} style="stroke" strokeWidth={1.2} />
            <Circle cx={ball[0] - 2.6} cy={ball[1] - 2.6} r={2.4} color="rgba(255,255,255,0.75)" />

            {/* HUD */}
            {hudFont && (
              <Text x={12} y={24} text={`Try ${String(tries).padStart(2, '0')}`} font={hudFont} color={c.ink} />
            )}
            {subFont && (
              <Text x={12} y={42} text={`${angle.toFixed(1)}°   power ${power.toFixed(1)}`} font={subFont} color={c.muted} />
            )}
          </Group>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
