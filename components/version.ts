import { version } from '../package.json';

// Which build is this? The app version is package.json's (app.json `expo.version` is kept equal; reading
// package.json directly avoids a stale cached app config in web builds). The build is the git commit it
// was built from: Vercel sets EXPO_PUBLIC_COMMIT (see vercel.json); local and Expo Go runs show "dev".
// Store builds also carry ios.buildNumber / android.versionCode in app.json.
export const APP_VERSION = version;
export const BUILD = (process.env.EXPO_PUBLIC_COMMIT ?? '').slice(0, 7) || 'dev';
export const VERSION_LABEL = `Bank Shot v${APP_VERSION} · build ${BUILD}`;
