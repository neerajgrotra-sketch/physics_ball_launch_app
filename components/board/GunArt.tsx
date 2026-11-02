import { BlurMask, Circle, Group, Path, type SkCanvas, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { gunShapes, type GunColors, type GunShape, type GunSkin } from '../../game/guns';
import { linePath, polygonPath } from './paths';

/**
 * The gun (game/guns.ts) for a Skia canvas, aimed at `angle` with `power`, in world units. Its paths are built only when the gun or
 * the aim changes (the board redraws on every finger movement; see Board.tsx `shape`).
 */
/**
 * `glow` (ASMR mode): a neon colour for a soft halo behind the gun and a crisp outline round each part, so its own colours (an iron
 * barrel, dark wheels) still read on a near-black board.
 */
export function GunArt({ gun, angle, power, c, glow }: { gun: GunSkin; angle: number; power: number; c: GunColors; glow?: string }) {
  const parts = useMemo(
    () => gunShapes(gun, angle, power, c).map((s) => ({ s, path: s.kind === 'poly' ? polygonPath(s.points) : s.kind === 'line' ? linePath(s.from[0], s.from[1], s.to[0], s.to[1]) : null })),
    [gun, angle, power, c.ink, c.muted, c.paper],
  );
  return (
    <Group>
      {glow && (
        <Group opacity={0.55}>
          {parts.map(({ s, path }, i) => s.kind === 'circle'
            ? <Circle key={`g${i}`} cx={s.at[0]} cy={s.at[1]} r={s.r + 2} color={glow}><BlurMask blur={5} style="normal" /></Circle>
            : <Path key={`g${i}`} path={path!} color={glow} style="stroke" strokeWidth={s.kind === 'line' ? s.width + 5 : 6} strokeCap="round" strokeJoin="round"><BlurMask blur={5} style="normal" /></Path>)}
        </Group>
      )}
      {parts.map(({ s, path }, i) => {
        if (s.kind === 'circle') {
          return (
            <Group key={i} opacity={s.alpha ?? 1}>
              {s.fill && <Circle cx={s.at[0]} cy={s.at[1]} r={s.r} color={s.fill} />}
              {s.stroke && <Circle cx={s.at[0]} cy={s.at[1]} r={s.r} color={s.stroke} style="stroke" strokeWidth={s.width ?? 1} />}
            </Group>
          );
        }
        if (s.kind === 'line') return <Path key={i} path={path!} color={s.color} style="stroke" strokeWidth={s.width} strokeCap="round" opacity={s.alpha ?? 1} />;
        return (
          <Group key={i} opacity={s.alpha ?? 1}>
            <Path path={path!} color={s.fill} />
            {s.stroke && <Path path={path!} color={s.stroke} style="stroke" strokeWidth={s.width ?? 1} strokeJoin="round" />}
          </Group>
        );
      })}
      {glow && parts.map(({ s, path }, i) => s.kind === 'circle'
        ? (s.fill || s.stroke) && (s.alpha ?? 1) > 0.5 ? <Circle key={`o${i}`} cx={s.at[0]} cy={s.at[1]} r={s.r} color={glow} style="stroke" strokeWidth={1.2} opacity={0.9} /> : null
        : s.kind === 'poly' ? <Path key={`o${i}`} path={path!} color={glow} style="stroke" strokeWidth={1.2} strokeJoin="round" opacity={0.9} /> : null)}
    </Group>
  );
}

/** The same gun drawn straight onto a canvas (the share poster, components/board/shareCard.ts). */
export function drawGun(cv: SkCanvas, shapes: GunShape[]) {
  const paint = (color: string, alpha = 1, width?: number) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(color));
    p.setAlphaf(alpha);
    if (width != null) { p.setStyle(1); p.setStrokeWidth(width); p.setStrokeCap(1); p.setStrokeJoin(1); }
    return p;
  };
  for (const s of shapes) {
    if (s.kind === 'circle') {
      if (s.fill) cv.drawCircle(s.at[0], s.at[1], s.r, paint(s.fill, s.alpha));
      if (s.stroke) cv.drawCircle(s.at[0], s.at[1], s.r, paint(s.stroke, s.alpha, s.width ?? 1));
    } else if (s.kind === 'line') {
      cv.drawPath(linePath(s.from[0], s.from[1], s.to[0], s.to[1]), paint(s.color, s.alpha, s.width));
    } else {
      const path = polygonPath(s.points);
      cv.drawPath(path, paint(s.fill, s.alpha));
      if (s.stroke) cv.drawPath(path, paint(s.stroke, s.alpha, s.width ?? 1));
    }
  }
}
