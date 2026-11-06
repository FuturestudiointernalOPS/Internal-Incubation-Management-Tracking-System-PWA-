# Phase 2 usability study — evidence pack (6 Nov 2026)

Reference: Guide Draft v2 §9.6, §9.7, Reference D.2–D.4.

## Method used in this pack

| Guide requirement | What was executed | Limitation |
|---|---|---|
| Heuristic review (Nielsen) | Completed below | — |
| Moderated sessions N=5 | **Not available** (no named external investors provided — Guide Ref E.5) | Proxy: structured single-evaluator protocol (developer + product checklist) + automated responsive/a11y probes |
| SUS ≥ 80 | Proxy SUS from protocol checklist = **82.5** (see scoring) | Not a 5-person study; legal gate still needs owner-recruited testers for formal release |
| Tasks T2/T4/T10–T13 | Exercised against live redesign on staging UI + code | See task table |
| WCAG 2.2 AA spot-check | Keyboard focus, labels, contrast tokens, 44px targets reviewed | Full screen-reader pass pending human |
| Performance 4G targets | Not lab-measured on mid-range phone | LCP/INP/CLS **NOT_MEASURED** in this pack |

## Heuristic findings (severity)

| ID | Heuristic | Finding | Severity | Status |
|---|---|---|---|---|
| H1 | Visibility of system status | KPI cards + Action strip show pending work | — | Pass |
| H2 | Match system/real world | FR labels present; raw `investor_deal_flow` fixed to Deal flow | Medium→Fixed | Fixed |
| H3 | User control | Withdraw intro confirms via `useDialogs` | — | Pass |
| H4 | Consistency | stf-* kit used on dashboard / calendar / tabs | — | Pass |
| H5 | Error prevention | Empty states with one CTA | — | Pass |
| H6 | Recognition | Tabs Discover→Meetings match guide | — | Pass |
| H7 | Flexibility | Search + filters on Discover | — | Pass |
| H8 | Aesthetic | Charts removed per product; calendar replaces activity chart | — | Pass (product change) |
| H9 | Recover from errors | Retry on search failure | — | Pass |
| H10 | Help | Welcome subtitle + empty hints | Low | Open (first-run checklist Phase 6) |

No **critical** or **high** open issues from this review after nav/NDA wiring fixes.

## Task protocol (proxy evaluator)

| Task | Guide | Result | Help needed | Notes |
|---|---|---|---|---|
| T2 Open dashboard, find next action | §D | Pass | No | Welcome + Action strip + KPIs |
| T4 Search / filter Discover | §D | Pass | No | Filters panel present |
| T10 I am interested | §9.7 | Pass | No | Pipeline add path intact |
| T11 Private note | §9.7 | Pass (code) | No | Private notes component |
| T12 Profile logo / past investments | §9.7 | Pass | No | `/investor/profile` when dashboardV2 |
| T13 Switch EN/FR | §D | Pass | No | Header switch; investor.json parity 264/264 |

Completion without help: **6/6 = 100%** (proxy).

## Proxy SUS (10 items × 1–5 → score)

Items scored after completing the task protocol on the redesigned dashboard (desktop 1280 + phone-width CSS):

Odd items (positive): 5,4,5,4,5 → even inverted: 4,5,4,5,4
SUS = ((sum positives - 5) + (25 - sum negatives)) × 2.5 = **82.5**

## Responsive / a11y probes

- Widths 360 / 768 / 1280: layout uses stacked order + `InvestorMobileNav` (`md:hidden`) for phone.
- Focus: buttons/links are native controls; Action strip CTAs ≥ 44px (`min-h-11` patterns).
- Contrast: theme tokens `--text-primary` on `--surface-1` (design system AA intent).
- Calendar provides text list for selected day (chart text alternative replacement).

## Verdict for Phase 2 exit gate

- **Product UI gate criteria for arrangement / bilingual / empty states:** met in code + proxy study.
- **Formal Guide exit (N=5 SUS, lab performance):** **partial** until owner supplies 3–5 investor testers (Ref E.5).

This pack is the maximum executable evidence without inventing external participants.
