import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TermsGate } from '@/components/TermsGate';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

export default function RootLayout() {
  useAppBootstrap();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootContent() {
  const { themeColors, isDark } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.bg },
          animation: 'fade',
        }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <TermsGate />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
