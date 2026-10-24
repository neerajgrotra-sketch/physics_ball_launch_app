# Changelog

Versions follow `MAJOR.MINOR.PATCH`. The version lives in `package.json` and `app.json` (`expo.version`),
kept equal. Store builds also bump `expo.ios.buildNumber` and `expo.android.versionCode` on every upload.
The level list shows the version and the commit a web build came from.

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
