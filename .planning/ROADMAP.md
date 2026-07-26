# Roadmap: settl. — v1.0 Reskin + UX Overhaul

## Overview

Six phases built in strict dependency order: CSS token foundations first, then global shell state (theme + font scale), then LocationIntelCard enhancements (geocoding + geolocation), then saved locations, then icon modernization, then the ReportPanel overview. Each phase delivers a coherent, independently verifiable capability. No phase can safely build before its predecessor ships — later features inherit CSS variables, context providers, and geocoding labels established earlier.

**Milestone v1.1 — Free Data Expansion + Live Webcams (Phases 7–10):** Additive data layers and bug fixes requiring no new npm dependencies. Build order: zero-risk data additions (Pollen + Flood) first to establish the neutral/not-applicable state pattern; then Overpass expansion + bug fixes; then live webcams (blocked on external Windy key); then marine conditions + climate selector as polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: CSS Foundations + Reskin** - Tokens, rounded corners, brand rename, Leaflet override block
- [ ] **Phase 2: App Shell State** - 3-state theme toggle, OS detection, FontScaleContext, A-/A+ controls
- [x] **Phase 3: LocationIntelCard Enhancements** - Debounced autocomplete, geolocation button, plain-English headers (completed 2026-06-18)
- [ ] **Phase 4: Saved Locations** - Heart toggle, localStorage persistence, labeled location list
- [ ] **Phase 5: ModuleRail + Lucide Icons** - Icon swap in rail, section headers, service rows, overview toggle UI
- [ ] **Phase 6: ReportPanel (Overview Mode)** - Scrollable overview panel inside ModuleSheet, view toggle, severity cards

---

**Milestone v1.1 — Free Data Expansion + Live Webcams**

- [x] **Phase 7: Zero-Risk Data Additions (Pollen + Flood)** - Global flood risk (GloFAS) + pollen on the existing AQ call; establishes the not-applicable neutral state (completed 2026-06-22)
- [x] **Phase 8: Overpass Expansion + Bug Fixes** - Hazard infrastructure layers, QUERY_VERSION v5, mobile layout, hospital/clinic + school classification fixes (completed 2026-06-22)
- [x] **Phase 9: Live Webcams (Windy)** - Windy V3 webcam thumbnail/embed grid in context tab; gated on VITE_WINDY_KEY (completed 2026-06-23)
- [x] **Phase 10: Marine + Climate Selector** - Coastal wave/SST conditions + 1-/5-/10-year ERA5 climate averages selector (completed 2026-06-24)

## Phase Details

### Phase 1: CSS Foundations + Reskin
**Goal**: Visual foundation is stable — brand is settl., HUD decoration is gone, corners are rounded, Leaflet is safe
**Depends on**: Nothing (first phase)
**Requirements**: SKIN-01, SKIN-02, SKIN-03
**Success Criteria** (what must be TRUE):
  1. All panels and cards display 8-14px rounded corners with no sharp HUD edges anywhere in the UI
  2. Noise overlay, scan lines, HUD brackets, grid dots, and gradient backdrops are absent from every view
  3. Page title, logo area, and bottom strip show "settl." with the cyan dot accent
  4. Leaflet popups and tooltip arrows render correctly on both dark and light themes after all CSS changes
**Plans:** 0/3 plans executed
Plans:
- [ ] 01-01-PLAN.md — CSS token layer: strip HUD decorative CSS, add rounded corner tokens, update Leaflet overrides
- [ ] 01-02-PLAN.md — Component cleanup: remove brackets from Panel, strip MapHud decorations, apply rounded corners
- [ ] 01-03-PLAN.md — Brand rename: rebrand BlindSpot to settl. across all files
**UI hint**: yes

### Phase 2: App Shell State
**Goal**: Theme and font scale are global, persistent, and inherited correctly by every component
**Depends on**: Phase 1
**Requirements**: UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. Toggling Light / System / Dark cycles the theme without any flash-of-wrong-theme on load
  2. Theme preference survives a hard browser refresh (localStorage persistence confirmed)
  3. Visiting the app with no saved preference applies the OS dark/light preference automatically
  4. A- and A+ controls step font size in 10% increments (rem-based); map click accuracy is unaffected by any scale change
  5. Font size selection persists across sessions
**Plans:** 0/2 plans executed
Plans:
- [ ] 02-01-PLAN.md — Context providers (ThemeContext + FontScaleContext), FOUC prevention, App.tsx/MapCanvas refactor
- [x] 02-02-PLAN.md — 3-state theme toggle UI, A-/A+ font scale controls, BaseMap cleanup
**UI hint**: yes

### Phase 3: LocationIntelCard Enhancements
**Goal**: Users can find locations via autocomplete search or one-click geolocation without manual coordinate entry
**Depends on**: Phase 2
**Requirements**: FEAT-01, FEAT-02, UX-01
**Success Criteria** (what must be TRUE):
  1. Typing 3+ characters into search shows a Nominatim autocomplete dropdown within 400ms debounce; results are keyboard-navigable and dismissed on click-outside
  2. Clicking "Use my location" prompts for permission (never autofires); on grant, map centers on GPS coordinates
  3. Declining or revoking geolocation permission shows a clear inline message, no uncaught errors
  4. All section headers across modules display plain English labels ("Climate", "Air Quality") with no §XX codes visible
**Plans:** 2/2 plans complete
Plans:
- [x] 03-01-PLAN.md — GPS geolocation button, debounced autocomplete dropdown with keyboard nav and click-outside dismiss
- [x] 03-02-PLAN.md — Remove section codes from SectionHeader and LocationIntelCard inline labels, visual checkpoint
**UI hint**: yes

### Phase 4: Saved Locations
**Goal**: Users can bookmark locations and return to them instantly without re-typing
**Depends on**: Phase 3
**Requirements**: FEAT-03
**Success Criteria** (what must be TRUE):
  1. Clicking the heart toggle on a loaded location saves it; the list persists after browser refresh
  2. Clicking a saved location in the list re-centers the map and reloads all module data for that location
  3. Removing a saved location removes it from the list immediately and does not reappear after refresh
  4. Saving an 11th location is rejected gracefully (10-item cap enforced, user informed)
**Plans:** 0/1 plans executed
Plans:
- [x] 04-01-PLAN.md — SavedLocation type, useSavedLocations hook, heart toggle + saved list in LocationIntelCard
**UI hint**: yes

### Phase 5: ModuleRail + Lucide Icons
**Goal**: All emoji and HUD-style icons are replaced with Lucide SVGs; the rail includes an overview toggle affordance
**Depends on**: Phase 1
**Requirements**: SKIN-04, UX-03
**Success Criteria** (what must be TRUE):
  1. Module rail, section headers, and service rows display Lucide SVG icons — no emoji or HUD glyphs visible anywhere
  2. An overview/advanced toggle control appears in the rail and is visually distinct from module nav icons
  3. Icons render at consistent size and color on both dark and light themes
**Plans:** 0/2 plans executed
Plans:
- [ ] 05-01-PLAN.md — Install lucide-react, replace ModuleRail inline SVGs and Unicode warning glyphs with Lucide components
- [ ] 05-02-PLAN.md — Add overview/advanced toggle button to rail, lift viewMode state to App.tsx
**UI hint**: yes

### Phase 6: ReportPanel (Overview Mode)
**Goal**: Users land in a scrollable overview of all module data by default, with one-click drill-down to detail
**Depends on**: Phase 5
**Requirements**: UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Opening the app with a location loaded shows the Overview panel as the default view inside ModuleSheet
  2. The overview displays scrollable chapter cards covering data from all modules (Climate, Wind, Sun, Hazards, Air Quality, Context)
  3. Each card shows an OK / Watch / Alert status indicator derived from existing risk synthesis data
  4. Clicking the advanced toggle switches to the existing module-detail view; clicking back returns to overview without data reload
  5. ReportPanel renders inside ModuleSheet with no new z-index context that buries Leaflet popups
**Plans:** 0/2 plans executed
Plans:
- [x] 06-01-PLAN.md — ChapterCard component + overviewSeverity utility (building blocks)
- [x] 06-02-PLAN.md — ReportPanel assembly, ModuleSheet view branching, App.tsx onDrillDown wiring
**UI hint**: yes

---

## Milestone v1.1 — Free Data Expansion + Live Webcams

### Phase 7: Zero-Risk Data Additions (Pollen + Flood)
**Goal**: Users can see global flood risk and pollen levels for any pin, with honest "not applicable" states for locations with no river or no coverage — never a false OK
**Depends on**: Nothing in v1.1 (v1.0 app is prerequisite). Establishes the shared not-applicable/no-data neutral state pattern reused by Phases 9 and 10.
**Requirements**: DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
  1. Pinning a riverside address shows a flood-risk band (OK < 500 m³/s / Watch 500–2000 / Alert > 2000); pinning a desert or hilltop address shows "No major river within 5km" in muted gray — never a green OK or a loading spinner
  2. Pinning a location in Europe shows pollen levels (tree, grass, weed species) with a "CAMS European model" source label; pinning in Sydney, Toronto, or Nairobi hides the pollen section entirely — zero values are never displayed
  3. The flood and pollen states are visually distinct from loading (spinner), error (red), and OK (green) — a muted "not applicable" row covers the coverage-gap case
  4. Flood severity feeds the existing Hazards chapter in the Overview panel (ok / watch / alert derived from GloFAS discharge values)
**Plans:** 3/3 plans complete
Plans:
- [x] 07-01-PLAN.md — Pollen: add 6 CAMS vars to useAirQuality HOURLY_VARS + AqiSample (nullable), bump cache key to aqv2| [DATA-02]
- [x] 07-02-PLAN.md — Flood data layer: useFlood.ts hook, all-zero-or-null not-applicable guard, deriveFloodSeverity (500/2000 bands), 'not-applicable' severity + TTL [DATA-01]
- [x] 07-03-PLAN.md — ReportPanel wiring: Flood Risk metric + hazards composition, muted N/A StatusDot, gated pollen sub-block (CAMS European model), human-verify checkpoint [DATA-01, DATA-02]
**Research notes**: Pollen: add 6 vars to HOURLY_VARS in useAirQuality.ts, bump cache key to aqv2|... prefix. Pollen null-guard: show section only when at least one species value is non-null and > 0; heuristic lon -25 to 45 / lat 30 to 75 for Europe guard. Flood: new hook useFlood.ts mirroring useAirQuality.ts pattern; GloFAS null-filled arrays map to not-applicable, never to ok.
**UI hint**: yes

### Phase 8: Overpass Expansion + Bug Fixes
**Goal**: Users see nearby hazard/infrastructure POIs (military, power substations, wastewater, quarry/landfill, data centers, golf courses), the app works on mobile, and hospitals/schools are labeled accurately across locales
**Depends on**: Ordered after Phase 7; files touched independently but QUERY_VERSION bump is atomic
**Requirements**: HAZ-01, HAZ-02, HAZ-03, FIX-01, FIX-02, FIX-03
**Success Criteria** (what must be TRUE):
  1. Pinning a location near a military base, power substation, wastewater plant, quarry/landfill, or data center shows each feature under a "Hazard" category with distance; a nearby golf course appears in the existing park/leisure category
  2. A hazard POI within 1km triggers a Watch status in the Overview context card; military or wastewater within 500m triggers an Alert
  3. On a mobile viewport the app stacks map above panel vertically, all content scrolls, and no panel is trapped off-screen (root fix: h-[100dvh] + responsive stack, not h-screen + overflow-hidden)
  4. A Greek hospital tagged healthcare=hospital labels as "Hospital"; a Greek clinic tagged healthcare=clinic labels as "Clinic" — name-string heuristics are absent
  5. A primary school tagged school:level=primary labels as "Primary School"; a high school tagged school:level=secondary labels as "High School" — substring matching on "1" is absent
**Plans:** 4/3 plans complete
Plans:
- [x] 08-01-PLAN.md — Overpass expansion + bug fixes: QUERY_VERSION v5, buildQuery hazard+golf, categorise hazard branches, FIX-02 healthcare + FIX-03 school fixes, both CATEGORY_COLORS maps [HAZ-01, HAZ-02, FIX-02, FIX-03]
- [x] 08-02-PLAN.md — HAZ-03 severity: replace deriveContextSeverity stub with proximity bands (1km Watch / 500m military+wastewater Alert), Nearest hazard metric in ReportPanel [HAZ-03]
- [x] 08-03-PLAN.md — FIX-01 mobile layout: h-[100dvh] + responsive flex stack + min-h-0 in App.tsx, responsive ModuleSheet width, human-verify checkpoint [FIX-01]
**Research notes**: QUERY_VERSION must bump from v4 to v5 before any Overpass changes merge. power=substation nodes only — drop power=line ways entirely (geometry explosion + timeout risk). Add [maxsize:32000000] to Overpass query header. HAZ categorise() and FIX-02/FIX-03 are in the same useOverpassFeatures.ts function; FIX-01 mobile fix is in App.tsx.
**UI hint**: yes

### Phase 9: Live Webcams (Windy)
**Goal**: Users can see live nearby webcams in the context tab, with graceful absence when no API key is configured and graceful image fallback when tokens expire
**Depends on**: Phase 7 (neutral/empty-state pattern reuse). External precondition: VITE_WINDY_KEY must be procured from api.windy.com/keys and domain-restricted — this phase is blocked until the key is available.
**Requirements**: CAM-01
**Success Criteria** (what must be TRUE):
  1. With VITE_WINDY_KEY configured, the context tab shows a grid of nearby webcam thumbnails; clicking a camera opens its windy.com detail page in a new tab (reinterpreted per 09-RESEARCH — `player.live` is absent on ~99% of cameras, so no embedded live stream; the detail page shows current image + timelapse + live where available)
  2. When a webcam image token expires (images older than ~10min), onError triggers graceful fallback (placeholder or silent re-fetch) — no broken-image icons persist
  3. With no VITE_WINDY_KEY set (e.g. a fresh clone), the webcam section is absent from the UI with no error state — the rest of the context tab is unaffected
  4. Webcam data is never stored in persistent cache — each panel open fetches fresh; TTL <= 8min to respect 10-min token expiry
**Plans:** 2/3 plans executed
Plans:
- [ ] 09-01-PLAN.md — Pre-condition gate: whitelist localhost + production domain for VITE_WINDY_KEY (human-action checkpoint) [CAM-01]
- [x] 09-02-PLAN.md — useWebcams.ts hook: Windy V3 header auth, daylight-first thumbnails, haversine distance, 8-min in-memory TTL, NO idb cache [CAM-01]
- [x] 09-03-PLAN.md — WebcamsSection + WebcamCard in ContextModule SingleView, detail-page link, onError placeholder, gated on key, human-verify [CAM-01]
**Research notes**: Windy V3 only (V2 query-param auth is deprecated and breaks). Header auth: x-windy-api-key. VITE_WINDY_KEY is plaintext in the JS bundle — accepted under no-backend constraint; document exposure in code comment; domain-restrict at Windy dashboard. TTL.webcams = 8min. No persistent cache for image URLs. Windy V3 response field paths (images.current.thumbnail, player.live.embed) need live-API validation on first integration test. Nearby param format (comma-separated vs separate) also unresolved — resolve against live API.
**UI hint**: yes

### Phase 10: Marine + Climate Selector
**Goal**: Coastal users see live wave/SST conditions; all users can switch climate figures between 1-, 5-, and 10-year ERA5 averages without breaking existing behavior
**Depends on**: Phase 7 (not-applicable neutral state reused for inland pins where no Marine section is shown)
**Requirements**: DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. Pinning a coastal address shows a Marine section with wave height mapped to WMO sea-state severity (OK < 2.5m / Watch 2.5–4m / Alert > 4m) and sea-surface temperature; pinning an inland address shows no Marine section at all
  2. The climate module shows a 1-yr / 5-yr / 10-yr selector; selecting 1-yr produces output identical to the current app (no regression); selecting 5-yr or 10-yr fetches ERA5 archive data and updates all climate figures
  3. The default selector position is 1-year — no existing user behavior changes without deliberate interaction
  4. ERA5 data comes from archive-api.open-meteo.com (1940+ coverage), NOT historical-forecast-api.open-meteo.com (2021+ only) — multi-year averages are real historical data, not short-range model output
**Plans:** 4/4 plans complete
Plans:
- [x] 10-01-PLAN.md — Marine data layer: useMarine (coastal via null-check + dedup) + MarineModule (badge/cards/legend) + TTL [DATA-03]
- [x] 10-02-PLAN.md — Climate archive layer: useClimateArchive (ERA5 daily, sum÷N normalize) + useOpenMeteo KEY_VERSION v8 + years param [DATA-04]
- [x] 10-03-PLAN.md — Shell integration: marine TabId, App coastal flag + visibleTabs + C-02 fallback + climateYears lift, ModuleSheet Marine case (human-verify) [DATA-03, DATA-04]
- [x] 10-04-PLAN.md — Climate selector UI: 1/5/10YR pill, dual-hook gating, per-year count normalize, N/A degrade for thermal/humidity/UV (human-verify) [DATA-04]
**Research notes (corrected by 10-RESEARCH):** Marine API returns HTTP 200 with NULL wave/SST for inland pins (NOT 400) — coastal detection via null-check; useMarine is a single fetch reused for App coastal flag + module. Coastal status resolves at App level (visibleTabs) since the marine TAB existence is conditional (C-01). useClimateArchive.ts is a NEW hook against archive-api.open-meteo.com, daily-only (hourly 7.4MB deferred to v1.2) — humidity/thermal-matrix/UV show N/A on 5/10yr. useOpenMeteo adds inert years=1 param; KEY_VERSION bumps v7→v8 — coastal guard is in the display layer (hide section), not the hook (always fetch). useClimateArchive.ts is a NEW hook against archive-api.open-meteo.com — distinct base URL. Existing useOpenMeteo.ts adds years: 1|5|10 = 1 default param only; all existing callers remain unaffected. KEY_VERSION bumps to v8. ERA5 10-year payload parse on low-end devices is v1.2 concern (Web Worker).
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CSS Foundations + Reskin | 0/3 | Planned    |  |
| 2. App Shell State | 1/2 | In Progress | - |
| 3. LocationIntelCard Enhancements | 2/2 | Complete   | 2026-06-18 |
| 4. Saved Locations | 0/1 | Planned | - |
| 5. ModuleRail + Lucide Icons | 0/2 | Planned    |  |
| 6. ReportPanel (Overview Mode) | 0/2 | Planned    |  |
| **v1.1 — Free Data Expansion + Live Webcams** | | | |
| 7. Zero-Risk Data Additions (Pollen + Flood) | 3/3 | Complete | 2026-06-22 |
| 8. Overpass Expansion + Bug Fixes | 4/3 | Complete   | 2026-06-23 |
| 9. Live Webcams (Windy) | 2/3 | In Progress|  |
| 10. Marine + Climate Selector | 4/4 | Complete    | 2026-06-24 |
