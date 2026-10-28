import { Circle, Group, Path, type SkCanvas, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { gunShapes, type GunColors, type GunShape, type GunSkin } from '../../game/guns';
import { linePath, polygonPath } from './paths';

/**
 * The gun (game/guns.ts) for a Skia canvas, aimed at `angle` with `power`, in world units. Its paths are built only when the gun or
 * the aim changes (the board redraws on every finger movement; see Board.tsx `shape`).
 */
export function GunArt({ gun, angle, power, c }: { gun: GunSkin; angle: number; power: number; c: GunColors }) {
  const parts = useMemo(
    () => gunShapes(gun, angle, power, c).map((s) => ({ s, path: s.kind === 'poly' ? polygonPath(s.points) : s.kind === 'line' ? linePath(s.from[0], s.from[1], s.to[0], s.to[1]) : null })),
    [gun, angle, power, c.ink, c.muted, c.paper],
  );
  return (
    <Group>
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
