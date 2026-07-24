import { useEffect, useState } from 'react';
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
import { createSharedMap, sharedFetch } from '../utils/sharedFetch';

const openMeteoGate = new Semaphore(2);

const BASE = 'https://historical-forecast-api.open-meteo.com/v1/forecast';

const HOURLY_VARS = [
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_speed_100m',
  'wind_direction_100m',
  'wind_gusts_10m',
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'snowfall',
  'cloud_cover',
  'shortwave_radiation',
];

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'precipitation_hours',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'sunshine_duration',
];

const cache = new Map<string, ClimateData>();
const inflight = createSharedMap<ClimateData>();

const COORD_PRECISION = 2;

function quantize(coords: Coordinates): Coordinates {
  return {
    lat: Number(coords.lat.toFixed(COORD_PRECISION)),
    lon: Number(coords.lon.toFixed(COORD_PRECISION)),
  };
}

const KEY_VERSION = 'v8';

function makeKey(coords: Coordinates, start: string, end: string, model: string): string {
  return `${KEY_VERSION}|${coords.lat.toFixed(COORD_PRECISION)}|${coords.lon.toFixed(COORD_PRECISION)}|${start}|${end}|${model}`;
}

interface ModelChoice {
  id: string;
  display: string;
  resolutionKm: number;
}

const ICON: ModelChoice = {
  id: 'icon_seamless',
  display: 'DWD ICON-EU · ~6KM',
  resolutionKm: 6,
};

function pickModel(_coords: Coordinates): ModelChoice {
  return ICON;
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  hourly: Record<string, number[] | string[]>;
  daily: Record<string, number[] | string[]>;
}

function buildUrl(
  coords: Coordinates,
  start: string,
  end: string,
  model: ModelChoice,
): string {
  const params = new URLSearchParams({
    latitude: coords.lat.toString(),
    longitude: coords.lon.toString(),
    start_date: start,
    end_date: end,
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
    windspeed_unit: 'kmh',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
    models: model.id,
  });
  return `${BASE}?${params.toString()}`;
}

// UV index not available on ICON model; fetch separately without model param
function buildUvUrl(coords: Coordinates, start: string, end: string): string {
  const params = new URLSearchParams({
    latitude: coords.lat.toString(),
    longitude: coords.lon.toString(),
    start_date: start,
    end_date: end,
    daily: 'uv_index_max',
    timezone: 'auto',
  });
  return `${BASE}?${params.toString()}`;
}

function arr(obj: Record<string, number[] | string[]>, key: string): number[] {
  return (obj[key] as number[]) ?? [];
}

function strArr(obj: Record<string, number[] | string[]>, key: string): string[] {
  return (obj[key] as string[]) ?? [];
}

const RETRY_DELAYS_MS = [3000, 9000, 20000];

async function fetchWithBackoff(
  url: string,
  signal: AbortSignal,
): Promise<OpenMeteoResponse> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetchJson<OpenMeteoResponse>(url, { signal, timeoutMs: 25000 });
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

async function fetchOpenMeteo(
  coords: Coordinates,
  start: string,
  end: string,
  model: ModelChoice,
  signal: AbortSignal,
): Promise<ClimateData> {
  const url = buildUrl(coords, start, end, model);
  const uvUrl = buildUvUrl(coords, start, end);
  const [raw, uvRaw] = await Promise.all([
    fetchWithBackoff(url, signal),
    fetchWithBackoff(uvUrl, signal).catch(() => null),
  ]);

  const resolved: Coordinates = { lat: raw.latitude, lon: raw.longitude };
  const distanceMeters = haversine(coords, resolved);

  const resolvedLoc: ResolvedLocation = {
    requested: coords,
    resolved,
    elevation: raw.elevation,
    distanceMeters,
    model: model.display,
    modelResolutionKm: model.resolutionKm,
  };

  const hourly: HourlyWeather = {
    time: strArr(raw.hourly, 'time'),
    windSpeed10m: arr(raw.hourly, 'wind_speed_10m'),
    windDirection10m: arr(raw.hourly, 'wind_direction_10m'),
    windSpeed100m: arr(raw.hourly, 'wind_speed_100m'),
    windDirection100m: arr(raw.hourly, 'wind_direction_100m'),
    windGusts10m: arr(raw.hourly, 'wind_gusts_10m'),
    temperature2m: arr(raw.hourly, 'temperature_2m'),
    relativeHumidity2m: arr(raw.hourly, 'relative_humidity_2m'),
    precipitation: arr(raw.hourly, 'precipitation'),
    rain: arr(raw.hourly, 'rain'),
    snowfall: arr(raw.hourly, 'snowfall'),
    cloudCover: arr(raw.hourly, 'cloud_cover'),
    shortwaveRadiation: arr(raw.hourly, 'shortwave_radiation'),
  };

  const daily: DailyWeather = {
    time: strArr(raw.daily, 'time'),
    temperatureMax: arr(raw.daily, 'temperature_2m_max'),
    temperatureMin: arr(raw.daily, 'temperature_2m_min'),
    temperatureMean: arr(raw.daily, 'temperature_2m_mean'),
    precipitationSum: arr(raw.daily, 'precipitation_sum'),
    rainSum: arr(raw.daily, 'rain_sum'),
    snowfallSum: arr(raw.daily, 'snowfall_sum'),
    precipitationHours: arr(raw.daily, 'precipitation_hours'),
    windSpeedMax: arr(raw.daily, 'wind_speed_10m_max'),
    windGustsMax: arr(raw.daily, 'wind_gusts_10m_max'),
    windDirectionDominant: arr(raw.daily, 'wind_direction_10m_dominant'),
    sunshineDuration: arr(raw.daily, 'sunshine_duration'),
    uvIndexMax: uvRaw ? arr(uvRaw.daily, 'uv_index_max') : [],
  };

  return { resolved: resolvedLoc, hourly, daily };
}

// _years is reserved for Plan 04 — useOpenMeteo always serves the 1-yr path;
// 5/10-yr routing uses useClimateArchive. Param is inert here.
export function useOpenMeteo(coords: Coordinates | null, _years: 1 = 1): ModuleState<ClimateData> {
  const [state, setState] = useState<ModuleState<ClimateData>>(() =>
    initialModuleState<ClimateData>(),
  );

  const qLat = coords ? Number(coords.lat.toFixed(COORD_PRECISION)) : null;
  const qLon = coords ? Number(coords.lon.toFixed(COORD_PRECISION)) : null;

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<ClimateData>());
      return;
    }
    const qCoords = quantize(coords);
    const { start, end } = defaultDateRange();
    const model = pickModel(coords);
    const key = makeKey(qCoords, start, end, model.id);
    const cached = cache.get(key);
    if (cached) {
      setState({ status: 'success', data: cached, error: null });
      return;
    }

    let cancelled = false;
    // Set once the shared fetch is subscribed; releasing it aborts the
    // underlying request when this is the last subscriber (see sharedFetch).
    let release: (() => void) | null = null;
    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      const persistent = await cacheGet<ClimateData>(key);
      if (cancelled) return;
      if (persistent) {
        cache.set(key, persistent);
        setState({ status: 'success', data: persistent, error: null });
        return;
      }

      const sub = sharedFetch(inflight, key, (signal) =>
        openMeteoGate.run(async () => {
          if (signal.aborted) throw new DOMException('aborted', 'AbortError');
          const data = await fetchOpenMeteo(coords, start, end, model, signal);
          cache.set(key, data);
          void cacheSet(key, data, TTL.openMeteoArchive);
          return data;
        }),
      );
      release = sub.release;
      sub.promise
        .then((data) => {
          if (cancelled) return;
          setState({ status: 'success', data, error: null });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const friendlier =
            err instanceof FetchError && err.status === 429
              ? 'Rate-limited by Open-Meteo (retried 3×). Wait 30s and try again.'
              : err instanceof Error
              ? err.message
              : String(err);
          setState({ status: 'error', data: null, error: friendlier });
        });
    })();

    return () => {
      cancelled = true;
      release?.();
    };
  }, [qLat, qLon]);

  return state;
}

