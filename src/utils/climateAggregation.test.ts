import { describe, it, expect } from 'vitest';
import { buildMonthlyAggregates } from './climateAggregation';
import type { ClimateData } from '../types';

// 5 identical synthetic years: every Jan day has 3mm precipitation.
// Mirrors useClimateArchive normalization: sum-type display fields arrive ÷N,
// precipitationSum arrives UNDIVIDED (per-day threshold input).
function fiveYearJanuaries(): ClimateData {
  const time: string[] = [];
  const precipitationSum: number[] = [];
  const rainSum: number[] = [];
  for (let y = 2021; y <= 2025; y++) {
    for (let d = 1; d <= 31; d++) {
      time.push(`${y}-01-${String(d).padStart(2, '0')}`);
      precipitationSum.push(3);        // undivided raw mm/day
      rainSum.push(3 / 5);             // ÷N display value
    }
  }
  const zeros = time.map(() => 0);
  return {
    resolved: { requested: { lat: 0, lon: 0 }, resolved: { lat: 0, lon: 0 }, elevation: 0, distanceMeters: 0, model: 't', modelResolutionKm: 1 },
    hourly: { time: [], windSpeed10m: [], windDirection10m: [], windSpeed100m: [], windDirection100m: [], windGusts10m: [], temperature2m: [], relativeHumidity2m: [], precipitation: [], rain: [], snowfall: [], cloudCover: [], shortwaveRadiation: [], },
    daily: {
      time, precipitationSum, rainSum,
      temperatureMax: zeros, temperatureMin: zeros, temperatureMean: zeros,
      snowfallSum: zeros, precipitationHours: zeros, windSpeedMax: zeros,
      windGustsMax: zeros, windDirectionDominant: zeros, sunshineDuration: zeros,
      uvIndexMax: [],
    },
  };
}

describe('buildMonthlyAggregates multi-year normalization', () => {
  it('rainDays on a 5-yr aggregate ≈ one typical year, not deflated by ÷N thresholds', () => {
    const monthly = buildMonthlyAggregates(fiveYearJanuaries(), 5);
    // 31 wet days per January per year -> a typical year's January = 31, not 0
    expect(monthly[0].rainDays).toBe(31);
  });
  it('rainSum stays the ÷N typical-year value', () => {
    const monthly = buildMonthlyAggregates(fiveYearJanuaries(), 5);
    // typical-year January total — ÷N daily values accumulated over N years
    // = one average year; dividing again would double-divide.
    expect(monthly[0].rainSum).toBeCloseTo(31 * 3, 5);
  });
});
