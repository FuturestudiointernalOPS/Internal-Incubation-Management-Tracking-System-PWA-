
# Venture Financial Reporting — currency, FTE and legacy ranges

This document records the decisions implemented in phases 0–5 of the
"Financial Reporting, Currency Conversion and Terminology" work. It is the
reference for anyone reading a money figure, an FTE, or an old range.

---

## 1. Two currencies, deliberately separate

| Concept | Where it lives | What it means |
|---|---|---|
| **Reporting currency** | `venture_static_profile.reporting_currency` | The unit the founder FILES in. Stamped on every monthly, quarterly, baseline and event row (`currency` column). |
| **Display currency** | `contacts.display_currency` (personal) | The unit a READER wants to see figures converted into. `null` = follow the venture. |

**Rules**

- Changing the display currency never writes a financial record. Conversion is a
  presentation concern only.
- The reporting currency is not a display setting: it is the unit the numbers
  were reported in, and it is immutable per row.
- A converted figure is always printed with `≈` so it cannot be mistaken for the
  filed amount.

### What the engine now refuses

Growth, average burn, runway and the yearly roll-ups compare money from
different months. They now refuse to do so across a currency change:

- `metrics.js` → `mrr_growth_mom`, `mrr_growth_3m`, `average_burn`, `runway_months`
  become `not_applicable` when their window spans two currencies.
- `yearly.js` → `yoyMrrGrowth` and `annualBurn` become `null` for a mixed window.
  Customer counts are currency-free and survive.
- A month filed before the stamp existed (`currency = null`) is UNKNOWN, not
  different: it is treated as compatible so legacy history is not wiped.

---

## 2. Exchange rates

- Provider: **Frankfurter** (ECB reference rates), EUR-based, no API key.
  Override with `FX_PROVIDER_URL`.
- **Fetch cadence: twice a month** — once for the 1st–15th window, once for the
  16th–end window (`ratePeriodFor`). A request inside a window that already holds
  rates never reaches the provider: a rate is a stated fact, not a live tick.
- The CFA francs are **pegged** (1 EUR = 655.957 XOF = 655.957 XAF) and are
  constants, not fetched.
- Every rate is stored in `fx_rates` keyed by `(base, quote, rate_date)` with the
  **day it was published**, and is append-only. A page view never calls the
  provider.
- Any pair is derived through EUR by division.
- If no rate is available, the screen shows the ORIGINAL amount with the venture's
  own unit — never a stale conversion and never zero.

**Endpoint:** `GET /api/finance/fx?base=XOF&quote=USD&date=YYYY-MM-DD` (authenticated).

---

## 3. FTE and headcount

One definition, in `services/ventures/reporting/rules.js → computeFte`:

```
FTE = full-time people + (part-time days ÷ 20) + full-time founders
```

- 20 days = one full month of part-time work (studio convention).
- Part-time **days** convert; part-time headcount alone cannot (two people on two
  days are not two full-timers).
- The stage rule `scaling_min_non_founder_fte` uses the same function with
  `includeFounders: false` — founders are not evidence of hiring.
- **Headcount** is shown beside FTE: people on the books, regardless of hours.
  `jobsSupported` is labelled "FTE supported (includes founders)" so the
  inclusion is explicit.
- The baseline FTE is **derived, not typed**: it is the workforce snapshot of the
  month the baseline is captured (`services/ventures/reporting/baseline.js →
  fteFromWorkforce`). A snapshot saved *after* the capture fills an empty
  baseline once (`team.js → backfillBaselineFte`); a captured value is never
  rewritten. An all-zero snapshot means "not reported", not 0 — `jobsCreated`
  stays `null` rather than comparing against a measured zero.

---

## 4. Ranges are retired for new filings

- **UI:** the exact/range selector is gone from the monthly, quarterly, baseline
  and event forms. Those forms submit amounts only, and clear the band codes.
- **Validation:** a payload carrying `mode: "band"` is refused with
  `venture.reporting.validation.bandRemoved`.
- **History is untouched.** A validated month, quarter, baseline or event that was
  reported as a range keeps its band row, keeps `approximate: true`, and keeps
  rendering as a range (`moneyBounds` still reads it).
- A draft saved earlier as a range shows which band it held, with the note
  "Saved as an estimated range (…). Enter the actual amount to save it again."
- The ladder (`venture_band_settings`) stays in the database: it is what makes the
  historical bands readable. It is no longer offered in any form.
- `top3_share_band` is a categorical answer (under 30% / 30–60% / over 60%), not a
  money range, and is unaffected.

---

## 5. Terminology

- The baseline section is called **Venture Baseline** (`venture.baseline`), in the
  workspace tab, the reporting sub-tab and the section heading. Only the label
  changed; the table, columns and supersede rules are untouched.
- "FTE" is spelled in full wherever it is a label: **Full-Time Equivalent
  (FTE)**, with the formula in the tooltip. Renaming it "Full-Time Employees"
  would be a reporting error: a venture with 2 full-timers and 4 part-timers
  working 10 days each has a headcount of 6 and an FTE of 4.
- The founder's baseline tab is split by subject: **1. Initial Financial &
  Customer Position** (paying customers, cash, outside financing) and **2.
  Starting Workforce & Full-Time Equivalent** (the team, and the FTE it
  produces). FTE is a workforce figure and no longer sits among the money.

---

## 6. Decisions still open for Future Studio

1. ~~Whether the FTE at baseline should be captured as counts instead of a single
   typed number.~~ **Settled:** it is derived from the workforce snapshot.
2. Whether `jobsSupported` should exclude founders rather than be relabelled.
3. Whether historical ranges should eventually be re-stated as exact amounts by
   their founders (a correction flow) instead of staying estimates forever.
4. Baselines captured before this change keep the FTE that was typed for them;
   they are not backfilled from today's workforce.
