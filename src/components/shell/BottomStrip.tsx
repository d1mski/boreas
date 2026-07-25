import { useEffect, useState } from 'react';
import type { Coordinates } from '../../types';
import { computeCompareGeometry, formatDistance } from '../../utils/compareUtils';
import { StatusDot } from '../hud/StatusDot';

interface Props {
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
  resolvingA: boolean;
  resolvedA: string | null;
  compareMode: boolean;
  className?: string;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmtUtc(d: Date) {
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const s = d.getUTCSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function fmtDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtCoord(c: Coordinates): string {
  const lat = `${c.lat >= 0 ? 'N' : 'S'}${Math.abs(c.lat).toFixed(4)}°`;
  const lon = `${c.lon >= 0 ? 'E' : 'W'}${Math.abs(c.lon).toFixed(4)}°`;
  return `${lat} ${lon}`;
}

export function BottomStrip({
  coordsA,
  coordsB,
  resolvingA,
  resolvedA,
  compareMode,
  className,
}: Props) {
  const now = useClock();
  const sessionId = (
    Math.abs(
      ((window.location.search || '') + now.getUTCMinutes().toString())
        .split('')
        .reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0),
    ) % 0xffff
  )
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');

  const compare = compareMode && coordsA && coordsB
    ? computeCompareGeometry(coordsA, coordsB)
    : null;

  return (
    <footer className={`h-8 border-t border-edge bg-void/95 backdrop-blur-md flex items-center text-[9px] font-mono uppercase tracking-widest select-none shrink-0${className ? ` ${className}` : ''}`}>
      <div className="px-4 flex items-center gap-3 border-r border-edge h-full">
        <StatusDot tone="good" label="ONLINE" />
      </div>

      <div className="px-4 flex items-center gap-3 border-r border-edge h-full text-muted">
        <span>SYS</span>
        <span className="text-ink">settl./{__APP_VERSION__}</span>
      </div>

      <div className="px-4 flex items-center gap-3 border-r border-edge h-full text-muted">
        <span>SESS</span>
        <span className="text-cyan">0x{sessionId}</span>
      </div>

      {!compare ? (
        <div className="flex-1 px-4 flex items-center gap-3 text-muted min-w-0">
          <span className="shrink-0">TGT A</span>
          {coordsA ? (
            <>
              <span className="text-cyan tabular-nums shrink-0">{fmtCoord(coordsA)}</span>
              <span className="text-edge-bright shrink-0">·</span>
              <span className="text-ink truncate">
                {resolvingA ? 'RESOLVING...' : (resolvedA ?? '—')}
              </span>
            </>
          ) : (
            <span className="text-dim">UNSET</span>
          )}
        </div>
      ) : (
        <div className="flex-1 px-4 flex items-center gap-3 text-muted truncate">
          <span className="text-cyan">A</span>
          <span className="text-cyan tabular-nums">{fmtCoord(coordsA!)}</span>
          <span className="text-edge-bright">↔</span>
          <span className="text-amber tabular-nums">{fmtCoord(coordsB!)}</span>
          <span className="text-amber">B</span>
          <span className="text-edge-bright">·</span>
          <span>Δ</span>
          <span className="text-ink">{formatDistance(compare.distanceKm)}</span>
          <span className="text-muted">@</span>
          <span className="text-ink">{compare.bearingAtoB.toFixed(0)}° {compare.cardinalAtoB}</span>
        </div>
      )}

      <div className="px-4 flex items-center gap-3 border-l border-edge h-full text-muted">
        <span>UTC</span>
        <span className="text-ink tabular-nums">{fmtDate(now)} {fmtUtc(now)}</span>
      </div>

      <div className="px-4 flex items-center gap-2 border-l border-edge h-full text-muted">
        <span>UNCLAS</span>
        <span className="text-amber">◆</span>
      </div>
    </footer>
  );
}
