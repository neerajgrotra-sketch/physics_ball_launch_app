# Changelog

Versions follow `MAJOR.MINOR.PATCH`. The version lives in `package.json` and `app.json` (`expo.version`),
kept equal. Store builds also bump `expo.ios.buildNumber` and `expo.android.versionCode` on every upload.
The level list shows the version and the commit a web build came from.

## 0.45.0

- A level won with help now counts: it saves stars, points, best bounces and the winning shot (the card's drawing and Replay),
  capped by the help used on that level: one hint caps it at ★★, more hints or the full solution at ★ (never above what the
  shot itself earned). Solve's own shot is a ★ win. The help is saved per level and stays through Start over, Try it yourself
  and leaving the level, so taking the answer and rebuilding it can't earn ★★★ (before, Start over cleared the help mark).
- The help card says what help costs on this level before you use it, the win card says "solved with help, max ★★", and the
  level card marks helped results with 💡. The +1 💡 three-star reward stays for wins without help. Daily puzzles keep their
  rule (a helped daily win counts for the streak, with no stars); the tutorial never scores.

## 0.44.3

- Fixed: the levels screen drew a level as locked when it wasn't, so › in a level opened a "locked" level. A win with a hint
  or Solve unlocks the next level but saves no stars, and the list judged wins by stars alone: that level still looked unplayed
  and highlighted, and the one after it locked. Cards now follow the real unlocks (`cardStates` in game/progress.ts): a level
  won with help says "Won with help", the next level to play is the one actually unlocked, and levels opened by the Testing
  switch no longer show a lock.

## 0.44.2

- Phone music no longer stutters as a level starts. In Expo Go every bundled sound came from the PC's dev server, and iOS played
  the music as a network stream, so it stalled while it buffered (worst on the first loops). Music and effects now play from
  files on the phone (`components/feedback/localAudio.ts`, downloaded once at app start). The iPhone audio mode is set once
  per app run instead of each time a level opened (each call re-applied the audio session under the playing music), and the
  effect players are made at app start, not mid-level on the first bounce.

## 0.44.1

- The levels screen opens on the level to play next (highlighted, about a third of the way down), not the top of the list,
  and moves to the new one after a win. Further along, the next level was off screen and players had to scroll to find it.

## 0.44.0

- A level you've already won reopens as you last left it: the winning bars, aim and trail (or whatever you tried after),
  ready to go for fewer bounces. Levels won before this version open on their saved winning shot. Only Start over (or Try it
  yourself) gives an empty board, and it stays empty when you come back.
- Fixed: on Trampoline and Slingshot the saved winning shot forgot its spring bar, so the level card's drawing and the
  card's Replay showed the shot missing. Saved shots now take each bar's bounce from the level (`shotPieces`).

## 0.43.0

- Leaving a level part-way no longer loses it. The bars, the aim, the tries so far and the last few shots' ghost trails are
  saved as you play (game/drafts.ts), so going back to the levels, moving to another level, or closing the app and coming
  back picks up exactly where you were. A win or Start over clears it. Hints and Solve used before leaving still count as
  help. The tutorial always starts fresh. Daily puzzles resume too.

## 0.42.0

- Locked levels now show a faded drawing of the level (its walls, spikes, pads, portals and glass) under the lock, and say
  what's on it ("3 bars · 2 blocks · 2 spikes · par 4"), so there's something to look forward to.
- Each world header has an ⓘ that opens the world's card: a tagline and pitch, a drawing and a line for each new thing it
  brings (blocks, spikes, spiked walls, spring pads and bars, portals), a pro tip, its levels with the stars won so far, and
  a peek at its final level.

## 0.41.2

- The remove badge now finds open space: it keeps clear of the level's walls, spikes, spring pads, portals, the glass, the gun
  and the other bars, not only the selected bar's own handles (it could land on a pillar, as on Moat). It tries further out when
  the usual ring is crowded. Checked on every level, over 70,000 bar positions: it never sits on anything.

## 0.41.1

- The remove badge sits further out from the bar: 85 units from its centre (was 50), closer only where the board runs out, and
  at least 40 from the bar itself where there's room. Across every position and angle it's never nearer than 43 to the bar
  (typically about 80), so a wide finger aiming for it doesn't grab the bar, and the reverse.

## 0.41.0

- Removing a bar: the selected bar now shows a small red trash badge right beside it on the board, placed in the clearest spot
  around the bar (away from the rotate handle, both slide grips and the board's edges) and moving with it. Tap it to take the bar
  off; Undo puts it back. The trash can by the bar's name is gone: it sat right above the rotation slider and players kept
  hitting it while turning the bar. Dragging a bar below the floor still removes it too.

## 0.40.1

- The slide grips on a selected bar now always sit well clear of the bar. When the bar lay along an arm's direction (flat for
  the sideways grip, upright for the up-down one), the arm ran along the bar and its grip ended just past the bar's end, under the
  same finger. Each arm now reaches 50 units beyond the bar's end in its direction, still fitting on the board.

## 0.40.0

- Your gun: Settings has a "Your gun" picker under "Your ball", with six designs: Classic, Brass cannon (on a wooden wheel),
  Pirate cannon (on a cart), Blaster (glowing tip), Slingshot (the band stretches back with the power) and Pool cue (draws back
  with the power). A look only: every gun fires exactly the same shot. The chosen gun shows on the board, on the level cards and on
  the share poster, and is remembered. The intro keeps the classic gun.

## 0.39.3

- Fix: on the phone the music could play twice, and the Music switch didn't stop it. Since 0.39.0 the one music player was made
  with `createAudioPlayer` and kept in a module variable; a reload of the app's code (in Expo Go, after a git pull) left that
  player playing on its own, out of reach, and the next level started a second. The music player now lives in one component in
  the root layout (`MusicHost`, `useAudioPlayer`), which React releases on any reload, and the level screens only say when they
  want music (`musicDemand.ts`). It still carries on across levels. The web keeps its own player, now also safe across reloads.

## 0.39.2

- Smoother bar and gun dragging on phones, and no more slowing down the longer you play:
  - Finger movements are handled at most once per screen frame, using the latest position. iPhones send them up to 120 times a
    second; when a redraw took longer than that they queued up, and the bar or gun trailed further and further behind the finger.
  - The board reuses its shapes across redraws instead of building about 15 new ones per finger movement (floor, glass, each bar,
    the handles, the gun). They lived in native memory the JS garbage collector doesn't count, so they piled up during play.
  - The sound and music players keep the iPhone's audio session open: every pause used to shut it down and the next play start it up.
- (The sliders always felt fine because their knob is moved by the phone itself, not by the game's code.)

## 0.39.1

- Fix: on a first launch, "Let's go" showed the level list for a moment and then jumped to "What should we call you?". The tour
  only went up once the intro had finished fading, so the fade revealed the levels first. It now goes up as the fade starts, so the
  intro fades straight into the name question. Returning players are unchanged.

## 0.39.0

- Settings has separate switches for Music, Sound effects and Vibration (Vibration only in the app: a web page can't vibrate a
  phone). Each is remembered.
- The music no longer breaks off when moving to another level: each level screen used to start its own player. There's now one
  for the whole app, which carries on across levels and pauses only when you leave the levels (on the phone and the web).

## 0.38.4

- Fix: on iPhone the music hiccuped every time it looped. The track is an MP3, which has a few milliseconds of encoder silence at
  each end that iOS plays. Phones now play a seamless WAV copy (`assets/music/loops`, made by `scripts/make-playlist.mjs` with
  ffmpeg, listed in `playlist.native.ts`); the web keeps the smaller MP3, which it already looped cleanly.

## 0.38.3

- Fix: on iPhone a sound could stay silent and then play twice on the next shot (a launch with no sound, then a double one).
  Each effect rewound its player just before playing, and the rewind was still pending when play() ran. Now each player rewinds
  as soon as it finishes, so a sound always starts cleanly from the top, and each sound has a few players (three for bounces,
  walls, glass and stars) so fast repeats don't cut each other off. One set is shared by the whole app.

## 0.38.2

- Fix: no sound effects on iPhone (Expo Go and the app): the launch, bounces, glass, win and the intro's shot were all silent.
  Each effect set its pitch by assigning `playbackRate`, which is read-only on iOS; that threw before `play()`, and the error was
  swallowed. It now uses `setPlaybackRate()`, and a failed sound is logged in development. The web build was unaffected.

## 0.38.1

- The share poster always uses the game's standard graph-paper colours (blue frame, paper board), whatever board theme is picked
  in Settings; 0.38.0 recoloured it to match the theme (neon in Night).

## 0.38.0

- The shared picture is now a poster instead of a screenshot of a mostly empty board: the board is zoomed in on where the round
  happened, the winning shot is drawn bold in red with rings where it bounced (misses in blue), a tilted rubber stamp says the
  result with the stars ("PAR! ★★★", "BIRDIE!", "SOLVED!"), and a dare runs along the bottom ("CAN YOU BEAT 2 BOUNCES?").
  1080×1350, the shape chat apps show biggest.

## 0.37.0

- Touching the gun no longer drops the aim: it used to jump the aim to the finger, right at the gun (0° and no power). Now a
  touch changes nothing and a drag from the gun moves the aim along with the finger from where it was.
- Swipe-to-aim on empty board now only works while no bar is on the board (a level just opened). Once bars are placed, touches
  on empty board never move the gun, so placing and moving bars can't knock the aim. Aim then with the gun, its dotted line or
  the sliders.

## 0.36.0

- Undo now steps back aim changes too, not only the bars: a swipe, a drag of the gun or its dotted line, a slider or the −/+
  buttons that changed the angle or power is one undo step (a drag or a held slider counts as one), in order with the bar changes.

## 0.35.1

- Swiping on empty board now moves the aim along with the finger from where it already is, instead of jumping to point at the
  finger: move away from the gun for more power, towards it for less, round it to turn the gun. Touching the board without moving
  changes nothing, slow drags still register, and after pushing past full power (or 0°/90°) coming back responds at once.

## 0.35.0

- Swipe anywhere to aim: a drag on empty board now aims the gun at the finger straight away (direction is the angle, distance
  from the gun the power), the same as dragging from the gun. Players swiped around the board expecting the gun to follow and
  thought the screen had frozen. A tap on empty board still only deselects a bar; aiming starts once the finger moves.

## 0.34.1

- The web page (every route, e.g. /level/08-switchback) is now served with `Cache-Control: no-cache`, so a phone always checks
  for the newest build instead of showing a level page from an older one (the 0.32.2 trash-can move looked like it only reached
  the daily puzzle). The game's code files keep their long cache: their names change with every build.

## 0.34.0

- The shared picture now reads like a finished level: a banner over the board with BANK SHOT, "LEVEL 3 COMPLETE!" (or "DAILY #2
  COMPLETE!"), the stars won (or "Solved with a hint") and the result line (name, golf score unless plain par, bounces, par, tries).

## 0.33.0

- Challenge a friend (and the daily's Share) now sends a picture of the board with the message: every trail of the round, the
  misses and the winning shot in red, as it is on screen. On iPhone Safari and the iOS app the picture goes with the text; a browser
  that can't share pictures shares the text alone.
- The message ends "I'm playing the coolest game… you should try it!", and the 🎱 is now 🏀 (a ball from the game's own designs).

## 0.32.2

- The selected bar's trash can now sits right beside its name ("Bar 1 🗑") above the rotation slider, so it reads as removing that
  bar, instead of at the far right of the row.

## 0.32.1

- Fix: the fading messages (hints given, "+3 💡", "Copied!", the Solve nudge) left an empty outlined box behind on iPhone Safari.
  The message is now removed once it has faded, instead of staying on screen fully transparent.

## 0.32.0

- Share every win: a level's win card has "📣 Challenge a friend", and the daily's Share uses the same message. It opens with a hook
  that fits the shot (first-try brag, birdie, "Don't ask how", owning up to a hint), names the level, gives the stars, bounces, par and
  tries (never where the bars went), dares a friend and ends with the game's link (a placeholder until the store link is ready:
  `SHARE_LINK` in `game/share.ts`). On a browser without a share sheet it's copied instead.

## 0.31.0

- Daily puzzle: a card at the top of the levels screen opens one puzzle a day, the same for everyone, gentle on Monday and toughest
  on Sunday. 28 puzzles made by a generator (`tools/make-dailies.ts`), each with a stored answer that uses every bar and a par.
- Daily streak: days in a row won (missing a whole day resets it). A win gives +2 💡 (+1 more for three stars, +1 only with a hint
  or Solve), and a 7, 30 and 100-day streak give +5, +15 and +50. Only the day's first win counts.
- Share: the win card's right button, and the card on the levels screen, share the result without spoilers (stars, bounces, par,
  tries, streak). On a browser without a share sheet it's copied instead. The card counts down to the next puzzle.

## 0.30.3

- During a shot, tapping a bar chip, the cannon chip, Solve, Clear, Undo or the bar's rotation controls skips to the end of the shot
  and then does what it does, in the same tap: Bar 1 is selected, the cannon chip brings the aim sliders back, Solve opens its card
  (on the tutorial it plays the answer). In 0.30.2 the tap only skipped and had to be repeated.

## 0.30.2

- During a shot, tapping a bar chip, the cannon chip, Solve, Clear or Undo (or the bar's rotation controls) now skips to the end of
  the shot, like Skip ›, instead of doing nothing. The tap only skips: it doesn't also place a bar, open the Solve card, clear the
  trails or undo.

## 0.30.1

- The hint shop's packs no longer add hints as a test: tapping one says "Purchases not activated yet" (buying comes with the App
  Store and Play Store apps) and gives nothing. Watching an ad for +3 still works.

## 0.30.0

- Board themes: Settings has a "Board theme" picker with Auto (the default: graph paper or blueprint, following the phone's light or
  dark setting) and six themes: Graph paper, Blueprint, Chalkboard, Notebook, Night and Sand. Each recolours the whole game (board,
  buttons, cards, tour) and is saved on the device. A test checks every theme keeps the walls, bars, glass, text and springs readable
  (`theme/palettes.ts`, `components/settings/Theme.tsx`, `ThemePicker.tsx`).

## 0.29.1

- The Solve button shows the hints left next to its name ("Solve 💡12"), so the balance is always in sight. Not on the tutorial,
  whose Solve is free.

## 0.29.0

- Hints are paid from a balance (💡) instead of an ad each time, so a new player sees no ads early on. Everyone starts with 15,
  enough to be helped through the first few levels. A hint costs 1; the full solution costs one less than hinting every missing
  step. The Solve card shows the balance and each cost; when there aren't enough, it offers an ad for +3 and the shop.
- Free hints: a daily gift of +2 (from the second day), +1 for each level's first unassisted three-star win, +5 for winning a world's
  last level. A short message fades in when hints are given.
- A hint shop (from the Solve card and from Settings): watch an ad for +3, or packs of 30, 80 and 200 for CA$1.99, CA$3.99 and
  CA$7.99. Real payments need the store apps, so for now a pack is a marked test purchase that just adds the hints.
- Settings shows the balance; Reset progress also resets the hints (`game/wallet.ts`, `components/hints`).

## 0.28.0

- Ball skins: Settings has a "Your ball" picker with 17 balls. Colours and finishes: Steel (the default), Chrome, Gold, Copper, Ruby,
  Mint, Onyx, Glass, Neon (it glows) and Rainbow. Designs: Beach ball, 8-ball, Smiley, Planet, Basketball, Star and Cube. The choice is
  saved on the device and shows on the board, in the tour, on the level cards and in the intro. Designs roll with the ball's travel as
  it flies (and stay at the turn they ended on). Purely a look: the physics ball is unchanged, so every ball bounces exactly the same
  and no level or answer changes (`game/skins.ts`, `components/board/BallArt.tsx`, `components/settings/BallPicker.tsx`).

## 0.27.3

- The "answer is already set up" message no longer pushes the controls up: it floats over the middle of the board in a small card,
  stays about 2 seconds and fades away, and never takes a touch (`FadeToast` in the level screen). The Solve button still shakes red.

## 0.27.2

- Once the board already matches the answer in every step (all bars, the angle and the power, e.g. after the hints or the full solution),
  Solve no longer opens the card or offers another ad: there's nothing left to give. The button shakes and flashes red, and a line over
  the buttons says "The answer is already set up: every bar, the angle and the power. Just launch!" (`solvedNudge` in `game/help.ts`).

## 0.27.1

- The Solve card is back to one Hint button, and the hint now carries on past the bars: each tap (after its ad) gives the answer's next
  step in order: Bar 1, Bar 2, Bar 3, then the launch angle, then the launch power. The button says which is next ("Hint: place Bar 2",
  "Hint: launch angle", "Hint: launch power"), skips anything already matching the answer, and goes once every step matches, leaving
  "Show the full solution". The angle and power hints set the slider and say what they set (`game/help.ts` `nextHint`). This replaces
  0.27.0's separate angle and power buttons.

## 0.27.0

- Two more hints on the Solve card: "Hint: angle" and "Hint: power", each behind its own rewarded ad (the 5-second placeholder for now).
  Each sets that one value to the stored answer's, shows the aim sliders so the change is seen, and says what it set ("Angle set to 37.6°,
  as in the answer…", under a "Your hint" heading). A hint already matched by the aim isn't offered. Like the bar hint, using one marks
  the round as helped: the win opens the next level but earns no stars or score (`game/help.ts`, new ad placements `angle` and `power`).

## 0.26.0

- The tour's pieces page is a live scene too: four small boards in turn, each with a real shot and its sounds. The ball banks off a grey
  block into the glass, lobs onto red spikes and bursts, lands on a gold spring and is thrown into the glass (with the pad's flash and
  glow), and goes into a blue portal and out of the orange one into the glass (`PIECE_DEMOS` in `game/tour.ts`; a test checks each shot
  does what its page says). Every tour page is now a live scene.

## 0.25.0

- The tour's pictures are now live scenes on the real board instead of drawings (the drawn shots didn't leave the cannon and the
  aim picture didn't match the game). Each page plays a real level with real `simulate()` shots and their bounce sounds, and a ghost finger
  does the controls: it drags out from the cannon to turn the angle and pull the power in and out, taps Launch, taps a bar chip, drags the
  bar, slides it on both arms and turns it by its handle. The goal page shows a try that misses a bar and then the one that goes in, the stars
  page counts bounces against par and pops the stars, the help page shows Solve's hint and full answer and Replay, and the last page drags a bar
  onto the tutorial's outline. Only the pieces page is still a drawing (`components/tour/TourScene.tsx`, `scenes.ts`; levels in
  `game/tour.ts` `TOUR_SCENES`, and a test checks every shot lands, or misses for the miss, inside the view).

## 0.24.2

- Fixed two music tracks playing at once: a level left underneath another screen kept its music going. Now only the level on top plays music
  (it stops when covered and picks up again when it is back on top), and when the tour hands over to Learn the ropes from a level it
  replaces that level instead of stacking a second one on it.

## 0.24.1

- The tour now shows whichever screen the app opens on (it only appeared on the level list, so reloading on a level skipped it). It lives in
  the root layout (`components/tour/TourGate.tsx`) and appears after the intro.
- It starts by asking "What should we call you?" and greets the player by first name through the tour ("Welcome to Bank Shot, Sam",
  "Ready, Sam?"). The name is saved in the About you profile on the device; "Continue without a name" and Skip work as before. A name
  already set in Settings skips the question.

## 0.24.0

- A guided tour before the first level: after "Let's go" a new player gets eight short screens with pictures drawn in the game's own style:
  what the game is (precision, real physics), the goal, aiming (angle and power), placing and turning bars, stars and par, the five
  worlds' pieces (blocks, spikes, springs, portals), where to get help (Solve, Replay), and a hand-off: "the next level teaches you each
  control step by step" with a button into Learn the ropes. Next, Back or a swipe moves through it; Skip leaves at any time. It shows
  once; Settings on the levels screen has "How to play (the tour)", and Reset progress shows it again (`game/tour.ts`, `components/tour`).

## 0.23.0

- Level locks are on: a level opens once the one before it is won (level 2 opens once the tutorial is finished or skipped). Every device
  starts fresh once with this version: wins, stars, saved shots and the tutorial are cleared.
- Settings (now also on the levels screen) has a Testing section: "Unlock all levels" (remembered) and "Reset progress" (tap twice) to
  start again from level 1 and the tutorial.
- Settings has an optional "About you": name, age, gender and country, saved on this device only (`game/profile.ts`); nothing is sent anywhere.
- Music is a session playlist: one track is picked when the app starts and plays on every level. The playlist is every MP3/M4A in
  assets/music, listed by scripts/make-playlist.mjs before each web build, so adding music is adding a file.

## 0.22.1

- After a win the Launch button reads "Replay ▶" instead of "Watch again ▶" (players found "Watch again" unclear). It still replays the winning
  shot exactly, without counting a try.

## 0.22.0

- New level "Bounce house", the gentle first level of the Springs world (before Springboard): one golden pad in the middle of the floor, the
  glass on a raised plate, two bars and nothing else. The answer drops the ball on the pad and fails if the pad is a plain block. Par 4,
  49/49 forgiving, toughness about 0.5 (the easiest way into springs).

## 0.21.1

- The win card no longer cuts the celebration short: it now waits until the spark and the burst have fully played (2 s, then a short pause),
  and fades in. It also moves out of the way of the glass: at the top of the board as before, but at the bottom when the glass is in the
  top half, so the burst is never hidden.

## 0.21.0

- New level "Relay", the Portals world's finale: two portal pairs in a row. The first pair carries the ball up to the top right, the second drops
  it into a shut box over the glass, and the three bars steer it from one to the next. A win needs the ball through both pairs. Par 4,
  49/49 forgiving, toughness about 9.3.

## 0.20.0

- New level "Turnstile" (Portals world, between Wormhole and Slingshot): a portal that turns the ball a quarter turn clockwise. The glass is
  at the bottom of a shut shaft whose walls are spiked, and the orange end of the portal is on its ceiling, so the ball must go into the blue
  end heading right to come out heading down. Without the turn the answer dies on the spikes. Par 2, 43/49 forgiving, toughness about 6.6.

## 0.19.0

- Win celebration, "light the fuse": the moment the ball settles in the glass a gold spark races along your winning shot from the cannon
  (leaving a glowing line, and hopping across portals), then the glass flashes, rings spread out of it and confetti flies up. The better the
  result the bigger the burst (three stars: 34 pieces and two rings; a hint or Solve win: a small one). It takes about 1.7 s; the win card
  waits for the burst, then its stars pop in one by one, each with a rising note. New star and burst sounds, with haptics on a phone.
  Touching the board cuts it short and goes back to playing, as it does with the card. The logic is in `game/celebration.ts`.

## 0.18.0

- Levels are in worlds, one per new idea: 1 Bars, 2 Blocks, 3 Hazards, 4 Springs, 5 Portals (`game/worlds.ts`). Inside a world the toughness
  now rises (Four millimetres before High ground and Crossfire, Slalom before Roadblock, Cushion after Spikes), and the level list has a
  header at the start of each world. Levels were rated with tools/assess-levels.ts first.
- Saved wins and stars are kept (they are saved by level name). The saved "furthest level" is worked out again from the levels already won.

## 0.17.1

- The Remove button is now a small trash can at the far right of the bar's title row (over the angle readout), well clear of the + nudge button and
  the slider, so it is not hit by accident. A removed bar can be brought back with undo.

## 0.17.0

- Undo: an undo button just before Launch steps the bars back one change at a time (place, move, turn, remove, a snap back; a drag or
  a held slider counts as one step; up to 30 steps), so an accidental drag can be put back. Faded when there is nothing to undo, and
  off during a shot (`game/history.ts`). The aim is not part of undo.

## 0.16.0

- The cannon is a chip beside the bars: tap it to switch the sliders to the aim, tap Bar 1, 2, 3 to switch to that bar. It is filled when
  you are aiming. Touching the cannon itself or its dotted aim line does the same, so the Done button is gone.
- Remove is a smaller button, well away from the +/- nudges (over the angle readout), and a bar can also be dragged down past the floor to
  take it off the board (a red strip shows where; let go there to remove it).
- Clear (the trails) moved down beside Solve to make room for the cannon chip on the bar row.

## 0.15.2

- Launching no longer deselects the bar being adjusted: its rotation slider stays up through and after the shot, instead of the aim sliders
  taking its place (players kept dragging them thinking they were still turning the bar). Done, or a touch on the dotted aim line,
  brings the aim sliders back.

## 0.15.1

- The live bounce counter no longer covers the level: it takes whichever top corner (left, centre or right) has the least of the puzzle
  under it (`game/counter.ts`; Slingshot's spiked roof is top left, so its counter sits top right).

## 0.15.0

- New level 23, "Slingshot": a portal that turns the ball a quarter turn on the way out (one-way exit) and a spring bar (Bar 3). The glass
  is on a tower in the top left under a spiked roof, with a low ceiling over the cannon. Par 3, 48/49 forgiving; it fails with the spring
  as a plain bar and with the portal turn removed.
- Scoring fix: a bounce directly below a raised glass (in its column, under the plate) wasn't counted, because the "inside the glass" test
  had no lower limit. It is now only between the rim and the plate. Stilts (par 3) and Springboard (par 4) were re-solved.

## 0.14.1

- Portals can have a one-way exit (`oneWay`): the orange end only lets the ball out, and shows a solid dot. Wormhole uses it, so the
  ball goes in once, drops into the glass and can no longer wander back out through the orange end (its answer went round twice before).

## 0.14.0

- Portals: linked pairs (`Level.portals`, blue and orange rings). A ball whose centre enters one end comes out of the other with its
  speed kept and its heading turned by an optional `turn`; it can't go straight back in. Like bars and pads, a win needs every pair used
  (the goal line says "through the portal"). Bars keep clear of portals. The trail breaks at a portal instead of drawing a line across
  the board, a ring flashes where the ball comes out, and there is a new warp sound.
- New level 22, "Wormhole": the glass is walled into a box in the bottom right and the only way in is the blue portal in the open, whose
  orange end opens inside the box. Par 2, 49/49 forgiving.

## 0.13.2

- Tray chips on levels with 4 or more bars have their dash back ("— Bar 1"): a short line icon, tighter chips and a slightly smaller
  label so five chips and Clear still fit on one row.

## 0.13.1

- Tray chips on levels with 4 or more bars read "Bar 1", "Bar 2"... again (they had shrunk to bare numbers), and a spring bar's chip
  carries a gold energy bolt in place of the length line.

## 0.13.0

- Spring bars: a bar with restitution above 1 is a spring the player places. It kicks like a pad (1.3x plus a small kick, capped at
  the launch speed), draws gold with a dark edge, has a gold tray chip, and plays the boing, burst and energised ball.
- New level 21, "Trampoline": four bars, Bar 4 a spring bar, the glass high in the top right under a spiked roof. Par 4, 43/49
  forgiving; the same shot with Bar 4 as a plain bar fails.

## 0.12.2

- A win now needs the ball to touch every spring pad, as well as every bar (a pad level could be won without its pads, which
  made its par and goal wrong). A landing that skipped a pad says so ("So close!"), and the goal line names the pads.
- Pinball re-solved under the new rule: par 10, 32/49 forgiving.

## 0.12.1

- New level 20, "Pinball": two spring pads (one on the floor, one set into the right wall as a bumper), a spiked roof just above
  the glass so a ball thrown too hard is lost, and a pillar holding the glass up. The answer kicks off both pads and bounces
  off both bars and the wall, par 6, 49/49 forgiving; the same shot with the pads as plain blocks fails.

## 0.12.0

- Spring pads: a new fixed surface (`Level.pads`, drawn as a golden plate with chevrons) that throws the ball back harder than
  it came: restitution 1.3 plus a small kick of 240 px/s along the surface normal, never above the 1120 px/s launch speed
  cap (so it can never tunnel). A pad bounce counts as a bounce like any other.
- The ball is energised by a kick: a burst ring and sparks at the pad, the pad flashing white, and a warm glow and hot ring
  round the ball that eases to a steady glow until the shot ends. New "boing" sound and a heavy haptic on a pad.
- New level 19, "Springboard": a wall, a pad on the floor and the glass up in the top right; the stored answer uses the
  pad (the solver requires a pad hit on pad levels), par 4, 49/49 forgiving. The same shot with the pad as a plain block fails.

## 0.11.9

- Tutorial: the outline showing where to drag each bar is red again, bolder and with a soft glow (it was a pale dashed grey
  that was easy to miss), and the board is asked to redraw whenever the outline changes, which on Safari could leave it
  undrawn.

## 0.11.8

- Move handles: a selected bar now has two dotted arms out of its centre, one along x and one along y, each ending in a
  two-way arrow grip. Dragging a grip slides the bar along that axis with the finger well clear of it (the bar itself still
  drags freely). The arms keep to the board and stay off the rotate lever.

## 0.11.7

- After a refused rotation drag the slider thumb now really snaps back to the bar's angle when the finger lifts (it was
  staying where the finger left it while the number showed the real angle).

## 0.11.6

- The bar rotation slider no longer runs ahead of a bar that cannot turn (it would clip the glass, a block or another bar):
  the thumb pulls back to the real angle, shakes and turns red for a moment.

## 0.11.5

- Hitting a hazard no longer opens an "Ouch!" card that had to be dismissed. The ball bursts in a ring and sparks where it
  was destroyed (with the destroyed sound and the red ×), and the next shot can be set up straight away.

## 0.11.4

- New level 18, "Cushion": the glass is shut in under a spiked roof and can only be reached through a narrow gap beside the
  right wall of the board, so the answer banks off that wall. Par 3, two bars.
- A new analysis tool, `tools/needs-walls.ts`, checks whether a level needs the board's own walls (it searches again with the
  floor and edges deadly).

## 0.11.3

- New level 17, "Skyline": Penthouse with a fifth bar. The glass is up under a spiked roof; the ball goes out high past the
  spiked walls, uses all five bars and comes home from the right. Par 8.

## 0.11.2

- New level 16, "Penthouse": Boomerang's garage raised 120 up on stilts, with a spiked roof and back wall, a bed of spikes
  underneath, four bars and three spiked walls. The ball has to fly out high and come home from the right. Par 6.

## 0.11.1

- New level 15, "Boomerang": the glass sits in a spiked-roof garage by the cannon, open only on the right, with four bars and
  three spiked walls. The ball has to fly out over the walls and come back home from the right. Par 6.

## 0.11.0

- New level 14, "Needle", from your mockup: five bars, three walls with spikes along one edge each, and spikes either
  side of the glass. Par 7.
- Spikes can now sit on one edge of a block (a thin hazard laid along the edge, drawn under the block so only the outer spikes show).
- With four or more bars the tray shows just the numbers, so five bars fit on one row.

## 0.10.2

- New level 13, "Stilts": the glass stands on stilts, 190 up, over a bed of spikes, behind a wall, with three bars. Measured at
  6.0 on the toughness scale (BACKLOG.md).
- Par is now never below the number of bars (a feather-light touch on a bar counts as touching it but not as a bounce, which
  had let the solver find a par below the bar count).

## 0.10.1

- New level 12, "Moat": spiked patches on both sides of the glass, a spiked block hanging from the ceiling and a wall on the
  way, with three bars. The ball has to stay under the hanging spikes, clear the wall and drop straight in. Par 4.

## 0.10.0

- Hazards: spiked red shapes that destroy the ball. A hit ends the shot (it counts as a try), shows "Ouch!"
  and plays a new destroyed sound (a crack, a falling zap, shards and a boom).
- New level 11, "Spikes": spikes on the floor and the ceiling and a wall to clear, with three bars. Par 4.

## 0.9.0

- New level 10, "Gauntlet": the first with four bars and three blocks. The glass sits in a pit between a ceiling
  block and a wall, so the ball has to clear the first wall, pass under the hanging block and drop in from above.
  Par 8.

## 0.8.4

- New level 9, "Switchback": a wall from the floor and a slanted block overhead, with three bars. The slanted block is
  a free bank shot: the par-5 solution bounces off it first.

## 0.8.3

- Sliders on iPhone: a horizontal drag that drifted a little up or down could be taken by Safari as a page
  gesture, which froze the slider or bounced it back. Sliders now keep their touches, as the board already did.
- Touching the angle or power controls while a shot is playing now skips the shot (like tapping the board), then
  lets you adjust.

## 0.8.2

- Power and Angle sliders: they keep their own value while a finger is on them (they could snap back a step
  when the screen redrew, most often while a shot was playing), and dragging one no longer redraws the whole
  level on every step.

## 0.8.1

- New level 8, "Slalom": one block rises from the floor and another hangs from the ceiling, so the ball has to be
  threaded between them, still touching both bars. Par 4.

## 0.8.0

- New: fixed bouncy blocks, solid shapes on the board that the ball bounces off (softly, like the walls).
  They're drawn grey with an ink outline, and bars can't be placed against them.
- New level 7, "Roadblock": a tall block stands between the cannon and the glass, and both bars still have to be
  used.

## 0.7.4

- The tutorial level no longer gives stars or points, even when you replay it and launch the shot yourself.
  Any score an earlier version saved for it is cleared.
- Solve on the tutorial level just solves it: no ad, no help card.

## 0.7.3

- A tutorial hint now disappears as soon as it's for a step you've already done (it could hang around asking
  for the angle after you'd set it with the slider).
- The aim steps teach both ways: the finger alternates between dragging the dotted line and sliding the slider,
  for the angle and for the power, and either way is accepted.

## 0.7.2

- Fixed the Angle and Power sliders sometimes jumping to their end when dragged (seen in the tutorial): they
  now work out where they are on every touch.
- The tutorial finger now teaches both ways of aiming: it drags the dotted line for the angle, then slides the
  Power slider for the power. The tutorial aim snaps onto the answer when you let go, not while you drag.

## 0.7.1

- The tutorial card no longer looks locked once you've done it: it shows "Tutorial ✓" and your winning shot
  (with Replay). Tapping the card, or ⚙ "Replay the tutorial", runs the guided tutorial again; "Try it
  yourself" after winning it gives the plain level.
- The tutorial caption no longer shows "n of 12".

## 0.7.0

- A guided tutorial: a new level 1, "Learn the ropes", with three bars. A new player starts in it, and the
  ghost finger leads them step by step to a winning shot: place the bars, drag each onto its dashed outline,
  turn it to match, set the angle, set the power, launch. Each step waits for you to do it, and things snap
  into place when you're close, so the first launch lands.
- Everywhere else the finger only shows the first bar to place. "Stop tips" on its caption, or the Tips switch
  in ⚙, stops it for good; "Skip tutorial" skips the tutorial; ⚙ can replay it.
- Dragging the dotted aim line is now an exact rubber band: turning it no longer changes the power, and
  pulling it out no longer changes the angle.
- A bar's turn handle moves to its other end if a move would leave it hanging off the edge of the board.

## 0.6.0

- Idle coach: sit still on a level for a few seconds and a ghost finger shows what to do next, with a
  caption: tap a bar to put it on the board, drag a bar into the ball's path, then tap Launch. Any touch
  hides it.

## 0.5.4

- The goal line names the bounce target: "Goal: into the glass in 3 bounces, off all 3 bars".

## 0.5.3

- Replay on a won level's card: opens the level with your winning shot set up (bars, angle, power),
  plays it once, then you can tweak it and try for fewer bounces. Not counted as a try.

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
