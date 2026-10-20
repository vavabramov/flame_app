import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ErrorView, LoadingView } from '@/components/StatusViews';
import { HabitStoreProvider, useHabitStore } from '@/features/habits/habit-store';
import { configureNotificationHandler } from '@/features/reminders/reminder.service';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotificationHandler();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <HabitStoreProvider>
        <RootNavigator />
      </HabitStoreProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status, loadError, retry, settings } = useHabitStore();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  if (status === 'loading') return <LoadingView />;
  if (status === 'error') return <ErrorView message={loadError ?? 'Unknown error'} onRetry={retry} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!settings.onboardingCompleted}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={settings.onboardingCompleted}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="habits/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="habits/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reading/[id]" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
