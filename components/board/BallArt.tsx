import { BlurMask, Circle, Group, Path, RadialGradient, Skia, SweepGradient, vec, type SkPath, type Transforms3d } from '@shopify/react-native-skia';
import type { DerivedValue, SharedValue } from 'react-native-reanimated';
import { BALL_RADIUS } from '../../physics';
import { shade, skinFill, type BallSkin, type Pattern } from '../../game/skins';
import type { Palette } from '../../theme/colors';

// The ball, drawn in a skin (game/skins.ts) around (0, 0) in world units, for the board's Skia canvas. `spun` places and turns the
// design (it rolls as it flies); `at` only places, for the light glint that stays put on top. Everything stays inside the ball's
// radius except a neon glow and a planet's ring, which only reach a few units past it.

const R = BALL_RADIUS;
type Transform = Transforms3d | SharedValue<Transforms3d> | DerivedValue<Transforms3d>;

export function BallArt({ skin, c, at, spun }: { skin: BallSkin; c: Palette; at: Transform; spun: Transform }) {
  const fill = skinFill(skin, c.steel);
  const p = patternPaths(skin.pattern);
  const round = skin.pattern !== 'star' && skin.pattern !== 'cube';
  return (
    <Group>
      {skin.finish === 'neon' && (
        <Group transform={at}>
          <Circle cx={0} cy={0} r={R + 3} color={fill} opacity={0.55}>
            <BlurMask blur={4} style="normal" />
          </Circle>
        </Group>
      )}
      <Group transform={spun}>
        {round && <Body skin={skin} fill={fill} c={c} />}
        <Decor pattern={skin.pattern} paths={p} fill={fill} c={c} />
      </Group>
      {skin.finish !== 'neon' && (
        <Group transform={at}>
          <Circle cx={-2.6} cy={-2.6} r={skin.finish === 'glass' ? 2 : 2.4} color="rgba(255,255,255,0.75)" />
        </Group>
      )}
    </Group>
  );
}

/** The round body in its finish, with the ink outline every ball has. */
function Body({ skin, fill, c }: { skin: BallSkin; fill: string; c: Palette }) {
  const edge = <Circle cx={0} cy={0} r={R} color={c.ink} style="stroke" strokeWidth={1.2} />;
  switch (skin.finish) {
    case 'metal':
      return (
        <Group>
          <Circle cx={0} cy={0} r={R}>
            <RadialGradient c={vec(-2.6, -2.6)} r={R * 1.7} colors={[shade(fill, 0.65), fill, shade(fill, -0.45)]} positions={[0, 0.45, 1]} />
          </Circle>
          {edge}
        </Group>
      );
    case 'glass':
      return (
        <Group>
          <Circle cx={0} cy={0} r={R} color={fill} opacity={0.35} />
          <Circle cx={0} cy={0} r={R - 2.4} color={fill} style="stroke" strokeWidth={1.2} opacity={0.8} />
          {edge}
        </Group>
      );
    case 'neon':
      return (
        <Group>
          <Circle cx={0} cy={0} r={R} color={fill} />
          <Circle cx={0} cy={0} r={R - 3} color="#ffffff" opacity={0.7} />
        </Group>
      );
    case 'rainbow':
      return (
        <Group>
          <Circle cx={0} cy={0} r={R}>
            <SweepGradient c={vec(0, 0)} colors={['#ff4d4d', '#ffb84d', '#fff04d', '#4dff88', '#4dc3ff', '#9b6bff', '#ff4dd2', '#ff4d4d']} />
          </Circle>
          {edge}
        </Group>
      );
    default:
      return (
        <Group>
          <Circle cx={0} cy={0} r={R} color={fill} />
          {edge}
        </Group>
      );
  }
}

/** What a design draws on the ball (or, for the star and the cube, instead of it). */
function Decor({ pattern, paths, fill, c }: { pattern: Pattern; paths: SkPath[]; fill: string; c: Palette }) {
  switch (pattern) {
    case 'beach': {
      const colours = [fill, '#ffffff', '#2f7ff0', '#ffffff', '#ffd23f', '#ffffff'];
      return (
        <Group>
          {paths.map((w, i) => <Path key={i} path={w} color={colours[i]} />)}
          <Circle cx={0} cy={0} r={1.6} color="#ffffff" />
          <Circle cx={0} cy={0} r={R} color={c.ink} style="stroke" strokeWidth={1.2} />
        </Group>
      );
    }
    case 'eight':
      return (
        <Group>
          <Circle cx={0} cy={0} r={3.9} color="#ffffff" />
          <Path path={paths[0]} color="#16181a" style="stroke" strokeWidth={0.9} />
        </Group>
      );
    case 'smiley':
      return (
        <Group>
          <Circle cx={-2.6} cy={-1.8} r={1.1} color="#2b2b2b" />
          <Circle cx={2.6} cy={-1.8} r={1.1} color="#2b2b2b" />
          <Path path={paths[0]} color="#2b2b2b" style="stroke" strokeWidth={1.2} strokeCap="round" />
        </Group>
      );
    case 'planet':
      return (
        <Group>
          <Path path={paths[0]} color="#56c46b" />
          <Path path={paths[1]} color="#f0c673" style="stroke" strokeWidth={1.6} />
        </Group>
      );
    case 'basket':
      return <Path path={paths[0]} color="#3a2414" style="stroke" strokeWidth={0.9} />;
    case 'star':
      return (
        <Group>
          <Path path={paths[0]} color={fill} />
          <Path path={paths[0]} color={c.ink} style="stroke" strokeWidth={1.1} strokeJoin="round" />
        </Group>
      );
    case 'cube':
      return (
        <Group>
          <Path path={paths[0]} color={fill} />
          <Path path={paths[1]} color={shade(fill, 0.35)} />
          <Path path={paths[0]} color={c.ink} style="stroke" strokeWidth={1.1} strokeJoin="round" />
        </Group>
      );
    default:
      return null;
  }
}

// Each design's paths, built once (Skia must be loaded first, so not at import time).
const cache = new Map<Pattern, SkPath[]>();
function patternPaths(pattern: Pattern): SkPath[] {
  const hit = cache.get(pattern);
  if (hit) return hit;
  const paths = buildPaths(pattern);
  cache.set(pattern, paths);
  return paths;
}

function buildPaths(pattern: Pattern): SkPath[] {
  const B = () => Skia.PathBuilder.Make();
  const oval = { x: -R, y: -R, width: 2 * R, height: 2 * R };
  switch (pattern) {
    case 'beach':
      // Six wedges round the ball, each its own colour.
      return Array.from({ length: 6 }, (_, i) => {
        const p = B();
        p.moveTo(0, 0);
        p.arcToOval(oval, i * 60 - 90, 60, false);
        p.close();
        return p.detach();
      });
    case 'eight': {
      const p = B();
      p.addCircle(0, -1.15, 1.05);
      p.addCircle(0, 1.25, 1.3);
      return [p.detach()];
    }
    case 'smiley': {
      const p = B();
      p.addArc({ x: -4, y: -3.2, width: 8, height: 8 }, 25, 130);
      return [p.detach()];
    }
    case 'planet': {
      const land = B();
      land.addOval({ x: -5.5, y: -4.5, width: 6, height: 4 });
      land.addOval({ x: 0.5, y: 0.5, width: 5, height: 4.5 });
      const ring = B();
      ring.addOval({ x: -R - 3, y: -2.4, width: 2 * R + 6, height: 4.8 });
      const m = Skia.Matrix();
      m.rotate(-0.35);
      ring.transform(m);
      return [land.detach(), ring.detach()];
    }
    case 'basket': {
      const p = B();
      p.moveTo(0, -R); p.lineTo(0, R);
      p.moveTo(-R, 0); p.lineTo(R, 0);
      p.addArc({ x: -R - 6, y: -R, width: 2 * R, height: 2 * R }, -55, 110);
      p.addArc({ x: 6 - R, y: -R, width: 2 * R, height: 2 * R }, 125, 110);
      return [p.detach()];
    }
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.48 : R + 1.5;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r };
      });
      const p = B();
      p.addPoly(pts, true);
      return [p.detach()];
    }
    case 'cube': {
      const s = R * 0.82;
      const face = B();
      face.addRRect({ rect: { x: -s, y: -s, width: 2 * s, height: 2 * s }, rx: 2, ry: 2 });
      const shine = B();
      shine.addPoly([{ x: -s + 1.5, y: -s + 1.5 }, { x: s - 1.5, y: -s + 1.5 }, { x: -s + 1.5, y: s - 1.5 }], true);
      return [face.detach(), shine.detach()];
    }
    default:
      return [];
  }
}
