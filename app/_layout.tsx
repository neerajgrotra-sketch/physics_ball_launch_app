import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ProgressProvider } from '../components/progress/ProgressProvider';
import { FONTS, useColors } from '../theme/colors';

export default function RootLayout() {
  const c = useColors();
  const [fontsLoaded] = useFonts({
    Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold,
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
  });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProgressProvider>
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
          <Stack.Screen name="index" options={{ title: 'Bank Shot' }} />
          <Stack.Screen name="level/[id]" options={{ title: '' }} />
        </Stack>
      </ProgressProvider>
    </GestureHandlerRootView>
  );
}
