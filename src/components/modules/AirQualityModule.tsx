import { useMemo, type ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AqiSample, Coordinates } from '../../types';
import { useAirQuality } from '../../hooks/useAirQuality';
import { StatReadout } from '../hud/StatReadout';
import { DualReadout } from '../hud/DualReadout';
import { SectionHeader } from '../hud/SectionHeader';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { signedFixed, deltaTone } from '../../utils/compareUtils';
import { fmtTooltipNum } from '../../utils/chartFmt';

interface Props {
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
  compareMode: boolean;
}

const AXIS_PROPS = { stroke: '#3d4759', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', tickLine: false };
const GRID_PROPS = { stroke: '#1a2338', strokeDasharray: '2 4', vertical: false } as const;
const TOOLTIP_STYLE = {
  background: '#080b15',
  border: '1px solid #2d3a55',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  borderRadius: 0,
  padding: '6px 10px',
};
const WHO_LIMITS = { pm25: 5, pm10: 15, no2: 10, o3: 60 };

function aqiBand(aqi: number): { label: string; tone: 'good' | 'warn' | 'risk' } {
  if (aqi <= 20) return { label: 'GOOD', tone: 'good' };
  if (aqi <= 40) return { label: 'FAIR', tone: 'good' };
  if (aqi <= 60) return { label: 'MODERATE', tone: 'warn' };
  if (aqi <= 80) return { label: 'POOR', tone: 'warn' };
  if (aqi <= 100) return { label: 'V.POOR', tone: 'risk' };
  return { label: 'EXTREME', tone: 'risk' };
}

function mean(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) return 0;
  let s = 0;
  for (const v of valid) s += v;
  return s / valid.length;
}

function aqiPeak(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return valid.length === 0 ? 0 : Math.max(...valid);
}

function dailyAverage(samples: AqiSample[]): Array<{ date: string; aqi: number }> {
  if (samples.length === 0) return [];
  const map = new Map<string, { sum: number; count: number }>();
  for (const s of samples) {
    if (s.europeanAqi === null) continue;
    const day = s.time.slice(0, 10);
    const e = map.get(day) ?? { sum: 0, count: 0 };
    e.sum += s.europeanAqi;
    e.count += 1;
    map.set(day, e);
  }
  return Array.from(map.entries())
    .map(([date, { sum, count }]) => ({ date: date.slice(5), aqi: count > 0 ? sum / count : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface Stats {
  daily: Array<{ date: string; aqi: number }>;
  pm25Mean: number;
  pm10Mean: number;
  no2Mean: number;
  o3Mean: number;
  aqiMean: number;
  aqiPeak: number;
}

function deriveStats(data: AqiSample[]): Stats {
  return {
    daily: dailyAverage(data),
    pm25Mean: mean(data.map((s) => s.pm25)),
    pm10Mean: mean(data.map((s) => s.pm10)),
    no2Mean: mean(data.map((s) => s.no2)),
    o3Mean: mean(data.map((s) => s.o3)),
    aqiMean: mean(data.map((s) => s.europeanAqi)),
    aqiPeak: aqiPeak(data.map((s) => s.europeanAqi)),
  };
}

export function AirQualityModule({ coordsA, coordsB, compareMode }: Props) {
  const a = useAirQuality(coordsA);
  const b = useAirQuality(coordsB);

  const statsA = useMemo(() => (a.data ? deriveStats(a.data) : null), [a.data]);
  const statsB = useMemo(() => (b.data ? deriveStats(b.data) : null), [b.data]);

  if (!coordsA) return <EmptyState />;
  if (a.status === 'loading' || a.status === 'idle') return <LoadingSkeleton />;
  if (a.status === 'error' || !statsA) return <ErrorState error={a.error} />;

  const isCompare = compareMode && coordsA && coordsB;

  if (isCompare) {
    if (b.status === 'loading' || b.status === 'idle') return <LoadingSkeleton />;
    if (b.status === 'error' || !statsB) return <ErrorState error={b.error} />;
    return <CompareView a={statsA} b={statsB} />;
  }

  return <SingleView s={statsA} />;
}

function SingleView({ s }: { s: Stats }) {
  const meanBand = aqiBand(s.aqiMean);
  const peakBand = aqiBand(s.aqiPeak);

  return (
    <div className="space-y-5">
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        <StatReadout label="MEAN AQI" value={s.aqiMean.toFixed(0)} hint={meanBand.label} tone={meanBand.tone} compact />
        <StatReadout label="PEAK AQI" value={s.aqiPeak.toFixed(0)} hint={peakBand.label} tone={peakBand.tone} compact />
        <StatReadout label="PM2.5" value={s.pm25Mean.toFixed(1)} hint={`WHO ${WHO_LIMITS.pm25} µg/m³`} tone={s.pm25Mean > WHO_LIMITS.pm25 ? 'warn' : 'good'} compact />
        <StatReadout label="PM10" value={s.pm10Mean.toFixed(1)} hint={`WHO ${WHO_LIMITS.pm10} µg/m³`} tone={s.pm10Mean > WHO_LIMITS.pm10 ? 'warn' : 'good'} compact />
      </div>

      <Section code="01" title="AQI TIMELINE" subtitle="EUROPEAN AQI · 92 DAYS · DAILY MEAN">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={s.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} interval={6} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#7eeaff', fontSize: 9, textTransform: 'uppercase' }} formatter={fmtTooltipNum('AQI', 0)} />
            <Line type="monotone" dataKey="aqi" stroke="#7eeaff" strokeWidth={1.6} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section code="02" title="POLLUTANT LEVELS" subtitle="MEAN µg/m³ · WHO REFERENCE">
        <div className="grid gap-2 grid-cols-2">
          <StatReadout label="NO₂" value={s.no2Mean.toFixed(1)} hint={`WHO ${WHO_LIMITS.no2} µg/m³`} tone={s.no2Mean > WHO_LIMITS.no2 ? 'warn' : 'good'} compact />
          <StatReadout label="O₃" value={s.o3Mean.toFixed(1)} hint={`WHO ${WHO_LIMITS.o3} µg/m³`} tone={s.o3Mean > WHO_LIMITS.o3 ? 'warn' : 'good'} compact />
        </div>
      </Section>
    </div>
  );
}

function CompareView({ a, b }: { a: Stats; b: Stats }) {
  const merged = useMemo(() => {
    const map = new Map<string, { date: string; aqiA: number | null; aqiB: number | null }>();
    for (const s of a.daily) map.set(s.date, { date: s.date, aqiA: s.aqi, aqiB: null });
    for (const s of b.daily) {
      const e = map.get(s.date) ?? { date: s.date, aqiA: null, aqiB: null };
      e.aqiB = s.aqi;
      map.set(s.date, e);
    }
    return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));
  }, [a.daily, b.daily]);

  return (
    <div className="space-y-5">
      <Section code="01" title="AQI READOUT" subtitle="A ↔ B · 92 DAYS">
        <div className="grid gap-2 md:grid-cols-2">
          <DualReadout
            label="MEAN AQI"
            valueA={a.aqiMean.toFixed(0)}
            valueB={b.aqiMean.toFixed(0)}
            delta={signedFixed(b.aqiMean - a.aqiMean, 0)}
            deltaTone={deltaTone(b.aqiMean - a.aqiMean, 'higher-bad', 5)}
          />
          <DualReadout
            label="PEAK AQI"
            valueA={a.aqiPeak.toFixed(0)}
            valueB={b.aqiPeak.toFixed(0)}
            delta={signedFixed(b.aqiPeak - a.aqiPeak, 0)}
            deltaTone={deltaTone(b.aqiPeak - a.aqiPeak, 'higher-bad', 10)}
          />
          <DualReadout
            label="PM2.5"
            valueA={a.pm25Mean.toFixed(1)}
            valueB={b.pm25Mean.toFixed(1)}
            delta={signedFixed(b.pm25Mean - a.pm25Mean, 1)}
            deltaTone={deltaTone(b.pm25Mean - a.pm25Mean, 'higher-bad', 1)}
          />
          <DualReadout
            label="PM10"
            valueA={a.pm10Mean.toFixed(1)}
            valueB={b.pm10Mean.toFixed(1)}
            delta={signedFixed(b.pm10Mean - a.pm10Mean, 1)}
            deltaTone={deltaTone(b.pm10Mean - a.pm10Mean, 'higher-bad', 2)}
          />
          <DualReadout
            label="NO₂"
            valueA={a.no2Mean.toFixed(1)}
            valueB={b.no2Mean.toFixed(1)}
            delta={signedFixed(b.no2Mean - a.no2Mean, 1)}
            deltaTone={deltaTone(b.no2Mean - a.no2Mean, 'higher-bad', 2)}
          />
          <DualReadout
            label="O₃"
            valueA={a.o3Mean.toFixed(1)}
            valueB={b.o3Mean.toFixed(1)}
            delta={signedFixed(b.o3Mean - a.o3Mean, 1)}
            deltaTone={deltaTone(b.o3Mean - a.o3Mean, 'higher-bad', 5)}
          />
        </div>
      </Section>

      <Section code="02" title="AQI TIMELINE" subtitle="DAILY MEAN · A vs B">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} interval={6} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#7eeaff', fontSize: 9, textTransform: 'uppercase' }} formatter={fmtTooltipNum('AQI', 0)} />
            <Line type="monotone" dataKey="aqiA" name="A" stroke="#7eeaff" strokeWidth={1.6} dot={false} connectNulls />
            <Line type="monotone" dataKey="aqiB" name="B" stroke="#ffb347" strokeWidth={1.6} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Section>
    </div>
  );
}

function Section({ code, title, subtitle, children }: { code: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div>
      <SectionHeader code={code} title={title} subtitle={subtitle} />
      <div className="border border-edge bg-bg/40 p-3 rounded-md">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-edge bg-bg/40 p-6 text-center rounded-md">
      <div className="text-[10px] font-mono uppercase tracking-widest text-cyan/70 mb-1">▸ AWAITING TARGET</div>
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted">SET COORD TO QUERY AIR QUALITY</div>
    </div>
  );
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="border border-risk/50 bg-risk/5 p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-risk mb-1">✖ FETCH FAILED</div>
      {error && <div className="text-[10px] font-mono text-ink break-words">{error}</div>}
    </div>
  );
}
