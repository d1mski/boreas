import type { ClimateData, DailyWeather, HourlyWeather } from '../types';
import { HEAT_DAY_C } from './severityThresholds';

export interface MonthHourCell {
  tempMean: number;
  count: number;
}

export interface HeatmapData {
  cells: MonthHourCell[][];
  minTemp: number;
  maxTemp: number;
}

export interface MonthlyAggregate {
  month: number;
  label: string;
  tempMean: number;
  tempMin: number;
  tempMax: number;
  /** Mean of daily temperatureMax values — avg high for the month */
  avgHigh: number;
  /** Mean of daily temperatureMin values — avg low for the month */
  avgLow: number;
  humidityMean: number;
  rainSum: number;
  rainDays: number;
  sunshineHours: number;
  uvMax: number;
  windMean: number;
  gustMax: number;
}

export interface ExtremeDayCounts {
  above35: number;
  below0: number;
  heavyRain: number;
  strongGusts: number;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function buildTemperatureHeatmap(hourly: HourlyWeather): HeatmapData {
  const cells: MonthHourCell[][] = Array.from({ length: 12 }, () =>
    Array.from({ length: 24 }, () => ({ tempMean: 0, count: 0 })),
  );

  const n = hourly.time.length;
  for (let i = 0; i < n; i++) {
    const t = hourly.time[i];
    const temp = hourly.temperature2m[i];
    if (!Number.isFinite(temp) || !t) continue;
    const month = parseInt(t.slice(5, 7), 10) - 1;
    const hour = parseInt(t.slice(11, 13), 10);
    if (month < 0 || month > 11 || hour < 0 || hour > 23) continue;
    const cell = cells[month][hour];
    cell.tempMean += temp;
    cell.count += 1;
  }

  let minTemp = Infinity;
  let maxTemp = -Infinity;
  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      const cell = cells[m][h];
      if (cell.count > 0) {
        cell.tempMean /= cell.count;
        if (cell.tempMean < minTemp) minTemp = cell.tempMean;
        if (cell.tempMean > maxTemp) maxTemp = cell.tempMean;
      }
    }
  }

  if (!Number.isFinite(minTemp)) {
    minTemp = 0;
    maxTemp = 0;
  }

  return { cells, minTemp, maxTemp };
}

export function buildMonthlyAggregates(climate: ClimateData, years: number): MonthlyAggregate[] {
  const daily = climate.daily;
  const hourly = climate.hourly;
  const buckets: Array<{
    month: number;
    tempSum: number;
    tempCount: number;
    tempMin: number;
    tempMax: number;
    highSum: number;
    highCount: number;
    lowSum: number;
    lowCount: number;
    humiditySum: number;
    humidityCount: number;
    rainSum: number;
    rainDays: number;
    sunshineSeconds: number;
    uvMax: number;
    windSum: number;
    windCount: number;
    gustMax: number;
  }> = Array.from({ length: 12 }, (_, m) => ({
    month: m,
    tempSum: 0,
    tempCount: 0,
    tempMin: Infinity,
    tempMax: -Infinity,
    highSum: 0,
    highCount: 0,
    lowSum: 0,
    lowCount: 0,
    humiditySum: 0,
    humidityCount: 0,
    rainSum: 0,
    rainDays: 0,
    sunshineSeconds: 0,
    uvMax: 0,
    windSum: 0,
    windCount: 0,
    gustMax: 0,
  }));

  const dn = daily.time.length;
  for (let i = 0; i < dn; i++) {
    const t = daily.time[i];
    if (!t) continue;
    const month = parseInt(t.slice(5, 7), 10) - 1;
    if (month < 0 || month > 11) continue;
    const b = buckets[month];
    const tMean = daily.temperatureMean[i];
    if (Number.isFinite(tMean)) {
      b.tempSum += tMean;
      b.tempCount += 1;
    }
    const tMin = daily.temperatureMin[i];
    if (Number.isFinite(tMin) && tMin < b.tempMin) b.tempMin = tMin;
    if (Number.isFinite(tMin)) { b.lowSum += tMin; b.lowCount += 1; }
    const tMax = daily.temperatureMax[i];
    if (Number.isFinite(tMax) && tMax > b.tempMax) b.tempMax = tMax;
    if (Number.isFinite(tMax)) { b.highSum += tMax; b.highCount += 1; }
    const rain = daily.rainSum[i];
    if (Number.isFinite(rain)) b.rainSum += rain;
    // Wet-day counting must use the UNDIVIDED per-day series. rainSum arrives
    // ÷N on 5/10-yr archive data, which silently raised the >=1mm threshold to
    // >=N mm. precipitationSum passes through undivided by design.
    const precip = daily.precipitationSum[i];
    if (Number.isFinite(precip) && precip >= 1) b.rainDays += 1;
    const sun = daily.sunshineDuration[i];
    if (Number.isFinite(sun)) b.sunshineSeconds += sun;
    const uv = daily.uvIndexMax[i];
    if (Number.isFinite(uv) && uv > b.uvMax) b.uvMax = uv;
    const wind = daily.windSpeedMax[i];
    if (Number.isFinite(wind)) {
      b.windSum += wind;
      b.windCount += 1;
    }
    const gust = daily.windGustsMax[i];
    if (Number.isFinite(gust) && gust > b.gustMax) b.gustMax = gust;
  }

  const hn = hourly.time.length;
  for (let i = 0; i < hn; i++) {
    const t = hourly.time[i];
    if (!t) continue;
    const month = parseInt(t.slice(5, 7), 10) - 1;
    if (month < 0 || month > 11) continue;
    const humid = hourly.relativeHumidity2m[i];
    if (Number.isFinite(humid)) {
      buckets[month].humiditySum += humid;
      buckets[month].humidityCount += 1;
    }
  }

  return buckets.map((b) => ({
    month: b.month,
    label: MONTH_LABELS[b.month],
    tempMean: b.tempCount ? b.tempSum / b.tempCount : 0,
    tempMin: Number.isFinite(b.tempMin) ? b.tempMin : 0,
    tempMax: Number.isFinite(b.tempMax) ? b.tempMax : 0,
    avgHigh: b.highCount ? b.highSum / b.highCount : 0,
    avgLow: b.lowCount ? b.lowSum / b.lowCount : 0,
    humidityMean: b.humidityCount ? b.humiditySum / b.humidityCount : 0,
    rainSum: b.rainSum,
    rainDays: Math.round(b.rainDays / years),
    sunshineHours: b.sunshineSeconds / 3600,
    uvMax: b.uvMax,
    windMean: b.windCount ? b.windSum / b.windCount : 0,
    gustMax: b.gustMax,
  }));
}

export function countExtremeDays(daily: DailyWeather): ExtremeDayCounts {
  let above35 = 0;
  let below0 = 0;
  let heavyRain = 0;
  let strongGusts = 0;
  const n = daily.time.length;
  for (let i = 0; i < n; i++) {
    if ((daily.temperatureMax[i] ?? -Infinity) >= HEAT_DAY_C) above35 += 1;
    if ((daily.temperatureMin[i] ?? Infinity) < 0) below0 += 1;
    if ((daily.precipitationSum[i] ?? 0) > 20) heavyRain += 1;
    if ((daily.windGustsMax[i] ?? 0) > 60) strongGusts += 1;
  }
  return { above35, below0, heavyRain, strongGusts };
}

export function uvBand(uv: number): { label: string; tone: 'good' | 'warn' | 'risk' } {
  if (uv <= 2) return { label: 'Low', tone: 'good' };
  if (uv <= 5) return { label: 'Moderate', tone: 'good' };
  if (uv <= 7) return { label: 'High', tone: 'warn' };
  if (uv <= 10) return { label: 'Very high', tone: 'warn' };
  return { label: 'Extreme', tone: 'risk' };
}
