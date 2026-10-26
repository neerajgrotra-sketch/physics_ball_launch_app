import type { ReactNode } from 'react';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { TourPicture as Kind } from '../../game/tour';
import { TOUR_VIEW } from '../../game/tour';
import { FONTS, useColors, type Palette } from '../../theme/colors';
import { TourScene } from './TourScene';

// The pictures in the guided tour. Every page but one is a live scene on the real board (TourScene: real shots, sounds and a ghost
// finger). The pieces page is a still drawing of the four worlds' pieces in the board's colours, in a frame the same shape as a scene.

const W = 300, H = (300 * TOUR_VIEW.height) / TOUR_VIEW.width;
const GOLD = '#ffb020', BLUE = '#2f9bff', ORANGE = '#ff7a1a';

export function TourPicture({ kind, width }: { kind: Kind; width: number }) {
  const c = useColors();
  if (kind !== 'pieces') return <TourScene key={kind} kind={kind} width={width} />;
  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Paper c={c} />
      <G transform={`translate(0 ${(H - 180) / 2})`}>
        <Pieces c={c} />
      </G>
    </Svg>
  );
}

function Paper({ c }: { c: Palette }) {
  const lines = [];
  for (let x = 15; x < W; x += 15) lines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={c.grid} strokeWidth={0.6} />);
  for (let y = 15; y < H; y += 15) lines.push(<Line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={c.grid} strokeWidth={0.6} />);
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H} fill={c.paper} />
      {lines}
    </G>
  );
}

const label = (c: Palette, x: number, y: number, text: string, color = c.ink, size = 11) => (
  <SvgText x={x} y={y} fill={color} fontSize={size} fontFamily={FONTS.condensedBold} textAnchor="middle">{text}</SvgText>
);

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
