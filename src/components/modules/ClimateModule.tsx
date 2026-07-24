import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ClimateData, Coordinates } from '../../types';
import { useOpenMeteo } from '../../hooks/useOpenMeteo';
import { useClimateArchive } from '../../hooks/useClimateArchive';
import {
  buildMonthlyAggregates,
  buildTemperatureHeatmap,
  countExtremeDays,
  uvBand,
  type ExtremeDayCounts,
  type MonthlyAggregate,
  type HeatmapData,
} from '../../utils/climateAggregation';
import { HeatmapGrid } from '../charts/HeatmapGrid';
import { GridResolutionWarning } from '../GridResolutionWarning';
import { StatReadout } from '../hud/StatReadout';
import { DualReadout } from '../hud/DualReadout';
import { SectionHeader } from '../hud/SectionHeader';
import { YearSelector } from '../hud/YearSelector';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { signedFixed, deltaTone } from '../../utils/compareUtils';
import { fmtTooltipNum } from '../../utils/chartFmt';

interface Props {
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
  compareMode: boolean;
  // forward-declared for Plan 04 — behaviour implemented there
  years?: 1 | 5 | 10;
  onYearsChange?: (years: 1 | 5 | 10) => void;
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
const TOOLTIP_LABEL = { color: '#7eeaff', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' as const };

interface Derived {
  heatmap: HeatmapData;
  monthly: MonthlyAggregate[];
  extremes: ExtremeDayCounts;
  data: ClimateData;
}

function deriveOne(data: ClimateData | null, years: number): Derived | null {
  if (!data) return null;
  const raw = countExtremeDays(data.daily);
  const extremes = years > 1
    ? { above35: Math.round(raw.above35 / years), below0: Math.round(raw.below0 / years),
        heavyRain: Math.round(raw.heavyRain / years), strongGusts: Math.round(raw.strongGusts / years) }
    : raw;
  return {
    heatmap: buildTemperatureHeatmap(data.hourly),
    monthly: buildMonthlyAggregates(data, years),
    extremes,
    data,
  };
}

function annualMean(d: Derived): number {
  return d.monthly.reduce((s, m) => s + m.tempMean, 0) / d.monthly.length;
}
function annualRain(d: Derived): number {
  return d.monthly.reduce((s, m) => s + m.rainSum, 0);
}
function annualSun(d: Derived): number {
  return d.monthly.reduce((s, m) => s + m.sunshineHours, 0);
}
function peakUv(d: Derived): number {
  return Math.max(...d.monthly.map((m) => m.uvMax));
}
function annualAvgHigh(d: Derived): number {
  return d.monthly.reduce((s, m) => s + m.avgHigh, 0) / d.monthly.length;
}
function annualAvgLow(d: Derived): number {
  return d.monthly.reduce((s, m) => s + m.avgLow, 0) / d.monthly.length;
}

export function ClimateModule({ coordsA, coordsB, compareMode, years, onYearsChange }: Props) {
  const yearsValue = years ?? 1;

  // Four unconditional null-gated hook calls — no Rules-of-Hooks violation.
  // 1YR path: useOpenMeteo receives real coords; archive hooks receive null (idle).
  // 5/10YR path: useOpenMeteo receives null (idle); archive hooks receive real coords.
  const stateA1 = useOpenMeteo(yearsValue === 1 ? coordsA : null);
  const stateB1 = useOpenMeteo(yearsValue === 1 ? coordsB : null);
  const stateAArchive = useClimateArchive(yearsValue > 1 ? coordsA : null, (yearsValue === 1 ? 5 : yearsValue) as 5 | 10);
  const stateBArchive = useClimateArchive(yearsValue > 1 ? coordsB : null, (yearsValue === 1 ? 5 : yearsValue) as 5 | 10);
  const stateA = yearsValue === 1 ? stateA1 : stateAArchive;
  const stateB = yearsValue === 1 ? stateB1 : stateBArchive;

  const derivedA = useMemo(() => deriveOne(stateA.data, yearsValue), [stateA.data, yearsValue]);
  const derivedB = useMemo(() => deriveOne(stateB.data, yearsValue), [stateB.data, yearsValue]);

  if (!coordsA) return <EmptyState />;

  const isCompare = compareMode && coordsA && coordsB;

  if (stateA.status === 'loading' || stateA.status === 'idle') return <LoadingSkeleton />;
  if (stateA.status === 'error' || !derivedA) return <ErrorState error={stateA.error} />;

  if (isCompare) {
    if (stateB.status === 'loading' || stateB.status === 'idle') return <LoadingSkeleton />;
    if (stateB.status === 'error' || !derivedB) return <ErrorState error={stateB.error} />;
    return <CompareView a={derivedA} b={derivedB} years={yearsValue} onYearsChange={onYearsChange} />;
  }

  return <SingleView d={derivedA} years={yearsValue} onYearsChange={onYearsChange} />;
}

function SingleView({ d, years, onYearsChange }: { d: Derived; years: 1 | 5 | 10; onYearsChange?: (y: 1 | 5 | 10) => void }) {
  const meanT = annualMean(d);
  const totalR = annualRain(d);
  const totalS = annualSun(d);
  const peakU = peakUv(d);
  const uv = uvBand(peakU);
  const avgH = annualAvgHigh(d);
  const avgL = annualAvgLow(d);

  // D-09: active-window subtitle suffix — empty string for 1YR (no change vs original)
  const win = years === 1 ? '' : ` · ${years}-YR AVG`;
  const isMultiYear = years > 1;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <YearSelector years={years} onYearsChange={onYearsChange} />
        {isMultiYear && (
          <p className="text-[9px] font-mono uppercase tracking-widest text-dim">
            {years}-YEAR VIEW SHOWS DAILY CLIMATE AVERAGES — HOURLY &amp; UV DETAIL UNAVAILABLE
          </p>
        )}
      </div>
      <GridResolutionWarning resolved={d.data.resolved} />

      <SectionContainer code="01" title={years === 1 ? 'ANNUAL READOUT' : `${years}-YEAR READOUT`} subtitle={years === 1 ? '12-MONTH ROLLUP' : `${years}-YR AVG`}>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          <StatReadout label="MEAN TEMP" value={`${meanT.toFixed(1)}°C`} tone="cyan" compact />
          <StatReadout label="TOTAL PRECIP" value={`${totalR.toFixed(0)} mm`} compact />
          <StatReadout label="SUN HOURS" value={totalS.toFixed(0)} compact />
          {years === 1 ? (
            <StatReadout
              label="PEAK UV"
              value={peakU.toFixed(1)}
              hint={uv.label.toUpperCase()}
              tone={uv.tone === 'risk' ? 'risk' : uv.tone === 'warn' ? 'warn' : 'good'}
              compact
            />
          ) : (
            <>
              <StatReadout label="AVG HIGH" value={`${avgH.toFixed(1)}°C`} hint="MEAN DAILY MAX" tone="warn" compact />
              <StatReadout label="AVG LOW" value={`${avgL.toFixed(1)}°C`} hint="MEAN DAILY MIN" compact />
            </>
          )}
        </div>
      </SectionContainer>

      {years === 1 ? (
        <SectionContainer code="02" title="THERMAL MATRIX" subtitle="MONTH × HOUR · MEAN °C">
          <HeatmapGrid data={d.heatmap} />
        </SectionContainer>
      ) : (
        <SectionContainer code="02" title="TEMPERATURE RANGE" subtitle={`MONTHLY AVG HIGH–LOW · ${years}-YR`}>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={d.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tempRangeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffb347" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7eeaff" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} unit="°" />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum('°C')} />
              <Area type="monotone" dataKey="avgHigh" name="AVG HIGH" stroke="#ffb347" strokeWidth={1.8} fill="url(#tempRangeFill)" dot={false} />
              <Area type="monotone" dataKey="avgLow" name="AVG LOW" stroke="#7eeaff" strokeWidth={1.8} fill="none" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </SectionContainer>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SectionContainer code="03" title="PRECIPITATION" subtitle={`MM PER MONTH${win}`}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={d.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum('mm')} />
              <Bar dataKey="rainSum" name="MM" fill="#7eeaff" />
            </BarChart>
          </ResponsiveContainer>
        </SectionContainer>

        {years === 1 && (
          <SectionContainer code="04" title="HUMIDITY" subtitle="MEAN %">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={d.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum('%')} />
                <Line type="monotone" dataKey="humidityMean" stroke="#66ffa3" strokeWidth={1.8} dot={{ r: 2, fill: '#66ffa3' }} />
              </LineChart>
            </ResponsiveContainer>
          </SectionContainer>
        )}

        <SectionContainer code="05" title="SUNSHINE" subtitle={`HOURS PER MONTH${win}`}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={d.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum('h')} />
              <Bar dataKey="sunshineHours" name="HRS" fill="#ffb347" />
            </BarChart>
          </ResponsiveContainer>
        </SectionContainer>

        {years === 1 && (
          <SectionContainer code="06" title="UV INDEX" subtitle="MONTHLY MAX">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={d.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} domain={[0, 12]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum()} />
                <Bar dataKey="uvMax" name="UV">
                  {d.monthly.map((entry, i) => {
                    const band = uvBand(entry.uvMax);
                    const fill = band.tone === 'risk' ? '#ff4d5e' : band.tone === 'warn' ? '#ffb347' : '#66ffa3';
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionContainer>
        )}
      </div>

      <SectionContainer code="07" title="EXTREME DAYS" subtitle={years === 1 ? 'THRESHOLD COUNTS · 12 MO' : 'THRESHOLD COUNTS · /YR AVG'}>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          <StatReadout label=">35°C" value={d.extremes.above35} hint="HOT DAYS" tone={d.extremes.above35 > 10 ? 'risk' : d.extremes.above35 > 0 ? 'warn' : 'neutral'} compact />
          <StatReadout label="<0°C" value={d.extremes.below0} hint="FROST" tone={d.extremes.below0 > 30 ? 'risk' : d.extremes.below0 > 0 ? 'warn' : 'neutral'} compact />
          <StatReadout label="RAIN >20MM" value={d.extremes.heavyRain} hint="HEAVY" tone={d.extremes.heavyRain > 10 ? 'risk' : d.extremes.heavyRain > 0 ? 'warn' : 'neutral'} compact />
          <StatReadout label="GUST >60" value={d.extremes.strongGusts} hint="KM/H" tone={d.extremes.strongGusts > 10 ? 'risk' : d.extremes.strongGusts > 0 ? 'warn' : 'neutral'} compact />
        </div>
      </SectionContainer>
    </div>
  );
}

function CompareView({ a, b, years, onYearsChange }: { a: Derived; b: Derived; years: 1 | 5 | 10; onYearsChange?: (y: 1 | 5 | 10) => void }) {
  const meanA = annualMean(a);
  const meanB = annualMean(b);
  const rainA = annualRain(a);
  const rainB = annualRain(b);
  const sunA = annualSun(a);
  const sunB = annualSun(b);
  const uvA = peakUv(a);
  const uvB = peakUv(b);
  const avgHighA = annualAvgHigh(a);
  const avgHighB = annualAvgHigh(b);
  const avgLowA = annualAvgLow(a);
  const avgLowB = annualAvgLow(b);

  // D-09: active-window suffix for compare subtitles
  const win = years === 1 ? '' : ` · ${years}-YR AVG`;
  const isMultiYear = years > 1;

  const merged = useMemo(
    () =>
      a.monthly.map((m, i) => ({
        label: m.label,
        rainA: m.rainSum,
        rainB: b.monthly[i].rainSum,
        humA: m.humidityMean,
        humB: b.monthly[i].humidityMean,
        sunA: m.sunshineHours,
        sunB: b.monthly[i].sunshineHours,
        uvA: m.uvMax,
        uvB: b.monthly[i].uvMax,
        avgHighA: m.avgHigh,
        avgHighB: b.monthly[i].avgHigh,
        avgLowA: m.avgLow,
        avgLowB: b.monthly[i].avgLow,
      })),
    [a.monthly, b.monthly],
  );

  return (
    <div className="space-y-5">
      {/* D-10: single shared selector for both A and B */}
      <div className="space-y-1.5">
        <YearSelector years={years} onYearsChange={onYearsChange} />
        {isMultiYear && (
          <p className="text-[9px] font-mono uppercase tracking-widest text-dim">
            {years}-YEAR VIEW SHOWS DAILY CLIMATE AVERAGES — HOURLY &amp; UV DETAIL UNAVAILABLE
          </p>
        )}
      </div>

      <DeltaBanner
        items={[
          {
            label: 'ΔMEAN TEMP',
            text: `${signedFixed(meanB - meanA)}°C`,
            tone: deltaTone(meanB - meanA, 'higher-bad', 0.5),
          },
          {
            label: 'ΔRAIN',
            text: `${signedFixed(rainB - rainA, 0)}mm`,
            tone: deltaTone(rainB - rainA, 'higher-bad', 50),
          },
          {
            label: 'ΔSUN',
            text: `${signedFixed(sunB - sunA, 0)}h`,
            tone: deltaTone(sunB - sunA, 'higher-good', 100),
          },
          years === 1
            ? {
                label: 'ΔPEAK UV',
                text: signedFixed(uvB - uvA, 1),
                tone: deltaTone(uvB - uvA, 'higher-bad', 0.5),
              }
            : {
                label: 'ΔAVG HIGH',
                text: `${signedFixed(avgHighB - avgHighA)}°C`,
                tone: deltaTone(avgHighB - avgHighA, 'higher-bad', 0.5),
              },
        ]}
      />

      <SectionContainer code="01" title={years === 1 ? 'ANNUAL READOUT' : `${years}-YEAR READOUT`} subtitle={years === 1 ? 'A ↔ B · 12 MO ROLLUP' : `A ↔ B · ${years}-YR AVG`}>
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
          <DualReadout
            label="MEAN TEMP"
            valueA={`${meanA.toFixed(1)}°C`}
            valueB={`${meanB.toFixed(1)}°C`}
            delta={`${signedFixed(meanB - meanA)}°C`}
            deltaTone={deltaTone(meanB - meanA, 'higher-bad', 0.5)}
          />
          <DualReadout
            label="TOTAL RAIN"
            valueA={`${rainA.toFixed(0)} mm`}
            valueB={`${rainB.toFixed(0)} mm`}
            delta={`${signedFixed(rainB - rainA, 0)} mm`}
            deltaTone={deltaTone(rainB - rainA, 'higher-bad', 50)}
          />
          <DualReadout
            label="SUN HOURS"
            valueA={sunA.toFixed(0)}
            valueB={sunB.toFixed(0)}
            delta={signedFixed(sunB - sunA, 0)}
            deltaTone={deltaTone(sunB - sunA, 'higher-good', 100)}
          />
          {years === 1 ? (
            <DualReadout
              label="PEAK UV"
              valueA={uvA.toFixed(1)}
              valueB={uvB.toFixed(1)}
              delta={signedFixed(uvB - uvA, 1)}
              deltaTone={deltaTone(uvB - uvA, 'higher-bad', 0.5)}
            />
          ) : (
            <>
              <DualReadout
                label="AVG HIGH"
                valueA={`${avgHighA.toFixed(1)}°C`}
                valueB={`${avgHighB.toFixed(1)}°C`}
                delta={`${signedFixed(avgHighB - avgHighA)}°C`}
                deltaTone={deltaTone(avgHighB - avgHighA, 'higher-bad', 0.5)}
              />
              <DualReadout
                label="AVG LOW"
                valueA={`${avgLowA.toFixed(1)}°C`}
                valueB={`${avgLowB.toFixed(1)}°C`}
                delta={`${signedFixed(avgLowB - avgLowA)}°C`}
                deltaTone={deltaTone(avgLowB - avgLowA, 'higher-bad', 0.5)}
              />
            </>
          )}
        </div>
      </SectionContainer>

      {years === 1 ? (
        <SectionContainer code="02" title="THERMAL MATRIX" subtitle="A | B · SHARED SCALE · MONTH × HOUR">
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <SubChart label="A">
                <HeatmapGrid
                  data={a.heatmap}
                  scaleMin={Math.min(a.heatmap.minTemp, b.heatmap.minTemp)}
                  scaleMax={Math.max(a.heatmap.maxTemp, b.heatmap.maxTemp)}
                />
              </SubChart>
              <SubChart label="B">
                <HeatmapGrid
                  data={b.heatmap}
                  scaleMin={Math.min(a.heatmap.minTemp, b.heatmap.minTemp)}
                  scaleMax={Math.max(a.heatmap.maxTemp, b.heatmap.maxTemp)}
                />
              </SubChart>
            </div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-dim mt-2">
              ※ Both heatmaps share {Math.min(a.heatmap.minTemp, b.heatmap.minTemp).toFixed(1)}°C →{' '}
              {Math.max(a.heatmap.maxTemp, b.heatmap.maxTemp).toFixed(1)}°C so cell colors are directly comparable.
            </div>
          </>
        </SectionContainer>
      ) : (
        <SectionContainer code="02" title="TEMPERATURE RANGE" subtitle={`MONTHLY AVG HIGH–LOW · A vs B · ${years}-YR`}>
          <div className="grid gap-3 md:grid-cols-2">
            <SubChart label="A">
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempRangeFillCmpA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffb347" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7eeaff" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} unit="°" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum('°C')} />
                  <Area type="monotone" dataKey="avgHighA" name="HIGH" stroke="#ffb347" strokeWidth={1.8} fill="url(#tempRangeFillCmpA)" dot={false} />
                  <Area type="monotone" dataKey="avgLowA" name="LOW" stroke="#7eeaff" strokeWidth={1.8} fill="none" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </SubChart>
            <SubChart label="B">
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempRangeFillCmpB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffb347" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7eeaff" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} unit="°" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum('°C')} />
                  <Area type="monotone" dataKey="avgHighB" name="HIGH" stroke="#ffb347" strokeWidth={1.8} fill="url(#tempRangeFillCmpB)" dot={false} />
                  <Area type="monotone" dataKey="avgLowB" name="LOW" stroke="#7eeaff" strokeWidth={1.8} fill="none" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </SubChart>
          </div>
        </SectionContainer>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SectionContainer code="03" title="PRECIPITATION" subtitle={`MM · A vs B${win}`}>
          <DualBarChart data={merged} aKey="rainA" bKey="rainB" unit="mm" />
        </SectionContainer>
        {years === 1 && (
          <SectionContainer code="04" title="HUMIDITY" subtitle="MEAN % · A vs B">
            <DualLineChart data={merged} aKey="humA" bKey="humB" yMax={100} unit="%" />
          </SectionContainer>
        )}
        <SectionContainer code="05" title="SUNSHINE" subtitle={`HRS · A vs B${win}`}>
          <DualBarChart data={merged} aKey="sunA" bKey="sunB" unit="h" />
        </SectionContainer>
        {years === 1 && (
          <SectionContainer code="06" title="UV INDEX" subtitle="MAX · A vs B">
            <DualLineChart data={merged} aKey="uvA" bKey="uvB" yMax={12} />
          </SectionContainer>
        )}
      </div>

      <SectionContainer code="07" title="EXTREME DAYS" subtitle={years === 1 ? 'THRESHOLD COUNTS · A vs B' : 'THRESHOLD COUNTS · /YR AVG · A vs B'}>
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
          <DualReadout
            label=">35°C HOT DAYS"
            valueA={a.extremes.above35}
            valueB={b.extremes.above35}
            delta={`${signedFixed(b.extremes.above35 - a.extremes.above35, 0)}`}
            deltaTone={deltaTone(b.extremes.above35 - a.extremes.above35, 'higher-bad', 2)}
          />
          <DualReadout
            label="<0°C FROST"
            valueA={a.extremes.below0}
            valueB={b.extremes.below0}
            delta={`${signedFixed(b.extremes.below0 - a.extremes.below0, 0)}`}
            deltaTone={deltaTone(b.extremes.below0 - a.extremes.below0, 'higher-bad', 5)}
          />
          <DualReadout
            label="RAIN >20MM"
            valueA={a.extremes.heavyRain}
            valueB={b.extremes.heavyRain}
            delta={`${signedFixed(b.extremes.heavyRain - a.extremes.heavyRain, 0)}`}
            deltaTone={deltaTone(b.extremes.heavyRain - a.extremes.heavyRain, 'higher-bad', 2)}
          />
          <DualReadout
            label="GUST >60 KM/H"
            valueA={a.extremes.strongGusts}
            valueB={b.extremes.strongGusts}
            delta={`${signedFixed(b.extremes.strongGusts - a.extremes.strongGusts, 0)}`}
            deltaTone={deltaTone(b.extremes.strongGusts - a.extremes.strongGusts, 'higher-bad', 2)}
          />
        </div>
      </SectionContainer>
    </div>
  );
}

interface MergedRow {
  label: string;
  [key: string]: string | number;
}

function DualBarChart({ data, aKey, bKey, unit = '' }: { data: MergedRow[]; aKey: string; bKey: string; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum(unit)} />
        <Bar dataKey={aKey} name="A" fill="#7eeaff" />
        <Bar dataKey={bKey} name="B" fill="#ffb347" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DualLineChart({
  data,
  aKey,
  bKey,
  yMax,
  unit = '',
}: {
  data: MergedRow[];
  aKey: string;
  bKey: string;
  yMax?: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} domain={yMax ? [0, yMax] : ['auto', 'auto']} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={fmtTooltipNum(unit)} />
        <Line type="monotone" dataKey={aKey} name="A" stroke="#7eeaff" strokeWidth={1.8} dot={false} />
        <Line type="monotone" dataKey={bKey} name="B" stroke="#ffb347" strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DeltaBanner({ items }: { items: Array<{ label: string; text: string; tone: 'good' | 'warn' | 'risk' | 'neutral' }> }) {
  return (
    <div className="border border-amber/40 bg-amber/5 rounded-md">
      <div className="px-3 py-2 border-b border-amber/30 text-[9px] font-mono uppercase tracking-widest text-amber flex items-center gap-2">
        <span>▴ DELTA SUMMARY · A → B</span>
        <span className="flex-1 h-px bg-amber/30" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-amber/20">
        {items.map((it, i) => {
          const tone =
            it.tone === 'risk' ? 'text-risk' : it.tone === 'warn' ? 'text-warn' : it.tone === 'good' ? 'text-good' : 'text-ink';
          return (
            <div key={i} className="px-3 py-2">
              <div className="text-[8px] font-mono uppercase tracking-widest text-muted">{it.label}</div>
              <div className={`text-base font-mono font-semibold tabular-nums mt-0.5 ${tone}`}>{it.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubChart({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border border-edge bg-bg/40 rounded-md">
      <div className="px-2 py-1 border-b border-edge text-[9px] font-mono uppercase tracking-widest flex items-center gap-1.5">
        <span className={`inline-block w-1.5 h-1.5 ${label === 'A' ? 'bg-cyan' : 'bg-amber'}`} />
        <span className={label === 'A' ? 'text-cyan' : 'text-amber'}>TGT · {label}</span>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function SectionContainer({
  code,
  title,
  subtitle,
  children,
}: {
  code: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
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
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted">
        SET COORD VIA INPUT OR MAP CLICK
      </div>
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
