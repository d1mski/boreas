/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIRMS_MAP_KEY?: string;
  readonly VITE_NOMINATIM_CONTACT?: string;
  readonly VITE_WINDY_KEY?: string;
  readonly VITE_UMAMI_SRC?: string;
  readonly VITE_UMAMI_ID?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected from package.json by vite `define` — see vite.config.ts. */
declare const __APP_VERSION__: string;

interface Window {
  umami?: { track: (event: string, data?: Record<string, unknown>) => void };
}
