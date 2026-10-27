import { useState } from 'react';
import { useDaily } from '../components/daily/DailyProvider';
import { TIER_NAMES } from '../game/daily';
import { LevelGame } from './level/[id]';

/**
 * Today's daily puzzle, in the normal level game (daily mode). The day is fixed when the screen opens, so a puzzle started before
 * midnight still counts for the day it was opened on. Start over gives a clean slate, like a level.
 */
export default function DailyScreen() {
  const daily = useDaily();
  const [{ day, number, level }] = useState(daily.today);
  const [round, setRound] = useState(0);
  return (
    <LevelGame
      key={round} level={level} index={-1} guide={false} onReplay={() => setRound((r) => r + 1)}
      daily={{ number, tier: TIER_NAMES[level.tier], onWin: (r) => daily.won(day, r), onShare: (picture) => daily.share(day, picture) }}
    />
  );
}
