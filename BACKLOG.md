# Backlog

Agreed work that isn't built yet, roughly in priority order. Move an item to CHANGELOG.md when it ships.

## Next up

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

## Menus and settings

- **Settings screen** (the ⚙ button; today it only has Music): sound effects, music, haptics,
  notifications, language, save progress (account/cloud), support, share, privacy policy, terms of use.
- **Level locks.** Built but switched off while levels are being tested (`LOCK_LEVELS` in
  `game/progress.ts`): winning a level opens the next, locked cards show a lock. Turn on before release.
- **Level list paging** (1–100, 101–200…) once there are many levels.

## Scoring, rewards and money

- **Bulb currency.** Earn bulbs from stars, badges and watching ads; spend them on hints. Shown in the
  header and on the levels screen.
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
