import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { Coordinates, EarthquakeEvent, WildfireEvent } from '../../types';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import { useWildfires } from '../../hooks/useWildfires';
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

function depthColor(depth: number): string {
  if (depth < 10) return '#ff4d5e';
  if (depth < 35) return '#ffb347';
  if (depth < 70) return '#a5d8ff';
  return '#7eeaff';
}

function summarise(data: EarthquakeEvent[]) {
  if (data.length === 0) {
    return { count: 0, largest: null as EarthquakeEvent | null, closest: null as number | null };
  }
  let largest = data[0];
  let closest = Infinity;
  for (const e of data) {
    if (e.magnitude > largest.magnitude) largest = e;
    if (e.distanceKm < closest) closest = e.distanceKm;
  }
  return { count: data.length, largest, closest };
}

function buildYears(data: EarthquakeEvent[]) {
  const map = new Map<number, number>();
  for (const e of data) {
    const y = parseInt(e.date.slice(0, 4), 10);
    map.set(y, (map.get(y) ?? 0) + 1);
  }
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => {
    const year = currentYear - 9 + i;
    return { label: year.toString().slice(-2), count: map.get(year) ?? 0 };
  });
}

export function HazardsModule({ coordsA, coordsB, compareMode }: Props) {
  const a = useEarthquakes(coordsA);
  const b = useEarthquakes(coordsB);
  const firesA = useWildfires(coordsA);
  const firesB = useWildfires(coordsB);

  if (!coordsA) return <EmptyState />;
  if (a.status === 'loading' || a.status === 'idle') return <LoadingSkeleton />;
  if (a.status === 'error' || !a.data) return <ErrorState error={a.error} />;

  const isCompare = compareMode && coordsA && coordsB;

  if (isCompare) {
    if (b.status === 'loading' || b.status === 'idle') return <LoadingSkeleton />;
    if (b.status === 'error' || !b.data) return <ErrorState error={b.error} />;
    return (
      <CompareView
        coordsA={coordsA}
        coordsB={coordsB!}
        eventsA={a.data}
        eventsB={b.data}
        firesA={firesA.data ?? []}
        firesB={firesB.data ?? []}
        firesAStatus={firesA.status}
        firesBStatus={firesB.status}
        firesAError={firesA.error}
        firesBError={firesB.error}
      />
    );
  }

  return (
    <SingleView
      coords={coordsA}
      events={a.data}
      fires={firesA.data ?? []}
      firesStatus={firesA.status}
      firesError={firesA.error}
    />
  );
}

function SingleView({
  coords,
  events,
  fires,
  firesStatus,
  firesError,
}: {
  coords: Coordinates;
  events: EarthquakeEvent[];
  fires: WildfireEvent[];
  firesStatus: string;
  firesError: string | null;
}) {
  const summary = useMemo(() => summarise(events), [events]);
  const years = useMemo(() => buildYears(events), [events]);

  if (events.length === 0) {
    return (
      <div className="space-y-5">
        <div className="border border-good/40 bg-good/5 p-4 rounded-md">
          <div className="text-[9px] font-mono uppercase tracking-widest text-good flex items-center gap-2">
            <span>✓ SEISMICALLY QUIET</span>
            <span className="flex-1 h-px bg-good/30" />
          </div>
          <div className="text-[10px] font-mono text-ink mt-1">
            No M3.0+ events within 100 km in past 10 years.
          </div>
        </div>
        <WildfireSection fires={fires} status={firesStatus} error={firesError} code="02" />
      </div>
    );
  }

  const largest = summary.largest!;
  return (
    <div className="space-y-5">
      <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
        <StatReadout label="EVENTS · 10Y" value={summary.count} hint="M3.0+ · 100KM" tone={summary.count > 50 ? 'risk' : summary.count > 10 ? 'warn' : 'good'} compact />
        <StatReadout label="LARGEST" value={`M${largest.magnitude.toFixed(1)}`} hint={`${largest.distanceKm.toFixed(0)}KM · ${largest.date.slice(0, 10)}`} tone={largest.magnitude >= 6 ? 'risk' : largest.magnitude >= 5 ? 'warn' : 'cyan'} compact />
        <StatReadout label="CLOSEST" value={`${summary.closest!.toFixed(0)} KM`} hint="FROM PIN" compact />
      </div>

      <Section code="01" title="SEISMIC MAP" subtitle="RADIUS ∝ MAG · COLOR = DEPTH">
        <div className="border border-edge h-[320px] rounded-md overflow-hidden">
          <MapContainer center={[coords.lat, coords.lon]} zoom={9} scrollWheelZoom zoomControl={false} className="h-full w-full">
            <TileLayer attribution="" url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" maxZoom={19} />
            {events.map((e) => (
              <CircleMarker key={e.id} center={[e.lat, e.lon]} radius={Math.max(3, (e.magnitude - 2) * 4)} pathOptions={{ color: depthColor(e.depth), fillColor: depthColor(e.depth), fillOpacity: 0.5, weight: 1 }}>
                <Popup>
                  <div className="font-mono text-[10px]">
                    <div><strong>M{e.magnitude.toFixed(1)}</strong> · {e.depth.toFixed(0)} KM DEEP</div>
                    <div>{e.place}</div>
                    <div>{e.date.slice(0, 10)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </Section>

      <Section code="02" title="FREQUENCY" subtitle="EVENTS PER YEAR · LAST DECADE">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={years} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#7eeaff', fontSize: 9, textTransform: 'uppercase' }} formatter={fmtTooltipNum('events', 0)} />
            <Bar dataKey="count" fill="#ff4d5e" />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <WildfireSection fires={fires} status={firesStatus} error={firesError} code="03" />
    </div>
  );
}

function CompareView({
  coordsA,
  coordsB,
  eventsA,
  eventsB,
  firesA,
  firesB,
  firesAStatus,
  firesBStatus,
  firesAError,
  firesBError,
}: {
  coordsA: Coordinates;
  coordsB: Coordinates;
  eventsA: EarthquakeEvent[];
  eventsB: EarthquakeEvent[];
  firesA: WildfireEvent[];
  firesB: WildfireEvent[];
  firesAStatus: string;
  firesBStatus: string;
  firesAError: string | null;
  firesBError: string | null;
}) {
  const sumA = useMemo(() => summarise(eventsA), [eventsA]);
  const sumB = useMemo(() => summarise(eventsB), [eventsB]);
  const yearsA = useMemo(() => buildYears(eventsA), [eventsA]);
  const yearsB = useMemo(() => buildYears(eventsB), [eventsB]);
  const merged = useMemo(
    () => yearsA.map((y, i) => ({ label: y.label, countA: y.count, countB: yearsB[i].count })),
    [yearsA, yearsB],
  );

  const centerLat = (coordsA.lat + coordsB.lat) / 2;
  const centerLon = (coordsA.lon + coordsB.lon) / 2;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 md:grid-cols-2">
        <DualReadout
          label="EVENTS · 10Y · M3.0+"
          valueA={sumA.count}
          valueB={sumB.count}
          delta={signedFixed(sumB.count - sumA.count, 0)}
          deltaTone={deltaTone(sumB.count - sumA.count, 'higher-bad', 5)}
        />
        <DualReadout
          label="LARGEST"
          valueA={sumA.largest ? `M${sumA.largest.magnitude.toFixed(1)}` : '—'}
          valueB={sumB.largest ? `M${sumB.largest.magnitude.toFixed(1)}` : '—'}
          delta={
            sumA.largest && sumB.largest
              ? signedFixed(sumB.largest.magnitude - sumA.largest.magnitude, 1)
              : undefined
          }
          deltaTone={
            sumA.largest && sumB.largest
              ? deltaTone(sumB.largest.magnitude - sumA.largest.magnitude, 'higher-bad', 0.3)
              : 'neutral'
          }
        />
      </div>

      <Section code="01" title="SEISMIC MAP" subtitle="A (CYAN) ↔ B (AMBER) · M3.0+ · 100KM RADIUS">
        <div className="border border-edge h-[360px] rounded-md overflow-hidden">
          <MapContainer center={[centerLat, centerLon]} zoom={7} scrollWheelZoom zoomControl={false} className="h-full w-full">
            <TileLayer attribution="" url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" maxZoom={19} />
            <CircleMarker center={[coordsA.lat, coordsA.lon]} radius={5} pathOptions={{ color: '#7eeaff', fillColor: '#7eeaff', fillOpacity: 0.9, weight: 2 }}>
              <Popup>PIN A</Popup>
            </CircleMarker>
            <CircleMarker center={[coordsB.lat, coordsB.lon]} radius={5} pathOptions={{ color: '#ffb347', fillColor: '#ffb347', fillOpacity: 0.9, weight: 2 }}>
              <Popup>PIN B</Popup>
            </CircleMarker>
            {eventsA.map((e) => (
              <CircleMarker key={`a-${e.id}`} center={[e.lat, e.lon]} radius={Math.max(2, (e.magnitude - 2) * 3)} pathOptions={{ color: '#7eeaff', fillColor: '#7eeaff', fillOpacity: 0.35, weight: 0.8 }}>
                <Popup>
                  <div className="font-mono text-[10px]">A · M{e.magnitude.toFixed(1)} · {e.date.slice(0, 10)}</div>
                </Popup>
              </CircleMarker>
            ))}
            {eventsB.map((e) => (
              <CircleMarker key={`b-${e.id}`} center={[e.lat, e.lon]} radius={Math.max(2, (e.magnitude - 2) * 3)} pathOptions={{ color: '#ffb347', fillColor: '#ffb347', fillOpacity: 0.35, weight: 0.8 }}>
                <Popup>
                  <div className="font-mono text-[10px]">B · M{e.magnitude.toFixed(1)} · {e.date.slice(0, 10)}</div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </Section>

      <Section code="02" title="FREQUENCY" subtitle="EVENTS PER YEAR · A vs B">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#7eeaff', fontSize: 9, textTransform: 'uppercase' }} formatter={fmtTooltipNum('events', 0)} />
            <Bar dataKey="countA" name="A" fill="#7eeaff" />
            <Bar dataKey="countB" name="B" fill="#ffb347" />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section code="03" title="WILDFIRE · NRT" subtitle="A | B · EONET OPEN + FIRMS 5D">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-cyan mb-1.5">TGT·A</div>
            <WildfireList fires={firesA} status={firesAStatus} error={firesAError} />
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-amber mb-1.5">TGT·B</div>
            <WildfireList fires={firesB} status={firesBStatus} error={firesBError} />
          </div>
        </div>
      </Section>
    </div>
  );
}

function WildfireSection({
  fires,
  status,
  error,
  code,
}: {
  fires: WildfireEvent[];
  status: string;
  error: string | null;
  code: string;
}) {
  return (
    <Section code={code} title="WILDFIRE · NRT" subtitle="EONET OPEN + FIRMS 5D · ≤220KM">
      <WildfireList fires={fires} status={status} error={error} />
    </Section>
  );
}

function WildfireList({
  fires,
  status,
  error,
}: {
  fires: WildfireEvent[];
  status: string;
  error: string | null;
}) {
  if (status === 'loading' || status === 'idle') return <LoadingSkeleton />;
  if (status === 'error')
    return (
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted">
        WILDFIRE FEED UNREACHABLE
      </div>
    );

  const partialNote = status === 'success' && error !== null && (
    <div className="text-[9px] font-mono uppercase tracking-widest text-muted">
      PARTIAL DATA · {error}
    </div>
  );

  if (fires.length === 0) {
    return (
      <div className="space-y-2">
        {partialNote}
        <div className="border border-good/30 bg-good/5 px-3 py-2 rounded-md">
          <div className="text-[9px] font-mono uppercase tracking-widest text-good">
            ✓ NO ACTIVE HOTSPOTS IN RANGE
          </div>
        </div>
      </div>
    );
  }

  const eonetCount = fires.filter((f) => f.source === 'EONET').length;
  const firmsCount = fires.filter((f) => f.source === 'FIRMS').length;
  const closest = fires[0];

  return (
    <div className="space-y-2">
      {partialNote}
      <div className="flex flex-wrap gap-3 text-[9px] font-mono uppercase tracking-widest text-muted">
        <span>EONET <span className="text-risk tabular-nums">{eonetCount}</span></span>
        <span>FIRMS <span className="text-risk tabular-nums">{firmsCount}</span></span>
        <span>CLOSEST <span className="text-risk tabular-nums">{closest.distanceKm.toFixed(1)} KM</span></span>
      </div>
      <div className="grid gap-1">
        {fires.slice(0, 6).map((fire) => (
          <div key={fire.id} className="border border-edge bg-void/40 px-2 py-1.5 rounded-md">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[11px] font-mono text-ink truncate">
                {fire.title ?? `${fire.source} HOTSPOT`}
              </div>
              <div className="text-[9px] font-mono text-risk tabular-nums shrink-0 uppercase tracking-widest">
                {fire.distanceKm.toFixed(1)}KM
              </div>
            </div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted mt-0.5">
              {fire.source} · {fire.date.slice(0, 10)}
              {fire.frp != null && ` · FRP ${fire.frp.toFixed(1)}MW`}
              {fire.confidence && ` · ${fire.confidence.toUpperCase()}`}
            </div>
          </div>
        ))}
      </div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-dim">
        ※ HOTSPOTS OVERLAID ON MAIN MAP WHILE HAZARDS TAB ACTIVE
      </div>
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
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted">SET COORD TO QUERY USGS CATALOG</div>
    </div>
  );
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="border border-risk/50 bg-risk/5 p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-risk mb-1">✖ USGS FAULT</div>
      {error && <div className="text-[10px] font-mono text-ink break-words">{error}</div>}
    </div>
  );
}
