import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Root layout for the Expo Router file-based routes.
 *
 * Phase 0 ships a single screen: a WebView that hosts the same web reader
 * the browser uses. There is no React Native article renderer in this app —
 * the editorial layout lives entirely in the SvelteKit app.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
