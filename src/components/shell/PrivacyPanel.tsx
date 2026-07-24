import { useEffect } from 'react';
import { cacheClear } from '../../utils/persistentCache';

interface Props {
  open: boolean;
  onClose: () => void;
}

const RECIPIENTS = [
  'Open-Meteo (weather, climate, air, marine, flood, elevation)',
  'Nominatim/OSM (addresses)',
  'Overpass (nearby places)',
  'Wikipedia (nearby articles)',
  'USGS (earthquakes)',
  'NASA EONET+FIRMS (wildfires)',
  'Windy (webcams, if enabled)',
  'GeoJS (rough IP location once, to center the map)',
  'CARTO (map tiles)',
];

function handleExport() {
  const raw = localStorage.getItem('settl-saved-locations-v1') ?? '[]';
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'settl-saved-locations.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function handleWipe() {
  if (!window.confirm('Delete all saved locations, settings, and cached data on this device?')) return;
  await cacheClear();
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('settl-')) localStorage.removeItem(k);
  }
  window.location.reload();
}

export function PrivacyPanel({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-panel-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] flex flex-col bg-panel border border-edge rounded-lg shadow-panel-strong"
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-edge flex items-center gap-2 shrink-0">
          <span className="inline-block w-1.5 h-1.5 bg-cyan" />
          <span
            id="privacy-panel-title"
            className="text-[10px] font-mono uppercase tracking-widest text-cyan"
          >
            Privacy &amp; Data
          </span>
          <span className="flex-1" />
          <button
            onClick={onClose}
            aria-label="Close privacy panel"
            className="w-6 h-6 flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <section>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1.5 flex items-center gap-2">
              <span>What leaves your browser</span>
              <span className="flex-1 h-px bg-edge" />
            </div>
            <p className="text-[10px] font-mono text-ink leading-snug mb-2">
              Coordinates you pin are sent directly to these services to fetch data; settl. has no server of its own:
            </p>
            <ul className="space-y-1">
              {RECIPIENTS.map((r) => (
                <li key={r} className="text-[10px] font-mono text-muted leading-snug pl-3 relative">
                  <span className="absolute left-0 text-dim">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1.5 flex items-center gap-2">
              <span>What&rsquo;s stored on this device</span>
              <span className="flex-1 h-px bg-edge" />
            </div>
            <p className="text-[10px] font-mono text-ink leading-snug">
              Saved locations and settings (localStorage) and a data cache (IndexedDB), nothing else. No accounts, no cookies.
            </p>
          </section>

          <section>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1.5 flex items-center gap-2">
              <span>Controls</span>
              <span className="flex-1 h-px bg-edge" />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleExport}
                className="w-full text-left px-3 py-2 border border-edge rounded-md bg-void text-[10px] font-mono uppercase tracking-widest text-ink hover:border-cyan hover:text-cyan transition-colors"
              >
                Export saved locations (JSON)
              </button>
              <button
                onClick={handleWipe}
                className="w-full text-left px-3 py-2 border border-edge rounded-md bg-void text-[10px] font-mono uppercase tracking-widest text-risk hover:border-risk hover:bg-risk/5 transition-colors"
              >
                Clear all local data
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
