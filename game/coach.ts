// The ghost finger. Two uses (pure here: components/coach draws it; any touch hides it):
//  - the tutorial, once, on the tutorial level (a real level with three bars and a stored solution): it
//    leads the player step by step to that solution, each step waiting for them to actually do it;
//  - everywhere else, a hint for the very first bar only, when the player sits idle with nothing placed.
// Both can be stopped for good (components/coach/Tips.tsx).

/** The tutorial level (levels/00-tutorial.json). */
export const TUTORIAL_ID = '00-tutorial';
/** Idle time before the first-bar hint appears on a normal level. */
export const IDLE_MS = 4000;
/** Idle time before the tutorial's finger demonstrates the current step (its caption is there sooner). */
export const TUTORIAL_IDLE_MS = 1500;

export type CoachStep =
  | { kind: 'place'; bar: number }    // tap a bar's tray chip to put it on the board
  | { kind: 'move'; bar: number }     // drag a bar onto its dashed outline
  | { kind: 'select'; bar: number }   // tap a bar to select it (its dotted turn handle appears)
  | { kind: 'twist'; bar: number }    // drag the selected bar's handle to turn it to match
  | { kind: 'angle' }                 // set the cannon's angle by dragging the dotted line
  | { kind: 'power' }                 // set the cannon's power with the Power slider
  | { kind: 'launch' };               // fire

/** How the player's setup compares with the tutorial level's stored solution (game/tutorial.ts). */
export interface TutorialState {
  onBoard: boolean[];
  /** Per bar: sitting at its solution spot / turned to its solution angle. */
  posOk: boolean[];
  degOk: boolean[];
  selected: number | null;
  angleOk: boolean;
  powerOk: boolean;
}

export interface TutorialPlan { step: CoachStep; /** tasks already done */ done: number; /** all tasks */ total: number }

/**
 * Where the player is in the tutorial. Tasks, in order: place each bar; then for each bar, move it onto
 * its outline and turn it to match (turning takes two taps: select it, then drag its handle); then set the
 * angle, set the power, launch. Derived from the board each time, so undoing something puts that task back.
 */
export function tutorialPlan(s: TutorialState): TutorialPlan {
  const n = s.onBoard.length, total = 3 * n + 3;
  const inTray = s.onBoard.findIndex((b) => !b);
  if (inTray >= 0) return { step: { kind: 'place', bar: inTray }, done: s.onBoard.filter(Boolean).length, total };
  for (let k = 0; k < n; k++) {
    if (!s.posOk[k]) return { step: { kind: 'move', bar: k }, done: n + 2 * k, total };
    if (!s.degOk[k]) {
      return { step: s.selected === k ? { kind: 'twist', bar: k } : { kind: 'select', bar: k }, done: n + 2 * k + 1, total };
    }
  }
  if (!s.angleOk) return { step: { kind: 'angle' }, done: 3 * n, total };
  if (!s.powerOk) return { step: { kind: 'power' }, done: 3 * n + 1, total };
  return { step: { kind: 'launch' }, done: 3 * n + 2, total };
}

/** Outside the tutorial: only the first bar gets a hint, and only while none is on the board. */
export function firstBarStep(onBoard: boolean[]): CoachStep | null {
  return onBoard.length > 0 && !onBoard.some(Boolean) ? { kind: 'place', bar: 0 } : null;
}

/** The caption beside the finger. Bars are numbered from 1, as on the chips. `aim` is the target to quote. */
export function coachText(step: CoachStep, aim?: { angle: number; power: number }): string {
  switch (step.kind) {
    case 'place': return `Tap Bar ${step.bar + 1} to put it on the board`;
    case 'move': return `Drag Bar ${step.bar + 1} onto the dashed outline`;
    case 'select': return `Tap Bar ${step.bar + 1} to select it`;
    case 'twist': return `Drag the round handle to turn Bar ${step.bar + 1} to match`;
    case 'angle': return aim ? `Drag the dotted line round to set the angle to ${aim.angle.toFixed(1)}°` : 'Set the angle';
    case 'power': return aim ? `Slide Power to ${aim.power.toFixed(1)}` : 'Set the power';
    case 'launch': return 'Tap Launch to fire';
  }
}

/** The caption in the tutorial: what to do now (no step counter: players found "3 of 12" off-putting). */
export function tutorialText(plan: TutorialPlan, aim?: { angle: number; power: number }): string {
  return coachText(plan.step, aim);
}
