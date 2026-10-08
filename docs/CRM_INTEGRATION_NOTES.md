# CRM — Phase 2 & 3 Integration Notes

**Branch:** `new-crm` (staging twins `G` / `Ventures`) · **Date:** 2026-10-08 · **Status:** verified on staging, awaiting push

These notes record what was applied to the staging database, what was verified at
runtime, and the fixes made during verification. See `docs/CRM_FEASIBILITY_ASSESSMENT.md`
for the architectural assessment and `docs/PRODUCTION_TEST.md` for the promotion gate.

## Staging database — applied (in order)

| Migration | Contents |
|---|---|
| `migrations/phase2_crm_organization_foundation.sql` | `crm_organizations`, `crm_contact_organizations`, `crm_module_capabilities` (+2 capability seeds) |
| `migrations/phase3_crm_leads.sql` | `crm_leads` (+ `leads` capability seed) |
| `migrations/phase4_crm_opportunities_pipelines.sql` | `crm_pipelines`, `crm_pipeline_stages`, `crm_opportunities`, `crm_opportunity_stage_history`; 3 seed pipelines × 7 stages with terminal `won`/`lost` flags; +2 capability seeds |

All three are additive and idempotent (`CREATE … IF NOT EXISTS` / `ON CONFLICT DO
NOTHING`). None touches `investment_pipeline`, `fundraising_*` or any investor/venture
table.

**Runner note:** these files are multi-line, and `scripts/db-audit/apply-schema-file.mjs`
enforces a one-statement-per-line contract — it refuses them. They were applied with a
temporary multi-line-aware applier (same additive-only guard, staging-only), deleted
after use. Reformat to one-statement-per-line if the house runner should apply them.

## Runtime verification (staging)

- **Phase 2 schema + constraint smoke: 14/14 checks** — tables, real FKs, CHECKs, unique
  constraints, indexes; create/update/assign/soft-delete round-trips for both
  contact-linked and organization-only records; the transaction rolled back cleanly.
- **Phase 2 model E2E: pass** — org → contact link → lead → status/qualification/
  assignment → `contact_timeline` write → org-only lead → soft delete; all test rows
  cleaned up.
- **Phase 3 model E2E: pass** — seeded pipelines verified (7 stages, terminal flags);
  own pipeline + ordered stages; opportunity create; stage move + append-only history
  (joined stage names); timeline write; metrics; won-close; list filters; soft delete;
  all test rows cleaned up (staging retains exactly 3 seed pipelines / 21 seed stages).
- **Build** ✓ · **Lint:** 0 errors · **i18n parity:** Missing 0 ·
  **Jest:** 7,004/7,006 passing (the 2 failures are CRLF artifacts of this Windows
  checkout — see Open steps).

## Fixes made during verification

1. **Timeline writes (lead routes in `11142ffb`; opportunity routes extended here).**
   The CRM routes called `createContactTimelineEvent` (the model — 5 positional args)
   with a single object, so the insert would receive a JSON blob for `contact_cid` and
   nulls for the NOT NULL `event_type`/`description`. All lead and opportunity timeline
   writes now call the contacts service
   `addContactTimelineEvent({ cid, eventType, actorCid, … })` — the shape the existing
   `/api/contacts/[cid]/timeline` route uses.
2. **`getCrmPipelineMetrics` failed with `42P18`** (`could not determine data type of
   parameter $1`) on the `(? IS NULL OR pipeline_id = ?)` filter — every
   `GET /api/crm/opportunities` call would have 500'd. The parameters are now cast
   `?::uuid`.
3. **Capability module registration.** `crm` was in the capability catalog but not in
   `PERMISSION_MODULES` / `MODULE_TO_FEATURE`: super admins bypassed the gates, staff and
   PMs got 403, and the hub cards gated on `crm.view` rendered for nobody. The module is
   now registered (with sub-section rows and en/fr labels); `crm.assign` is held in a
   literal guard in the leads route; `crm.manage` is enforced by the pipelines routes.

## Open steps

- **Push:** `G` + `Ventures` are committed and synced locally but **not pushed** — the
  GitHub credential on this machine (`digitalgalaxy200-VibeC`) is denied. Push from an
  authorized account: `git push origin G Ventures`.
- **After the staging deploy:** re-run the permission seed (Permission Center → Seed) so
  super admin receives the `crm` module rows, then grant staff/PM via
  profiles/responsibilities as product decides.
- **Browser pass:** create/edit/assign/status for leads, opportunities and pipelines.
- **Environment:** `.env.staging`'s password is stale (use `.env.audit-staging` for
  scripts); `.env.audit-readonly` is empty (production audits use `.env.prod-verify`).
- **CRLF:** `result-email-schedule` and `program-workspace-wiring` fail on this Windows
  checkout because their LF regexes do not match CRLF working copies; they are unrelated
  to the CRM and pass on LF checkouts.
