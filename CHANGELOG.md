# Changelog

All notable changes to **settl. — Location Intelligence** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and this
project aims to follow [Semantic Versioning](https://semver.org/).

## [1.2.0] — 2026-07-25 — Truthfulness Pass

The theme of this release is that the app should never claim to know something
it doesn't. A risk read that says "all clear" while its sources are down is
worse than no read at all, and several paths did exactly that.

### Fixed
- **Hazard sources that fail now say so.** A failed wildfire or earthquake feed
  used to render as `LOW` / `NO FLAGS · AREA CLEAR`; it now reads
  *unavailable*, with a `PARTIAL DATA` badge when only some sources answered.
  Results derived from a failed fetch are never cached.
- **Satellite fire detections count again.** NASA FIRMS timestamps parsed to
  `Invalid Date`, so every hotspot was silently dropped from severity scoring
  while still being drawn on the map.
- **Multi-year climate figures.** The 5/10-year report inflated total
  precipitation roughly N× and deflated rain-day counts.
- **Air quality no longer invents clean air.** An all-null pollutant series
  averaged to `0.0` and displayed as a real reading; missing values show `—`.
- **Cross-checked severity.** The overview chip and the risk panel read from one
  shared set of thresholds instead of two copies that had already diverged.
- **Stored XSS** via world-editable OpenStreetMap place names in map popups.
- **Corrupt local settings no longer white-screen the app** at startup.
- **Duplicate and abandoned requests.** A pin drop fired ~28 requests with ~13
  duplicates; requests are now shared between panels and cancelled when you move
  the pin.
- Marine tab survives an API outage instead of reading as "not coastal";
  earthquakes no longer miss up to ~8 recent days; elevation resets between pins.

### Added
- **Privacy & Data panel** — what leaves your browser, what's stored on this
  device, one-click JSON export of saved locations, and a full local wipe that
  reports failure honestly rather than pretending to have succeeded.
- **Optional, env-gated analytics and error reporting.** Nothing loads and no
  request leaves the page unless the keys are configured.
- **Test suite and CI** — 87 tests covering the severity maths, cache rules,
  request sharing, popup escaping and the privacy controls, run on every PR.

### Changed
- Version shown in the footer is injected from `package.json` at build time, so
  it can no longer drift (it had been reading `0.1.0`).
- Keyboard focus is trapped inside the privacy dialog and restored on close.

## [1.1.0] — 2026-06-24 — Free Data Expansion + Live Webcams

### Added
- **Marine conditions module** — for coastal locations, a WMO sea-state severity
  badge plus live wave-height and sea-surface-temperature readings. The Marine
  tab appears automatically only when a pin is coastal.
- **Climate period selector** — switch climate between **1-year**, **5-year**, and
  **10-year** ERA5 historical averages, in both the Overview and Advanced views.
  Multi-year periods show a monthly **average high/low temperature range** chart.
- **Live webcams (Windy)** — nearby webcam thumbnails with an in-site player,
  surfaced both on the map and in the Context tab.
- **Pollen & flood risk** — pollen levels (CAMS, Europe) added to Air Quality, and
  global river-flood risk (GloFAS), each with a clear *not-applicable* state where
  there's no coverage instead of a misleading zero.
- **Expanded nearby places (Overpass)** — hazard and infrastructure layers (power
  substations, wastewater plants, quarries, landfills, data centres, military
  sites), transit hubs, harbours, and airports.
- **Per-type map icons** — nearby places now render as distinct, colour-grouped
  glyph badges (hospital, school, café, theatre, transit, park, …) instead of
  generic coloured dots.
- **Always-on context markers** — nearby places, POIs, Wikipedia entries, and
  webcams appear on the map as soon as a pin is dropped, no longer gated behind
  the Context tab.
- **IP-based default map centre**, **mobile-responsive layout** with a draggable
  bottom sheet, and a **GPS accuracy badge**.

### Changed
- Climate Overview cards now recompute for the selected 1/5/10-year window, and
  all climate copy reflects the active period (e.g. "5-YEAR READOUT").
- Map opens centred on your approximate (IP) location rather than prompting for
  geolocation up front.

### Fixed
- **Hospital classification** — stopped demoting real general hospitals to
  "clinic" when they list specialities (e.g. university hospitals), and dropped
  unnamed `amenity=hospital` stubs that were polluting "nearest hospital".
- Removed benches and similar noise from nearby places.
- Military sites recategorised out of generic hazards; school-level classification
  and various mobile-layout fixes.

## [1.0.0] — 2026-06-18 — Reskin + UX Overhaul

### Added / Changed
- Rebrand to **settl.** with a rounded-corner reskin (HUD edges removed).
- 3-state theme toggle (light/dark/system) with OS detection, and A-/A+ font
  scaling.
- Debounced location autocomplete, a geolocation button, and plain-English
  section headers.
- Saved locations (heart toggle, persisted locally).
- Lucide icon system across the module rail, section headers, and service rows.
- **ReportPanel overview mode** — a scrollable at-a-glance overview inside the
  module sheet with a view toggle and severity cards.

## [0.1.0] — Location Intelligence Core (pre-GSD)

### Added
- Six data modules: Climate, Wind, Sun, Hazards, Air Quality, Context.
- Compare mode, building-footprint detection, risk synthesis, and URL state
  persistence.

[1.1.0]: https://github.com/d1mski/settl./releases/tag/v1.1.0
[1.0.0]: https://github.com/d1mski/settl./releases/tag/v1.0.0
[0.1.0]: https://github.com/d1mski/settl./releases/tag/v0.1.0
