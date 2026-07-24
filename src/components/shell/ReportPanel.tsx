import { useMemo } from 'react';
import { BuildingCard } from './BuildingCard';
import {
  Sun,
  Wind,
  Sunrise,
  TriangleAlert,
  Gauge,
  Globe,
  Microscope,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Coordinates, TabId } from '../../types';
import type { OverviewSeverity } from '../../utils/overviewSeverity';
import {
  SEVERITY_TONE,
  deriveClimateSeverity,
  deriveWindSeverity,
  deriveSunSeverity,
  deriveHazardsSeverity,
  deriveAirSeverity,
  deriveContextSeverity,
  deriveFloodSeverity,
} from '../../utils/overviewSeverity';
import { useFlood } from '../../hooks/useFlood';
import { StatusDot } from '../hud/StatusDot';
import { YearSelector } from '../hud/YearSelector';
import { useOpenMeteo } from '../../hooks/useOpenMeteo';
import { useClimateArchive } from '../../hooks/useClimateArchive';
import { buildMonthlyAggregates } from '../../utils/climateAggregation';
import { useAirQuality } from '../../hooks/useAirQuality';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import { useWildfires } from '../../hooks/useWildfires';
import { useOverpassFeatures, type NearbyFeature } from '../../hooks/useOverpassFeatures';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReportPanelProps {
  coordsA: Coordinates | null;
  resolvedA: string | null;
  countryA: string | null;
  onDrillDown: (tab: TabId) => void;
  climateYears: 1 | 5 | 10;
  onClimateYearsChange: (years: 1 | 5 | 10) => void;
}

interface Metric {
  value: string;
  label: string;
  muted?: boolean;
}

interface Chapter {
  id: TabId;
  icon: LucideIcon;
  label: string;
  question: string;
  answer: string;
  severity: OverviewSeverity;
  severityLabel: string;
  metrics: Metric[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function avg(arr: number[]): number {
  const valid = arr.filter(Number.isFinite);
  if (valid.length === 0) return NaN;
  let s = 0;
  for (const v of valid) s += v;
  return s / valid.length;
}

function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) if (Number.isFinite(v)) s += v;
  return s;
}

function maxVal(arr: number[]): number {
  const valid = arr.filter(Number.isFinite);
  if (valid.length === 0) return NaN;
  return Math.max(...valid);
}

function fmt(n: number, decimals = 0): string {
  return Number.isFinite(n) ? n.toFixed(decimals) : '--';
}

function severityLabel(s: OverviewSeverity): string {
  if (s === 'ok') return 'OK';
  if (s === 'watch') return 'Watch';
  if (s === 'alert') return 'Alert';
  return '';
}

function nearestBySubtype(features: NearbyFeature[] | null, subtype: string): NearbyFeature | null {
  if (!features) return null;
  return features
    .filter(f => f.subtype === subtype)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
}

function isEuropeHeuristic(c: Coordinates): boolean {
  return c.lon >= -25 && c.lon <= 45 && c.lat >= 30 && c.lat <= 75;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ReportPanel({ coordsA, resolvedA, countryA, onDrillDown, climateYears, onClimateYearsChange }: ReportPanelProps) {
  // 1yr hook: always fetched — used for severity badges (climate/wind/sun) and wind/sun metric values.
  // Must stay on useOpenMeteo so severity derivations are unaffected by the year selector (scope guard).
  const climate1yr = useOpenMeteo(coordsA);

  // Archive hook: null-gated — only fetches on 5/10y; provides climate card display values.
  // Both calls are unconditional (Rules of Hooks) with null-gating to control fetch.
  const climateArchive = useClimateArchive(
    climateYears > 1 ? coordsA : null,
    (climateYears === 1 ? 5 : climateYears) as 5 | 10,
  );

  // climateDisplay drives climate card VALUE display only — not severity.
  const climateDisplay = climateYears === 1 ? climate1yr : climateArchive;

  const aqi = useAirQuality(coordsA);
  const earthquakes = useEarthquakes(coordsA);
  const wildfires = useWildfires(coordsA);
  const features = useOverpassFeatures(coordsA);
  const flood = useFlood(coordsA);

  // Severity derivations always use 1yr climate — unchanged by the year selector.
  const climateResult = deriveClimateSeverity(climate1yr);
  const windResult = deriveWindSeverity(climate1yr);
  const sunResult = deriveSunSeverity(climate1yr);
  const hazardsResult = deriveHazardsSeverity(earthquakes, wildfires, flood, flood.notApplicable);
  const floodResult = deriveFloodSeverity(flood, flood.notApplicable);
  const airResult = deriveAirSeverity(aqi);
  const contextResult = deriveContextSeverity(features);

  // Pollen sub-block: only shown for European pins with at least one species >= 1 grain/m³.
  // >= 1 threshold suppresses CAMS out-of-season noise (Pitfall 7).
  // !== null guards prevent coercing null to 0 (Pitfall 2 — null means no data).
  const pollenData = useMemo(() => {
    const hasPollen =
      coordsA !== null &&
      isEuropeHeuristic(coordsA) &&
      aqi.data !== null &&
      aqi.data.some(s =>
        (s.grassPollen !== null && s.grassPollen >= 1) ||
        (s.birchPollen !== null && s.birchPollen >= 1) ||
        (s.alderPollen !== null && s.alderPollen >= 1) ||
        (s.mugwortPollen !== null && s.mugwortPollen >= 1) ||
        (s.olivePollen !== null && s.olivePollen >= 1) ||
        (s.ragweedPollen !== null && s.ragweedPollen >= 1)
      );

    if (!hasPollen || aqi.data === null) return { hasPollen: false, species: [] as { label: string; peak: number }[] };

    function peakPollen(vals: (number | null)[]): number | null {
      const valid = vals.filter((v): v is number => v !== null && Number.isFinite(v));
      if (valid.length === 0) return null;
      return Math.max(...valid);
    }

    const grass = peakPollen(aqi.data.map(s => s.grassPollen));
    const birch = peakPollen(aqi.data.map(s => s.birchPollen));
    const alder = peakPollen(aqi.data.map(s => s.alderPollen));
    const mugwort = peakPollen(aqi.data.map(s => s.mugwortPollen));
    const olive = peakPollen(aqi.data.map(s => s.olivePollen));
    const ragweed = peakPollen(aqi.data.map(s => s.ragweedPollen));

    const allSpecies: { label: string; peak: number | null }[] = [
      { label: 'Grass', peak: grass },
      { label: 'Birch', peak: birch },
      { label: 'Alder', peak: alder },
      { label: 'Mugwort', peak: mugwort },
      { label: 'Olive', peak: olive },
      { label: 'Ragweed', peak: ragweed },
    ];

    // Skip species whose peak is null or 0
    const species = allSpecies
      .filter((s): s is { label: string; peak: number } => s.peak !== null && s.peak > 0)
      .map(s => ({ label: s.label, peak: s.peak }));

    return { hasPollen: species.length > 0, species };
  }, [aqi.data, coordsA]);

  const emergency = useMemo(() => {
    const featData = features.data;
    const hospital = nearestBySubtype(featData, 'hospital');
    const police = nearestBySubtype(featData, 'police');
    const fireStation = nearestBySubtype(featData, 'fire_station');
    const allFound = hospital !== null && police !== null && fireStation !== null;
    const severity: OverviewSeverity = featData === null ? 'unavailable' : allFound ? 'ok' : 'watch';
    return {
      severity,
      metrics: [
        { value: hospital ? `${hospital.distanceKm.toFixed(1)} km` : 'None nearby', label: 'Hospital' },
        { value: police ? `${police.distanceKm.toFixed(1)} km` : 'None nearby', label: 'Police' },
        { value: fireStation ? `${fireStation.distanceKm.toFixed(1)} km` : 'None nearby', label: 'Fire Station' },
      ],
    };
  }, [features.data]);

  const chapters = useMemo<Chapter[]>(() => {
    // 1yr daily: used for wind + sun metric values (scope guard \u2014 year selector doesn't affect these).
    const d1yr = climate1yr.data?.daily;
    // Display daily: used for climate card values \u2014 follows the year selector.
    const dDisplay = climateDisplay.data?.daily;
    const aqiData = aqi.data;
    const eqData = earthquakes.data;
    const wfData = wildfires.data;
    const featData = features.data;

    // Active-window suffix for climate card labels on 5/10y.
    const winSuffix = climateYears > 1 ? ` \u00B7 ${climateYears}-YR AVG` : '';

    /* Climate \u2014 values from climateDisplay (1yr or archive); UV swap on 5/10y */
    let climateMetrics: Metric[];
    if (dDisplay) {
      if (climateYears === 1) {
        climateMetrics = [
          { value: fmt(avg(dDisplay.temperatureMean), 1) + '\u00B0', label: 'Mean temp' },
          { value: fmt(sum(dDisplay.precipitationSum), 0) + ' mm', label: 'Total precip' },
          { value: fmt(maxVal(dDisplay.uvIndexMax), 0), label: 'Peak UV' },
          { value: fmt(sum(dDisplay.sunshineDuration) / 3600, 0) + ' h', label: 'Sunshine hrs' },
        ];
      } else {
        // 5/10y: archive has no UV \u2014 derive avgHigh/avgLow from monthly aggregates instead.
        const monthly = buildMonthlyAggregates(climateDisplay.data!, climateYears);
        const avgHighVal = monthly.reduce((s, m) => s + m.avgHigh, 0) / monthly.length;
        const avgLowVal = monthly.reduce((s, m) => s + m.avgLow, 0) / monthly.length;
        climateMetrics = [
          { value: fmt(avg(dDisplay.temperatureMean), 1) + '\u00B0', label: `Mean temp${winSuffix}` },
          { value: fmt(sum(dDisplay.precipitationSum) / climateYears, 0) + ' mm', label: `Total precip${winSuffix}` },
          { value: fmt(avgHighVal, 1) + '\u00B0', label: `Avg high${winSuffix}` },
          { value: fmt(avgLowVal, 1) + '\u00B0', label: `Avg low${winSuffix}` },
        ];
      }
    } else {
      climateMetrics = [
        { value: '--', label: 'Mean temp' },
        { value: '--', label: 'Total precip' },
        { value: climateYears === 1 ? '--' : '--', label: climateYears === 1 ? 'Peak UV' : 'Avg high' },
        { value: climateYears === 1 ? '--' : '--', label: climateYears === 1 ? 'Sunshine hrs' : 'Avg low' },
      ];
    }

    /* Wind \u2014 always 1yr (scope guard) */
    const windMetrics: Metric[] = d1yr
      ? [
          { value: fmt(maxVal(d1yr.windGustsMax), 0) + ' km/h', label: 'Max gust' },
          { value: fmt(avg(d1yr.windSpeedMax), 1) + ' km/h', label: 'Avg wind speed' },
        ]
      : [
          { value: '--', label: 'Max gust' },
          { value: '--', label: 'Avg wind speed' },
        ];

    /* Sun Exposure \u2014 always 1yr (scope guard) */
    const sunMetrics: Metric[] = d1yr
      ? [
          { value: fmt(maxVal(d1yr.uvIndexMax), 0), label: 'Peak UV index' },
          { value: fmt(avg(d1yr.sunshineDuration) / 3600, 1) + ' h', label: 'Daily sunshine avg' },
        ]
      : [
          { value: '--', label: 'Peak UV index' },
          { value: '--', label: 'Daily sunshine avg' },
        ];

    /* Hazards */
    const eqCount = eqData?.length ?? 0;
    const wfCount = wfData?.length ?? 0;
    const maxMag = eqData && eqData.length > 0
      ? Math.max(...eqData.map(e => e.magnitude))
      : NaN;
    const floodMetricValue = flood.notApplicable
      ? 'No river'
      : (floodResult.metric ? `${floodResult.metric} m³/s` : '--');
    const hazardsMetrics: Metric[] = [
      { value: eqData ? String(eqCount) : '--', label: 'Quakes nearby' },
      { value: wfData ? String(wfCount) : '--', label: 'Active fires' },
      ...(Number.isFinite(maxMag) ? [{ value: fmt(maxMag, 1), label: 'Max magnitude' }] : []),
      { value: floodMetricValue, label: 'Flood Risk', muted: flood.notApplicable },
    ];

    /* Air Quality */
    const airMetrics: Metric[] = aqiData && aqiData.length > 0
      ? [
          { value: fmt(avg(aqiData.map(s => s.pm25).filter((v): v is number => v !== null)), 1), label: 'PM2.5 mean' },
          { value: fmt(avg(aqiData.map(s => s.pm10).filter((v): v is number => v !== null)), 1), label: 'PM10 mean' },
          { value: fmt(avg(aqiData.map(s => s.no2).filter((v): v is number => v !== null)), 1), label: 'NO\u2082 mean' },
          { value: fmt(avg(aqiData.map(s => s.o3).filter((v): v is number => v !== null)), 1), label: 'O\u2083 mean' },
        ]
      : [
          { value: '--', label: 'PM2.5 mean' },
          { value: '--', label: 'PM10 mean' },
          { value: '--', label: 'NO\u2082 mean' },
          { value: '--', label: 'O\u2083 mean' },
        ];

    /* Context */
    const nearestHazard = featData
      ? [...featData].filter((f) => f.category === 'hazard').sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null
      : null;
    const contextMetrics: Metric[] = [
      { value: featData ? String(featData.length) : '--', label: 'Places nearby' },
      {
        value: nearestHazard ? `${nearestHazard.distanceKm.toFixed(1)} km` : 'None',
        label: 'Nearest hazard',
        muted: nearestHazard === null,
      },
    ];

    return [
      {
        id: 'climate' as TabId,
        icon: Sun,
        label: 'Climate',
        question: "What's the climate like?",
        answer:
          climateYears === 1
            ? 'Annual averages from historical weather model data.'
            : `${climateYears}-year averages from historical weather model data.`,
        severity: climateResult.severity,
        severityLabel: severityLabel(climateResult.severity),
        metrics: climateMetrics,
      },
      {
        id: 'wind' as TabId,
        icon: Wind,
        label: 'Wind',
        question: 'How windy does it get?',
        answer: 'Wind speed and gust extremes from the past year.',
        severity: windResult.severity,
        severityLabel: severityLabel(windResult.severity),
        metrics: windMetrics,
      },
      {
        id: 'sun' as TabId,
        icon: Sunrise,
        label: 'Sun Exposure',
        question: 'How much sunlight throughout the year?',
        answer: 'UV exposure and sunshine duration from weather data.',
        severity: sunResult.severity,
        severityLabel: severityLabel(sunResult.severity),
        metrics: sunMetrics,
      },
      {
        id: 'hazards' as TabId,
        icon: TriangleAlert,
        label: 'Hazards',
        question: 'What about seismic and wildfire risk?',
        answer: 'Earthquake history from USGS, active fires from NASA satellite data. River flood risk from Copernicus GloFAS.',
        severity: hazardsResult.severity,
        severityLabel: severityLabel(hazardsResult.severity),
        metrics: hazardsMetrics,
      },
      {
        id: 'air' as TabId,
        icon: Gauge,
        label: 'Air Quality',
        question: 'How clean is the air?',
        answer: 'Pollution levels compared to WHO guidelines.',
        severity: airResult.severity,
        severityLabel: severityLabel(airResult.severity),
        metrics: airMetrics,
      },
      {
        id: 'context' as TabId,
        icon: Globe,
        label: 'Context',
        question: "What's nearby?",
        answer: 'Points of interest and amenities from OpenStreetMap.',
        severity: contextResult.severity,
        severityLabel: severityLabel(contextResult.severity),
        metrics: contextMetrics,
      },
    ];
  }, [climate1yr.data, climateDisplay.data, climateYears, aqi.data, earthquakes.data, wildfires.data, features.data, flood.data, flood.notApplicable, climateResult, windResult, sunResult, hazardsResult, airResult, contextResult, floodResult]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="px-6 pt-6 pb-4">
        <YearSelector years={climateYears} onYearsChange={onClimateYearsChange} />
        <span className="block text-[9px] font-mono uppercase tracking-widest text-muted mt-4">
          Location Report
        </span>
        <h1 className="text-[1.5rem] font-body font-semibold text-ink mt-1 leading-tight">
          {resolvedA ?? 'Acquiring\u2026'}
        </h1>
        {countryA && (
          <span className="text-[0.85rem] text-muted font-body">{countryA}</span>
        )}
      </div>

      {/* Building footprint — MOBILE ONLY (desktop has it in the HUD column) */}
      <div className="md:hidden mb-4">
        <BuildingCard coords={coordsA} slot="A" />
      </div>

      {/* Chapter nav — icon on top, label below */}
      <nav
        className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-edge"
        style={{ scrollbarWidth: 'none' }}
      >
        <a
          href="#report-emergency"
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-md text-[9px] font-mono font-semibold uppercase tracking-wider text-muted hover:text-ink hover:bg-edge/40 transition-colors whitespace-nowrap min-w-[60px]"
        >
          <ShieldCheck className="w-5 h-5" strokeWidth={1.4} />
          Emergency
        </a>
        {chapters.map(ch => (
          <a
            key={ch.id}
            href={`#report-${ch.id}`}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-md text-[9px] font-mono font-semibold uppercase tracking-wider text-muted hover:text-ink hover:bg-edge/40 transition-colors whitespace-nowrap min-w-[60px]"
          >
            <ch.icon className="w-5 h-5" strokeWidth={1.4} />
            {ch.label}
          </a>
        ))}
      </nav>

      {/* Emergency section */}
      <section
        id="report-emergency"
        className="px-6 py-7 border-b border-edge cursor-pointer hover:bg-edge/20 transition-colors"
        onClick={() => onDrillDown('context')}
      >
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-muted" strokeWidth={1.4} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Emergency
          </span>
          {emergency.severity !== 'unavailable' && (
            <StatusDot
              tone={SEVERITY_TONE[emergency.severity as keyof typeof SEVERITY_TONE]}
              label={severityLabel(emergency.severity)}
            />
          )}
        </div>
        <h2 className="text-[1.05rem] font-body font-semibold text-ink leading-snug">
          How close are emergency services?
        </h2>
        <p className="text-[0.85rem] text-muted font-body mt-1">
          Distance to the nearest hospital, police station, and fire station.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          {emergency.metrics.map((m, i) => (
            <div key={i} className="bg-void border border-edge rounded-[10px] px-3 py-2">
              <span className="text-[1.25rem] font-mono font-semibold text-ink">
                {m.value}
              </span>
              <span className="block text-[10px] font-mono text-muted mt-0.5">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Chapter sections */}
      {chapters.map(ch => (
        <section
          key={ch.id}
          id={`report-${ch.id}`}
          className="px-6 py-7 border-b border-edge cursor-pointer hover:bg-edge/20 transition-colors"
          onClick={() => onDrillDown(ch.id)}
        >
          <div className="flex items-center gap-2 mb-1">
            <ch.icon className="w-4 h-4 text-muted" strokeWidth={1.4} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
              {ch.label}
            </span>
            {ch.severity !== 'unavailable' && (
              <StatusDot
                tone={SEVERITY_TONE[ch.severity as keyof typeof SEVERITY_TONE]}
                label={ch.severityLabel}
              />
            )}
          </div>
          <h2 className="text-[1.05rem] font-body font-semibold text-ink leading-snug">
            {ch.question}
          </h2>
          <p className="text-[0.85rem] text-muted font-body mt-1">{ch.answer}</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {ch.metrics.map((m, i) => (
              <div key={i} className="bg-void border border-edge rounded-[10px] px-3 py-2">
                <span className={`text-[1.25rem] font-mono font-semibold ${m.muted ? 'text-muted' : 'text-ink'}`}>
                  {m.value}
                </span>
                <span className="block text-[10px] font-mono text-muted mt-0.5">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          {ch.id === 'air' && pollenData.hasPollen && (
            <div className="mt-3">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted">Pollen · CAMS European model</span>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {pollenData.species.map((s, i) => (
                  <div key={i} className="bg-void border border-edge rounded-[10px] px-3 py-2">
                    <span className="text-[1.25rem] font-mono font-semibold text-ink">
                      {s.peak} grains/m³
                    </span>
                    <span className="block text-[10px] font-mono text-muted mt-0.5">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}

      {/* Go deeper CTA */}
      <div
        onClick={() => onDrillDown('climate')}
        className="mx-6 my-5 p-4 bg-void border border-edge rounded-[10px] flex items-center gap-3 cursor-pointer hover:border-cyan/40 transition-colors"
      >
        <Microscope className="w-5 h-5 text-cyan shrink-0" strokeWidth={1.4} />
        <div className="flex-1">
          <div className="text-[0.85rem] font-body font-semibold text-ink">Go deeper</div>
          <div className="text-[10px] text-muted font-mono">
            Heatmaps, wind rose, sun paths, pollutant breakdowns and more.
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-cyan shrink-0" strokeWidth={1.4} />
      </div>
    </div>
  );
}
