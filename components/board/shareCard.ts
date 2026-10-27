import { Skia, type SkCanvas, type SkFont, type SkPaint, type SkPath } from '@shopify/react-native-skia';
import {
  BALL_RADIUS, LAUNCHER, PORTAL_RADIUS, SPIKE_LENGTH, WORLD, blockCorners, glassBox, pieceEnds, type Level, type PlacedPiece, type Vec,
} from '../../physics';
import type { Palette } from '../../theme/colors';
import { blockPath, deadPaths, gridPaths, hazardPaths, launcherPath, linePath, polyPath } from './paths';

/**
 * What the shared picture says (game/share.ts shareCard): the title ("LEVEL 3 COMPLETE!"), the stars (null: won with help), the
 * result line, the stamp's word ("BIRDIE!") and the dare at the bottom ("CAN YOU BEAT 3 BOUNCES?").
 */
export interface ShareCard { title: string; stars: number | null; line: string; stamp: string; dare: string }

/** The shots to draw: every trail of the round, the winning one marked `ok`. */
export interface ShareTrail { path: Vec[]; ok: boolean; jumps?: number[] }

// A 4:5 poster, the shape chat apps and Instagram show biggest.
const CW = 1080, CH = 1350;
const BOARD = { x: 40, y: 250, w: 1000, h: 880 };

function star(cx: number, cy: number, r: number): SkPath {
  const p = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r * 0.45 : r;
    if (i) p.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); else p.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
  p.close();
  return p.detach();
}

/**
 * The part of the board the round happened in, padded, at the board frame's shape: the shots, the bars, the glass and the gun.
 * Zooming in on it is what keeps the picture from being mostly empty sky.
 */
function cropFor(level: Level, pieces: PlacedPiece[], trails: ShareTrail[]) {
  const g = glassBox(level.glass);
  let x0 = Math.min(LAUNCHER.x - 30, g.l - 20), x1 = Math.max(LAUNCHER.x + 30, g.r + 20);
  let y0 = Math.min(LAUNCHER.y - 30, g.rim - 20), y1 = WORLD.ground + 12;
  const take = (x: number, y: number) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const t of trails) for (const [x, y] of t.path) take(x, y);
  for (const p of pieces) { const [a, b, c, d] = pieceEnds(p); take(a, b); take(c, d); }
  const pad = 26;
  x0 -= pad; x1 += pad; y0 -= pad;
  // Grow the short side to the frame's shape (never smaller than a quarter of the board across), then keep it on the board.
  const aspect = BOARD.w / BOARD.h;
  let w = Math.max(x1 - x0, 160), h = Math.max(y1 - y0, 160 / aspect);
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  w = Math.min(w, WORLD.width); h = Math.min(h, WORLD.height);
  if (w / h < aspect) h = w / aspect; else w = h * aspect;
  const cx = (x0 + x1) / 2;
  const x = Math.max(0, Math.min(WORLD.width - w, cx - w / 2));
  const y = Math.max(0, Math.min(WORLD.height - h, y1 - h)); // keep the floor in, grow upwards
  return { x, y, w, h };
}

/** Where the winning shot turned sharply (a bounce): small rings there make the route read at a glance. */
function bounceSpots(path: Vec[]): Vec[] {
  const out: Vec[] = [];
  for (let i = 3; i < path.length - 3; i++) {
    const [ax, ay] = path[i - 3], [bx, by] = path[i], [cx, cy] = path[i + 3];
    const u = Math.atan2(by - ay, bx - ax), v = Math.atan2(cy - by, cx - bx);
    let turn = Math.abs(u - v);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if (turn > 0.6 && Math.hypot(cx - ax, cy - ay) > 2 && out.every(([x, y]) => Math.hypot(x - bx, y - by) > 14)) out.push([bx, by]);
  }
  return out;
}

/**
 * The picture a win shares: a poster in the game's blueprint blue with the title and stars on top, the round's shots on graph
 * paper zoomed in on where they happened (winner in bold red, misses in blue, rings where it bounced), a rubber stamp with the
 * result across it, and a dare along the bottom. Drawn from the level and the shots (not a screenshot), on a CPU surface, so it
 * looks the same on the web and on phones. Returns a base64 PNG.
 */
export function composeShareCard(
  level: Level, pieces: PlacedPiece[], trails: ShareTrail[], card: ShareCard, bold: SkFont, medium: SkFont, c: Palette,
): string | null {
  const surface = Skia.Surface.Make(CW, CH);
  if (!surface) return null;
  const cv = surface.getCanvas();
  const fill = (color: string, alpha = 1) => { const p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color)); p.setAlphaf(alpha); return p; };
  const stroke = (color: string, width: number, alpha = 1) => {
    const p = fill(color, alpha);
    p.setStyle(1); // stroke
    p.setStrokeWidth(width);
    p.setStrokeCap(1); // round
    p.setStrokeJoin(1); // round
    return p;
  };
  // The board's own fonts, resized for each line and put back after (a new font from their typeface fails on the web). Long text
  // shrinks to fit rather than run off the picture.
  const sizes = [bold.getSize(), medium.getSize()];
  const text = (cvs: SkCanvas, s: string, x: number, y: number, f: SkFont, size: number, paint: SkPaint, room: number, align: 'centre' | 'left' = 'centre') => {
    f.setSize(size);
    const tw = f.measureText(s).width;
    if (tw > room) f.setSize(size * (room / tw));
    const w = f.measureText(s).width;
    cvs.drawText(s, align === 'centre' ? x - w / 2 : x, y, paint, f);
  };

  // Poster ground and header.
  cv.drawColor(Skia.Color(c.pencil));
  text(cv, 'B A N K   S H O T', CW / 2, 64, medium, 30, fill(c.paper, 0.8), 900);
  text(cv, card.title, CW / 2, 150, bold, 92, fill(c.paper), 1000);
  text(cv, card.line, CW / 2, 216, medium, 38, fill(c.paper, 0.85), 1000);

  // The board: graph paper, zoomed to where the round happened.
  const crop = cropFor(level, pieces, trails);
  const k = BOARD.w / crop.w;
  const frame = Skia.RRectXY(Skia.XYWHRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h), 28, 28);
  cv.drawRRect(Skia.RRectXY(Skia.XYWHRect(BOARD.x + 6, BOARD.y + 12, BOARD.w, BOARD.h), 28, 28), fill('#000000', 0.18)); // shadow
  cv.save();
  cv.clipRRect(frame, 1, true);
  cv.drawColor(Skia.Color(c.paper));
  cv.translate(BOARD.x, BOARD.y);
  cv.scale(k, k);
  cv.translate(-crop.x, -crop.y);
  const grid = gridPaths();
  cv.drawPath(grid.fine, stroke(c.grid, 0.6));
  cv.drawPath(grid.major, stroke(c.grid, 1.1));
  // Shots first (under the pieces, as on the board): misses in blue, the winner bold red on top.
  const shots = [...trails].sort((a, b) => Number(a.ok) - Number(b.ok));
  for (const t of shots) cv.drawPath(polyPath(t.path, t.path.length, t.jumps ?? []), t.ok ? stroke(c.red, 3) : stroke(c.pencil, 2, 0.45));
  cv.drawPath(linePath(0, WORLD.ground, WORLD.width, WORLD.ground), stroke(c.ink, 4));
  for (const h of level.hazards ?? []) { const hp = hazardPaths(blockCorners(h), SPIKE_LENGTH); cv.drawPath(hp.body, fill(c.red)); cv.drawPath(hp.spikes, fill(c.red)); }
  for (const b of level.blocks ?? []) { const bp = blockPath(blockCorners(b)); cv.drawPath(bp, fill(c.steel)); cv.drawPath(bp, stroke(c.ink, 2.5)); }
  for (const b of level.pads ?? []) { const bp = blockPath(blockCorners(b)); cv.drawPath(bp, fill('#ffb020', 0.92)); cv.drawPath(bp, stroke(c.ink, 2.5)); }
  const dead = deadPaths(level.fixed);
  cv.drawPath(dead.bars, stroke(c.muted, 6));
  for (const pr of level.portals ?? []) {
    cv.drawCircle(pr.a.x, pr.a.y, PORTAL_RADIUS, stroke('#2f9bff', 3));
    cv.drawCircle(pr.b.x, pr.b.y, PORTAL_RADIUS, stroke('#ff7a1a', 3));
  }
  const g = glassBox(level.glass);
  cv.drawRect(Skia.XYWHRect(g.l, g.rim, g.r - g.l, g.base - g.rim), fill(c.red, 0.12));
  cv.drawPath(linePath(g.l, g.rim, g.l, g.base), stroke(c.red, 3));
  cv.drawPath(linePath(g.r, g.rim, g.r, g.base), stroke(c.red, 3));
  cv.drawPath(linePath(g.l - 8, g.base, g.r + 8, g.base), stroke(c.red, 3));
  for (const p of pieces) { const [x1, y1, x2, y2] = pieceEnds(p); cv.drawPath(linePath(x1, y1, x2, y2), stroke(c.pencil, 6)); }
  // The gun, pointing the way the winning shot left, and the ball resting where it ended.
  const win = trails.find((t) => t.ok) ?? trails[trails.length - 1];
  if (win && win.path.length > 3) {
    const [ax, ay] = win.path[0], [bx, by] = win.path[3];
    const a = Math.atan2(by - ay, bx - ax);
    cv.drawPath(linePath(LAUNCHER.x, LAUNCHER.y, LAUNCHER.x + Math.cos(a) * 22, LAUNCHER.y + Math.sin(a) * 22), stroke(c.ink, 6));
    if (win.ok) {
      for (const [x, y] of bounceSpots(win.path)) {
        if (x > g.l - 4 && x < g.r + 4 && y > g.rim - 4) continue; // not the rattle down inside the glass
        cv.drawCircle(x, y, 5, stroke(c.red, 2, 0.8));
      }
    }
  }
  cv.drawPath(launcherPath(LAUNCHER.x, LAUNCHER.y), fill(c.muted));
  if (win) {
    const [ex, ey] = win.path[win.path.length - 1];
    cv.drawCircle(ex, ey, BALL_RADIUS, fill(c.steel));
    cv.drawCircle(ex, ey, BALL_RADIUS, stroke(c.ink, 1.6));
    cv.drawCircle(ex - 2.5, ey - 2.5, 2.2, fill('#ffffff', 0.85));
  }
  cv.restore();
  cv.drawRRect(frame, stroke(c.ink, 4, 0.5));

  // The stamp: tilted across the board like a rubber stamp, with the result and the stars, wherever it covers the fewest shots.
  const sw = 460, sh = card.stars == null ? 150 : 220;
  const toCard = ([x, y]: Vec): Vec => [BOARD.x + (x - crop.x) * k, BOARD.y + (y - crop.y) * k];
  const ink = trails.flatMap((t) => t.path.filter((_, i) => i % 3 === 0).map(toCard));
  const spots: Vec[] = [[0.62, 0.2], [0.38, 0.2], [0.27, 0.22], [0.73, 0.22], [0.5, 0.42], [0.7, 0.45], [0.3, 0.45]]
    .map(([fx, fy]) => [BOARD.x + BOARD.w * fx, BOARD.y + BOARD.h * fy]);
  const covered = ([sx, sy]: Vec) => ink.filter(([x, y]) => Math.abs(x - sx) < sw / 2 + 10 && Math.abs(y - sy) < sh / 2 + 30).length;
  const [stx, sty] = spots.reduce((best, s) => (covered(s) < covered(best) ? s : best));
  cv.save();
  cv.translate(stx, sty);
  cv.rotate(-11, 0, 0);
  const box = Skia.RRectXY(Skia.XYWHRect(-sw / 2, -sh / 2, sw, sh), 26, 26);
  cv.drawRRect(box, fill(c.paper, 0.9));
  cv.drawRRect(box, stroke(c.red, 10));
  cv.drawRRect(Skia.RRectXY(Skia.XYWHRect(-sw / 2 + 16, -sh / 2 + 16, sw - 32, sh - 32), 16, 16), stroke(c.red, 3));
  const wordY = card.stars == null ? 34 : -6;
  text(cv, card.stamp, 0, wordY, bold, 104, fill(c.red), sw - 70);
  if (card.stars != null) for (let s = 0; s < 3; s++) cv.drawPath(star((s - 1) * 82, 62, 34), s < card.stars ? fill(c.red) : stroke(c.red, 4, 0.5));
  cv.restore();

  // The dare.
  text(cv, card.dare, CW / 2, 1222, bold, 66, fill(c.paper), 1000);
  text(cv, 'Bounce it in. Use every bar. Fewest bounces wins.', CW / 2, 1290, medium, 32, fill(c.paper, 0.8), 1000);

  bold.setSize(sizes[0]);
  medium.setSize(sizes[1]);
  surface.flush();
  return surface.makeImageSnapshot().encodeToBase64();
}
