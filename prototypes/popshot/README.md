# Popshot (working title)

Browser prototype of the first micro-game for a separate collection app (not part of Clink).
Open `index.html` in a browser, on a phone if possible. One file, no build step.

- A tower of balloons sways; the sway rolls up the tower as a wave, so the arrow has to lead it.
- Three arrows per level. Press anywhere and pull back to draw the string, let go to shoot: the pull sets the arrow's speed
  (520 to 1300 units/s; each level's wave is designed around 950). A tap mid-flight splits the arrow into three (once per arrow).
  Keyboard: hold Space to draw, let go to shoot.
- Points per pop grow with the streak; gold balloons double the rest of that arrow; bombs pop neighbours;
  armour stops an arrow and breaks on the second hit. Survivors drop down after each arrow.
- Camera starts zoomed on the bottom of the tower and pulls out as the arrow climbs; full view after each shot.
- The rhythm dial by the crossbow marks when each arrow was fired and how many it popped. The sway is a pure
  function of time, so the same moment gives the same result.

Lives here until the collection has its own repository; then move it there as its `reference/prototype.html`.
