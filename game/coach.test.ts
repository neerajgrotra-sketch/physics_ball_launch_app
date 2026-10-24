import { describe, expect, it } from 'vitest';
import { coachText, firstBarStep, tutorialPlan, tutorialText, type TutorialState } from './coach';

const base: TutorialState = {
  onBoard: [true, true, true], posOk: [false, false, false], degOk: [false, false, false],
  selected: null, angleOk: false, powerOk: false,
};

describe('tutorial plan', () => {
  it('places every bar first, then lines each up, then aims, then launches', () => {
    expect(tutorialPlan({ ...base, onBoard: [false, false, false] })).toMatchObject({ step: { kind: 'place', bar: 0 }, done: 0, total: 12 });
    expect(tutorialPlan({ ...base, onBoard: [true, false, true] })).toMatchObject({ step: { kind: 'place', bar: 1 }, done: 2 });
    expect(tutorialPlan(base)).toMatchObject({ step: { kind: 'move', bar: 0 }, done: 3 });
    expect(tutorialPlan({ ...base, posOk: [true, false, false] })).toMatchObject({ step: { kind: 'select', bar: 0 }, done: 4 });
    expect(tutorialPlan({ ...base, posOk: [true, false, false], selected: 0 })).toMatchObject({ step: { kind: 'twist', bar: 0 }, done: 4 });
    expect(tutorialPlan({ ...base, posOk: [true, false, false], degOk: [true, false, false], selected: 0 })).toMatchObject({ step: { kind: 'move', bar: 1 }, done: 5 });
    const lined = { ...base, posOk: [true, true, true], degOk: [true, true, true] };
    expect(tutorialPlan(lined)).toMatchObject({ step: { kind: 'angle' }, done: 9 });
    expect(tutorialPlan({ ...lined, angleOk: true })).toMatchObject({ step: { kind: 'power' }, done: 10 });
    expect(tutorialPlan({ ...lined, angleOk: true, powerOk: true })).toMatchObject({ step: { kind: 'launch' }, done: 11 });
  });

  it('is derived from the board: moving a bar off its spot puts that task back', () => {
    const lined = { ...base, posOk: [true, true, true], degOk: [true, true, true], angleOk: true, powerOk: true };
    expect(tutorialPlan({ ...lined, posOk: [true, false, true] }).step).toEqual({ kind: 'move', bar: 1 });
    expect(tutorialPlan({ ...lined, onBoard: [true, true, false] }).step).toEqual({ kind: 'place', bar: 2 });
  });

  it('scales to the level\'s bar count', () => {
    expect(tutorialPlan({ ...base, onBoard: [false], posOk: [false], degOk: [false] }).total).toBe(6);
  });

  it('says what to do, with the aim targets and no step counter', () => {
    expect(coachText({ kind: 'move', bar: 1 })).toBe('Drag Bar 2 onto the dashed outline');
    expect(coachText({ kind: 'angle' }, { angle: 47.7, power: 24.8 })).toContain('47.7°');
    expect(coachText({ kind: 'power' }, { angle: 47.7, power: 24.8 })).toContain('24.8');
    expect(tutorialText({ step: { kind: 'launch' }, done: 11, total: 12 })).toBe('Tap Launch to fire');
  });
});

describe('first-bar hint', () => {
  it('only while nothing is on the board', () => {
    expect(firstBarStep([false, false, false])).toEqual({ kind: 'place', bar: 0 });
    expect(firstBarStep([true, false, false])).toBeNull();
    expect(firstBarStep([true, true, true])).toBeNull();
    expect(firstBarStep([])).toBeNull();
  });
});
