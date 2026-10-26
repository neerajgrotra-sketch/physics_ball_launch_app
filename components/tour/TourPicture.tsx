import type { TourPicture as Kind } from '../../game/tour';
import { TourScene } from './TourScene';

// The pictures in the guided tour: every page is a live scene on the real board (TourScene: real shots, sounds and a ghost finger).

export function TourPicture({ kind, width }: { kind: Kind; width: number }) {
  return <TourScene key={kind} kind={kind} width={width} />;
}
