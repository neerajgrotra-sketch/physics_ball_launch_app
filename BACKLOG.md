# Backlog

Agreed work that isn't built yet, roughly in priority order. Move an item to CHANGELOG.md when it ships.

## Next up

- **Reset button** (user feedback): a clear "start over" on the board that takes every bar back to the tray and clears the trails (and
  the try count) without leaving the level. Today the Clear button only wipes the ghost trails, and Start over only shows after a win.
  Decide whether it keeps the aim, and whether it asks first when several bars are placed.
- **Piece-shape groundwork.** Pieces become shape types (bar, triangle, square, round bumper, concave and
  convex arcs, spring), each defining its collision outline (segments, circles, arcs), bounce behaviour,
  look, grab points and footprint. Placement, solver, hints and onboarding work against that, so a new
  shape is one file plus physics tests.
- **Onboarding** (the guided tutorial level and first-bar hint are done):
  - Bars start on the board in random legal spots that can't already win (fixed per level; Start over may
    reshuffle), with a wiggle when the level opens.
  - Goal card at the start of each level in big type; an ⓘ in the header brings it back.
  - A short "how to earn stars" card after the tutorial.

## Level design (next worlds)

Each new idea is introduced on its own, then mixed. Order agreed so far:
- **Fixed bouncy blocks** (rectangles, optionally turned; built, 0.8.0): levels "Roadblock" (one wall), "Slalom" (two) and "Switchback" (a wall and a slanted block you bank off, with three bars) and "Gauntlet" (three blocks, four bars, the glass in a pit) are in; next: a block that closes in on the glass, tighter glasses, and a compact tray for 4+ bars (the chips wrap to a second row now).
- **Shielded jar:** a glass with a roof or one tall side, so the ball must enter at a steep angle or from one side.
- **Gates (pass-through jars):** a jar with no base the ball falls through; a level's goal becomes touch every bar, pass every gate, then land in the glass.
- **Curved objects:** concave and convex arcs, circles and round bumpers (a ball bounces off the surface normal at each point, so these need circle and arc collision beside the straight edges), and a curved ramp. Part of the piece-shape groundwork below.
- **Hazards** (built, 0.10.0): spiked rectangles; next, a slanted or triangular hazard and a hazard that the solution must pass close to.
- Later: springs (energy in), moving or spinning parts (needs a time-aware solver), grey dead hazards used sparingly and clearly marked.

## Level order and difficulty curve

Assessment of the first 12 levels (`tools/assess-levels.ts`, "toughness" 0 to 10 = how rarely a random search finds a way in):
first-bounce 0.0, two-step 1.6, **high-ground 7.2, crossfire 10.0** (levels 4–5: the hardest pure-bar levels sit far too early),
four-millimetres 3.7, roadblock 4.5, slalom 3.9, switchback 5.2, gauntlet 8.4, spikes 4.0, moat 4.3. The curve is a sawtooth with a
flat baseline instead of a rising one.
- **Reorder** (levels are keyed by id, so saved results survive): tutorial, first-bounce, two-step, four-millimetres, roadblock, slalom,
  switchback, spikes, moat, high-ground, gauntlet, crossfire.
- **Fill the gap** between moat (4.3) and high-ground (7.2) with 2–3 levels around 5–6: a 4-bar hazard level, a raised glass behind a block.
- Each new mechanic starts with an easy example (a dip is right), then ramps; the baseline of those dips should rise from level to level.
- Precision is its own kind of hard: slalom (13/49 nearby inputs win) and roadblock (23/49) are finicky, not just clever; keep an eye
  on them in playtests.
- **Measure real play:** record tries, time to win and hint use per level (locally now, to a server later) and use it to calibrate the
  numbers above, since "found" is only a proxy for how hard a person finds a level.

What moves toughness (measured on candidate layouts): a **4th bar** about +2; **raising the glass** about +2 for the first 90 and
more after (a glass 190 up is about 6 with 3 bars and a wall); a **second block** about +1; a **narrower glass** about +0.2; **hazards**
almost nothing (they raise the chance a try fails, 36–46% of plain shots, not how hard a way in is to find). Level 13 "Stilts" was
tuned to 6.0 with this.

Level 14 "Needle" (from the owner's mockup; 5 bars, 3 walls with one spiked edge each, spikes beside the glass) measures **9.6**:
a finale-class level, 79% of plain shots die. Its stored answer is forgiving (24/49) and bounces off the walls twice. Its place is
the end of the first set, after gauntlet and crossfire.

Level 15 "Boomerang" (garage by the cannon, spiked roof and back wall, four bars, par 6) is **off the scale (found 8 per 10,000,
where Crossfire, the old hardest, was 91)** and every plain shot dies. Its stored answer is forgiving (40/49) and needs the walls,
but watch it closely in playtests: if players stall here, ease it (open the garage, drop the roof spikes) or move it later. Its first
two designs were too easy (the winning shot never went near the walls): check "does the answer need the blocks" for every new level.

Level 16 "Penthouse" (Boomerang's garage raised 120 up, over spikes, four bars, par 6) is harder still: the random search found **0 in
20,000** tries (Boomerang: 8 per 10,000), every plain shot dies, and its answer is forgiving only 17/49. A glass 140 up gave a
solution at the edge (8/49 at power 99.5 of 100), too fragile to ship, so 120 is the practical ceiling of this layout. These two are the
finale; if players stall, the first thing to ease is the spiked roof.

Level 17 "Skyline" (Penthouse plus a fifth bar, par 8) is the hardest yet. The random-search measure can no longer rank it: Penthouse
and Skyline both found **0 in 60,000** tries (Boomerang: 8 per 10,000), so the scale tops out here. Other signs it is harder: a fifth bar,
par 8 versus 6, an answer only 11/49 forgiving at power 96.7 (Penthouse 17/49), and a solution only turned up in 1 of 8 searches of 3M
attempts each (Penthouse needed 700k). To go beyond, the solver needs a stronger search, not just a harder layout. Levels 16 and 17 are
the ceiling of this layout; the sensible next step for variety is a *different* kind of hard (curves, gates), not more of this.

## Menus and settings

- **Settings screen** (the ⚙ button; today it only has Music): sound effects, music, haptics,
  notifications, language, save progress (account/cloud), support, share, privacy policy, terms of use.
- **Level locks.** Built but switched off while levels are being tested (`LOCK_LEVELS` in
  `game/progress.ts`): winning a level opens the next, locked cards show a lock. Turn on before release.
- **Level list paging** (1–100, 101–200…) once there are many levels.

## Scoring, rewards and money

- **Hints (💡), done in 0.29.0:** a balance (`game/wallet.ts`) with 15 to start, a daily gift, star and world rewards, +3 per ad,
  and a test shop. Still to do: **real in-app purchases** for the packs (RevenueCat in a development/store build; products
  `hints_30`, `hints_80`, `hints_200` in App Store Connect and Play Console; the shop's `give` call becomes the purchase), and
  showing the balance on the levels screen. Later: hints from badges.
- **Stars for helped wins (proposed, not built).** Today a win with a hint or Solve earns no stars or score, but Start over clears
  the help mark, so a player can re-place the bars they were shown and take 3 stars anyway. Proposal: a helped win scores, capped
  by the help used on that level: 1 hint caps it at ★★, 2 or more hints or the full solution at ★ (and never above what the shot
  itself earns; points follow the stars). The cap is saved per level and survives Start over, which closes the loophole. The
  Solve card warns before the first hint ("Using a hint here caps this level at ★★"), and the win card says "solved with help". The
  +1 💡 star reward stays for unhelped 3-star wins only; a future leaderboard marks helped results. Optional softer version:
  lift the cap after the level is beaten again with a different solution. About 1 to 2 hours (`game/score.ts`, a per-level
  help record, win and Solve card text, tests).
- **Badges:** Hole in One, Birdie, Eagle, Perfect World (all levels at par), 7-day Daily streak, Trick Shot.
- **Hint power-ups** (assisted, no score): longer aim preview, reveal one piece, extra undo.
- **Real ads:** AdMob rewarded ads in a development/store build (`components/ads/RewardedAds.tsx` is the
  only file to change), the iOS tracking prompt, the EU consent form, App Store and Play privacy answers.
  Needs an AdMob account in the owner's name. Later: a paid "Remove ads".

## Competition

- Accounts and a verified online leaderboard: the app submits a shot's inputs, the server re-runs the
  deterministic physics and computes the score (Supabase edge function running `physics/`).
- **Daily Shot:** one level for everyone each day, ranked, with a shareable result.
- Game Center and Google Play Games leaderboards.

## Content

- Music track for each level (level 1's plays everywhere until then).
- More levels, including ones whose par needs a wall bank or goes round obstacles.
- On-device check that every level's stored solution lands on Hermes (CLAUDE.md rule 6).
