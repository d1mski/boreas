# settl. Validation Sprint — 15 Days (23 Jul – 7 Aug 2026)

Locked against the Decision Register (see bottom). Async-only: email + LinkedIn. No calls. ~15 min weekday mornings + two 90-min weekend blocks.

## Decision Register (locked 22 Jul 2026)

| # | Decision | Label |
|---|---|---|
| 1 | Segments: (1) UK independent estate agents, (2) UK buying agents / relocation consultants. Parked: Gulf, Greece, direct-to-consumer. | INFERRED |
| 2 | Model: concierge productized service — hand-assembled per-property "Location Pack" (PDF), manually QA'd. Not SaaS, not $2 consumer PDF. | INFERRED |
| 3 | Pricing hypothesis: £45–95/pack, anchored to per-listing collateral + survey spend. Verify Sprift-type pricing during sprint. | ASSUMED |
| 4 | Message angle: research/validation framing. CTA = request a free sample pack. | INFERRED |
| 5 | Day-15 thresholds: ≥2 sample requests = double down; ≥4 substantive replies = signal; <2 substantive replies + 0 requests = park until Sept wave. | ASSUMED |
| 6 | Build gate: nothing built until ≥5 substantive conversations + ≥2 delivered manual packs + ≥1 firm payment commitment. | VERIFIED (discipline) |
| 7 | Constraints: 15 min weekday mornings, 90-min weekend blocks, async only. | VERIFIED |

## Volume & channel split

28 contacts total. **18 estate agents / 10 buying agents & relocation consultants.**

- **LinkedIn (primary, ~17 contacts):** both segments are LinkedIn-dense; connection note ≤300 chars, full message after accept. Max **3 connection requests per day** (throttle-safe).
- **Email (~11 contacts):** where a named person (owner/director) has a public address on the agency site. Never `info@` unless no alternative. One bump max, then stop (PECR-polite: identity clear, opt-out honoured).

Prospect filter (estate agents): independent, 1–3 branches, owner/director identifiable, active listings in areas where the data angle bites (coastal wind, flood-mapped towns, commuter belts). Skip chains.

## Calendar

| Day | Date | Block | Task |
|---|---|---|---|
| 1 | Thu 23 Jul | 15m | Set up tracking log; review all 8 templates, edit to your own voice (human review before first send — required). |
| 2 | Fri 24 Jul | 15m | Desk-check anchor: what do Sprift / Homesearch-type services charge UK agents? Log finding next to pricing hypothesis. Time-boxed — 15 min and stop. |
| — | Sat 25 Jul | **90m** | Build full 28-prospect list (name, role, agency, town, LinkedIn URL, email if public, chosen variant). Done = 28 rows. |
| 3 | Mon 27 Jul | 15m | Send batch 1: 3 LinkedIn connects (agents, variant LA1). Log. |
| 4 | Tue 28 Jul | 15m | 3 sends (2 agent emails EA1, 1 LinkedIn LA2). Answer any accepts with follow-up DM. Log. |
| 5 | Wed 29 Jul | 15m | 3 sends (mix). Reply handling first, sends second — replies always outrank new sends. |
| 6 | Thu 30 Jul | 15m | 3 sends. First buying-agent contacts (LB1/EB1). Log. |
| 7 | Fri 31 Jul | 15m | Reply handling + log review only. No new sends Friday. |
| — | Sat 1 Aug | **90m** | If a sample was requested: build THAT pack (48h promise). Else: build one example pack for a real, publicly listed property — link it in all week-2 messages. |
| 8 | Mon 3 Aug | 15m | Mid-sprint review: which variant is getting accepts/replies? Kill the weakest variant, continue with the strongest. 3 sends. |
| 9 | Tue 4 Aug | 15m | 3 sends + bump anyone silent 5+ days (one bump only). |
| 10 | Wed 5 Aug | 15m | 3 sends. |
| 11 | Thu 6 Aug | 15m | Final 2–4 sends — list exhausted (28/28). |
| 12 | Fri 7 Aug | 15m | Day-15 scorecard: fill metrics table, apply decision rules, pre-schedule September wave. |

Any sample request at any point: acknowledge same morning ("On it — you'll have it within 48h"), build in the next 90-min block.

## Summer expectations (so a thin result reads correctly)

At 28 cold contacts in peak UK holiday season, expected: **8–12 connection accepts, 2–5 substantive replies, 0–2 sample requests.** [ASSUMED — calibrated estimate, not market data]

- **Signal:** any reply engaging with the workflow (including a reasoned "no — because…"), a sample request, a referral, "ask me in September."
- **Noise:** accepts with silence, likes, profile views, "cool tool!" with no follow-through.
- A zero is *possible even if the thesis is good* — that is why the September wave exists and why "park" ≠ "dead."

## Day-15 decision rules

| Result | Call |
|---|---|
| ≥2 sample requests | **Double down.** Deliver both. After delivery ask each: "Would you pay £[45–95] for the next one on a live instruction?" First payment conversation = the sprint's real prize. |
| 1 sample request | Deliver it, extend measurement into the September wave before judging. |
| ≥4 substantive replies, 0 requests | **Reposition.** The objections tell you the new angle. Rewrite templates against the top objection; retest in September wave. |
| <2 substantive replies, 0 requests | **Park.** Run September wave as written. If that also returns <2, the UK-agent thesis is parked and D2C channel-building becomes a separate, deliberate decision — not a fallback assumption. |

## September follow-up wave (pre-built now, sent w/c 7 Sept)

To every non-responder, same channel as before, one message:

> Hi [Name] — I contacted you in early August, which I've since accepted was the worst possible timing. Quick recap: I hand-make per-listing "location packs" — 10-yr climate, flood & wind exposure, sun, air quality, schools, transport for a specific address ([link to example pack if it exists]). The offer stands: one free pack for a current [listing/client search] if it's useful. If not relevant, this is my last message.

Only claim delivered packs / agent feedback if true at send time.

## Tracking log

`validation-sprint/outreach-log.csv` — one row per contact:
`date_sent, name, role, company, town, segment, channel, variant, url, status, date_replied, reply_summary, interest_0-3, objection, next_action, followup_date`

Status values: `sent → accepted → replied → sample_requested → sample_delivered → payment_discussed → declined / silent`.
Interest: 0 none · 1 polite · 2 engaged with problem · 3 requested sample or referral.

## Build gate (restated — in force)

**BLOCKED until ≥5 substantive conversations + ≥2 delivered manual packs + ≥1 firm payment commitment:** report generator, payments/checkout, auth/accounts, app-wide data-accuracy overhaul, Gulf/any localization, new modules. Allowed: per-postcode data verification for a requested pack; template edits; the one example pack. If you catch yourself in the editor for any other reason during these 15 days, that is the avoidance pattern — close it and send instead.

## Templates

Fill every [bracket] with real specifics before sending — a template sent with placeholders is spam. All claims must be true.

### Estate agents — LinkedIn

**LA1 — connection note (sample-offer angle, ≤300 chars)**
> Hi [Name] — I built a free tool showing what it's actually like to live at any address (flood, wind, 10-yr climate, schools, transit). Researching whether per-listing "location packs" would genuinely help agents — keen on your take. Not selling anything.

**LA2 — connection note (pain-question angle, ≤300 chars)**
> Hi [Name] — research question from an independent developer: when applicants ask "what's the area really like?", is answering that well ever a time cost? I've built something related and want agent opinions before going further. No pitch.

**Follow-up DM after accept (both variants)**
> Thanks for connecting, [Name]. One line of context: settl. (dimski.co.uk/experiments/settl/) puts 10 years of climate, flood & wind exposure, sun, air quality, schools and transport for any address on one screen — free. I'm testing whether a per-listing PDF "location pack" helps agents at valuations or with applicants. Two questions, whenever suits:
> 1. Would you ever attach something like this to a listing or take it to a valuation?
> 2. If yes — want a free sample pack for one of your current listings? Hand-made, no strings, no follow-up spam.

### Estate agents — email

**EA1 — sample-offer angle**
> **Subject:** Location data for your [town] listings — question from an independent developer
>
> Hi [Name],
> I'm Dimitri, an independent developer. I've built a free tool that shows what it's genuinely like to live at an address — 10-year climate, flood and wind exposure, sun, air quality, schools, transport: dimski.co.uk/experiments/settl/
> I'm researching whether agents would use a per-listing "location pack" (a short PDF of that data) at valuations or with applicants — or whether this solves nothing you actually feel. Two questions, 60 seconds:
> 1. Do applicants' "what's the area really like?" questions ever cost you time — or a sale?
> 2. Would a free sample pack for one of your current listings be worth a look? Hand-made, no strings.
> Either way, if you reply I'll share what I learn from agents across the market. If it's not relevant, ignore this — no follow-up spam.
> Dimitri · dimski.co.uk

**EA2 — research-questions angle**
> **Subject:** How do [town] agents answer "what's the area like?"
>
> Hi [Name],
> Independent developer doing my own research — not selling anything. I'm trying to understand how agents handle applicants' questions about an area (schools, flood risk, transport, microclimate) — where it takes time, and whether existing tools help. Three written questions, answered whenever convenient:
> 1. What do you currently hand an applicant who asks about the area?
> 2. Does anything about that take real time or lose momentum in a sale?
> 3. Do you pay for any per-listing data or collateral today (reports, floor plans aside)?
> I'll share the aggregated findings with everyone who replies. Found you via [true source]. If not relevant, ignore — no follow-ups.
> Dimitri · dimski.co.uk
> P.S. The tool behind the research, free: dimski.co.uk/experiments/settl/ — happy to hand-make a sample pack for one of your listings if useful.

### Buying agents / relocation consultants — LinkedIn

**LB1 — expert-eyes angle (≤300 chars)**
> Hi [Name] — I'm researching how buying agents brief clients on what an area is actually like (climate, flood, schools, transport). I've built a free tool that does it on one screen and want expert eyes on it before going further. Not selling — would value your take.

**LB2 — sample-offer angle (≤300 chars)**
> Hi [Name] — independent developer. Built a free tool showing 10-yr climate, flood/wind risk, sun and amenities for any UK address. Testing whether a per-property "area pack" helps buying agents with client due diligence. Could I make you a free sample for a live search? No pitch.

**Follow-up DM after accept (both)**
> Thanks, [Name]. Context: settl. (dimski.co.uk/experiments/settl/) — free tool, one screen per address: 10-yr climate, flood & wind exposure, sun, air quality, schools, transport. I'm testing whether a hand-made per-property PDF pack is useful in client due diligence. Two questions:
> 1. What do you currently produce for a client asking "what's this area really like to live in?"
> 2. Want a free sample pack for a property on a live search — so you can judge it on a real case?

### Buying agents / relocation consultants — email

**EB1 — due-diligence angle**
> **Subject:** Area due diligence for clients — question from an independent developer
>
> Hi [Name],
> I'm Dimitri, an independent developer researching how buying agents and relocation consultants brief clients on what an area is actually like — long-run climate, flood and wind exposure, air quality, schools, transport. I've built a free tool that puts all of it on one screen per address: dimski.co.uk/experiments/settl/
> Question: would a hand-made per-property PDF pack of this data be useful in your client work — or does your current process already cover it? If you'd like to judge on a real case, I'll make a free sample for a property on a live search. No strings; if not relevant, ignore — no follow-up spam.
> Dimitri · dimski.co.uk

**EB2 — research-questions angle**
> **Subject:** 3 questions on how you research areas for clients
>
> Hi [Name],
> Independent research, not a pitch. I'm mapping how relocation and buying-side professionals answer clients' "what's it like to live there?" — what you produce, how long it takes, what you pay for. Three questions, in writing, whenever suits:
> 1. What does your area brief for a client contain today?
> 2. Which part takes the most time to compile?
> 3. Do you pay for any data or reports to produce it?
> I'll share aggregated findings with everyone who replies. Found you via [true source].
> Dimitri · dimski.co.uk

### One-bump follow-up (both segments, both channels — sent once, 5+ days after silence)
> No worries if this isn't relevant — closing this research round this week. If a free sample pack for a current [listing / client search] would be useful, say the word and I'll build it. Otherwise, all the best for the summer.
