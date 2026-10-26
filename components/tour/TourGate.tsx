import { useRouter } from 'expo-router';
import { TUTORIAL_ID } from '../../game/coach';
import { useTips } from '../coach/Tips';
import { Tour } from './Tour';

/**
 * Shows the guided tour over whatever screen the app opened on (the level list, or a level after a reload), once the intro has gone, until
 * the player has seen or skipped it. Settings brings it back by marking it unseen (restartTour).
 */
export function TourGate({ hidden }: { hidden: boolean }) {
  const router = useRouter();
  const { tourSeen, finishTour, restartTutorial } = useTips();
  if (hidden || tourSeen) return null;
  return (
    <Tour
      onStartTutorial={() => {
        finishTour();
        restartTutorial();
        router.push({ pathname: '/level/[id]', params: { id: TUTORIAL_ID } });
      }}
      onSkip={finishTour}
    />
  );
}
