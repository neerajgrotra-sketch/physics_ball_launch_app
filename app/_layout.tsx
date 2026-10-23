import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '../theme/colors';

export default function RootLayout() {
  const c = useColors();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.panel },
          headerTintColor: c.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.panel },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Bank Shot' }} />
        <Stack.Screen name="level/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}
