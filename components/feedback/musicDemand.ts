// Which screens want the music right now, shared by the level screens (useLevelMusic) and the one player that plays it (MusicHost).
// Level screens hold it while open with music on; the music stops only once nobody has held it for a moment, so moving to the next
// level carries it on without a gap. Kept on globalThis so a development reload of this file keeps the same count.

const GRACE_MS = 700;

interface Demand { holders: number; ducked: boolean; wanted: boolean; timer?: ReturnType<typeof setTimeout>; listeners: Set<() => void> }
const d: Demand = ((globalThis as { __bankShotMusicDemand?: Demand }).__bankShotMusicDemand ??= {
  holders: 0, ducked: false, wanted: false, listeners: new Set(),
});

const notify = () => d.listeners.forEach((f) => f());
const setWanted = (on: boolean) => { if (d.wanted !== on) { d.wanted = on; notify(); } };

/** A screen starts wanting music. Returns its release, which stops the music after the grace if nobody else wants it. */
export function holdMusic(): () => void {
  d.holders++;
  clearTimeout(d.timer);
  setWanted(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    d.holders = Math.max(0, d.holders - 1);
    if (d.holders > 0) return;
    clearTimeout(d.timer);
    d.timer = setTimeout(() => { if (d.holders === 0) setWanted(false); }, GRACE_MS);
  };
}

/** Music switched off, or the level covered: stop at once if nobody else holds it (no grace). */
export function musicOffNow() {
  if (d.holders > 0) return;
  clearTimeout(d.timer);
  setWanted(false);
}

export function setMusicDucked(on: boolean) {
  if (d.ducked !== on) { d.ducked = on; notify(); }
}

export function musicDemand() {
  return { wanted: d.wanted, ducked: d.ducked };
}

export function onMusicDemand(f: () => void): () => void {
  d.listeners.add(f);
  return () => { d.listeners.delete(f); };
}
