import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { load, saveActive, useStore } from '@/lib/store';
import { startAutoSync } from '@/lib/sync';
import { C } from '@/ui/kit';
import { OverlayHost } from '@/ui/overlay';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { ready } = useStore();

  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    load().then(() => {
      sub = startAutoSync();
      SplashScreen.hideAsync().catch(() => {});
    });
    // Android can kill a backgrounded app without warning, so flush the workout in progress on the way out.
    const flush = AppState.addEventListener('change', (s) => { if (s !== 'active') saveActive(); });
    return () => { sub?.remove(); flush.remove(); };
  }, []);

  if (!ready) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bar },
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: '500', fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: C.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session" options={{ title: 'Workout' }} />
        <Stack.Screen name="exercises" options={{ title: 'Exercises' }} />
        <Stack.Screen name="create-exercise" options={{ title: 'Create Exercise' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
        <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
        <Stack.Screen name="history/[id]" options={{ title: 'Workout' }} />
        <Stack.Screen name="statistics" options={{ title: 'Statistics' }} />
        <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="report" options={{ title: 'Monthly report' }} />
        <Stack.Screen name="assistant" options={{ title: 'Connect Claude' }} />
      </Stack>
      <OverlayHost />
    </>
  );
}
