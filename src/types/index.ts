export interface Coordinates {
  lat: number;
  lon: number;
}

export interface SavedLocation {
  id: string;       // `${lat.toFixed(5)},${lon.toFixed(5)}`
  label: string;    // reverse-geocoded address or fallback coords string
  lat: number;
  lon: number;
  savedAt: number;  // Date.now() timestamp for stable ordering
}

export type ModuleStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ModuleState<T> {
  status: ModuleStatus;
  data: T | null;
  error: string | null;
}

export const initialModuleState = <T>(): ModuleState<T> => ({
  status: 'idle',
  data: null,
  error: null,
});

export interface ResolvedLocation {
  requested: Coordinates;
  resolved: Coordinates;
  elevation: number;
  distanceMeters: number;
  model: string;
  modelResolutionKm: number;
}

export interface HourlyWeather {
  time: string[];
  windSpeed10m: number[];
  windDirection10m: number[];
  windSpeed100m: number[];
  windDirection100m: number[];
  windGusts10m: number[];
  temperature2m: number[];
  relativeHumidity2m: number[];
  precipitation: number[];
  rain: number[];
  snowfall: number[];
  cloudCover: number[];
  shortwaveRadiation: number[];
}

export interface DailyWeather {
  time: string[];
  temperatureMax: number[];
  temperatureMin: number[];
  temperatureMean: number[];
  precipitationSum: number[];
  rainSum: number[];
  snowfallSum: number[];
  precipitationHours: number[];
  windSpeedMax: number[];
  windGustsMax: number[];
  windDirectionDominant: number[];
  sunshineDuration: number[];
  uvIndexMax: number[];
}

export interface ClimateData {
  resolved: ResolvedLocation;
  hourly: HourlyWeather;
  daily: DailyWeather;
}

export type SpeedBucket = 0 | 1 | 2 | 3 | 4;

export interface WindRoseMatrix {
  directions: number;
  buckets: SpeedBucket[];
  counts: number[][];
  total: number;
  calmCount: number;
}

export interface BuildingFacade {
  label: 'Front' | 'Right' | 'Rear' | 'Left';
  bearing: number;
  cardinal: string;
}

export interface BuildingData {
  found: boolean;
  polygon: Coordinates[];
  areaSqm: number;
  levels: number | null;
  type: string | null;
  longestEdgeBearing: number;
  facades: BuildingFacade[];
  matchDistanceM: number | null;
}

export interface EarthquakeEvent {
  id: string;
  magnitude: number;
  depth: number;
  distanceKm: number;
  date: string;
  place: string;
  lat: number;
  lon: number;
}

export interface WildfireEvent {
  id: string;
  source: 'EONET' | 'FIRMS';
  title: string | null;
  lat: number;
  lon: number;
  date: string;
  distanceKm: number;
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  brightness: number | null;
  confidence: string | null;
  frp: number | null;
  polygon: Coordinates[] | null;
}

export interface AqiSample {
  time: string;
  europeanAqi: number | null;
  pm10: number | null;
  pm25: number | null;
  no2: number | null;
  o3: number | null;
  alderPollen: number | null;
  birchPollen: number | null;
  grassPollen: number | null;
  mugwortPollen: number | null;
  olivePollen: number | null;
  ragweedPollen: number | null;
}

export interface WikiArticle {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  distanceKm: number;
  extract?: string;
  language: string;
  url: string;
}

export type TabId =
  | 'climate'
  | 'wind'
  | 'sun'
  | 'hazards'
  | 'air'
  | 'context'
  | 'marine';

export const TAB_ORDER: TabId[] = [
  'climate',
  'wind',
  'sun',
  'hazards',
  'air',
  'context',
  'marine',
];

export const TAB_LABELS: Record<TabId, string> = {
  climate: 'Climate',
  wind: 'Wind',
  sun: 'Sun',
  hazards: 'Hazards',
  air: 'Air',
  context: 'Context',
  marine: 'Marine',
};
