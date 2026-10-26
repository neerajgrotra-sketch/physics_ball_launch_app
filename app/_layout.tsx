import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RewardedAdsProvider } from '../components/ads/RewardedAds';
import { TipsProvider } from '../components/coach/Tips';
import { SoundSettingsProvider } from '../components/feedback/SoundSettings';
import { ProgressProvider } from '../components/progress/ProgressProvider';
import { Intro } from '../components/splash/Intro';
import { TourGate } from '../components/tour/TourGate';
import { FONTS, useColors } from '../theme/colors';

// The launch screen (app.json, expo-splash-screen) stays up until the intro, which starts on the same
// picture, is on screen to take over.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const c = useColors();
  const [intro, setIntro] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold,
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
  });
  // On web the faces are registered by now and swap in when they arrive, so don't wait: Safari's font
  // check can hang and time out even after the fonts load, which left the page blank. Elsewhere wait,
  // but never get stuck on a font error.
  if (!fontsLoaded && !fontError && Platform.OS !== 'web') return null;

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: c.panel }]}>
      {/* On wide screens (web, iPad) the game keeps the prototype's 560px column. */}
      <View style={styles.column}>
        <ProgressProvider>
          <SoundSettingsProvider>
            <RewardedAdsProvider>
              <TipsProvider>
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: c.panel },
                headerTintColor: c.ink,
                headerTitleStyle: { fontFamily: FONTS.condensedBold, fontSize: 22 },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: c.panel },
              }}
            >
              <Stack.Screen name="index" options={{ title: 'Bank Shot', headerShown: false }} />
              <Stack.Screen name="level/[id]" options={{ title: '' }} />
            </Stack>
            <TourGate hidden={intro} />
              </TipsProvider>
            </RewardedAdsProvider>
          </SoundSettingsProvider>
        </ProgressProvider>
      </View>
      {intro && <Intro onDone={() => setIntro(false)} onShown={() => SplashScreen.hideAsync().catch(() => {})} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 560 },
});
