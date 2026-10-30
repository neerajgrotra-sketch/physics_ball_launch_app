import { Fragment, useMemo } from 'react';
import Svg, { Circle, Line, Polygon, Polyline, Rect } from 'react-native-svg';
import { BALL_RADIUS, PORTAL_RADIUS, blockCorners, hazardReach, glassBox, LAUNCHER, PLATE_OVERHANG, WORLD, buildWorld, pieceEnds, simulate, type Level } from '../../physics';
import { thin, type Shot } from '../../game/shots';
import { shotPieces } from '../../game/pieces';
import { gunShapes } from '../../game/guns';
import { skinFill } from '../../game/skins';
import { useColors } from '../../theme/colors';
import { useBallSkin } from '../settings/BallSkin';

/**
 * A small drawing of a level for the level list, drawn like the board: floor, launcher and glass, plus
 * the player's last winning shot if there is one (its bars and the ball's path, re-simulated from the
 * stored inputs). It shows the bottom of the board, cropped to the tile's shape, where the launcher and
 * glass are. SVG rather than Skia, so a screen of these stays cheap (each Skia canvas on the web is its
 * own GPU surface).
 */
export function ShotThumbnail({ level, shot, width, height }: { level: Level; shot?: Shot; width: number; height: number }) {
  const c = useColors();
  const { skin, gun } = useBallSkin();
  const path = useMemo(() => {
    if (!shot) return null;
    const res = simulate(buildWorld(level, shotPieces(level, shot)), shot.angle, shot.power);
    // One line per stretch between portals, so no line is drawn through one.
    const cuts = [0, ...res.jumps, res.path.length];
    return cuts.slice(0, -1).map((from, k) => thin(res.path.slice(from, cuts[k + 1]), 3)).filter((s) => s.length > 1);
  }, [level, shot]);
  const g = glassBox(level.glass);
  // The visible window: full board width, and as much height as the tile's shape allows, from the bottom.
  const viewH = Math.min(WORLD.height, (WORLD.width * height) / width);
  const top = WORLD.height - viewH;
  const lastStretch = path?.[path.length - 1];
  const ball = lastStretch ? lastStretch[lastStretch.length - 1] : [LAUNCHER.x, LAUNCHER.y];

  return (
    <Svg width={width} height={height} viewBox={`0 ${top} ${WORLD.width} ${viewH}`}>
      <Rect x={0} y={top} width={WORLD.width} height={viewH} fill={c.paper} />
      <Line x1={0} y1={WORLD.ground} x2={WORLD.width} y2={WORLD.ground} stroke={c.ink} strokeWidth={6} />
      {(level.hazards ?? []).map((h, i) => (
        <Polygon key={`hz${i}`} points={blockCorners(hazardReach(h)).map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ')} fill={c.red} />
      ))}
      {(level.portals ?? []).map((pr, i) => (
        <Fragment key={`portal${i}`}>
          <Circle cx={pr.a.x} cy={pr.a.y} r={PORTAL_RADIUS} fill="#14202e" stroke="#2f9bff" strokeWidth={5} />
          <Circle cx={pr.b.x} cy={pr.b.y} r={PORTAL_RADIUS} fill="#14202e" stroke="#ff7a1a" strokeWidth={5} />
        </Fragment>
      ))}
      {(level.pads ?? []).map((b, i) => (
        <Polygon key={`pad${i}`} points={blockCorners(b).map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ')} fill="#ffb020" stroke={c.ink} strokeWidth={4} />
      ))}
      {(level.blocks ?? []).map((b, i) => (
        <Polygon key={`blk${i}`} points={blockCorners(b).map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ')} fill={c.steel} stroke={c.ink} strokeWidth={4} />
      ))}
            {path?.map((stretch, k) => (
        <Polyline
          key={`s${k}`}
          points={stretch.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ')}
          fill="none" stroke={c.red} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85}
        />
      ))}
      {shot?.pieces.map((p, k) => {
        const [x1, y1, x2, y2] = pieceEnds(p);
        return <Line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.pencil} strokeWidth={12} strokeLinecap="round" />;
      })}
      {/* The glass: a faint fill, two walls and the plate. */}
      <Rect x={g.l} y={g.rim} width={g.r - g.l} height={g.base - g.rim} fill={c.red} opacity={0.12} />
      <Line x1={g.l} y1={g.rim} x2={g.l} y2={g.base} stroke={c.red} strokeWidth={6} />
      <Line x1={g.r} y1={g.rim} x2={g.r} y2={g.base} stroke={c.red} strokeWidth={6} />
      <Line x1={g.l - PLATE_OVERHANG} y1={g.base} x2={g.r + PLATE_OVERHANG} y2={g.base} stroke={c.red} strokeWidth={6} />
      {/* The launcher, as on the board: the player's gun (game/guns.ts) at the shot's angle. */}
      {gunShapes(gun, shot?.angle ?? 52, shot?.power ?? 45, c).map((s, i) => (
        s.kind === 'poly' ? (
          <Polygon key={`g${i}`} points={s.points.map((p) => p.join(',')).join(' ')} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} opacity={s.alpha} />
        ) : s.kind === 'line' ? (
          <Line key={`g${i}`} x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" opacity={s.alpha} />
        ) : (
          <Circle key={`g${i}`} cx={s.at[0]} cy={s.at[1]} r={s.r} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.width} opacity={s.alpha} />
        )
      ))}
      <Circle cx={ball[0]} cy={ball[1]} r={BALL_RADIUS + 1} fill={skinFill(skin, c.steel)} stroke={c.ink} strokeWidth={2} />
    </Svg>
  );
}
