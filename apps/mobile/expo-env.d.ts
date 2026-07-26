/// <reference types="expo/types" />

// Augment NodeJS.ProcessEnv with the Jelementi public env vars consumed by the
// WebView shell. Expo inlines `EXPO_PUBLIC_*` at build time via Babel.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_SITE_URL?: string;
    readonly EXPO_PUBLIC_ARTICLE_PATH?: string;
  }
}
