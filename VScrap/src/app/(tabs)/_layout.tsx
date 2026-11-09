import React from 'react';
import { Tabs } from 'expo-router';
import { AppTabBar } from '@/components/AppTabBar';
import { useTheme } from '@/context/ThemeContext';

export default function TabsLayout() {
  const { themeColors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: themeColors.bg },
      }}
      tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="queue" options={{ title: 'Queue' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
