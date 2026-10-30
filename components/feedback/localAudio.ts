import { Asset } from 'expo-asset';
import { setAudioModeAsync } from 'expo-audio';

// Phone audio plays from files on the phone. In Expo Go (and any development build) a bundled sound is served by the PC's dev
// server, and expo-audio hands that http:// address to iOS, which streams it: the music stalled for a moment at each level start
// and on its first loops while the stream buffered. Store builds already ship the files locally; this makes development match.

type Shared = { modeSet?: boolean; files: Map<number, Promise<string | number>> };
const shared: Shared = ((globalThis as { __bankShotAudio?: Shared }).__bankShotAudio ??= { files: new Map() });

/** A bundled sound as a file on the phone (downloaded once and cached), or the module itself if that fails. */
export function localSound(module: number): Promise<string | number> {
  let file = shared.files.get(module);
  if (!file) {
    file = Asset.fromModule(module).downloadAsync()
      .then((a) => a.localUri ?? module)
      .catch(() => module);
    shared.files.set(module, file);
  }
  return file;
}

/** The sound's source for a player: { uri } for a downloaded file, else the module. */
export const sourceOf = (file: string | number) => (typeof file === 'string' ? { uri: file } : file);

/**
 * Play even with the silent switch on, mixing with other audio. Once per app run: every call re-applies the iPhone's audio session
 * category, which can hiccup whatever is playing, and it used to run each time a level opened, just as the music carried on.
 */
export function setAudioModeOnce() {
  if (shared.modeSet) return;
  shared.modeSet = true;
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => { shared.modeSet = false; });
}
