// The idle coach: when the player sits still on a level for a few seconds, a ghost finger shows the next
// useful thing to do. Pure: picks the step; components/coach draws it. Any touch hides it.

/** How long the player has to be idle before the ghost finger appears. */
export const IDLE_MS = 4000;

export type CoachStep =
  | { kind: 'place'; bar: number }   // tap a bar's tray chip to put it on the board
  | { kind: 'drag'; bar: number }    // drag a bar on the board into the ball's path
  | { kind: 'launch' };              // fire

/**
 * The next step to suggest: place the first bar still in the tray; once they're all out, drag one
 * (until the player has moved a bar this round); then launch.
 */
export function coachStep(onBoard: boolean[], moved: boolean): CoachStep {
  const inTray = onBoard.findIndex((b) => !b);
  if (inTray >= 0) return { kind: 'place', bar: inTray };
  if (!moved && onBoard.length > 0) return { kind: 'drag', bar: 0 };
  return { kind: 'launch' };
}

/** The caption beside the finger. Bars are numbered from 1, as on the chips. */
export function coachText(step: CoachStep): string {
  if (step.kind === 'place') return `Tap Bar ${step.bar + 1} to put it on the board`;
  if (step.kind === 'drag') return 'Drag a bar into the ball’s path';
  return 'Tap Launch to fire';
}
