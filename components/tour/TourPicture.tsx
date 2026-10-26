import type { ReactNode } from 'react';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import type { TourPicture as Kind } from '../../game/tour';
import { FONTS, useColors, type Palette } from '../../theme/colors';

// The pictures in the guided tour, drawn in the board's own style (graph paper, the same cannon, bars, glass, spikes, pads and portals) so
// what the player sees here is exactly what they will meet. SVG in a 300 × 190 frame, scaled to the width given.

const W = 300, H = 190, FLOOR = 172;
const GOLD = '#ffb020', BLUE = '#2f9bff', ORANGE = '#ff7a1a';

export function TourPicture({ kind, width }: { kind: Kind; width: number }) {
  const c = useColors();
  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Paper c={c} />
      {kind === 'welcome' && <Welcome c={c} />}
      {kind === 'goal' && <Goal c={c} />}
      {kind === 'aim' && <Aim c={c} />}
      {kind === 'bars' && <Bars c={c} />}
      {kind === 'stars' && <Stars c={c} />}
      {kind === 'pieces' && <Pieces c={c} />}
      {kind === 'help' && <Help c={c} />}
      {kind === 'ready' && <Ready c={c} />}
    </Svg>
  );
}

function Paper({ c }: { c: Palette }) {
  const lines = [];
  for (let x = 10; x < W; x += 20) lines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={c.grid} strokeWidth={0.8} />);
  for (let y = 10; y < H; y += 20) lines.push(<Line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={c.grid} strokeWidth={0.8} />);
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H} fill={c.paper} />
      {lines}
    </G>
  );
}

const label = (c: Palette, x: number, y: number, text: string, color = c.ink, size = 11, anchor: 'start' | 'middle' | 'end' = 'middle') => (
  <SvgText x={x} y={y} fill={color} fontSize={size} fontFamily={FONTS.condensedBold} textAnchor={anchor}>{text}</SvgText>
);

function Floor({ c }: { c: Palette }) {
  return <Line x1={0} y1={FLOOR} x2={W} y2={FLOOR} stroke={c.ink} strokeWidth={3} />;
}

function Cannon({ c, x = 30, deg = 52 }: { c: Palette; x?: number; deg?: number }) {
  const a = (deg * Math.PI) / 180;
  return (
    <G>
      <Polygon points={`${x - 11},${FLOOR} ${x + 11},${FLOOR} ${x + 3},${FLOOR - 18} ${x - 3},${FLOOR - 18}`} fill={c.muted} />
      <Line x1={x} y1={FLOOR - 18} x2={x + Math.cos(a) * 20} y2={FLOOR - 18 - Math.sin(a) * 20} stroke={c.ink} strokeWidth={5} strokeLinecap="round" />
    </G>
  );
}

function Ball({ c, x, y }: { c: Palette; x: number; y: number }) {
  return <Circle cx={x} cy={y} r={6} fill={c.steel} stroke={c.ink} strokeWidth={1.4} />;
}

function Bar({ x1, y1, x2, y2, color, n, c }: { x1: number; y1: number; x2: number; y2: number; color: string; n?: string; c: Palette }) {
  return (
    <G>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={5} strokeLinecap="round" />
      {n && label(c, (x1 + x2) / 2, Math.min(y1, y2) - 6, n, c.pencil, 10)}
    </G>
  );
}

function Glass({ c, x, w = 30, h = 34, base = FLOOR }: { c: Palette; x: number; w?: number; h?: number; base?: number }) {
  const l = x - w / 2, r = x + w / 2;
  return (
    <G>
      <Rect x={l} y={base - h} width={w} height={h} fill={c.red} opacity={0.12} />
      <Line x1={l} y1={base - h} x2={l} y2={base} stroke={c.red} strokeWidth={3} />
      <Line x1={r} y1={base - h} x2={r} y2={base} stroke={c.red} strokeWidth={3} />
      <Line x1={l - 6} y1={base} x2={r + 6} y2={base} stroke={c.red} strokeWidth={3} />
    </G>
  );
}

/** A dotted shot path through the given points (a smooth-ish polyline). */
function Trail({ pts, color }: { pts: [number, number][]; color: string }) {
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return <Path d={d} stroke={color} strokeWidth={2} strokeDasharray="3 5" strokeLinecap="round" fill="none" />;
}

function arc(x0: number, y0: number, x1: number, y1: number, peak: number, n = 14): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - peak * 4 * t * (1 - t)] as [number, number];
  });
}

function Welcome({ c }: { c: Palette }) {
  return (
    <G>
      <Floor c={c} />
      <Cannon c={c} />
      <Bar x1={120} y1={46} x2={180} y2={46} color={c.pencil} c={c} />
      <Trail pts={[...arc(42, 150, 150, 52, 30, 10), ...arc(150, 52, 248, 150, 12, 10).slice(1)]} color={c.red} />
      <Glass c={c} x={250} />
      <Ball c={c} x={250} y={162} />
      {[[262, 120], [236, 116], [270, 140], [228, 138]].map(([x, y], k) => <Circle key={k} cx={x} cy={y} r={2.5} fill={k % 2 ? GOLD : c.red} />)}
    </G>
  );
}

function Goal({ c }: { c: Palette }) {
  return (
    <G>
      <Floor c={c} />
      <Cannon c={c} deg={65} />
      <Bar x1={88} y1={48} x2={130} y2={34} color={c.pencil} n="1" c={c} />
      <Bar x1={188} y1={70} x2={226} y2={98} color={c.pencil} n="2" c={c} />
      <Trail pts={[[40, 150], [62, 100], [84, 66], [108, 42], [140, 46], [170, 58], [206, 82], [232, 112], [254, 150]]} color={c.red} />
      <Glass c={c} x={256} />
      <Ball c={c} x={256} y={162} />
    </G>
  );
}

function Aim({ c }: { c: Palette }) {
  const x = 70, y = FLOOR - 18, deg = 40, a = (deg * Math.PI) / 180;
  const tip = [x + Math.cos(a) * 120, y - Math.sin(a) * 120];
  return (
    <G>
      <Floor c={c} />
      <Cannon c={c} x={x} deg={deg} />
      {Array.from({ length: 9 }, (_, i) => {
        const d = 26 + i * 12;
        return <Circle key={i} cx={x + Math.cos(a) * d} cy={y - Math.sin(a) * d + i * i * 0.5} r={2} fill={c.ink} opacity={1 - i * 0.08} />;
      })}
      {/* the angle, measured up from the floor */}
      <Path d={`M ${x + 46} ${y} A 46 46 0 0 0 ${x + Math.cos(a) * 46} ${y - Math.sin(a) * 46}`} stroke={c.pencil} strokeWidth={2} fill="none" />
      {label(c, x + 62, y - 12, 'ANGLE', c.pencil, 12, 'start')}
      {/* the drag: a finger out along the line, the distance is the power */}
      <Line x1={x + Math.cos(a) * 30} y1={y - Math.sin(a) * 30 - 16} x2={tip[0]} y2={tip[1] - 16} stroke={c.red} strokeWidth={2} />
      <Polygon points={`${tip[0]},${tip[1] - 16} ${tip[0] - 10},${tip[1] - 11} ${tip[0] - 6},${tip[1] - 21}`} fill={c.red} />
      {label(c, tip[0] - 46, tip[1] - 30, 'DRAG = POWER', c.red, 12)}
      <Circle cx={tip[0] + 12} cy={tip[1] - 6} r={9} fill={c.red} opacity={0.2} stroke={c.red} strokeWidth={1.5} />
    </G>
  );
}

function Bars({ c }: { c: Palette }) {
  const cx = 130, cy = 100;
  return (
    <G>
      <Floor c={c} />
      <Rect x={cx - 52} y={cy - 9} width={104} height={18} rx={9} fill={c.pencil} opacity={0.18} />
      <Bar x1={cx - 45} y1={cy} x2={cx + 45} y2={cy} color={c.pencil} c={c} />
      {/* rotate lever */}
      {[1, 2, 3, 4].map((i) => <Circle key={i} cx={cx + 45 + i * 9} cy={cy} r={1.8} fill={c.pencil} />)}
      <Circle cx={cx + 92} cy={cy} r={9} fill={c.paper} stroke={c.pencil} strokeWidth={2} />
      <Path d={`M ${cx + 88} ${cy - 3} A 4.5 4.5 0 1 1 ${cx + 89} ${cy + 3}`} stroke={c.pencil} strokeWidth={1.8} fill="none" />
      {label(c, cx + 92, cy - 16, 'TURN', c.pencil, 11)}
      {/* move arms */}
      {[1, 2, 3].map((i) => <Circle key={`y${i}`} cx={cx} cy={cy - i * 11} r={1.8} fill={c.pencil} />)}
      <Circle cx={cx} cy={cy - 46} r={9} fill={c.paper} stroke={c.pencil} strokeWidth={2} />
      <Path d={`M ${cx} ${cy - 51} L ${cx} ${cy - 41} M ${cx - 3} ${cy - 48} L ${cx} ${cy - 51} L ${cx + 3} ${cy - 48} M ${cx - 3} ${cy - 44} L ${cx} ${cy - 41} L ${cx + 3} ${cy - 44}`} stroke={c.pencil} strokeWidth={1.5} fill="none" />
      {[1, 2, 3].map((i) => <Circle key={`x${i}`} cx={cx - 45 - i * 9} cy={cy} r={1.8} fill={c.pencil} />)}
      <Circle cx={cx - 92} cy={cy} r={9} fill={c.paper} stroke={c.pencil} strokeWidth={2} />
      <Path d={`M ${cx - 97} ${cy} L ${cx - 87} ${cy} M ${cx - 94} ${cy - 3} L ${cx - 97} ${cy} L ${cx - 94} ${cy + 3} M ${cx - 90} ${cy - 3} L ${cx - 87} ${cy} L ${cx - 90} ${cy + 3}`} stroke={c.pencil} strokeWidth={1.5} fill="none" />
      {label(c, cx - 92, cy + 24, 'SLIDE', c.pencil, 11)}
      {label(c, cx + 22, cy - 42, 'SLIDE', c.pencil, 11, 'start')}
      {/* the tray chips */}
      {['Bar 1', 'Bar 2'].map((t, k) => (
        <G key={t}>
          <Rect x={168 + k * 62} y={142} width={56} height={22} rx={11} fill={k === 0 ? c.pencil : c.paper} stroke={c.pencil} strokeWidth={1.5} />
          {label(c, 196 + k * 62, 157, t, k === 0 ? c.paper : c.pencil, 11)}
        </G>
      ))}
      {label(c, 230, 136, 'TAP TO PLACE', c.muted, 10)}
    </G>
  );
}

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
  }).join(' ');
  return <Polygon points={pts} fill={fill} />;
}

function Stars({ c }: { c: Palette }) {
  return (
    <G>
      <Star x={100} y={70} r={26} fill={c.red} />
      <Star x={150} y={60} r={32} fill={c.red} />
      <Star x={200} y={70} r={26} fill={c.red} />
      <Rect x={95} y={112} width={110} height={44} rx={10} fill={c.paper} stroke={c.line} strokeWidth={1.5} />
      {label(c, 122, 145, '3', c.ink, 30)}
      {label(c, 168, 131, 'bounces', c.muted, 12)}
      {label(c, 168, 147, 'par 3', c.muted, 12)}
    </G>
  );
}

function Pieces({ c }: { c: Palette }) {
  const tile = (x: number, title: string, art: ReactNode) => (
    <G key={title}>
      <Rect x={x} y={20} width={66} height={120} rx={10} fill={c.paper} stroke={c.line} strokeWidth={1.5} />
      {art}
      {label(c, x + 33, 160, title, c.ink, 12)}
    </G>
  );
  const spikes = Array.from({ length: 5 }, (_, i) => `M ${86 + i * 10} 76 L ${91 + i * 10} 66 L ${96 + i * 10} 76 Z M ${86 + i * 10} 92 L ${91 + i * 10} 102 L ${96 + i * 10} 92 Z`).join(' ');
  return (
    <G>
      {tile(6, 'BLOCKS', <Rect x={22} y={44} width={34} height={70} fill={c.steel} stroke={c.ink} strokeWidth={2} />)}
      {tile(80, 'SPIKES', (
        <G>
          <Rect x={86} y={76} width={54} height={16} fill={c.red} />
          <Path d={spikes} fill={c.red} />
        </G>
      ))}
      {tile(154, 'SPRINGS', (
        <G>
          <Rect x={162} y={100} width={50} height={10} fill={GOLD} stroke={c.ink} strokeWidth={1.5} />
          <Path d="M 187 90 L 187 52 M 180 60 L 187 52 L 194 60" stroke={GOLD} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Line x1={166} y1={70} x2={206} y2={70} stroke={c.ink} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
          <Line x1={166} y1={70} x2={206} y2={70} stroke={GOLD} strokeWidth={3} strokeLinecap="round" />
        </G>
      ))}
      {tile(228, 'PORTALS', (
        <G>
          <Circle cx={248} cy={56} r={11} fill="#14202e" stroke={BLUE} strokeWidth={3.5} />
          <Circle cx={274} cy={108} r={11} fill="#14202e" stroke={ORANGE} strokeWidth={3.5} />
          <Path d="M 254 68 Q 266 84 268 96" stroke={c.muted} strokeWidth={1.6} strokeDasharray="3 4" fill="none" />
        </G>
      ))}
    </G>
  );
}

function Help({ c }: { c: Palette }) {
  return (
    <G>
      <Floor c={c} />
      <Cannon c={c} />
      <Glass c={c} x={250} />
      {/* the hint: the next bar appears where the answer puts it */}
      <Line x1={120} y1={60} x2={176} y2={44} stroke={c.pencil} strokeWidth={7} strokeLinecap="round" strokeDasharray="8 6" opacity={0.5} />
      {label(c, 148, 34, 'HINT', c.pencil, 12)}
      <Rect x={20} y={20} width={70} height={30} rx={15} fill={c.paper} stroke={c.line} strokeWidth={1.5} />
      {label(c, 55, 40, 'Solve', c.muted, 14)}
      <Path d="M 92 36 Q 106 38 114 52" stroke={c.red} strokeWidth={2} fill="none" />
      <Polygon points="114,52 108,47 117,45" fill={c.red} />
      <Rect x={190} y={20} width={84} height={30} rx={15} fill={c.red} />
      {label(c, 232, 40, 'Replay ▶', '#ffffff', 13)}
    </G>
  );
}

function Ready({ c }: { c: Palette }) {
  return (
    <G>
      <Floor c={c} />
      <Cannon c={c} />
      <Glass c={c} x={250} />
      {/* the guide: a dashed outline where the bar goes, and the hand showing it */}
      <Line x1={118} y1={68} x2={178} y2={68} stroke={c.red} strokeWidth={8} strokeLinecap="round" strokeDasharray="9 7" opacity={0.85} />
      <Line x1={70} y1={120} x2={130} y2={120} stroke={c.pencil} strokeWidth={5} strokeLinecap="round" />
      <Path d="M 104 120 Q 120 92 140 76" stroke={c.muted} strokeWidth={1.6} strokeDasharray="3 4" fill="none" />
      <Circle cx={160} cy={92} r={12} fill={c.ink} opacity={0.12} />
      {label(c, 168, 112, '☝', c.ink, 22)}
      {label(c, 236, 70, 'STEP BY STEP', c.red, 12)}
    </G>
  );
}
