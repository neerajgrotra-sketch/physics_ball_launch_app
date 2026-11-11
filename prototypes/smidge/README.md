# Smidge (working title)

A separate app (not part of Clink): a box of tiny games. Browser prototype; open `index.html`, on a phone if possible.
Splash screen ("Let's play"), then a home menu of games. Progress and the sound setting are kept in the browser.

## Games

**Popshot**: archery at a swaying balloon tower. Press anywhere and pull back, let go to shoot; the pull sets the
arrow's speed. A tap mid-flight splits the arrow. Three arrows a level, 8 levels. The sway rolls up the tower as a wave;
from level 2 the crossbow rocks on a tripod and fires along its tilt; from level 3 wind drifts the arrow and leans the
tower (gusts later). Gold, bomb and armour balloons. Rhythm dial and power-bar marks show earlier shots.

**Stickler**: matchstick puzzles in three packs, 22 puzzles.
- Take away (8): remove n sticks to leave exactly m squares (any size; every stick left must be part of a square), or none.
- Shift (6): move n sticks (drag, or tap then tap a spot) to make exactly m squares.
- Fix the sum (8): seven-segment sums; move sticks so the sum is true and every digit stays a real digit.
A live square count, undo, reset and a Hint (the next step of a stored answer; a star only without hints).
The win card closes (✕, "Look at the board", a tap outside or Esc) to leave the solved board on show; Reset then reads
"Play again", Hint reads "Next ›", and a "Solved" bar brings the card back.

**Slice**: one swipe cuts a paper shape on a cutting mat. Five shapes a round: halves, cut off a quarter, halves
through a pin, and a turning shape with a hole (the hole counts). 100 points for a perfect cut, off by 1% is 88.
A daily round (same shapes for everyone, by date) with a copyable emoji result, and practice rounds.

**Skim**: skip stones across a lake. Pull back and let go (pull length = speed, direction = angle). A stone skips when it
meets the water at under 20°, wave slope included, while still fast; each touch costs speed, more for steeper touches.
Five stones; a point a skip, +2 for a skip inside a floating ring. Daily lake (wind, waves, rings by date) and practice.

**Untangle**: drag pins until no strings cross. 12 levels, 6 to 28 pins. Each level is the crossing points of n straight
lines joined along each line (always flat-solvable), scrambled onto a circle. Stars by time.

**Pour**: hold to pour, let go on the line. The level comes from how much has landed and the glass's width at each
height (narrow parts rise fast); liquid already falling still lands after you let go. Five glasses: tumbler, cone,
flask or vase, two lines (two pours), and a leaky glass checked a second after you stop. Daily round and practice.

**Eyeball**: six judge-by-eye tests (middle of a line, right angle, centre of a circle, half an angle, make a square,
balance point of a triangle). Drag or touch, let go to lock in; the true answer is drawn over yours. Daily and practice.

**Switchboard**: a tap flips a bulb and its neighbours; switch every bulb off. 12 boards, 3x3 to 5x5, three flip
patterns (plus, corners, ring). Boards are made by pressing random bulbs on a dark board, and a GF(2) solver gives
par (the fewest taps) and the Hint. Three stars at par.

**Crack the Code**: a padlock and clue lines about guesses at its code ("682: one digit right and in the right place").
Exactly one code fits: the generator adds clues that each rule out a share of the codes until one is left, then drops
any clue it can spare. Codes use different digits. Tap a digit on a clue to mark it out (✗) or in (✓) everywhere.
15 levels (three digits, four digits, tricky: nothing is ever in place) and a daily that gets harder through the week.
Stars: no wrong tries 3, one 2; hints cap them. `node src/code.test.cjs` checks every level and a year of dailies.

## Source

`index.html` is built; edit `src/` and run `cd src && python3 build.py ../index.html`.
- `src/matchcore.js`: Stickler rules (pure, no DOM), shared by the game and the verifier.
- `src/puzzles.src.js`: the puzzles. Never edit `puzzles.gen.js`: run `cd src && node verify.js`, which checks each
  puzzle has an answer in exactly n steps (move puzzles: none in fewer) and stores one answer for the Hint.
- `src/slice.js`, `src/skim.js`, `src/untangle.js`, `src/pour.js`, `src/eyeball.js`, `src/switchboard.js`: each starts with its pure part (SliceGeo, SkimPhys, UntangleGen, PourPhys, EyeGeo, SwitchCore);
  `node src/logic.test.cjs` checks them (cuts, every Untangle level solvable, Skim skip spread, determinism).
- `src/pop.*`: Popshot. `src/sound.js`: shared synthesised sound. `src/app.js`: splash, home, moving between games.

The name: no game called Smidge turned up in a quick web search; do a proper trademark search before the store
listing (Clink was renamed in 0.74.0 over a trademark clash). Move this to its own repository when one exists.
