# Investor executive dashboard — clickable cards

> Branch `dashboard_refactoring_front` · 2026-10-02 · code commit `709405fb`.
> Scope: the investor side of the super-admin area only (`/admin/investors/*`).
> The main `/admin` dashboard is untouched.

## Goal

The cards of the Executive Dashboard (`/admin/investors/dashboard`) were static.
Each card now opens its own page — **but only when that page actually exists**.
A card whose page is not built yet never navigates (no 404, no crash): it gives
a short nudge on click so the user sees it reacted.

## What changed

| File | Change |
|---|---|
| `src/components/ui/AppLinkCard.js` | **New.** Reusable card with a gated redirect (see below). |
| `src/app/admin/investors/dashboard/page.js` | The 4 KPI cards and the 6 sections render through `AppLinkCard`, driven by one `CARD_LINKS` map. |
| `src/app/admin/investors/page.js` | Reads `?status=` to preselect the filter tab (`all`, `pending_review`, `approved`). |
| `src/app/admin/investors/campaigns/page.js` | New filter tabs **All / Active / Draft / Closed** (with counts); `?status=` preselects one. |
| `src/locales/{en,fr}/investorAdmin.json` | One key: `investorAdmin.campaigns.noMatch` (empty filter result). |
| `DESIGN_SYSTEM.md` | `AppLinkCard` added to the component list, with an example. |

All changes are additive: without a `?status=` parameter both list pages behave
exactly as before, and an unknown value falls back to `all`.

## `AppLinkCard`

```jsx
import AppLinkCard from "@/components/ui/AppLinkCard";

<AppLinkCard padding="md" isDeveloped redirectTo="/admin/investors?status=approved">
  …card content…
</AppLinkCard>
```

| Prop | Meaning |
|---|---|
| `isDeveloped` | `true` only when the target page is ready. Default `false`. |
| `redirectTo` | Target path (query string allowed). |
| `padding` | `sm` / `md` / `lg` / `xl`, same scale as `AppCard`. |
| `ariaLabel`, `className` | Optional. |

- **Ready** (`isDeveloped && redirectTo`): renders a Next `<Link>` — prefetch,
  keyboard (Tab + Enter), middle click — with a small ↗ icon in the top-right corner.
- **Not ready**: renders a plain card; a click plays a 320 ms horizontal nudge
  through the Web Animations API (no React re-render, transform only), skipped
  when the user prefers reduced motion.
- **Hover** (both cases): 2 px lift + brand-orange border, `cursor: pointer`;
  CSS variables only, so light and dark themes both work.
- Same surface as `AppCard` (radius, border, `--surface-1`).

## Card map (`CARD_LINKS`)

Defined at module scope at the top of `src/app/admin/investors/dashboard/page.js`.
To enable a card the day its page ships: set `isDeveloped: true` and `redirectTo`.

| Card | `isDeveloped` | `redirectTo` |
|---|---|---|
| Verified Investors | ✅ | `/admin/investors?status=approved` |
| Active Campaigns | ✅ | `/admin/investors/campaigns?status=active` |
| Total Committed | ❌ | — (no investment-decisions page) |
| Invested Deals | ❌ | — (no "invested" pipeline view) |
| Fundraising (section) | ✅ | `/admin/investors/campaigns` |
| Relationships (section) | ✅ | `/admin/investors/relationships` |
| Investment Pipeline (section) | ✅ | `/admin/investors/dashboard` |
| Campaign Performance (section) | ✅ | `/admin/investors/campaigns` |
| Sector Demand (section) | ❌ | — (no sector analytics page) |
| Top Investors (section) | ✅ | `/admin/investors` |

"Verified" = `approval_status = 'approved'` (that is what `total_verified`
counts in `src/models/investor.js`), hence `status=approved`.

Note: campaigns with status `paused` only appear under **All** (there was no
"paused" counter before either).

## Checks

- `npm run lint`: 0 errors.
- `npm run i18n:parity`: 0 missing.
- `npm run build`: OK.
- `npm test`: 4119 / 4121 — the 2 failures (`program-scope-coverage`,
  `identity-gate-bridge`, both about `api/participant-programs`) already fail
  on the previous commit and are unrelated to this work.

## Manual test

1. `/admin/investors/dashboard`: hover every card → slight lift + orange border.
2. Click **Verified Investors** → Investor Management, tab **Approved** active.
3. Click **Active Campaigns** → Campaigns, tab **Active** active.
4. Click **Total Committed** / **Invested Deals** / **Sector Demand** → nudge, no navigation.
5. ↗ only on cards that navigate; Tab + Enter opens them.
6. Light and dark theme.
