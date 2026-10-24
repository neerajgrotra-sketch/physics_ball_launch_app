# Backlog

Agreed work that isn't built yet, roughly in priority order. Move an item to CHANGELOG.md when it ships.

## Next up

- **Piece-shape groundwork.** Pieces become shape types (bar, triangle, square, round bumper, concave and
  convex arcs, spring), each defining its collision outline (segments, circles, arcs), bounce behaviour,
  look, grab points and footprint. Placement, solver, hints and onboarding work against that, so a new
  shape is one file plus physics tests.
- **Onboarding.**
  - Bars start on the board in random legal spots that can't already win (fixed per level; Start over may
    reshuffle), with a wiggle when the level opens.
  - Level 1 coach: a ghost finger shows "Drag the bar", "Twist it with the handle", "Now Launch", each
    step done by doing it.
  - Goal card at the start of each level in big type; an ⓘ in the header brings it back.

## Menus and settings

- **Settings screen** (the ⚙ button; today it only has Music): sound effects, music, haptics,
  notifications, language, save progress (account/cloud), support, share, privacy policy, terms of use.
- **Level locks.** Built but switched off while levels are being tested (`LOCK_LEVELS` in
  `game/progress.ts`): winning a level opens the next, locked cards show a lock. Turn on before release.
- **Level list paging** (1–100, 101–200…) once there are many levels.
- Watch a level's saved winning shot from the level card.

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
