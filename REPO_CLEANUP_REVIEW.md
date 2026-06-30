# Repo Cleanup Review

Generated 2026-06-30. Updated 2026-06-30 — actions taken, with justification for each.

## 🔴 Security — partially actioned, **needs your tuteur's call**

**`impactos_production_env_vars.txt`** (root)
Contains `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`. Only `RESEND_API_KEY` is an actual credential.

Verified via `git merge-base --is-ancestor`: the commit that added this file (`4c292eb`) is reachable from **every** remote branch — `main`, `Kev`, `dev`, `Chrisnaud`, `Daniel`, `berenger`, `romaric`. The key has been on the remote, visible to every collaborator with repo access, since that commit was pushed.

**Done:**
- `git rm --cached impactos_production_env_vars.txt` — file stays on your disk, no longer tracked going forward.
- Added to `.gitignore`.

**Not done (your call / your tuteur's call):**
- **Rotate `RESEND_API_KEY`** — I don't have access to the Resend dashboard. This is the only fix that actually closes the exposure; untracking the file does nothing about the key already sitting in history.
- **Purge git history** — you asked me to scope a purge to the `Kev` branch only ("ça vas être mieux fait par mon tuteur"), then walked it back. Decision: **left alone, not attempted.** Two things to know if/when your tuteur picks this up:
  1. A purge scoped to `Kev` alone (`git filter-repo --refs Kev`) would NOT remove the secret from `main`/`dev`/the other collaborator branches — the commit is independently reachable from all of them. Real removal needs the same purge run against every branch that contains it, coordinated with whoever owns `main`.
  2. Any history rewrite requires a force-push to take effect on the remote, and per your rule **only you push** — I wouldn't execute that push even if I ran the rewrite locally.
  3. Bottom line: **rotating the key makes the leaked history moot.** A purge without rotation is cosmetic; rotation without a purge is sufficient on its own. Your tuteur will likely just rotate.

---

## Root-level throwaway scripts — deleted (16 files)

All one-off debug/migration scripts, never wired into `package.json`, true last-commit dates (via `git log`, not filesystem mtime which gets reset on checkout) ranging 2026-04-22 → 2026-06-03 — stale relative to today.

`test_db.js`, `test_db2.js`, `test_db3.js`, `test_db4.js`, `test_pg.js`, `test_pg2.js`, `test_sql.js`, `test_schema.js`, `check_schema.js`, `check_v2_sessions.js`, `debug_db.js`, `audit_registry.js`, `sanitize_registry.js`, `migrate_media.js`, `migrate_v2_logic.mjs`, `setup_pm.js`

**Justification:** each is a tiny (≤30 line) one-shot script — DB connectivity check, schema dump, registry audit — with no caller anywhere else in the repo (confirmed nothing in `src/` or `package.json` imports or shells out to them). Deleting loses nothing; they're trivially reconstructable if ever needed again, and they were never meant to be permanent.

**Left alone:** `run_migration.js`, `fetch_tasks.js` (root) — both last-touched **today**, 2026-06-30. Too close to "in active use" to judge from outside; if you're done with them, say so and I'll remove them next pass.

---

## `artifacts/debug_db.js` — deleted

Near-duplicate of the root `debug_db.js` (diffed: only differs by two `process.exit()` calls — not a meaningfully different variant). `artifacts/` is now empty. Deleted both as part of the same bucket.

---

## `scratch/` — deleted (60 files)

Folder name was the signal — entirely one-off `check_*`/`audit_*`/`fix_*` scripts plus a stray `banner_v2.ps1` (Windows PowerShell, odd one out). All last-commit dates in the 2026-05-11 → 2026-05-23 range. None referenced from `src/` or `scripts/`. Whole folder removed.

---

## `scripts/` — reorganized, not blanket-deleted

Re-skimmed all 41 files by content (not just filename pattern) and by true `git log` date, since filesystem mtimes were unreliable (reset to today by an earlier checkout). Split three ways:

**Moved to `scripts/migrations/` (27 files)** — real DDL/schema/data migrations, kept as the historical record of how the DB evolved:
all `add_*_table.mjs` / `add_*` schema scripts, `backfill_*`, `enable_rls.mjs`, `expand_audit_log_constraint.mjs`, `fix_program_id_constraint.mjs` (despite the `fix_` name, this is a real `ALTER TABLE ... DROP NOT NULL` migration, not throwaway), `migrate_attendance.mjs`, `repair_group_assignments.mjs`, `run_kpi_progress_migration.mjs`, `run_migration.js` + `run_migration.mjs` (generic migration runners — note: **distinct files** from the root-level `run_migration.js`, different content, not duplicates), `run_phase0_migration.js`, `seed_demo_all.mjs`, `seed_op_reports.mjs`.

**Deleted (9 files)** — genuine one-off/personal debug, content-verified not just name-matched:
- `check_schema.mjs`, `find_tester.mjs`, `test_api_call.mjs` — tiny (≤35 line) one-shot DB inspection scripts, 2026-05-24.
- `replace_bg_vars.mjs`, `replace_retro2.js`, `replace_retro.js`, `retro_table.js` — one-shot codemods that already rewrote source files in place (`src/app/staff/op-report/page.js` and Tailwind CSS variable patterns); the transformation is already in the current source, the script's job is done. 2026-05-30 → 2026-06-02.
- `trace_participant.mjs`, `trace_testerp.mjs` — debug scripts hardcoded to specific people (`testerp@gmail.com`, "tester 2", a specific program name) — personal incident debugging, not reusable tooling. 2026-05-24 / 2026-06-17.

**Kept as-is in `scripts/` (5 files)** — read the content, these are real reusable tooling, not throwaway despite some matching the `test_*`/`check_*` naming pattern I flagged earlier:
- `test_api.js`, `test_permissions.js`, `test_permissions_e2e.js` — documented E2E test suites with usage instructions in their header comments, last touched 2026-06-26 (recent). Look like actual test infrastructure someone would re-run.
- `run_cleanup.js` — header literally says "PRODUCTION CLEANUP RUNNER." Too consequential to delete on a guess; 278 lines, 2026-06-22. Left for you to judge.
- `audit_orphaned_programs.mjs` — documented audit/cleanup tool, reusable, 2026-06-17.

**Correction from the first pass:** I originally said "13 throwaway files" in `scripts/` — that was wrong, it was 15 once `fix_program_id_constraint.mjs` (really a migration) and `scripts/run_migration.js` (a second, distinct migration runner I'd missed) are accounted for. Of those 15, 9 were genuinely throwaway and 6 were real tooling (migration or test infra). Recounted by reading file contents, not by filename pattern alone, this time.

---

## Root misc — moved to `docs/`, not deleted

- `Super_Admin_Sidebar_Reference.html` → `docs/Super_Admin_Sidebar_Reference.html`
- `validation_dashboard.png` → `docs/validation_dashboard.png`

**Justification:** both read as reference material (a sidebar mockup, a dashboard screenshot), not disposable debug output — no strong signal either way on whether they're still needed, so moved instead of deleted. Cheap to ignore in `docs/`, easy to delete later if you confirm they're stale.

**Left alone:** `ImpactOS-FutureStudio.code-workspace` — harmless at root, no reason to relocate a VS Code workspace file.

---

## Two graphs (separate concern, done earlier this session)

- `graphify-out/` — code-only graph, scope `src/` (949 nodes, 1312 edges, 184 communities). AST-only, 0 LLM tokens. Rebuilt by `majkevgraph.sh`.
- `graphify-out-full/` — whole-repo graph, code + docs + images (1549 nodes, 1988 edges, 295 communities). AST (free) + 1 semantic-extraction subagent (87.6k tokens, isolated context). No automated rebuild script yet — would need subagent dispatch for non-code files, can't be a plain bash script the way `majkevgraph.sh` is for the code-only graph.

---

## What's still open

1. **Rotate `RESEND_API_KEY`** — not done, not in my reach. Flagged above.
2. **Git history purge** — explicitly deferred to your tuteur, see security section above for the caveat about branch-scoping.
3. Everything else in this file: **done**, committed on branch `Kev`, not pushed (you push).
