// Web entry. Skia on web runs on CanvasKit (WebAssembly), and Skia's API binds to it the moment any
// Skia module is evaluated, so CanvasKit has to finish loading before the app (and its routes) load.
// `npm run web:setup` copies canvaskit.wasm into public/, which is served from the site root.
import '@expo/metro-runtime';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// A plain require (not import()) keeps the app in the same bundle while still deferring its evaluation.
LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => require('expo-router/entry'));
