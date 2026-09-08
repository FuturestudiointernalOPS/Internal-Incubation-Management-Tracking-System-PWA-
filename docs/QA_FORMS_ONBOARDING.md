# QA Result — Forms & Future Studio Onboarding

**Date:** 2026-08-10
**Tester:** Automated code-path trace
**Scope:** End-to-end Forms → Approval → Activation → Login flow

---

## What Was Tested

Every code path in the complete user journey was traced from entry to exit:

1. Form creation (Platform Forms builder)
2. Form run launch + group assignment
3. Public form rendering (/s/[slug])
4. Form submission + success message
5. Response storage
6. Super Admin response review
7. Approval action + automation triggers
8. Contact find-or-create
9. Activation token generation (password_setup_tokens)
10. Activation email sending (sendInviteEmail)
11. Activation link validation (/activate)
12. Password setup (/api/auth/activate)
13. Login gate (status check)
14. Role resolution

---

## Bugs Found During Testing

### Bug 1 — COALESCE group_name logic fails with empty strings
**Severity:** Medium
**Found in:** `src/lib/platform/automation.js` line 339
**Root cause:** `COALESCE(NULLIF(group_name, ''), NULLIF(group_name, 'unassigned'), ?)` fails when group_name is empty string because the second NULLIF still checks the original column value (''), returning '' instead of NULL. COALESCE then returns '' instead of the new group name.
**Fix:** Replaced with `CASE WHEN group_name IS NULL OR TRIM(group_name) = '' OR LOWER(group_name) = 'unassigned' THEN ? ELSE group_name END`.
**Status:** ✅ FIXED

### Bug 2 — {{group_name}} placeholder resolves to empty in success message
**Severity:** Low
**Found in:** `src/app/s/[runId]/page.js` resolvePlaceholders + `src/app/api/s/public-run/route.js`
**Root cause:** The `run` object from `platform_form_runs` has no `group_name` column. The placeholder silently resolved to empty string.
**Fix:** Added group name query to `public-run/route.js` that fetches the group name from `platform_form_run_assignments` JOIN `families` and includes it in the run response object.
**Status:** ✅ FIXED

---

## Bugs That Remain

**None.** All identified bugs were fixed during this testing phase.

---

## Blockers

**None.** The end-to-end code path is fully connected. The following environment dependencies must be in place for full functionality:

- `RESEND_API_KEY` must be configured for emails to actually send
- `NEXT_PUBLIC_APP_URL` must be set to the correct deployment URL
- `platform_form_submissions`, `platform_form_runs`, `platform_forms`, `password_setup_tokens`, `families`, `contacts`, `platform_form_run_assignments` tables must exist in the database

---

## Summary of All Changes Made

| # | File | Change |
|---|---|---|
| 1 | `DashboardLayout.js` | Removed V1 campaigns from navigation, notification counts, responsibility map |
| 2 | `api/s/public-submit/route.js` | Returns success_message and redirect_url from form settings |
| 3 | `s/[runId]/page.js` | Dynamic success screen with placeholder resolution |
| 4 | `platform/forms/page.js` | Success message config in form builder workflow panel |
| 5 | `lib/platform/automation.js` | Fixed approval→activation: email lookup, password_setup_tokens, status='approved', CASE WHEN group_name |
| 6 | `api/s/public-run/route.js` | Includes group_name in run response for success message resolution |
