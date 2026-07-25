// FIRST import, deliberately, and a side-effect import rather than a call:
// import statements are hoisted above every statement in this file, so calling
// the migration here would still run it AFTER App's module graph had evaluated.
// useFacadeOverride reads storage while it is being imported, so the move from
// settl- to boreas- keys has to happen during module evaluation, ahead of App.
import './utils/migrateBrand';

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/major-mono-display/400.css';
import 'leaflet/dist/leaflet.css';
import './utils/leafletIconFix';
import './index.css';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { FontScaleProvider } from './contexts/FontScaleContext';
import { createUmamiScript } from './utils/telemetry';

// Telemetry — both privacy-light and strictly opt-in via env. Unset = no
// script loads, no request leaves the page. See .env.example.
const umamiSrc = import.meta.env.VITE_UMAMI_SRC;
const umamiId = import.meta.env.VITE_UMAMI_ID;
if (umamiSrc && umamiId) {
  document.head.appendChild(createUmamiScript(umamiSrc, umamiId));
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  // Lazy so Sentry never weighs down the entry chunk.
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn: sentryDsn, tracesSampleRate: 0 });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <FontScaleProvider>
        <App />
      </FontScaleProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
