// The message a win shares (WhatsApp, Messages…): a hook that fits how the shot went, the level and the result (no spoilers: never
// where the bars went), a dare, and the link. Pure, so Vitest covers it; the pick among lines is seeded by the level and result, not
// random, so the same win always shares the same words.
import { golfName } from './score';

/** Where the share sends friends. A placeholder until the App Store / web link is final (BACKLOG.md). */
export const SHARE_LINK = '(link coming soon)';

export interface ShareResult { bounces: number; stars: number; tries: number; helped: boolean }

export type ShareWhat =
  | { kind: 'level'; number: number; name: string }
  | { kind: 'daily'; number: number; name: string; streak: number };

function pick<T>(lines: T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[h % lines.length];
}

/** The opening line: how the shot felt. Better results brag more. */
function hook(r: ShareResult, par: number, seed: string): string {
  if (r.helped) return pick(['💡 Okay, I had a little help…', '💡 With a tiny hint, but it counts!'], seed);
  const under = par - r.bounces;
  if (under >= 2) return `🤯 ${golfName(r.bounces, par).toUpperCase()}! ${under} under par. I'm not even sorry.`;
  if (under === 1) return pick(['🐦 Birdie! One under par 😎', '🐦 Birdie! Better than the puzzle-maker 😎'], seed);
  if (r.stars === 3 && r.tries === 1) return pick(['🎯 First try. No big deal 😎', '🎯 Nailed it on the FIRST try!'], seed);
  if (r.stars === 3) return pick(['🔥 Wow, I did it!', '🔥 Three stars. Perfect bank shot!', '🔥 Called it. Off every bar and in!'], seed);
  if (r.stars === 2) return pick(['😅 Wow, I did it… eventually!', '🏀 In the glass! Not pretty, but in!'], seed);
  return pick(["🙈 It went in. Don't ask how.", '🫣 Ugly? Yes. In the glass? ALSO yes.'], seed);
}

/** The dare at the end. */
function dare(r: ShareResult, what: ShareWhat, seed: string): string {
  if (what.kind === 'daily') return pick(['Same puzzle for everyone today. Beat me! 👀', 'Everyone gets this one today. Your move 😏'], seed);
  if (!r.helped && r.stars === 3) return pick(['Bet you can\'t match it 😏', 'Can you do better?? (You can\'t 😏)'], seed);
  return pick(['Can you do better?? 👀', `Think you can beat ${r.bounces} bounces? 👀`, 'Your move 😏'], seed);
}

export function resultLine(r: ShareResult, par: number): string {
  const stars = r.helped ? '💡 with a hint' : '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  const plural = (n: number, w: string, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
  return `${stars} · ${plural(r.bounces, 'bounce')} (par ${par}) · ${plural(r.tries, 'try', 'tries')}`;
}

/** The whole message. */
export function shareMessage(what: ShareWhat, r: ShareResult, par: number): string {
  const seed = `${what.kind}${what.number}:${r.bounces}:${r.tries}`;
  const where = what.kind === 'daily'
    ? `Bank Shot Daily #${what.number} · “${what.name}”`
    : `Level ${what.number} · “${what.name}” in Bank Shot`;
  return [
    hook(r, par, seed),
    `I just banked it into the glass on ${where}`,
    resultLine(r, par),
    ...(what.kind === 'daily' && what.streak > 1 ? [`🔥 ${what.streak}-day streak`] : []),
    '',
    dare(r, what, seed),
    `I'm playing the coolest game… you should try it! 👉 Bank Shot ${SHARE_LINK}`,
  ].join('\n');
}

/** The banner on the shared picture (components/board/shareCard.ts): it reads like the game's own "level complete" screen. */
export function shareCard(what: ShareWhat, r: ShareResult, par: number): { title: string; stars: number | null; line: string } {
  const title = what.kind === 'daily' ? `DAILY #${what.number} COMPLETE!` : `LEVEL ${what.number} COMPLETE!`;
  // The golf name only when it isn't plain par ("Par · 2 bounces (par 2)" says it twice).
  const name = r.helped || r.bounces === par ? '' : `${golfName(r.bounces, par).replace(/^\+(\d+)$/, '+$1 over par')} · `;
  const tries = r.tries === 1 ? 'first try' : `${r.tries} tries`;
  return { title, stars: r.helped ? null : r.stars, line: `“${what.name}” · ${name}${r.bounces} ${r.bounces === 1 ? 'bounce' : 'bounces'} (par ${par}) · ${tries}` };
}
