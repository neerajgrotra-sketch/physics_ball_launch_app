import type { Blocker } from './placement';

// The message when a bar can't turn because something is in the way (the rotation −/+ or slider pushed into it): what it bumps,
// what to do about it, and whether it still turns the other way. Pure: no UI imports.

/** What the bar bumps, in words. */
export function blockerName(b: Blocker): string {
  switch (b.what) {
    case 'bar': return `Bar ${b.other}`;
    case 'glass': return 'the glass';
    case 'floor': return 'the floor';
    case 'edge': return 'the edge of the board';
    case 'cannon': return 'the cannon';
    case 'portal': return 'a portal';
    case 'block': return 'a block';
    case 'spikes': return 'the spikes';
    case 'pad': return 'a spring pad';
    default: return 'a wall';
  }
}

/** How to make room, by what's in the way. */
function remedy(b: Blocker): string {
  switch (b.what) {
    case 'bar': return 'Move one of them to make room.';
    case 'floor': return 'Lift it up a little to turn it further.';
    case 'edge': return 'Bring it in from the edge to turn it further.';
    default: return 'Slide it clear to turn it further.';
  }
}

/**
 * The card over the board: "Clunk! Bar 2 bumps the glass. Slide it clear to turn it further." Spikes get a warning instead of the
 * clunk. `otherWay`: the button that still turns it, if one does (− or +), so the player knows they aren't stuck.
 */
export function jamText(bar: number, b: Blocker, otherWay: '−' | '+' | null = null): string {
  const hit = b.what === 'spikes' ? `Careful! Bar ${bar} would touch the spikes.` : `Clunk! Bar ${bar} bumps ${blockerName(b)}.`;
  const back = otherWay ? ` It still turns the other way (${otherWay}).` : '';
  return `${hit} ${remedy(b)}${back}`;
}
