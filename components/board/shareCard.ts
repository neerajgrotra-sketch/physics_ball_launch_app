import { Skia, type SkFont, type SkImage } from '@shopify/react-native-skia';
import type { Palette } from '../../theme/colors';

/** What the shared picture's banner says: "LEVEL 3 COMPLETE!", the stars (null: won with help), and the result. */
export interface ShareCard { title: string; stars: number | null; line: string }

function star(cx: number, cy: number, r: number) {
  const p = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r * 0.45 : r;
    if (i) p.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); else p.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
  p.close();
  return p.detach();
}

/**
 * The picture a win shares: a "level complete" banner (the game's name, the title, the stars, the result) over the board as drawn,
 * every trail of the round on it. Drawn on a CPU surface so it works the same on the web and on phones. Returns a base64 PNG.
 */
export function composeShareCard(board: SkImage, card: ShareCard, bold: SkFont, medium: SkFont, c: Palette): string | null {
  const src = board.makeNonTextureImage() ?? board;
  const w = src.width(), h = src.height(), u = w / 400, band = Math.round(150 * u);
  const surface = Skia.Surface.Make(w, h + band);
  if (!surface) return null;
  const cv = surface.getCanvas();
  cv.drawColor(Skia.Color(c.paper));
  const paint = (color: string) => { const p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color)); return p; };
  // The board's own fonts, resized for each line and put back after (a new font from their typeface fails on the web). Long names
  // shrink to fit the width rather than run off the picture.
  const sizes = [bold.getSize(), medium.getSize()];
  const centred = (text: string, y: number, f: SkFont, size: number, color: string) => {
    f.setSize(size);
    const tw = f.measureText(text).width, room = w * 0.92;
    if (tw > room) f.setSize(size * (room / tw));
    cv.drawText(text, (w - f.measureText(text).width) / 2, y, paint(color), f);
  };

  centred('B A N K   S H O T', 26 * u, medium, 15 * u, c.pencil);
  centred(card.title, 64 * u, bold, 36 * u, c.red);
  if (card.stars == null) {
    centred('SOLVED WITH A HINT', 100 * u, bold, 20 * u, c.pencil);
  } else {
    for (let k = 0; k < 3; k++) cv.drawPath(star(w / 2 + (k - 1) * 40 * u, 94 * u, 16 * u), paint(k < card.stars ? c.red : c.line));
  }
  centred(card.line, 136 * u, medium, 18 * u, c.ink);
  bold.setSize(sizes[0]);
  medium.setSize(sizes[1]);
  cv.drawImage(src, 0, band);
  const rule = paint(c.line);
  rule.setStrokeWidth(2 * u);
  cv.drawLine(0, band, w, band, rule);
  surface.flush();
  return surface.makeImageSnapshot().encodeToBase64();
}
