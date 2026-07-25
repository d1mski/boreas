import { Suspense, lazy, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sun as SunLucide, Sunrise, Wind, TriangleAlert, Gauge, Globe, Waves } from 'lucide-react';
import type { Coordinates, TabId } from '../../types';
import { TAB_LABELS } from '../../types';
import { ReportPanel } from './ReportPanel';
import { PrivacyPanel } from './PrivacyPanel';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';
import { useFontScale } from '../../contexts/FontScaleContext';

const ClimateModule = lazy(() =>
  import('../modules/ClimateModule').then((m) => ({ default: m.ClimateModule })),
);
const WindModule = lazy(() =>
  import('../modules/WindModule').then((m) => ({ default: m.WindModule })),
);
const SunModule = lazy(() =>
  import('../modules/SunModule').then((m) => ({ default: m.SunModule })),
);
const HazardsModule = lazy(() =>
  import('../modules/HazardsModule').then((m) => ({ default: m.HazardsModule })),
);
const AirQualityModule = lazy(() =>
  import('../modules/AirQualityModule').then((m) => ({ default: m.AirQualityModule })),
);
const ContextModule = lazy(() =>
  import('../modules/ContextModule').then((m) => ({ default: m.ContextModule })),
);
const MarineModule = lazy(() =>
  import('../modules/MarineModule').then((m) => ({ default: m.MarineModule })),
);

const TAB_ICONS: Record<TabId, JSX.Element> = {
  climate: <SunLucide className="w-5 h-5" strokeWidth={1.4} />,
  wind:    <Wind className="w-5 h-5" strokeWidth={1.4} />,
  sun:     <Sunrise className="w-5 h-5" strokeWidth={1.4} />,
  hazards: <TriangleAlert className="w-5 h-5" strokeWidth={1.4} />,
  air:     <Gauge className="w-5 h-5" strokeWidth={1.4} />,
  context: <Globe className="w-5 h-5" strokeWidth={1.4} />,
  marine:  <Waves className="w-5 h-5" strokeWidth={1.4} />,
};

interface Props {
  active: TabId;
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
  compareMode: boolean;
  view: 'overview' | 'advanced';
  resolvedA: string | null;
  countryA: string | null;
  onToggleView: () => void;
  onSelect: (tab: TabId) => void;
  onDrillDown: (tab: TabId) => void;
  visibleTabs: TabId[];
  climateYears: 1 | 5 | 10;
  onClimateYearsChange: (years: 1 | 5 | 10) => void;
  embedded?: boolean;
}

export function ModuleSheet({ active, coordsA, coordsB, compareMode, view, resolvedA, countryA, onToggleView, onSelect, onDrillDown, visibleTabs, climateYears, onClimateYearsChange, embedded }: Props) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  return (
    <aside className={embedded ? "h-full w-full bg-panel flex flex-col" : "hidden md:flex h-full md:w-[392px] min-[1200px]:w-[560px] shrink-0 bg-panel border-l border-edge flex-col"}>
      {/* Mode bar: Overview/Advanced toggle + font/theme controls */}
      <div className="px-4 py-2.5 border-b border-edge flex items-center gap-3 shrink-0">
        <div className="flex bg-void border border-edge rounded-md p-0.5">
          <button
            onClick={() => view !== 'overview' && onToggleView()}
            className={`px-3 py-1 rounded text-[10px] font-mono font-semibold tracking-wider transition-all ${
              view === 'overview' ? 'bg-panel text-ink shadow-sm' : 'text-muted cursor-pointer'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => view !== 'advanced' && onToggleView()}
            className={`px-3 py-1 rounded text-[10px] font-mono font-semibold tracking-wider transition-all ${
              view === 'advanced' ? 'bg-panel text-ink shadow-sm' : 'text-muted cursor-pointer'
            }`}
          >
            Advanced
          </button>
        </div>
        <div className="flex-1" />
        <FontScaleControl />
        <ThemeToggle />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {view === 'overview' ? (
          <motion.div
            key="overview"
            className="flex-1 overflow-y-auto overflow-x-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ReportPanel coordsA={coordsA} resolvedA={resolvedA} countryA={countryA} onDrillDown={onDrillDown} climateYears={climateYears} onClimateYearsChange={onClimateYearsChange} />
          </motion.div>
        ) : (
          <motion.div
            key="advanced"
            className="flex-1 flex flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Horizontal module tabs — icon on top, label below */}
            <div className="px-4 py-3 border-b border-edge flex gap-2 shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {visibleTabs.map(id => (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  disabled={!coordsA}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-md text-[9px] font-mono font-semibold tracking-wider transition-colors whitespace-nowrap min-w-[60px] ${
                    active === id
                      ? 'bg-cyan/10 text-cyan'
                      : 'text-muted hover:text-ink hover:bg-edge/40'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {TAB_ICONS[id]}
                  {TAB_LABELS[id]}
                </button>
              ))}
            </div>

            {/* Module content */}
            <div className="flex-1 overflow-y-auto p-5 stagger">
              <ErrorBoundary>
                <Suspense fallback={<LoadingSkeleton />}>
                  {active === 'climate' && <ClimateModule coordsA={coordsA} coordsB={coordsB} compareMode={compareMode} years={climateYears} onYearsChange={onClimateYearsChange} />}
                  {active === 'wind' && <WindModule coordsA={coordsA} coordsB={coordsB} compareMode={compareMode} />}
                  {active === 'sun' && <SunModule coordsA={coordsA} coordsB={coordsB} compareMode={compareMode} />}
                  {active === 'hazards' && <HazardsModule coordsA={coordsA} coordsB={coordsB} compareMode={compareMode} />}
                  {active === 'air' && <AirQualityModule coordsA={coordsA} coordsB={coordsB} compareMode={compareMode} />}
                  {active === 'context' && <ContextModule coordsA={coordsA} coordsB={coordsB} compareMode={compareMode} />}
                  {active === 'marine' && <MarineModule coordsA={coordsA} coordsB={coordsB} compareMode={compareMode} />}
                </Suspense>
              </ErrorBoundary>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-edge px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim flex items-center justify-between shrink-0">
        <span>{view === 'overview' ? 'OVW · REPORT' : `MOD · ${active.toUpperCase()}`}</span>
        <button
          onClick={() => setPrivacyOpen(true)}
          className="uppercase tracking-widest text-dim hover:text-cyan transition-colors"
        >
          Privacy &amp; Data
        </button>
        <span>v0.1</span>
      </footer>

      <PrivacyPanel open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </aside>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const modes: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'light',
      label: 'Light theme',
      icon: (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ),
    },
    {
      mode: 'system',
      label: 'System theme',
      icon: (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
    {
      mode: 'dark',
      label: 'Dark theme',
      icon: (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="shrink-0 flex border border-edge rounded-md overflow-hidden">
      {modes.map(({ mode, label, icon }, i) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          title={label}
          aria-label={label}
          className={`w-7 h-7 flex items-center justify-center transition-colors ${
            i > 0 ? 'border-l border-edge' : ''
          } ${
            theme === mode
              ? 'bg-cyan/15 text-cyan'
              : 'bg-void text-muted hover:text-ink'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function FontScaleControl() {
  const { scale, increase, decrease } = useFontScale();

  return (
    <div className="shrink-0 flex items-center border border-edge rounded-md overflow-hidden">
      <button
        onClick={decrease}
        disabled={scale <= 0.8}
        aria-label="Decrease font size"
        title="Decrease font size"
        className="w-7 h-7 flex items-center justify-center transition-colors bg-void text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="text-[10px] font-bold leading-none">A-</span>
      </button>
      <span className="px-1.5 text-[9px] text-muted tabular-nums min-w-[32px] text-center border-x border-edge bg-void/50">
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={increase}
        disabled={scale >= 1.4}
        aria-label="Increase font size"
        title="Increase font size"
        className="w-7 h-7 flex items-center justify-center transition-colors bg-void text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="text-[10px] font-bold leading-none">A+</span>
      </button>
    </div>
  );
}
