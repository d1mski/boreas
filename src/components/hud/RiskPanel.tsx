import { useMemo } from 'react';
import type { Coordinates } from '../../types';
import { useOpenMeteo } from '../../hooks/useOpenMeteo';
import { useAirQuality } from '../../hooks/useAirQuality';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import { useWildfires } from '../../hooks/useWildfires';
import { useOverpassFeatures } from '../../hooks/useOverpassFeatures';
import { useWikipedia } from '../../hooks/useWikipedia';
import { useElevation } from '../../hooks/useElevation';
import { useReverseGeocode } from '../../hooks/useNominatim';
import {
  synthesiseRisks,
  type RiskSeverity,
} from '../../utils/riskSynthesis';

interface Props {
  coords: Coordinates | null;
}

const SEVERITY_STYLE: Record<
  RiskSeverity,
  { label: string; bg: string; border: string; text: string }
> = {
  critical: {
    label: 'CRITICAL',
    bg: 'bg-risk/10',
    border: 'border-l-risk',
    text: 'text-risk',
  },
  warn: {
    label: 'WARN',
    bg: 'bg-warn/10',
    border: 'border-l-warn',
    text: 'text-warn',
  },
  watch: {
    label: 'WATCH',
    bg: 'bg-amber/10',
    border: 'border-l-amber',
    text: 'text-amber',
  },
  info: {
    label: 'INFO',
    bg: 'bg-cyan/5',
    border: 'border-l-cyan',
    text: 'text-cyan',
  },
};

export function RiskPanel({ coords }: Props) {
  const climate = useOpenMeteo(coords);
  const aqi = useAirQuality(coords);
  const earthquakes = useEarthquakes(coords);
  const wildfires = useWildfires(coords);
  const features = useOverpassFeatures(coords);
  const geo = useReverseGeocode(coords);
  const wiki = useWikipedia(coords, geo.result?.countryCode ?? null);
  const { elevation } = useElevation(coords);

  const risks = useMemo(
    () =>
      synthesiseRisks({
        coords,
        climate: climate.data,
        features: features.data,
        wiki: wiki.data,
        earthquakes: earthquakes.data,
        wildfires: wildfires.data,
        aqi: aqi.data,
        elevation,
      }),
    [
      coords,
      climate.data,
      features.data,
      wiki.data,
      earthquakes.data,
      wildfires.data,
      aqi.data,
      elevation,
    ],
  );

  const anyLoading =
    climate.status === 'loading' ||
    features.status === 'loading' ||
    earthquakes.status === 'loading' ||
    wildfires.status === 'loading' ||
    aqi.status === 'loading';

  const anyFailed =
    climate.status === 'error' ||
    features.status === 'error' ||
    earthquakes.status === 'error' ||
    aqi.status === 'error' ||
    wildfires.status === 'error' ||
    (wildfires.status === 'success' && wildfires.error !== null) ||
    wiki.status === 'error';

  if (!coords) return null;

  return (
    <div className="flex flex-col border border-edge bg-bg/85 backdrop-blur-sm shrink-0 max-h-[40vh] rounded-md">
      <div className="px-3 py-2 border-b border-edge flex items-center gap-2 shrink-0">
        <span className="inline-block w-1.5 h-1.5 bg-cyan" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-cyan">
          RISK SYNTHESIS
        </span>
        <span className="flex-1" />
        {anyLoading && (
          <span className="text-[8px] font-mono uppercase tracking-widest text-muted">
            SCANNING…
          </span>
        )}
        <span className="text-[9px] font-mono text-muted tabular-nums">
          {risks.length}
        </span>
      </div>
      <div className="overflow-y-auto">
        {risks.length === 0 ? (
          <div className="px-3 py-3 text-[10px] font-mono uppercase tracking-wider text-dim">
            {anyLoading
              ? '▸ SCANNING…'
              : anyFailed
                ? '▸ PARTIAL DATA · SOME SOURCES UNAVAILABLE'
                : '▸ NO FLAGS · AREA CLEAR'}
          </div>
        ) : (
          <>
            <div className="divide-y divide-edge/60">
              {risks.map((r) => {
                const s = SEVERITY_STYLE[r.severity];
                return (
                  <div
                    key={r.id}
                    className={`px-3 py-2 ${s.bg} border-l-2 ${s.border}`}
                  >
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span
                        className={`text-[8px] font-mono font-bold uppercase tracking-widest ${s.text}`}
                      >
                        {s.label}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-ink">
                        {r.title}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-muted leading-snug">
                      {r.detail}
                    </div>
                  </div>
                );
              })}
            </div>
            {anyFailed && (
              <div className="px-3 py-1.5 text-[8px] font-mono uppercase tracking-widest text-warn border-t border-edge/60">
                PARTIAL DATA · SOME SOURCES UNAVAILABLE
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
