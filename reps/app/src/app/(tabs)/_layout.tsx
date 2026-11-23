import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useStore } from '@/lib/store';
import { C, type IconName } from '@/ui/kit';

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
  };

export default function TabsLayout() {
  useStore(); // re-render when the theme changes
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.bar, borderTopColor: C.bar },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.text,
        sceneStyle: { backgroundColor: C.bg },
      }}>
      {/* The Workout tab is the index route so the app opens on it. */}
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="index" options={{ title: 'Workout', tabBarIcon: icon('barbell-outline') }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', tabBarIcon: icon('fitness-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
