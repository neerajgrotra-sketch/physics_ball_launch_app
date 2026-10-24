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
- **Fixed bouncy blocks** (rectangles, optionally turned; built, 0.8.0): levels "Roadblock" (one wall) and "Slalom" (two) are in; next, a level where a block is a free bank shot, and one with a slanted block.
- **Shielded jar:** a glass with a roof or one tall side, so the ball must enter at a steep angle or from one side.
- **Gates (pass-through jars):** a jar with no base the ball falls through; a level's goal becomes touch every bar, pass every gate, then land in the glass.
- **Curved objects:** concave and convex arcs, circles and round bumpers (a ball bounces off the surface normal at each point, so these need circle and arc collision beside the straight edges), and a curved ramp. Part of the piece-shape groundwork below.
- Later: springs (energy in), moving or spinning parts (needs a time-aware solver), grey dead hazards used sparingly and clearly marked.

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
