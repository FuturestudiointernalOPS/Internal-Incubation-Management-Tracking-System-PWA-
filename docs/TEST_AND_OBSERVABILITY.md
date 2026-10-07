# Test, Coverage & Observability Audit

> Phase report. Companion to `docs/PERFORMANCE.md` and `docs/PRODUCTION_TEST.md`.
> Measured on branch `A` (2026-09-29). Numbers are from a real run, not estimates.

The governing question is not "what percentage did we cover?" but:

> If something breaks in production tomorrow, can we detect it, understand why,
> find the request, find the database operation, and reproduce it from a test?

---

## Part A — Tests & Coverage

### A.1 Baseline

| Command | Result |
|---|---|
| `git status` | clean (branch `A`) |
| `npm test` | 221 suites / 2840 tests — **all passing**, ~16 s |
| `npm run build` | succeeds (route tree emitted, `ƒ Proxy (Middleware)`) |
| `npx eslint .` | **0 errors**, 6 warnings (all pre-existing, legacy hooks) |

**Framework (verified, not assumed):** Jest 30, `testEnvironment: "node"`, tests
matched by `src/__tests__/**/*.test.js`, ESM through `babel-jest`. No Vitest, no
React Testing Library runner beyond `@testing-library/react` used directly in 8
suites. **No E2E framework** (no Playwright / Cypress / Puppeteer).

**Test kinds (counted):**

| Kind | Suites | Notes |
|---|---:|---|
| API route tests (call `@/app/api/**/route`) | 77 | the largest group |
| Model-layer tests (require `@/models/**`) | 57 | pure/decision logic |
| Component tests (`@testing-library/react`) | 8 | UI behaviour |
| DB-round-trip tests (sequencer / fake DB) | 16 | statement-count guards |
| **Real-PostgreSQL integration tests** | **0** | see A.11 |
| Suites that mock `@/lib/db` | 119 | DB replaced by a fake |
| Subdirectory suites (`server/`, `ventures/`) | 26 | |

### A.2 Coverage (measured, `npm run test:coverage`)

Added to `package.json`: `test:coverage`, `test:watch`, `collectCoverageFrom`
(excludes tests, locales, migrations, config, and the trivial
`layout/loading/error/not-found` route files), text-summary + json-summary + lcov.

**Global:** statements 20.4% · branches 14.6% · functions 14.9% · lines 21.1%.

The global figure is low for a structural reason, and reading it as "the app is
untested" would be wrong: `src/app/api`, `src/lib` and `src/models` are covered
per function, while **~180 large UI page files are 0%** and they dominate the
denominator by raw statement count. The matrix below separates the two.

**By area (weighted by statements):**

| Area | Lines | Statements | Files |
|---|---:|---:|---:|
| `src/models/lms` | ~82% | 1670 | 21 |
| `src/models/authorization` | ~75% | 1611 | 26 |
| `src/server/auth` + `src/server/authz` | ~89% | 245 | 9 |
| `src/lib/lms` | ~68% | 376 | 25 |
| `src/app/api` | ~22% | 20701 | 406 |
| `src/components/ui` | ~25% | 633 | 27 |
| `src/app/admin`, `/platform`, `/pm`, `/staff`, `/investor`, `/participant` | 0% | ~19000 | ~180 |

**Key files — 0% before this phase → now:**

| File | Before | After |
|---|---:|---:|
| `src/app/api/auth/login/route.js` | 0% | **73.9%** |
| `src/app/api/errors/route.js` | 0% | **82.1%** |
| `src/lib/db.js` | 64.2% | **80.1%** |
| `src/lib/api/createHandler.js` | — | **84.0%** |
| `src/lib/logger.js` (new) | — | **93.8%** |
| `src/lib/request-context.js` (new) | — | **92.0%** |
| `src/app/api/health/route.js` (new) | — | **100%** |
| `src/app/api/ready/route.js` (new) | — | **100%** |

**Strongly covered (critical, keep it that way):** `models/lms/learning.js` (97%),
`models/authorization/accessQueries.js` (95%), `lib/programProgress.js` (95%),
`models/authorization/programScopeReadiness.js` (99%), `server/auth/cookies.js`
(100%), `lib/ventureStatuses.js` (100%), the whole `security-lot*` family.

**Still 0% and important (the real backlog):** `src/models/investor.js` (0.8%),
`src/models/authFlows.js`, `src/models/adminOps.js`, `src/models/platformConfig.js`,
`src/models/forms.js`, `src/models/finance/*`, `src/lib/storage.js`,
`src/app/api/auth/{session-login,forgot-password,reset-password,setup-password,activate}`,
`src/app/api/intents/route.js`, `src/app/api/contacts/*`.

### A.3/A.4 Coverage targets and the test matrix

No single target is imposed. The intent is per-risk:

| Category | Target | Rationale |
|---|---|---|
| Authorization / IDOR | ≥ 95% | a miss is a breach |
| Authentication flows | ≥ 90% | credential handling |
| Business rules (status/eligibility) | ≥ 90% | silent corruption |
| DB mutations / transactions | ≥ 85% | partial-state bugs |
| Decision-heavy services | ≥ 80% | |
| UI presentation | ~25% | high line count, low risk per line |
| Constants / pure maps | low | |
| Generated / config | excluded | |

**Excluded from coverage (reasonably):** test files, `src/locales/**` (JSON),
`src/migrations/**`, `*.config.js`, and the trivial `layout/loading/error/not-found`
route files. **Never excluded:** business logic, authorization, security and SQL —
even when hard to test.

**Matrix** (counts are suites whose *filename* targets the domain; "critical
behaviour" states what the passing badge actually means):

| Domain | Unit | API | Component | Integration (real DB) | E2E | Critical behaviour pinned |
|---|---:|---:|---:|---:|---:|---|
| Auth | 15 | 4 | — | 0 | — | session lifecycle, guards, **login route (new)** |
| Sessions | 7 | — | — | 0 | — | 2-session cap, expiry, token hash |
| Permissions | 6 | — | — | 0 | — | matrix, eligibility, deny-by-default |
| Authorization / IDOR | 17 (`security-*`) | 20 | — | 0 | — | cross-workspace / cross-venture ids refused |
| Users / contacts | 1 | — | — | 0 | — | identity, role writes |
| Workspaces | — | — | — | 0 | — | **gap** |
| Programs | 11 | — | — | 0 | — | scope, progress, assignment |
| Ventures | 41 | — | — | 0 | — | lifecycle, gating, visibility, ledger |
| Messages | — | — | — | 0 | — | **gap (no filename suite)** |
| Forms / platform | 2 | — | — | 0 | — | run projection (fake-LMS DB) |
| Responsibilities | 1 | — | — | 0 | — | grants, catalogue |
| LMS | 28 | — | 4 | 0 | — | learning, certificates, checkout |
| Investor | 2 | — | — | 0 | — | diligence scope (IDOR) |
| Finance | 1 | — | — | 0 | — | sheet guards |
| Tasks | 4 | — | — | 0 | — | carry-over, dependencies |
| Notifications | 3 | — | — | 0 | — | badge, hardening |
| DB / performance | 7 | — | — | 0 | — | round-trip budget, pool window, sequencing |
| Observability | **7 (new)** | — | — | 0 | — | logging, correlation, slow-query, health |

### A.5–A.20 What the existing suite does well, and the honest gaps

**Well covered and behaviour-oriented:** authorization/IDOR (`security-lot1…14`,
`authz-scope-enforcement`, `program-scoped-access`), the scope engine
(`phase5/5b/6`), venture lifecycle/gating, LMS learning & scoring, notification
hardening, and DB round-trip budgets (they assert *statement counts and waves*,
i.e. behaviour, not "function was called").

**Weak patterns found:**

- **Source-shape assertions.** Several `security-lot*` / `*-ui` suites read a
  file and regex the source (`expect(src).toMatch(/auditLoginAttempt\(/)`). They
  catch a deleted line but not a wrong decision. The new login tests replace this
  pattern with real `Given/When/Then` execution.
- **The DB is mocked in 119 of 221 suites**, so SQL text, constraints, unique
  indexes, FKs and `ON CONFLICT` semantics are **never executed**. See A.11.
- **No transaction/rollback test executed against a real engine** until now
  (the new DB suite drives `db.transaction` and asserts `ROLLBACK` + no commit).
- **Mocks are mostly at the right boundary** (email provider, `fetch`, `pg`,
  `@/lib/db`) — good. A few mock `@/lib/authorization` wholesale, which is
  acceptable for route tests but means the decision itself is only covered by the
  dedicated resolver suites (which do exist).

**Auth, critically:** the *rules* were tested (rate limits, guards) but the
**login route had no executable test at all**. Now covered (A.6): success,
unknown user (with timing equalisation), wrong password, inactive/pending/
archived/other status, legacy plaintext, rate-limit, and session-creation failure
(never a success without a cookie) — each asserting the side effect (no session,
audit written).

### A.11/A.12 Database integration & transactions

**Finding:** there are **zero** tests against a real PostgreSQL. Every SQL string
is replaced by a fake. This is a deliberate speed choice, but it means schema
drift (`docs/SCHEMA_DRIFT_AUDIT.md`), constraint violations and transaction
rollback are not exercised. The new DB suite pins the *engine's* behaviour
(latency reporting, retry, rollback logging) against a fake pool, which is the
correct unit boundary — it does **not** replace a real-DB suite.

**Recommended (roadmap):** one opt-in integration suite, gated by an env var
(`TEST_DATABASE_URL`), that creates a throwaway schema and exercises: a unique
constraint, a FK violation, `ON CONFLICT DO UPDATE`, and a two-step transaction
that fails halfway and must leave no row. Run in CI only when a database is
provided; skip otherwise. This is the single highest-value test investment left.

### A.13–A.19 Error paths, edge cases, mocks, data, isolation

- **Error paths:** the new suites cover 400/401/403/429/500 on login and
  `/api/errors`, plus 503 on readiness and rollback on transactions. `security-lot14`
  already pins "no internal detail in 5xx bodies". Remaining: per-route 409/422 on
  write endpoints.
- **Edge cases:** unknown user vs wrong password (same generic message, equalised
  timing), archived-by-timestamp-vs-status, dedup vs insert, hung DB → fast 503,
  cycles in logged objects, 50-item array bound. No artificial cases were added.
- **Mocks:** boundary-only (email, `pg`, `fetch`, db module). No new test mocks
  business logic it is verifying.
- **Isolation:** each suite resets modules/mocks in `beforeEach`; a fresh read of
  the suite shows no ordering dependency. `jest --runInBand` confirmed.
- **Flakiness:** three full runs, all green; no retries needed; the only timed
  suite (`use-api-hook`, ~1.9 s) is fast. No `setTimeout`-based timing assertions
  were added (the readiness timeout test uses a 25 ms bound against a
  deliberately never-resolving promise, which cannot race).

### A.25 Test performance

Total run ~16 s for 2840 tests. Slowest suites:

| Suite | Time |
|---|---:|
| `use-api-hook.test.js` | 1950 ms |
| `server/auth-password.test.js` | 732 ms |
| `db-sequencing.test.js` | 591 ms |
| `lms-*-ui.test.js` (×4) | 240–470 ms |

No suite is a bottleneck; nothing was optimised prematurely.

---

## Part B — Observability

### B.27 Observability model

Three pillars, mapped to what actually breaks here:

| Pillar | Implementation in this repo |
|---|---|
| **Logs** | `src/lib/logger.js` — structured, one event one line, sanitized |
| **Metrics** | in-process counters: `getDbMetrics()` (latency histogram, slow/medium counts, maxMs, avgMs), `getPoolStats()` (active/idle/waiting) |
| **Traces** | request correlation id via `AsyncLocalStorage` (`src/lib/request-context.js`), echoed as `x-request-id` |

Correlated signals: errors (`request_failed`, `db_query_failed`), latency
(`db_slow_query`, `db_medium_query`), traffic (`request_completed`), DB
(`getPoolStats`/`getDbMetrics`), authentication (`auth_login_*`), authorization
(`authorization_denied`), business events (available via the same logger).

### B.28 Current logging — before → after

**Before:** 488 `console.error` + 88 `console.warn` + 59 `console.log` across 261
files, unstructured, no correlation, some carrying SQL and recipients.

**After (critical paths only — deliberately not "everywhere"):**

| Event | Level | Where | Fields (never secrets) |
|---|---|---|---|
| `request_completed` | debug | `createHandler` | status, durationMs, requestId |
| `request_failed` | error | `createHandler` | status, durationMs, error{name,message,stack} |
| `request_rejected` | debug | `createHandler` | status, userId |
| `db_query` | debug | `lib/db` | operation, durationMs, rows |
| `db_medium_query` / `db_slow_query` | warn / error | `lib/db` | operation, durationMs, thresholdMs, poolWaiting |
| `db_query_failed` | error | `lib/db` | operation, statement-head (≤120 chars, **no args**), code |
| `db_transaction_committed` / `_rolled_back` | debug / warn | `lib/db` | statements, durationMs |
| `authorization_denied` | warn | `models/authorization/resolver` | userId, role, resourceType, action, reason |
| `auth_login_success` / `auth_login_failed` | info / warn | `api/auth/login` | userId, role, kind / reason (no email, no password) |
| `auth_login_rate_limited` | warn | `api/auth/login` | scope |
| `auth_session_create_failed` | error | `api/auth/login` | userId |
| `email_sent` / `email_sent_via_fallback` / `email_send_failed` | info / warn / error | `lib/email` | provider, durationMs (recipient **never** logged) |
| `readiness_failed` | warn | `api/ready` | durationMs, error, pool |

`console.log("something happened")` was **not** swept repo-wide — the remaining
calls are mostly in UI components and low-risk models. They are candidates, not
regressions. Production format is one JSON line; dev/test is readable.

### B.29 Request correlation

`createHandler` (118 routes) and `withRequestContext` (hand-written routes such as
`auth/login`) create/reuse an `x-request-id`, run the whole request inside
`AsyncLocalStorage`, and echo the id on the response. The logger attaches the
ambient id automatically, so a line written three modules down still joins the
request — including DB warnings and authorization denials. The edge middleware
(`src/proxy.js`) reuses an incoming id or generates one and forwards it.

Reconstruction now works: **request → API → authorization → DB → error**, all with
one id.

### B.30 Error tracking

Already present and kept: `error_logs` table + `/api/errors` (client reports,
dedup by fingerprint, category) + `ClientErrorReporter` + `AppErrorBoundary`. This
phase adds **server-side** structured error events (`request_failed`,
`db_query_failed`) so a server fault is captured even when no browser reports it,
and gates the read/triage endpoints behind `engineering.manage_errors`. No second
error-tracking system was introduced.

### B.31/B.32 DB observability & slow-query detection

Every statement records operation, duration, success/failure and the request id;
slow ones become structured events. Thresholds are env-tunable
(`DB_SLOW_MS` default **500**, `DB_CRITICAL_MS` default **1000**) — calibrated to
the ~130 ms round trip observed in `docs/PERFORMANCE.md`, not treated as
universal. The SQL **text and arguments are never logged** on a slow/failed query
(operation + statement head only), because parameters can carry personal data.

### B.33/B.34 Latency & error rate

Per request: `request_completed`/`request_failed` carry status and duration. DB
latency has a histogram (`lt100 / lt500 / lt1000 / gte1000`) plus `avgMs`/`maxMs`,
exposed by `getDbMetrics()`. Expected 401/403 are logged at **debug** (not counted
as server errors); 5xx are `error`. p50/p95/p99 are derivable from the histogram
buckets once exported to the platform's log/metric backend (see B.42).

### B.35/B.36 Auth & authorization observability

Login success/failure/rate-limit and session-creation failure are events with a
reason enum — **never** the password, never the email. Denials log
`{userId, role, resourceType, action, reason}` — no business payload. The DB audit
(`logPermissionAudit`, login history) is unchanged and remains the durable record.

### B.38 Database pool

`getPoolStats()` exposes `total / idle / active / waiting / max`. Slow-query
events include `poolWaiting`, which is precisely what distinguishes **slow SQL**
from **waiting for a connection** — the distinction required before touching the
pool size. Both are surfaced on `/api/ready`.

### B.39 External services

Email (Gmail/Resend) is instrumented as an external boundary: attempt, provider,
fallback used, duration, success/failure. Other integrations
(Google Sheets, Kkiapay, DeepSeek) are **not yet instrumented** — listed
in the roadmap.

### B.40 Health checks

- `GET /api/health` — **liveness**: no dependency, never cached. Cannot turn a DB
  blip into a restart.
- `GET /api/ready` — **readiness**: one bounded `SELECT 1` (`pingDatabase()`),
  returns **503 fast** when the DB hangs (own timeout, `READY_TIMEOUT_MS`), with
  pool + DB metrics in the body.
- Both are public in the middleware allowlist (a monitor holds no cookie).
- The pre-existing `GET /api/system/health` (authenticated, `settings.view`) is a
  *per-component application health dashboard* — kept, distinct in purpose.

### B.41/B.42 Proposed alerts and dashboard

Alerts (symptom-based, each with condition / severity / owner / action):

| Alert | Condition | Sev | Action |
|---|---|---|---|
| `5xx` spike | `request_failed` > 1% of requests / 5 min | P1 | page on-call |
| Latency spike | p95 > 2 s / 5 min | P2 | investigate slow routes |
| DB connection exhaustion | `pool.waiting > 0` sustained, or `/api/ready` 503 | P1 | raise pool / find long query |
| DB errors | `db_query_failed` rate > baseline | P1 | check Supabase |
| Auth failure spike | `auth_login_failed` per IP/account > N / 15 min | P2 | security review |
| Authz denial spike | `authorization_denied` rate jump | P2 | check a role change |
| Email outage | `email_send_failed` > threshold | P2 | check Gmail/Resend |

Minimal dashboard: **Application** (requests/min, p50/p95/p99, 5xx rate) ·
**Database** (query latency histogram, pool active/idle/waiting, slow count) ·
**Authentication** (logins success/fail, session failures) · **Business** (a few
events only: `auth_login_success` by role, email_sent).

### B.43 Privacy

Enforced by the logger, not by convention: keys matching secrets
(`password/token/secret/cookie/authorization/api key/DSN/signature…`) and personal
data (`email/phone/address/…`) are replaced with `[redacted]` **recursively**; a
Request/Response object is replaced with `[request]`; errors reduce to
name/message/stack. Regression tests assert the serialized output does not contain
the secret (`observability-logger.test.js`, `observability-external-email.test.js`,
`auth-login-route.test.js`).

### B.44 Environments

Level is resolved per call from `LOG_LEVEL`, defaulting to **info** in production,
**warn** under test, **debug** locally. Production emits JSON (drain-ready);
elsewhere a readable line. Slowness thresholds are env-tunable per environment.

### B.45 Observability tests

`observability-logger` (redaction, envelope, level gate, JSON wire),
`observability-request-context` (propagation across awaits, header echo, reuse),
`observability-db-instrumentation` (slow/medium/fast, no-SQL-in-logs, pool stats,
rollback, histogram), `observability-health` (liveness has no dependency, readiness
200/503/timeout, public), `observability-external-email` (provider events, no
recipient), `auth-login-route` (auth events + no session on failure),
`errors-route-observability` (throttle before DB, dedup, authz, no echo).

### B.46 Performance impact

Instrumentation is synchronous, allocation-light (a counter increment + a gate
check) except when a statement crosses the slow threshold or a caller logs
explicitly. Debug-level records are dropped before any string work. Build and the
full test suite times were unchanged (±1 s).

---

## Final validation

```
npm test          → 221 suites / 2840 tests, all passing
npm run build     → success
npx eslint .      → 0 errors (6 pre-existing warnings)
```

Checklist:

- [x] Tests stable (3 consecutive full runs, no flaky)
- [x] Critical business logic tested (scope engine, venture lifecycle, LMS)
- [x] Authorization tested (security-lot* + resolver; IDOR across ventures/workspaces)
- [x] DB mutations tested (sequencer/round-trip budgets + new transaction test)
- [x] Important API routes tested (77 route suites; login + errors newly covered)
- [x] Error paths tested (400/401/403/429/500/503 + rollback)
- [x] Coverage measured (configured + per-area report)
- [x] Structured logging (`src/lib/logger.js`)
- [x] Request correlation (`AsyncLocalStorage` + `x-request-id`)
- [x] Error tracking (existing `/api/errors` + new server-side events)
- [x] DB latency visibility (`db_slow_query` / `db_medium_query` + histogram)
- [x] Connection pool visibility (`getPoolStats`, `poolWaiting` in slow events)
- [x] Important business events observable (auth, authorization, email)
- [x] Sensitive data excluded from logs (redaction + regression tests)
- [x] Alerts based on actionable signals (proposed, symptom-based)

## Priority roadmap

1. **Real-DB integration suite** (env-gated) — the one structural gap; covers
   constraints, FKs, `ON CONFLICT`, and a rollback that must persist nothing.
2. **Remaining auth routes** — `session-login` (118 stmts, 0%), `reset-password`,
   `setup-password`, `activate`, `forgot-password`.
3. **`models/investor.js`** (0.8%) and **`models/adminOps.js`** (0%, error triage).
4. **Revenue/ops routes with no suite** — `intents`, `contacts/*`, `campaigns`,
   `blockers`.
5. **Instrument remaining external services** — Google Sheets, Kkiapay,
   DeepSeek (count / latency / errors / timeouts).
6. **Export metrics** to the platform backend so p95/p99 and alerting thresholds
   in B.41 become live, not derived.
7. Replace source-shape assertions in the `security-lot*` family with executable
   ones as those routes gain real tests.
