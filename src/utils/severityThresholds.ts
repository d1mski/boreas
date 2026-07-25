// Single source of truth for cross-file severity numbers. The overview chip
// (overviewSeverity.ts) and the risk panel (riskSynthesis.ts) previously
// carried divergent copies — same fire read HIGH on one and warn on the other.

// Wildfire distance bands, km. Alert = active fire close enough to threaten
// directly; watch = regional activity worth monitoring. Beyond watch, recent
// fires contribute context (panel 'info') but do not move the hazards chip.
export const FIRE_ALERT_KM = 10;
export const FIRE_WATCH_KM = 30;

// PM2.5 annual-mean bands, µg/m³. WHO 2021 annual guideline = 5; 15 = WHO
// interim target 3. Above 15 we call it alert; the panel escalates further
// at the EU limit (25) which stays local to riskSynthesis.
export const PM25_WATCH = 5;
export const PM25_ALERT = 15;

// A "heat day": daily max at or above this °C. riskSynthesis used >=35 while
// countExtremeDays used >35 — off-by-one-day on exact-35 days.
export const HEAT_DAY_C = 35;
