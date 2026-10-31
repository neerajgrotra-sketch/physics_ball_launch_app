import { usePathname, useRouter } from 'expo-router';
import { TUTORIAL_ID } from '../../game/coach';
import { useTips } from '../coach/Tips';
import { Tour } from './Tour';

/**
 * Shows the guided tour over whatever screen the app opened on (the level list, or a level after a reload), once the intro has gone, until
 * the player has seen or skipped it. Settings brings it back by marking it unseen (restartTour).
 */
export function TourGate({ hidden }: { hidden: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const { tourSeen, finishTour, restartTutorial } = useTips();
  // A friend arriving from a challenge link goes straight to the challenge (and then to the app page); the tour waits for the app.
  if (hidden || tourSeen || path.startsWith('/challenge') || path.startsWith('/get')) return null;
  return (
    <Tour
      onStartTutorial={() => {
        finishTour();
        restartTutorial();
        // Over a level (the app was reloaded on one), swap that level for the tutorial rather than stacking a second level on it.
        const to = { pathname: '/level/[id]' as const, params: { id: TUTORIAL_ID } };
        if (path.startsWith('/level/')) router.replace(to); else router.push(to);
      }}
      onSkip={finishTour}
    />
  );
}
