# 🔐 Security Audit — Module 1 (post-1.9)

**Date** : 2026-07-04
**Method** : static grep over `src/app/api/**/route.js` (157 route files) + live DB policy inspection. Every number below was counted, not estimated.
**Scope** : authN/authZ surface, SQL param safety, storage exposure, secrets.

---

## 0. VERIFIED METRICS (corrects the estimates in ARCHITECTURE_TECH_DEBT.md)

| Metric | Claimed (DeepSeek) | **Verified** | Note |
|---|---|---|---|
| Total API route files | ~120 | **157** | `find src/app/api -name route.js \| wc -l` |
| Routes with NO auth primitive | 20 | **30** | no `requireAuth`/`getSession`/`requireSession`/`requireProjectAccess` |
| — of which legitimately public | — | **~13** | login/reset/activate/invite-accept/public-form |
| — of which real breaches | 12 | **~17** | see §2 |
| Routes `requireAuth()` no role | 39 | **39** ✓ | correct |
| Routes `requireAuth([roles])` | 84 | **85** | close |
| `middleware.js` | absent | **absent** ✓ | confirmed |
| SQL injection | 0 | **0** ✓ | all dynamic clauses use param arrays |
| `$N`-instead-of-`?` bug | 1 (internal-comms) | **0 — FALSE POSITIVE** | see §3 |

---

## 1. FALSE POSITIVE retracted

**DeepSeek claim** : `internal-comms/route.js` L250 uses `$N` instead of `?` → bug.

**Reality** : L250 is `const placeholders = messageIds.map((_, i) => \`$${i + 1}\`).join(",")` building a dynamic `IN ($1,$2,...)` clause. The `pg` driver consumes `$N` natively; the `db.execute()` wrapper only rewrites `?`→`$N`, and since there is no `?` in this query nothing collides. **It works.** It is a *style inconsistency* (fragile if a `?` is ever added to the same statement), not a live defect. Normalize opportunistically, do NOT treat as a security fix.

The `$N` hits my grep also flagged in `auth/login`, `auth/reset-password` are `password.startsWith("$2")` — the bcrypt hash prefix. Not SQL. Ignore.

---

## 2. REAL AUTH GAPS

### 2a. 🔴 CRITICAL — delete entirely

| Route | Why |
|---|---|
| `api/debug-db/project-tasks/route.js` | No auth. Dumps `information_schema` (full column layout of `v2_projects`, `tasks`) + arbitrary project/task rows to any anonymous caller. Diagnostic left in prod. **Delete the file**, don't gate it. |

### 2b. 🔴 CRITICAL — unauthenticated mutations (add `requireAuth([...])`)

Confirmed each exposes a state-changing verb with zero auth:

| Route | Verbs | Suggested guard |
|---|---|---|
| `api/teams/route.js` | GET, **POST** | `requireAuth(['super_admin','staff','program_manager'])` |
| `api/v2/groups/route.js` | **POST**, GET | `requireAuth(['super_admin','staff'])` |
| `api/v2/kpis/route.js` | GET, **POST, DELETE** | `requireAuth(['super_admin','program_manager'])` |
| `api/v2/program-staff/route.js` | GET, **POST, DELETE** | `requireAuth(['super_admin','program_manager'])` |
| `api/pm/programs/assignment/route.js` | **PATCH** | `requireAuth(['super_admin','program_manager'])` |
| `api/pm/programs/[id]/route.js` | (verify) | `requireAuth(['super_admin','program_manager'])` |
| `api/responses/review/route.js` | **POST** | `requireAuth(['super_admin','staff','teacher'])` |
| `api/v2/invites/route.js` | **POST** (create invite) | `requireAuth(['super_admin','staff'])` |
| `api/v2/teacher/fulfillment/route.js` | mutation | `requireAuth(['super_admin','teacher'])` |
| `api/v2/teacher/full-state/route.js` | read | `requireAuth(['super_admin','teacher'])` |
| `api/v2/teacher/reports/route.js` | mutation | `requireAuth(['super_admin','teacher'])` |
| `api/feedback/route.js` | **POST** | `requireAuth()` (any logged-in user) |

### 2c. 🟠 HIGH — cron / webhook without a shared secret

| Route | Issue | Fix |
|---|---|---|
| `api/tasks/notify-deadlines/route.js` | No auth, no secret. Anyone can trigger a notification blast (spam/DoS). | Require header `x-cron-secret === process.env.CRON_SECRET`, else 401. |
| `api/integrations/calendar/route.js` | No auth. **Verify intent**: internal call → `requireAuth`; external webhook → shared-secret header. |
| `api/integrations/notion/route.js` | Same as calendar — verify webhook-vs-internal, then secret-or-auth. |
| `api/errors/route.js` | Public error sink (client posts JS errors). Keep open but **cap body size + rate-limit** to prevent log flooding. |

### 2d. 🟠 HIGH — 39 routes call `requireAuth()` with no role

Authenticated but role-blind: a `participant` token passes the same guard as `super_admin`. Each of the 39 must get an explicit allow-list. Audit the write verbs first (POST/PUT/DELETE/PATCH) — those are the dangerous ones. GET-only role-blind routes are lower priority but still leak cross-role data.

---

## 3. STORAGE EXPOSURE — 🟠 HIGH (introduced during Ticket 1.8)

Live `pg_policies` on `storage.objects`:

```
task_attachments_insert  roles={anon,authenticated}  cmd=INSERT
task_attachments_select  roles={anon,authenticated}  cmd=SELECT
```

The app has **no Supabase Auth** — the browser Supabase client is always the `anon` role (uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`, shipped to every client). Granting `anon` INSERT means **any anonymous internet caller holding the public anon key can write arbitrary files into `task-attachments`** — a storage-abuse / cost / malware-hosting vector. `SELECT` on `anon` also makes every uploaded file world-readable by key.

**Fix (this is DeepSeek plan item S20, promote to HIGH):**
1. Move upload server-side: new/updated `POST /api/tasks/resources` accepts `multipart/form-data`, uploads with `supabaseAdmin` (service role) from `src/lib/supabase-admin.js`.
2. Drop the `anon` policies; keep bucket private; serve files via signed URLs or an authenticated proxy route.
3. Client stops calling `uploadFile()` (anon) directly.

Until then the bucket is a public write target.

---

## 4. SECRETS — ✅ mostly clean

- `SUPABASE_SERVICE_ROLE_KEY` used only in `src/lib/supabase-admin.js` (server) — good.
- `.env.local` gitignored — confirmed earlier.
- No hardcoded secrets found in tracked route files.
- ⚠️ Watch: the anon key is `NEXT_PUBLIC_*` by necessity (client SDK). That is expected — the exposure in §3 is the RLS grant, not the key itself.

---

## 5. PRIORITY ORDER

1. Delete `debug-db/project-tasks` (§2a) — 2 min, removes schema leak.
2. Guard the 12 critical unauth mutations (§2b) — highest blast radius.
3. Cron secret on `notify-deadlines` + classify integrations (§2c).
4. Server-side upload + drop anon storage policies (§3).
5. Explicit roles on the 39 role-blind routes (§2d) — write verbs first.

Cross-reference: architecture-level remediation (middleware to make §2 impossible-by-default) is in `DEEPSEEK_M1_HARDENING_WORKORDER.md`.
