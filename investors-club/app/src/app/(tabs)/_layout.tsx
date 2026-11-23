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
      {/* Market is the index route so the app opens on it. */}
      <Tabs.Screen name="index" options={{ title: 'Market', tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio', tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('school-outline') }} />
      <Tabs.Screen name="class" options={{ title: 'Class', tabBarIcon: icon('trophy-outline') }} />
    </Tabs>
  );
}
