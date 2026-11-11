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

## Source

`index.html` is built; edit `src/` and run `cd src && python3 build.py ../index.html`.
- `src/matchcore.js`: Stickler rules (pure, no DOM), shared by the game and the verifier.
- `src/puzzles.src.js`: the puzzles. Never edit `puzzles.gen.js`: run `cd src && node verify.js`, which checks each
  puzzle has an answer in exactly n steps (move puzzles: none in fewer) and stores one answer for the Hint.
- `src/pop.*`: Popshot. `src/sound.js`: shared synthesised sound. `src/app.js`: splash, home, moving between games.

The name: no game called Smidge turned up in a quick web search; do a proper trademark search before the store
listing (Clink was renamed in 0.74.0 over a trademark clash). Move this to its own repository when one exists.
