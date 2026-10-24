# Changelog

Versions follow `MAJOR.MINOR.PATCH`. The version lives in `package.json` and `app.json` (`expo.version`),
kept equal. Store builds also bump `expo.ios.buildNumber` and `expo.android.versionCode` on every upload.
The level list shows the version and the commit a web build came from.

## 0.5.2

- Rotating a bar: the rotate icon now sits at the tip of a dotted lever sticking out of the bar's end, so
  your finger turns it from out there without covering the bar. Tap the bar's other end to move the
  lever to that side.

## 0.5.1

- Level cards: the drawings now show the launcher and glass properly (the bottom of the board was cut
  off). Only won levels and the next one show a drawing; the rest show their number and a lock (a look
  only for now: they still open while levels are being tested).

## 0.5.0

- Level header: ⚙ settings (music on/off, version) and ••• to go back to the levels from any level.
- Levels screen redesigned: cards with each level's name, best stars and bounces, and a drawing of your
  last winning shot (bars and path). The next level to play is highlighted.
- All levels are open while they're being tested (locks come back later).
- BACKLOG.md lists the agreed future work.

## 0.4.3

- The win card says what earns more stars, e.g. "Get it in with 5 bounces or fewer for ★★, or 3 for ★★★".

## 0.4.2

- Dragging the dotted aim line now sets power too: pull it out to stretch for more, push in for less,
  and swing it round to change the angle.

## 0.4.1

- Intro: the ball now visibly strikes the bar (true reflection, flat bar), with a continuous trail and a faint
  imprint where it hit; a proper launcher (barrel on a dome, on a floor line); launch, bar and glass sounds;
  the version under the Let's go button.

## 0.4.0

- The goal is now a score: get in with the fewest bounces. Every level has a par (the fewest bounces the
  solver found), shown under the board; a live counter ticks up as the ball bounces.
- Wins are named golf style (Birdie, Par, Bogey…) with 1–3 stars and points. Best results are saved;
  the level list shows each level's stars and best, and a total score.
- Solve now asks: a hint (places one bar where it belongs) or the full solution, each after a short ad
  (placeholder until the store builds). Help means no stars or score for that round.
- Stored solutions are now the fewest-bounce ones, so Solve shows a par shot.

## 0.3.1

- The intro now ends on a "Let's go" button and waits for it, so there's time to read the title.
  A tap during the animation jumps to the end.

## 0.3.0

- Launch screen: the app icon on the paper colour (light and dark), on iPhone, Android and the web.
- Animated intro on every start: the ball launches, banks off a bar into the glass, and the title drops in.
  Tap to skip; respects Reduce Motion.

## 0.2.3

- Every level plays the background track (level 1's until each gets its own).
- Music starts as soon as a level opens, not on the first launch.
- Aim by grabbing the dotted aim line and swinging it round the launcher (power stays the same).

## 0.2.2

- Sound plays even with the iPhone silent switch on (web and app).
- Web audio unlocks reliably on the first tap on iPhone, and sounds load up front so the first launch is heard.

## 0.2.1

- Music is quieter and dips while the ball flies, so bounces cut through.
- Each bar hit in a shot plays a step higher (a rising arpeggio); bar hits are punchier, wall bounces softer.
- A near miss (landed but skipped a bar) is now a pop-up card over the board, not a line of small text.

## 0.2.0

- Real bounces off bars, the glass, the floor and all four walls; open glasses.
- A win must bounce off every bar the level gives; the hint says which bar a near miss skipped.
- Bars can't be placed through the glass, the launcher or each other (red, then snap back).
- Bar rotation controls, bars named Bar 1-3, bigger board on phones.
- Skip to the end of a shot; Watch again after a win; keep playing after a win.
- Sounds: launch thunk and whoosh, metallic tink off bars, woody tok off walls, glass clink.
- Background music per level (level 1 so far), with a music on/off button in the level header.
- Web version on Vercel that fits a phone like an app (Add to Home Screen).

## 0.1.0

- First playable build: Expo app around the physics, five levels, Skia board, aim, bars, win flow.
