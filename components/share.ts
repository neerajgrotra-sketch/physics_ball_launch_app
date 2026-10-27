import { Platform, Share } from 'react-native';

/**
 * Opens the share sheet (WhatsApp, Messages…) with a message. A browser without one (most desktops) copies it instead and says so
 * through `copied`.
 */
export function shareText(text: string, copied: (note: string) => void) {
  const nav = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && !nav.share) {
    nav.clipboard?.writeText(text).then(() => copied('Copied! Paste it to a friend'), () => {});
    return;
  }
  Share.share({ message: text }).catch(() => {});
}
