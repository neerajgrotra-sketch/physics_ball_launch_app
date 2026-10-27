import { Platform, Share } from 'react-native';

/** A base64 PNG as a File, built synchronously so the browser still counts the share as part of the tap. */
function pngFile(base64: string): File | null {
  try {
    const bin = atob(base64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], 'bank-shot.png', { type: 'image/png' });
  } catch {
    return null;
  }
}

/**
 * Opens the share sheet (WhatsApp, Messages…) with a message and, if given, a picture (a base64 PNG of the board). A browser that
 * can't share files shares the text alone; one without a share sheet at all (most desktops) copies the text and says so via `copied`.
 */
export function shareText(text: string, copied: (note: string) => void, image?: string | null) {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (!nav) return;
    if (!nav.share) {
      nav.clipboard?.writeText(text).then(() => copied('Copied! Paste it to a friend'), () => {});
      return;
    }
    const file = image ? pngFile(image) : null;
    const withPicture = file && nav.canShare?.({ files: [file] });
    nav.share(withPicture ? { text, files: [file] } : { text }).catch(() => {});
    return;
  }
  // iOS takes the picture as a data URL beside the message; Android shares the message only.
  Share.share(image && Platform.OS === 'ios' ? { message: text, url: `data:image/png;base64,${image}` } : { message: text }).catch(() => {});
}
