import { useEffect, useRef, useState } from 'react';
import type {
  ClimateData,
  Coordinates,
  DailyWeather,
  HourlyWeather,
  ModuleState,
  ResolvedLocation,
} from '../types';
import { initialModuleState } from '../types';
import { fetchJson, FetchError } from '../utils/fetcher';
import { haversine } from '../utils/coordinates';
import { cacheGet, cacheSet, TTL } from '../utils/persistentCache';
import { Semaphore } from '../utils/semaphore';

// Rate-limit archive fetches to 2 concurrent — mirrors openMeteoGate in useOpenMeteo.
const archiveGate = new Semaphore(2);

const BASE = 'https://archive-api.open-meteo.com/v1/archive';

// Daily variables supplied to the archive endpoint.
// NO hourly (avoids 7.4MB payload; thermal-matrix and humidity degrade in Plan 04).
// NO uv_index_max (returns all null from ERA5 — Plan 04 shows N/A for UV).
// NO models param (ERA5 is the only ERA5 source; archive-api defaults to it).
const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'precipitation_hours',
  'sunshine_duration',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
];

// In-memory + idb cache — 30-day TTL (ERA5 reanalysis is stable; aggressive cache per RESEARCH).
const cache = new Map<string, ClimateData>();
const inflight = new Map<string, Promise<ClimateData>>();

const COORD_PRECISION = 2;
const ARCHIVE_KEY_VERSION = 'era5v1';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// N-year rolling window ending 7 days ago (same lag as useOpenMeteo's defaultDateRange).
function archiveDateRange(years: number): { start: string; end: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return { start: isoDate(start), end: isoDate(end) };
}

function makeArchiveKey(coords: Coordinates, start: string, end: string, years: number): string {
  return `${ARCHIVE_KEY_VERSION}|${coords.lat.toFixed(COORD_PRECISION)}|${coords.lon.toFixed(COORD_PRECISION)}|${start}|${end}|${years}`;
}

interface ArchiveResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  daily: Record<string, number[] | string[]>;
}

function arr(obj: Record<string, number[] | string[]>, key: string): number[] {
  return (obj[key] as number[]) ?? [];
}

function strArr(obj: Record<string, number[] | string[]>, key: string): string[] {
  return (obj[key] as string[]) ?? [];
}

function buildUrl(coords: Coordinates, start: string, end: string): string {
  const params = new URLSearchParams({
    latitude: coords.lat.toString(),
    longitude: coords.lon.toString(),
    start_date: start,
    end_date: end,
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
    windspeed_unit: 'kmh',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
  });
  return `${BASE}?${params.toString()}`;
}

const RETRY_DELAYS_MS = [3000, 9000, 20000];

async function fetchWithBackoff(
  url: string,
  signal: AbortSignal,
): Promise<ArchiveResponse> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetchJson<ArchiveResponse>(url, { signal, timeoutMs: 25000 });
    } catch (err) {
      if (signal.aborted) throw err;
      const is429 = err instanceof FetchError && err.status === 429;
      if (!is429 || attempt === RETRY_DELAYS_MS.length) throw err;
      const delay = RETRY_DELAYS_MS[attempt];
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('aborted', 'AbortError'));
        }, { once: true });
      });
    }
  }
  throw new Error('unreachable');
}

async function fetchClimateArchive(
  coords: Coordinates,
  start: string,
  end: string,
  years: number,
  signal: AbortSignal,
): Promise<ClimateData> {
  const url = buildUrl(coords, start, end);
  const raw = await fetchWithBackoff(url, signal);

  const resolvedCoords: Coordinates = { lat: raw.latitude, lon: raw.longitude };
  const distanceMeters = haversine(coords, resolvedCoords);

  const resolvedLoc: ResolvedLocation = {
    requested: coords,
    resolved: resolvedCoords,
    elevation: raw.elevation,
    distanceMeters,
    model: 'ERA5 REANALYSIS · ~9KM',
    modelResolutionKm: 9,
  };

  // Hourly: empty arrays — archive is daily-only. Thermal-matrix (section 02) and
  // humidity (section 04) degrade to N/A in Plan 04.
  const hourly: HourlyWeather = {
    time: [],
    windSpeed10m: [],
    windDirection10m: [],
    windSpeed100m: [],
    windDirection100m: [],
    windGusts10m: [],
    temperature2m: [],
    relativeHumidity2m: [],
    precipitation: [],
    rain: [],
    snowfall: [],
    cloudCover: [],
    shortwaveRadiation: [],
  };

  // Raw daily arrays from ERA5.
  const rawTime = strArr(raw.daily, 'time');
  const rawTmax = arr(raw.daily, 'temperature_2m_max');
  const rawTmin = arr(raw.daily, 'temperature_2m_min');
  const rawTmean = arr(raw.daily, 'temperature_2m_mean');
  const rawPrecip = arr(raw.daily, 'precipitation_sum');
  const rawRain = arr(raw.daily, 'rain_sum');
  const rawSnow = arr(raw.daily, 'snowfall_sum');
  const rawPrecipHours = arr(raw.daily, 'precipitation_hours');
  const rawSunshine = arr(raw.daily, 'sunshine_duration');
  const rawWindMax = arr(raw.daily, 'wind_speed_10m_max');
  const rawGustMax = arr(raw.daily, 'wind_gusts_10m_max');
  const rawWindDir = arr(raw.daily, 'wind_direction_10m_dominant');

  // NORMALIZATION: divide SUM-TYPE display fields by N years so that when
  // buildMonthlyAggregates accumulates them across N×Jan…N×Dec into monthly
  // buckets, each bucket represents one average year rather than N-year totals.
  //
  // DIVIDE by N (4 display-sum fields):
  //   rainSum, snowfallSum, sunshineDuration, precipitationHours
  //
  // DO NOT DIVIDE precipitationSum: it is NOT a display sum. countExtremeDays
  // tests each day's value against the >20mm heavyRain threshold. Dividing it
  // would push real wet days below the threshold and undercount heavy-rain days.
  // Per-year scaling for that count (count÷N) happens in Plan 04.
  //
  // DO NOT DIVIDE temperature/wind arrays: they are averaged or max-reduced per
  // bucket, so they naturally represent a single year regardless of N.
  //
  // rainDays is counted from undivided precipitationSum and ÷N'd inside
  // buildMonthlyAggregates (fixed 2026-07; see climateAggregation.test.ts).
  // The ÷N'd sums below need NO further division downstream: accumulating N
  // years of ÷N daily values into one 12-month bucket already yields one
  // average year — dividing again would double-divide.
  const n = years;
  const daily: DailyWeather = {
    time: rawTime,                                      // pass through — N years of dates
    temperatureMax: rawTmax,                            // pass through — max-reduced per bucket
    temperatureMin: rawTmin,                            // pass through — min-reduced per bucket
    temperatureMean: rawTmean,                          // pass through — averaged per bucket
    windSpeedMax: rawWindMax,                           // pass through — averaged per bucket
    windGustsMax: rawGustMax,                           // pass through — max-reduced per bucket
    windDirectionDominant: rawWindDir,                  // pass through
    precipitationSum: rawPrecip,                        // pass through — per-day threshold input
    rainSum: rawRain.map(v => v / n),                   // SUM ÷ N (display chart value)
    snowfallSum: rawSnow.map(v => v / n),               // SUM ÷ N (display chart value)
    sunshineDuration: rawSunshine.map(v => v / n),      // SUM ÷ N (display chart value)
    precipitationHours: rawPrecipHours.map(v => v / n), // SUM ÷ N (display chart value)
    uvIndexMax: [],                                     // absent from ERA5 archive → N/A in Plan 04
  };

  return { resolved: resolvedLoc, hourly, daily };
}

function sharedFetch(
  coords: Coordinates,
  bucketKey: string,
  start: string,
  end: string,
  years: number,
): Promise<ClimateData> {
  const existing = inflight.get(bucketKey);
  if (existing) return existing;
  const ctrl = new AbortController();
  const p = archiveGate
    .run(() => fetchClimateArchive(coords, start, end, years, ctrl.signal))
    .then((data) => {
      cache.set(bucketKey, data);
      void cacheSet(bucketKey, data, TTL.openMeteoArchive);
      return data;
    })
    .finally(() => {
      inflight.delete(bucketKey);
    });
  inflight.set(bucketKey, p);
  return p;
}

export function useClimateArchive(coords: Coordinates | null, years: 5 | 10): ModuleState<ClimateData> {
  const [state, setState] = useState<ModuleState<ClimateData>>(() =>
    initialModuleState<ClimateData>(),
  );
  const controllerRef = useRef<AbortController | null>(null);

  const qLat = coords ? Number(coords.lat.toFixed(COORD_PRECISION)) : null;
  const qLon = coords ? Number(coords.lon.toFixed(COORD_PRECISION)) : null;

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<ClimateData>());
      return;
    }
    const qCoords: Coordinates = {
      lat: Number(coords.lat.toFixed(COORD_PRECISION)),
      lon: Number(coords.lon.toFixed(COORD_PRECISION)),
    };
    const { start, end } = archiveDateRange(years);
    const key = makeArchiveKey(qCoords, start, end, years);

    const cached = cache.get(key);
    if (cached) {
      setState({ status: 'success', data: cached, error: null });
      return;
    }

    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      const persistent = await cacheGet<ClimateData>(key);
      if (ctrl.signal.aborted) return;
      if (persistent) {
        cache.set(key, persistent);
        setState({ status: 'success', data: persistent, error: null });
        return;
      }
      try {
        const data = await sharedFetch(qCoords, key, start, end, years);
        if (ctrl.signal.aborted) return;
        setState({ status: 'success', data, error: null });
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const friendlier =
          err instanceof FetchError && err.status === 429
            ? 'Rate-limited by Open-Meteo Archive (retried 3×). Wait 30s and try again.'
            : err instanceof Error
            ? err.message
            : String(err);
        setState({ status: 'error', data: null, error: friendlier });
        return;
      }
    })();

    return () => {
      ctrl.abort();
    };
  }, [qLat, qLon, years]);

  return state;
}
