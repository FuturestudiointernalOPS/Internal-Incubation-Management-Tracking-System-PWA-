# CRM — Phases 2–4 Integration Notes

**Branch:** `new-crm` (staging twins `G` / `Ventures`) · **Date:** 2026-10-09 · **Status:** verified on staging, awaiting push

These notes record what was applied to the staging database, what was verified at
runtime, and the fixes made during verification. See `docs/CRM_FEASIBILITY_ASSESSMENT.md`
for the architectural assessment and `docs/PRODUCTION_TEST.md` for the promotion gate.

## Staging database — applied (in order)

| Migration | Contents |
|---|---|
| `migrations/phase1_crm_foundation.sql` | `contact_roles`, `contact_timeline`; `participant_programs` lifecycle columns |
| `migrations/phase2_crm_organization_foundation.sql` | `crm_organizations`, `crm_contact_organizations`, `crm_module_capabilities` (+2 capability seeds) |
| `migrations/phase3_crm_leads.sql` | `crm_leads` (+ `leads` capability seed) |
| `migrations/phase4_crm_opportunities_pipelines.sql` | `crm_pipelines`, `crm_pipeline_stages`, `crm_opportunities`, `crm_opportunity_stage_history`; 3 seed pipelines × 7 stages with terminal `won`/`lost` flags; +2 capability seeds |
| `migrations/phase5_crm_activities.sql` | `crm_activities` (+ `activities` capability seed); §3 widens `tasks.chk_tasks_context_type` to admit the four `crm_*` contexts |

All five are additive and idempotent (`CREATE … IF NOT EXISTS` / `ON CONFLICT DO
NOTHING`; the constraint widening is drop-if-exists + re-add). None touches
`investment_pipeline`, `fundraising_*` or any investor/venture table. Re-applied
2026-10-09 as a whole: 68/68 statements OK, 0 errors.

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
- **Phase 4 activities E2E: pass** — activity create/list/update/delete round-trips and
  native task creation through the CRM context; all test rows cleaned up.
- **Phase 4 re-verification (2026-10-09, transactional, always rolled back)** — the
  UNION query extracted verbatim from `src/models/crm/activities.js` (18 placeholders):
  a native task inserted with `context_type='crm_organization'` is accepted (proves the
  widened constraint), and the query returns both the stored activity and the CRM task
  in GLOBAL (no-context) mode and in filtered mode. 2/2 checks.
- **Staging inventory: clean** — 9 `crm_*` tables; 6 capability rows all active;
  `crm_pipelines` = 3, `crm_pipeline_stages` = 21, activities/leads/opportunities/
  organizations = 0 (no leftover test data).
- **Build** ✓ · **Lint:** 0 errors · **i18n parity:** Missing 0 · **i18n JSON:** en+fr
  parse · **Jest:** 7,010/7,012 passing (the 2 failures are CRLF artifacts of this
  Windows checkout — see Open steps).

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
4. **`activities/[id]` route (PATCH/DELETE) was non-functional and off-layer.** Next 16
   hands `params` as a promise — `const { id } = params` made `id` undefined, so both
   verbs always 404'd — and the route ran raw SQL inline. Now `await params`, and the
   existence check / delete go through `getCrmActivityById` / `deleteCrmActivity` in the
   model.
5. **Task-linking routes (`leads/[id]/tasks`, `opportunities/[id]/tasks`) same two bugs:**
   `params` not awaited (always 404) and inline `db.execute`. Fixed with `await params`
   and the existing `getCrmLeadById` / `getCrmOpportunityById` getters (which also now
   correctly refuse soft-deleted parents).
6. **`chk_tasks_context_type` rejected every CRM task (`23514`).** The original constraint
   (from `src/migrations/035_phase1_unified_operations.sql`) allowed only
   `('staff','venture','participant')`. `phase5_crm_activities.sql` §3 widens it (house
   drop-if-exists + re-add pattern) to the four `crm_*` contexts. Applied and verified.
7. **The global activities feed returned nothing.** `getCrmActivities`' WHERE clauses all
   required a non-null context parameter, so `GET /api/crm/activities` without filters —
   exactly what `/crm/activities` calls — always produced an empty list. The model now
   takes a no-filter path: every stored activity, plus every task carrying a `crm_*`
   context.
8. **Activities UI/locale defects:** the create dialog offered no `task` type although
   the save path and the `[id]/tasks` endpoints exist for it (option added, hidden on
   contact/organization-only panels that have no task endpoint); task rows rendered raw
   i18n keys for their native status (`crm.activities.outcomes.pending`) — now mapped
   through `status.*` with a raw fallback; the email branch logs `outcome='sent'`, which
   had no locale key (added en+fr); the FR activities block was **invalid JSON** (the
   `pipelines` closing brace was left without the separating comma — the EN block got it)
   and was missing its accents; the file's missing trailing newline was restored.

## Open steps

- **Push:** `G` + `Ventures` are committed and synced locally but **not pushed** — the
  GitHub credential on this machine (`digitalgalaxy200-VibeC`) is denied. Push from an
  authorized account: `git push origin G Ventures`.
- **After the staging deploy:** re-run the permission seed (Permission Center → Seed) so
  super admin receives the `crm` module rows, then grant staff/PM via
  profiles/responsibilities as product decides.
- **Browser pass:** create/edit/assign/status for leads, opportunities and pipelines;
  activity create/edit/delete on a lead and an opportunity; task creation from the
  activity panel; the global activities feed after the first activity exists.
- **Environment:** `.env.staging`'s password is stale (use `.env.audit-staging` for
  scripts); `.env.audit-readonly` is empty (production audits use `.env.prod-verify`).
- **CRLF:** `result-email-schedule` and `program-workspace-wiring` fail on this Windows
  checkout because their LF regexes do not match CRLF working copies; they are unrelated
  to the CRM and pass on LF checkouts.
