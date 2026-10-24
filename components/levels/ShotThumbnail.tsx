import { useMemo } from 'react';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { glassBox, LAUNCHER, PLATE_OVERHANG, WORLD, buildWorld, pieceEnds, simulate, type Level } from '../../physics';
import { thin, type Shot } from '../../game/shots';
import { useColors } from '../../theme/colors';

/** The top of the board, where little happens, is cropped so the drawing fills a squarer tile. */
const VIEW_TOP = 100;

/**
 * A small drawing of a level for the level list: the glass and launcher, plus the player's last winning
 * shot if there is one (its bars and the ball's path, re-simulated from the stored inputs). SVG rather
 * than Skia, so a screen full of these stays cheap (each Skia canvas on the web is its own GPU surface).
 */
export function ShotThumbnail({ level, shot, width, height }: { level: Level; shot?: Shot; width: number; height: number }) {
  const c = useColors();
  const path = useMemo(() => {
    if (!shot) return null;
    const res = simulate(buildWorld(level, shot.pieces), shot.angle, shot.power);
    return thin(res.path, 3).map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ');
  }, [level, shot]);
  const g = glassBox(level.glass);
  const end = shot && path ? path.split(' ').pop()!.split(',').map(Number) : null;

  return (
    <Svg width={width} height={height} viewBox={`0 ${VIEW_TOP} ${WORLD.width} ${WORLD.height - VIEW_TOP}`} preserveAspectRatio="xMidYMid slice">
      <Rect x={0} y={0} width={WORLD.width} height={WORLD.ground} fill={c.paper} />
      <Line x1={0} y1={WORLD.ground} x2={WORLD.width} y2={WORLD.ground} stroke={c.ink} strokeWidth={6} />
      {path && <Polyline points={path} fill="none" stroke={c.red} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />}
      {shot?.pieces.map((p, k) => {
        const [x1, y1, x2, y2] = pieceEnds(p);
        return <Line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.pencil} strokeWidth={12} strokeLinecap="round" />;
      })}
      <Line x1={g.l} y1={g.rim} x2={g.l} y2={g.base} stroke={c.red} strokeWidth={7} />
      <Line x1={g.r} y1={g.rim} x2={g.r} y2={g.base} stroke={c.red} strokeWidth={7} />
      <Line x1={g.l - PLATE_OVERHANG} y1={g.base} x2={g.r + PLATE_OVERHANG} y2={g.base} stroke={c.red} strokeWidth={7} />
      <Circle cx={LAUNCHER.x} cy={LAUNCHER.y} r={14} fill={c.muted} />
      {end && <Circle cx={end[0]} cy={end[1]} r={11} fill={c.steel} stroke={c.ink} strokeWidth={3} />}
    </Svg>
  );
}
