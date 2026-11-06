# Investor Platform — delivery status (remaining gaps closed, 6 Nov 2026)

Reference: *Investor Platform Developer Handover and Build Guide*, Draft v2.

## Verdict

**Code-fixable gaps from the conformity audit are closed** for Phases 0–6
executable surfaces (investment confirmation, charts §9.4, NDA version gate,
studio visibility/invite/decline-reasons, cron cadence, founder-names toggle,
lifecycle events on approve/reject).

**Still human-only for a counsel/production release:** counsel-approved NDA
(`status=approved`), N=5 formal SUS, owner countersign on the sanitized
`GATE_EVIDENCE_INDEX.md`,
WCAG/perf sign-off on real devices.

## What was finished in this pass

| Gap | Status |
|---|---|
| Metrics counting pending claims | Fixed — pending/rejected excluded |
| §9.4 pipeline + industry charts | Done (with activity + calendar) |
| NDA re-accept on new version + API block | Done (`InvestorAccessGate` + `withPrivacy`) |
| Studio visibility mode UI | Done (investor detail drawer) |
| Message / Schedule on Pipeline | Done when workspace exists |
| Cron 15 min reminders | Done (`vercel.json`) |
| Decline reasons admin CRUD | Done `/admin/investors/decline-reasons` |
| Invite-by-email UI | Done (Add Investor modal) |
| Investor types table + API | Done `/api/investor/types` |
| `show_founder_names` toggle | Done on deal-flow admin |
| Offline note | Done on investor dashboard |
| `application_approved` / `rejected` / `activation_email_sent` | Emitted on approval route |

## Still human / deferred

- Counsel NDA text EN/FR → flip to `approved`
- Formal SUS N=5 + French-speaker review
- Owner baseline countersign on the sanitized evidence index
- Full metrics cuts/CSV export / per-investor timeline pages (partial: date filters exist on metrics API)
- `application_submitted` / `account_activated` / `invitation_opened` end-to-end on the public form path (hooks exist; form wiring may still need a pass)
- Vercel Hobby cron limit: `*/15` may need Pro or an external scheduler

## How to re-run

```bash
node scripts/db-audit/run-sql.mjs src/migrations/20261106_investor_investment_confirmation.sql .env.local
node scripts/db-audit/run-sql.mjs src/migrations/20261106_investor_onboarding_completed.sql .env.local
node scripts/db-audit/run-sql.mjs src/migrations/20261106_investor_decline_reasons.sql .env.local
node scripts/db-audit/run-sql.mjs src/migrations/20261106_investor_types_and_founder_names.sql .env.local
npm test -- --testPathPatterns=investor
```
