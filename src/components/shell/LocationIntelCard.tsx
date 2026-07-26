import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, ChevronDown } from 'lucide-react';
import type { Coordinates } from '../../types';
import type { Slot } from '../../hooks/useUrlState';
import { formatCoordinate, parseCoordinates } from '../../utils/coordinates';
import { forwardGeocode, reverseGeocode, type GeocodeResult } from '../../hooks/useNominatim';
import { Panel } from '../hud/Panel';
import { useSavedLocations } from '../../hooks/useSavedLocations';

const HeartOutline = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

const HeartFilled = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

interface Props {
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
  resolvedA: string | null;
  countryA: string | null;
  resolvingA: boolean;
  resolvedB: string | null;
  countryB: string | null;
  resolvingB: boolean;
  activeSlot: Slot;
  compareMode: boolean;
  onSetSlot: (slot: Slot) => void;
  onChangeA: (coords: Coordinates | null) => void;
  onChangeB: (coords: Coordinates | null) => void;
  onEnableCompare: () => void;
  onDisableCompare: () => void;
}

export function LocationIntelCard({
  coordsA,
  coordsB,
  resolvedA,
  countryA,
  resolvingA,
  resolvedB,
  countryB,
  resolvingB,
  activeSlot,
  compareMode,
  onSetSlot,
  onChangeA,
  onChangeB,
  onEnableCompare,
  onDisableCompare,
}: Props) {
  const currentValue = activeSlot === 'b' ? coordsB : coordsA;
  const setCurrent = activeSlot === 'b' ? onChangeB : onChangeA;

  const [raw, setRaw] = useState(currentValue ? formatCoordinate(currentValue) : '');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fixStatus, setFixStatus] = useState<'idle' | 'locating' | 'active' | 'denied' | 'nogps'>('idle');
  const [accuracyM, setAccuracyM] = useState<number | null>(null); // GPS fix radius in metres

  const { locations, isSaved, toggle, remove } = useSavedLocations();
  const [capWarning, setCapWarning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const currentSaved = coordsA ? isSaved(coordsA.lat, coordsA.lon) : false;

  function handleHeartToggle() {
    if (!coordsA) return;
    const label = resolvedA ?? `${coordsA.lat.toFixed(5)}, ${coordsA.lon.toFixed(5)}`;
    const result = toggle({ label, lat: coordsA.lat, lon: coordsA.lon });
    if (result.rejected) {
      setCapWarning(true);
      setTimeout(() => setCapWarning(false), 3000);
    } else {
      setCapWarning(false);
    }
  }

  useEffect(() => {
    setRaw(currentValue ? formatCoordinate(currentValue) : '');
  }, [activeSlot, currentValue?.lat, currentValue?.lon]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setFocusedIdx(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setRaw(value);
    setSuggestions([]);
    setFocusedIdx(-1);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) return;

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const results = await forwardGeocode(value.trim(), ctrl.signal);
        if (!ctrl.signal.aborted) {
          setSuggestions(results);
          setFocusedIdx(-1);
        }
      } catch {
        // Silently swallow — user may still hit Enter for exact search
      }
    }, 400);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) {
      if (e.key === 'Enter') handleSubmit();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setFocusedIdx(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIdx >= 0 && suggestions[focusedIdx]) {
        selectSuggestion(suggestions[focusedIdx]);
      } else {
        handleSubmit();
      }
    }
  }

  function selectSuggestion(s: GeocodeResult) {
    const truncated = s.displayName.length > 70 ? s.displayName.slice(0, 70) + '...' : s.displayName;
    setRaw(truncated);
    setCurrent(s.coords);
    setSuggestions([]);
    setFocusedIdx(-1);
  }

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setFixStatus('nogps');
      return;
    }
    setFixStatus('locating');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCurrent(coords);
        setAccuracyM(pos.coords.accuracy);
        setFixStatus('active');
        try {
          const result = await reverseGeocode(coords);
          setRaw(result.displayName.length > 70 ? result.displayName.slice(0, 70) + '...' : result.displayName);
        } catch {
          // Reverse geocode failed — coords are still set, just no display name
        }
      },
      (err) => {
        if (err.code === 1) {
          setFixStatus('denied');
          setError('Grant Location Access — click the crosshair button or enter coordinates manually');
        } else if (err.code === 2) {
          setFixStatus('denied');
          setError('Location unavailable');
        } else {
          setFixStatus('denied');
          setError('Location request timed out');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleSubmit() {
    setError(null);
    setSuggestions([]);
    const text = raw.trim();
    if (!text) {
      setCurrent(null);
      return;
    }
    const parsed = parseCoordinates(text);
    if (parsed) {
      setCurrent(parsed);
      return;
    }
    setSearching(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const results = await forwardGeocode(text, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (results.length === 0) setError(`NO MATCH · "${text.toUpperCase()}"`);
      else if (results.length === 1) setCurrent(results[0].coords);
      else setSuggestions(results);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError((err instanceof Error ? err.message : String(err)).toUpperCase());
    } finally {
      setSearching(false);
    }
  }

  return (
    <Panel className="w-full md:w-[360px]">
      {/* Wordmark */}
      <div className="px-4 pt-3 pb-2 border-b border-edge flex items-center justify-between">
        <div>
          <div className="font-mono text-[17px] font-bold leading-none tracking-tight text-ink lowercase">
            settl<span className="text-cyan">.</span>
          </div>
          <div className="text-[8px] font-mono uppercase tracking-widest text-muted mt-1">
            LOCATION INTELLIGENCE
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!compareMode ? (
            <button
              onClick={onEnableCompare}
              className="text-[8px] font-mono uppercase tracking-widest border border-edge bg-void px-2 py-1 rounded-md text-amber hover:border-amber hover:bg-amber/5 transition-colors"
              title="Add comparison location"
            >
              + CMP
            </button>
          ) : (
            <button
              onClick={onDisableCompare}
              className="text-[8px] font-mono uppercase tracking-widest border border-edge bg-void px-2 py-1 rounded-md text-muted hover:border-risk hover:text-risk transition-colors"
              title="Exit compare mode"
            >
              × CMP
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse location details' : 'Expand location details'}
            className="md:hidden shrink-0 w-7 h-7 flex items-center justify-center border border-edge bg-void rounded-md"
          >
            <ChevronDown
              size={14}
              className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 space-y-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1.5 flex items-center gap-2">
            <span>INPUT</span>
            <span className="flex-1 h-px bg-edge" />
            {compareMode && (
              <SlotToggle activeSlot={activeSlot} onSetSlot={onSetSlot} />
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleGeolocate}
              title="Use current location"
              aria-label="Use current location"
              className={`shrink-0 w-8 h-8 flex items-center justify-center border rounded-md bg-void transition-colors ${
                fixStatus === 'active'
                  ? 'border-cyan text-cyan'
                  : fixStatus === 'locating'
                  ? 'border-amber/50 text-amber'
                  : fixStatus === 'denied' || fixStatus === 'nogps'
                  ? 'border-risk/50 text-risk'
                  : 'border-edge text-muted hover:border-cyan hover:text-cyan'
              }`}
            >
              <Crosshair size={14} />
            </button>
            <div ref={containerRef} className="relative flex-1 min-w-0">
              <input
                type="text"
                value={raw}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeSlot === 'b' ? 'TGT B · COORD / DMS / ADDR' : 'TGT A · COORD / DMS / ADDR'
                }
                className={`w-full bg-void border rounded-md px-2.5 py-1.5 text-[11px] font-mono text-ink outline-none placeholder:text-dim tracking-wider transition-colors ${
                  activeSlot === 'b'
                    ? 'border-amber/50 focus:border-amber'
                    : 'border-edge focus:border-cyan'
                }`}
              />
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-0.5 bg-void border border-edge rounded shadow-lg max-h-[200px] overflow-y-auto z-50">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectSuggestion(s)}
                      className={`w-full text-left px-2 py-1.5 flex items-center gap-2 transition-colors ${
                        i === focusedIdx ? 'bg-cyan/10 text-ink' : 'hover:bg-cyan/5'
                      }`}
                    >
                      <MapPin size={12} className="shrink-0 text-muted" />
                      <span className="text-[10px] font-mono text-ink truncate">
                        {s.displayName.length > 70 ? s.displayName.slice(0, 70) + '...' : s.displayName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={searching}
              className={`shrink-0 px-3 py-1.5 border rounded-md bg-void text-[10px] font-mono uppercase tracking-widest transition-colors disabled:opacity-40 ${
                activeSlot === 'b'
                  ? 'border-amber/50 text-amber hover:border-amber hover:bg-amber/5'
                  : 'border-edge text-cyan hover:border-cyan hover:bg-cyan/5'
              }`}
            >
              {searching ? '...' : 'GO'}
            </button>
          </div>

          {fixStatus !== 'idle' && (
            <div className={`mt-1 text-[9px] font-mono tracking-wider ${
              fixStatus === 'locating' ? 'text-amber' :
              fixStatus === 'active' ? 'text-good' :
              fixStatus === 'denied' || fixStatus === 'nogps' ? 'text-risk' : 'text-muted'
            }`}>
              {fixStatus === 'locating' && 'LOCATING...'}
              {fixStatus === 'active' && (
                <>
                  ACTIVE
                  {accuracyM != null && (
                    <span className={accuracyM > 1000 ? 'text-amber' : 'text-muted'}>
                      {' · '}±{accuracyM >= 1000 ? `${(accuracyM / 1000).toFixed(1)} km` : `${Math.round(accuracyM)} m`}
                      {accuracyM > 1000 && ' (approx — no GPS/WiFi)'}
                    </span>
                  )}
                </>
              )}
              {fixStatus === 'denied' && 'DENIED'}
              {fixStatus === 'nogps' && 'NO GPS'}
            </div>
          )}

          {error && (
            <div className="mt-2 text-[9px] font-mono tracking-wider text-risk border-l border-risk pl-2">
              {error}
            </div>
          )}
        </div>

        <div className={expanded ? '' : 'hidden md:block'}>
          <FixBlock
            label="FIX A"
            coords={coordsA}
            resolved={resolvedA}
            country={countryA}
            resolving={resolvingA}
            tone="cyan"
            active={activeSlot === 'a'}
            onActivate={() => onSetSlot('a')}
          />

          {coordsA && (
            <div className="flex items-center gap-2 -mt-1">
              <button
                onClick={handleHeartToggle}
                disabled={resolvingA}
                aria-label={currentSaved ? 'Remove saved location' : 'Save location'}
                aria-pressed={currentSaved}
                className={`p-1 rounded transition-colors ${
                  currentSaved
                    ? 'text-rose-400 hover:text-rose-300'
                    : 'text-muted hover:text-ink'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {currentSaved ? <HeartFilled /> : <HeartOutline />}
              </button>
              <span className="text-[8px] font-mono uppercase tracking-widest text-muted">
                {currentSaved ? 'SAVED' : 'SAVE LOCATION'}
              </span>
              {capWarning && (
                <span className="text-[8px] font-mono uppercase tracking-widest text-risk">
                  MAX 10 REACHED
                </span>
              )}
            </div>
          )}

          {compareMode && (
            <FixBlock
              label="FIX B"
              coords={coordsB}
              resolved={resolvedB}
              country={countryB}
              resolving={resolvingB}
              tone="amber"
              active={activeSlot === 'b'}
              onActivate={() => onSetSlot('b')}
            />
          )}

          {locations.length > 0 && (
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1.5 flex items-center gap-2">
                <span>SAVED · {locations.length}/10</span>
                <span className="flex-1 h-px bg-edge" />
              </div>
              <div className="space-y-0.5">
                {locations.map(loc => (
                  <div key={loc.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => onChangeA({ lat: loc.lat, lon: loc.lon })}
                      className="flex-1 text-left px-2 py-1 text-[10px] font-mono text-ink truncate rounded hover:bg-cyan/5 transition-colors"
                      title={`${loc.label} (${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)})`}
                    >
                      {loc.label}
                    </button>
                    <button
                      onClick={() => remove(loc.id)}
                      aria-label={`Remove ${loc.label}`}
                      className="shrink-0 p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-risk transition-all"
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[8px] font-mono uppercase tracking-widest text-dim pt-2 border-t border-edge">
            Map click . Drag pin . Enter coords
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SlotToggle({
  activeSlot,
  onSetSlot,
}: {
  activeSlot: Slot;
  onSetSlot: (slot: Slot) => void;
}) {
  return (
    <div className="flex border border-edge rounded-md overflow-hidden text-[8px] font-mono uppercase tracking-widest">
      <button
        onClick={() => onSetSlot('a')}
        className={`px-1.5 py-0.5 transition-colors ${
          activeSlot === 'a' ? 'bg-cyan/15 text-cyan' : 'text-muted hover:text-ink'
        }`}
      >
        TGT·A
      </button>
      <button
        onClick={() => onSetSlot('b')}
        className={`px-1.5 py-0.5 transition-colors border-l border-edge ${
          activeSlot === 'b' ? 'bg-amber/15 text-amber' : 'text-muted hover:text-ink'
        }`}
      >
        TGT·B
      </button>
    </div>
  );
}

function FixBlock({
  label,
  coords,
  resolved,
  country,
  resolving,
  tone,
  active,
  onActivate,
}: {
  label: string;
  coords: Coordinates | null;
  resolved: string | null;
  country: string | null;
  resolving: boolean;
  tone: 'cyan' | 'amber';
  active: boolean;
  onActivate: () => void;
}) {
  const toneText = tone === 'cyan' ? 'text-cyan' : 'text-amber';
  const toneBg = tone === 'cyan' ? 'bg-cyan' : 'bg-amber';
  return (
    <button
      onClick={onActivate}
      className={`w-full text-left transition-colors ${active ? '' : 'opacity-70 hover:opacity-100'}`}
    >
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1.5 flex items-center gap-2">
        <span className={`inline-block w-1.5 h-1.5 ${toneBg}`} />
        <span>{label}</span>
        {active && <span className={`text-[8px] ${toneText}`}>· ACTIVE</span>}
        <span className="flex-1 h-px bg-edge" />
      </div>
      {coords ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px] font-mono">
          <span className="text-muted">LAT</span>
          <span className={`${toneText} tabular-nums`}>
            {coords.lat >= 0 ? 'N' : 'S'}
            {Math.abs(coords.lat).toFixed(5)}°
          </span>
          <span className="text-muted">LON</span>
          <span className={`${toneText} tabular-nums`}>
            {coords.lon >= 0 ? 'E' : 'W'}
            {Math.abs(coords.lon).toFixed(5)}°
          </span>
          <span className="text-muted">CC</span>
          <span className="text-ink">{country ?? '—'}</span>
          <span className="text-muted">LOC</span>
          <span className="text-ink truncate" title={resolved ?? ''}>
            {resolving ? (
              <span className={`${toneText} opacity-70`}>RESOLVING...</span>
            ) : (
              resolved ?? '—'
            )}
          </span>
        </div>
      ) : (
        <div className="text-[9px] font-mono uppercase tracking-wider text-dim">
          NO {label} · CLICK MAP OR ENTER COORD
        </div>
      )}
    </button>
  );
}
