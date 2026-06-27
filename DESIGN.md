# Design

> Status: **proposed warm direction**, validated through the monetization-surface mockups (`mockups/monetization/`). The live app still ships the legacy HUD aesthetic; this document is the agreed target for the monetization feature and the seed for the eventual app-wide redesign. See `PRODUCT.md` for strategy.

This project carries **two related visual registers**:
1. **White-label report** — the PDF an estate agent hands to a homebuyer. Editorial, premium, neutral, and **tinted by the agency's own brand colour** (Settl recedes).
2. **Settl app surfaces** — the agent-facing tool (create report, brand settings, checkout). Settl's own warm identity: calm base, confident money moments.

They share a type family for cohesion and differ in colour: the report is tinted by the *agency's* accent; the app uses *Settl's* accent.

---

## Register A — White-label Report (editorial)

### Theme
A premium location report kept on a buyer's kitchen table — light, paper, unhurried, magazine-grade. Reference feel: The Modern House, Monocle, fine property collateral. Restrained colour strategy: neutral paper + one accent (the agency's).

### Color
Light, near-white paper at near-zero chroma (NOT cream/sand). The accent is the **agency's brand colour**, supplied per-agency and applied restrained — hairlines, thin rules, single chart fills, the wordmark. In the mockups the example agency (Harbour & Stone) uses deep teal.

| Token | Value (example) | Use |
|---|---|---|
| `paper` | `#FAFAF8` | Page background |
| `ink` | `#1A1A18` | Body + headings (≥4.5:1 on paper) |
| `muted` | ~`#5A5A54` | Secondary text (still AA) |
| `line` | hairline neutral | Rules, gridlines, table borders |
| `accent` | **agency-supplied** (e.g. `#0E5A57`) | Wordmark, thin rules, chart fills, rating bars |
| `track` | `#E7E1D6` | Rating-bar track behind the accent fill |

**White-label tokening principle:** the report reads one agency colour into `accent` (+ logo + contact details). Everything else stays neutral. One variable swap re-skins the whole report per agency.

### Typography
Contrast-axis pairing: **Fraunces** (serif display — location title, chapter titles, the agency wordmark, key figures) + **Inter** (labels, data, tables, body). Tabular numerals in data tables. Display ≤96px, letter-spacing ≥ -0.04em.

### Components
- **Cover**: agency wordmark, large serif location title, geo subline, a restrained hero motif (hand-built SVG — contour band), a quiet stat row, a contents line.
- **Liveability Index**: rows of `label · rating bar (track + accent fill) · word value`. Bars encode *favourability for living* (fuller = better). Always paired with a text value (colour-blind-safe).
- **Chapter page**: "Chapter 0X" kicker (accent) + serif title + italic summary line + 1–2 elegant inline-SVG charts + a small key-figures strip or normals table + a warm **"What this means for you"** paragraph. Running footer: page number + quiet "data by Settl." credit.
- **Charts** (inline SVG, restrained): temperature band+mean line, value bars, daylight/sea-temp area curves, pollutant-vs-guideline bars, a quiet AQI half-gauge, a wind rose, a schematic bay plan. Thin strokes, hairline gridlines, soft single-colour accent fills.

### Motion
N/A (print artifact). Honour `prefers-reduced-motion` anywhere these components appear on-screen (e.g. the live preview).

---

## Register B — Settl App Surfaces (warm)

### Theme
Calm, trustworthy tool (Airbnb/Wise territory) with deliberate confidence where money changes hands. Light primary; dark mode is first-class and must pass AA (contrast of the two accents in dark mode still to be audited).

### Color
| Token | Value | Use |
|---|---|---|
| `--bg` | `#FAF8F3` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--ink` | `#16201E` | Body + headings |
| `--muted` | `#5B6B66` | Secondary text (AA on bg/surface) |
| `--line` | `#E7E1D6` | Borders, dividers |
| `--green` (Settl brand) | `#16615A` | Brand marks, links, active nav, calm accents |
| `--clay` (money moment) | `#A84E27` | Primary CTAs — continue, pay (the confident-action colour) |
| `--good` | `#1F7A4D` | Positive/confirm |
| `--warn` | `#9A5B00` | Caution (e.g. storm-watch) |

Two-accent system: **green = calm/trust**, **clay = action**. Clay is reserved for the money-moment CTAs.

### Typography
Same family as the report — **Fraunces** (Settl wordmark "Settl." with the clay period; headings; prices) + **Inter** (all UI, labels, data). Keeps tool and report visually related.

### Components
- **Top bar** (shared across flow screens): `Settl.` wordmark (clay period) · divider · location pill (`pin + "St Ives, Cornwall · TR26"`) · right-aligned nav (Reports / Branding) + avatar.
- **Surfaces**: `--surface` cards, 1px `--line`, soft shadow, radius 12px. No nested cards.
- **Buttons**: primary = `--clay` bg / white; secondary = `--surface` / `--line` / `--ink`.
- **Inputs**: `--surface`, 1px `--line`, visible `--green` focus ring, labels in `--ink`.
- **Report preview**: a miniature of the white-label cover (in the *agency's* colour, e.g. teal) embedded in the Settl chrome — this contrast tells the white-label story (Settl tool wrapping the agency's deliverable).

### Motion
Ease-out (quart/expo), no bounce. Reduced-motion alternative required for every animation.

---

## Absolute bans (both registers)
No gradient text, no side-stripe accent borders, no decorative glassmorphism, no big-number hero-metric template, no uppercase tracked eyebrow on every section (a per-chapter "Chapter 0X" sequence is allowed), no identical card grids, no nested cards. WCAG AA throughout; light gray body text on tinted near-white is banned.
