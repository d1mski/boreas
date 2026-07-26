# settl.

## What This Is

A location intelligence tool for families researching where to relocate and real estate agents presenting neighborhood data to clients. Analyzes any location for climate, air quality, seismic/wildfire hazards, sunlight, transit, schools, and nearby amenities using open data APIs. Map-centric with data panels.

## Core Value

Give anyone instant, trustworthy, data-backed insight into what it's really like to live somewhere — before they commit.

## Current Milestone: v1.1 Free Data Expansion + Live Webcams

**Goal:** Maximize free, no-key, global public-data coverage and fix community-reported accuracy/UX bugs — ship a stable, broader release.

**Target features:**
- Overpass layer expansion — military, power lines/substations, wastewater plants, golf courses, quarry/landfill, data centers (new `hazard` category; no new dep, no key)
- Open-Meteo additions — global flood risk (GloFAS), pollen on the existing AQ call, marine (waves/SST), 5–10yr climate averages
- Live webcams — Windy Webcams API (one free key: `VITE_WINDY_KEY`)
- Bug fixes — mobile scroll/UX, POI misclassification (schools, hospital vs clinic), data accuracy outside test region

**Origin:** Threads community feedback (research in `.firecrawl/implementation-scope.md`).

## Requirements

### Validated

- ✓ Climate module (temp, precip, humidity, UV, heatmap, extremes) — Open-Meteo — v0.1
- ✓ Wind module (wind rose, seasonal profiles, monthly velocity) — Open-Meteo — v0.1
- ✓ Sun module (sun path arcs, daylight duration, facade sunlight) — SunCalc — v0.1
- ✓ Hazards module (USGS earthquakes, EONET/FIRMS wildfires) — v0.1
- ✓ Air Quality module (AQI, PM2.5, PM10, NO₂, O₃ vs WHO limits) — Open-AQ — v0.1
- ✓ Context module (Wikipedia intel, nearby OSM features, distance to services) — v0.1
- ✓ Compare mode (A vs B locations with deltas) — v0.1
- ✓ Building footprint detection + facade orientation (Overpass/OSM) — v0.1
- ✓ Risk synthesis panel (aggregated alerts from all modules) — v0.1
- ✓ Coordinate input (decimal, DMS, address via Nominatim) — v0.1
- ✓ Dark/light theme toggle — v0.1
- ✓ Leaflet map with CARTO tiles — v0.1
- ✓ URL state persistence (coords, tab, compare mode) — v0.1
- ✓ Saved locations (heart toggle, localStorage, 10-item cap, one-click restore) — Phase 4
- ✓ Global river flood risk (Copernicus GloFAS via Open-Meteo) with not-applicable neutral state for ocean/desert — DATA-01, Phase 7
- ✓ Pollen on the existing AQ call (CAMS, 6 species, Europe-gated, nullable) — DATA-02, Phase 7

### Active

(Defined per milestone — see Current Milestone below)

### Out of Scope

- Fabricated composite scores (safety score, transit score) — no reliable global data source
- Noise level dB readings — no reliable global API
- Crime statistics — fragmented by country, unreliable coverage
- Property listings / prices — different product category
- User accounts / authentication — unnecessary complexity for v1

## Context

- **Stack**: React + TypeScript + Vite + Tailwind CSS + Leaflet
- **Data sources**: Open-Meteo, Open-AQ, USGS, EONET, FIRMS, Overpass/OSM, Nominatim, Wikipedia
- **Current aesthetic**: Military/HUD tactical (JetBrains Mono, cyan/amber, sharp corners, noise overlays)
- **Target aesthetic**: Same palette softened, rounded corners, no decorative cruft, accessible/ND-friendly
- **Design mockup**: `mockups/reskin-interactive.html` — approved direction
- **Brand**: Renamed from BlindSpot to **settl.** (dot as cyan accent)

## Constraints

- **Data integrity**: Every displayed metric must come from a real, attributable API — no fabricated or estimated scores
- **Accessibility**: ND-friendly design, font size controls, OS theme detection
- **No new dependencies**: Prefer minimal additions; Lucide icons is the one approved addition
- **Offline-safe**: All data fetched client-side from public APIs, no backend

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rebrand BlindSpot → settl. | "BlindSpot" potentially insensitive to visually impaired | — Pending |
| Overview report as default view | Reduces cognitive load for families; advanced view for power users | — Pending |
| Lucide icons over emojis | Professional, consistent, tactical feel without childishness | — Pending |
| Drop fabricated scores | No reliable global data; misleading to present estimates as facts | ✓ Good |
| OS theme detection as default | Users browsing at home expect their system preference respected | — Pending |
| 560px right panel, 320px floating left | Fits all 8 nav icons; left panels don't crowd the map | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-22 — Phase 7 complete (flood + pollen data, not-applicable neutral state)*
