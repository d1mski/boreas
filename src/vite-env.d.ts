/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIRMS_MAP_KEY?: string;
  readonly VITE_UMAMI_SRC?: string;
  readonly VITE_UMAMI_ID?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  umami?: { track: (event: string, data?: Record<string, unknown>) => void };
}
