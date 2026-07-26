import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Phase 0 WebView shell.
 *
 * Opens the same article route served by the SvelteKit web app
 * (configurable via EXPO_PUBLIC_SITE_URL / EXPO_PUBLIC_ARTICLE_PATH).
 * Navigation is restricted to the configured site origin; a full
 * trusted-origin + external-link routing pass lands in Phase 4 alongside
 * push and the native audio bridge.
 */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;
const ARTICLE_PATH = process.env.EXPO_PUBLIC_ARTICLE_PATH ?? '/articles/tristan-da-cunha';

function originOf(url: string): string {
  const match = url.match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : url;
}

export default function ArticleWebView() {
  if (!SITE_URL) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>EXPO_PUBLIC_SITE_URL is not configured.</Text>
        <Text style={styles.muted}>Expected route: {ARTICLE_PATH}</Text>
      </View>
    );
  }

  const url = `${SITE_URL.replace(/\/$/, '')}${ARTICLE_PATH}`;
  const origin = originOf(url);

  return (
    <View style={styles.container}>
      <WebView source={{ uri: url }} originWhitelist={[origin]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#666', textAlign: 'center', marginBottom: 4 },
});
