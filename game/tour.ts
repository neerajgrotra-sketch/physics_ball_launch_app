// The guided tour: a few screens between the intro and the first level that explain what the game is, how to win, how the controls work,
// what the board pieces are, and where to get help, ending with a hand-off to the tutorial level. Pure content: no UI imports, so a test
// can check it. The pictures are drawn by components/tour/TourPicture.tsx, one per `picture`.

export type TourPicture = 'welcome' | 'goal' | 'aim' | 'bars' | 'stars' | 'pieces' | 'help' | 'ready';

export interface TourPage {
  picture: TourPicture;
  /** A small label over the title. */
  kicker: string;
  title: string;
  body: string;
  /** Short bullet points under the body (optional). */
  points?: string[];
}

export const TOUR: TourPage[] = [
  {
    picture: 'welcome', kicker: 'Welcome to Bank Shot', title: 'A game of precision',
    body: 'Every bounce is real physics. Set the shot just right and the ball does exactly the same thing every time, so each try teaches you the next.',
  },
  {
    picture: 'goal', kicker: 'The goal', title: 'Bounce it into the glass',
    body: 'Fire the steel ball from the cannon so it ends up resting in the red glass.',
    points: ['It has to bounce off every bar you are given', 'Walls, floor and blocks bounce too', 'Your last few shots stay on screen as faint trails'],
  },
  {
    picture: 'aim', kicker: 'Aiming', title: 'Angle and power',
    body: 'Drag out from the cannon: the direction sets the angle and the distance sets the power. The dotted line shows where the ball starts to fly.',
    points: ['Angle and Power sliders for fine control', '− and + nudge by the smallest step', 'Tap the cannon chip to come back to aiming'],
  },
  {
    picture: 'bars', kicker: 'Your bars', title: 'Place, slide, turn',
    body: 'Tap a bar chip to put that bar on the board, then make the ball bounce where you want.',
    points: ['Drag a bar, or its arrow grips, to move it', 'Drag the round handle to turn it', 'Undo puts a bar back; drag it below the floor to remove it'],
  },
  {
    picture: 'stars', kicker: 'Scoring', title: 'Fewer bounces, more stars',
    body: 'Each level has a par: the fewest bounces we found. Land in that many or fewer for three stars.',
    points: ['★★★ at par or better', '★★ within two of par', 'Every win unlocks the next level'],
  },
  {
    picture: 'pieces', kicker: 'What you will meet', title: 'Five worlds of tricks',
    body: 'Each world adds something new to bounce off, avoid or use.',
    points: ['Grey blocks: walls to bank off', 'Red spikes: they destroy the ball', 'Gold springs: they throw the ball back harder', 'Portals: in the blue, out of the orange'],
  },
  {
    picture: 'help', kicker: 'Stuck?', title: 'Help is one tap away',
    body: 'Tap Solve for a hint, which places the next bar for you, or for the whole answer. A win with help still opens the next level.',
    points: ['Replay shows your winning shot again', 'Clear wipes the old trails'],
  },
  {
    picture: 'ready', kicker: 'Ready?', title: 'Learn the ropes',
    body: 'The next level is a guided one: a hand shows you each control, step by step, and waits for you to do it. Then the real levels begin.',
  },
];
