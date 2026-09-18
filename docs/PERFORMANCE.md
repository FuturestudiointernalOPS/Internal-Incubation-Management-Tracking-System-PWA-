# PERFORMANCE — DATABASE ROUND TRIPS

The application is slow for one measurable reason, and it is not the SQL:

> **Latency ≈ (number of sequential database round trips) × (cost of one round trip).**

In the observed environment one round trip costs roughly **130ms**, whatever the
query returns. It is the same for a `SELECT` on 11 rows and a schema statement,
and the same query answers in ~10ms when the process is warm and nothing else is
in flight. So the number that matters is not how long a query runs — it is **how
many times a request has to wait for the database**.

Evidence from a single production log, before this work:

| Request                          | Sequential round trips | Observed |
| -------------------------------- | ---------------------: | -------: |
| `/api/responsibilities`          |                     25 |    3.4s |
| `/api/facilitator-reviews` (warm)|                      1 |   145ms |
| `/api/platform/form-runs` (warm) |                      2 |   275ms |

25 × 130ms = 3.25s. 2 × 130ms = 260ms. The model holds, which is why **adding
indexes or rewriting queries is not the fix** — the queries are not the cost.

## The four rules

1. **No schema change on a request path.** Creating a table, adding a column or
   creating an index belongs to `src/migrations/` and the deploy step
   (`npm run db:align`, `scripts/db-audit/apply-migrations.mjs`). A user request
   must never wait for DDL.
2. **One wave for independent reads.** If several reads need only the session
   identity, they run together (`Promise.all` / `Promise.allSettled`). Never
   `await` them one after another out of habit.
3. **Respect the real dependencies.** A read that needs another one's result
   belongs to the next wave. Parallelising dependent reads is a correctness bug,
   not an optimisation.
4. **Never repeat per request what only changes on deploy.** A catalogue, a
   schema check or a fixed seed runs once per process (module-level promise) or
   once per database (the migration ledger), never once per request.

## What is measured, and how

`src/__tests__/helpers/dbSequencer.js` replaces the database engine with a
recorder that reports, for one request:

| Metric            | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| `statements`      | how many statements the request issues (schema excluded)         |
| `waves`           | how many sequential steps it waits through — **this is latency** |
| `maxInFlight`     | the widest parallel burst (compare with the pool of 10)          |
| `schemaStatements`| once-per-process schema work, reported separately                |

`src/__tests__/db-sequencing.test.js` asserts a budget per screen, so a change
that re-introduces a per-request statement or a new sequential step fails the
build. `src/__tests__/db-roundtrip-budget.test.js` does the same for the
catalogue seed.

To re-measure a screen, call it through the sequencer and read `report()`.

## Before / after (measured, same harness both sides)

| Screen                        | Statements | Waves         | Burst         |
| ----------------------------- | ---------- | ------------- | ------------- |
| Responsibilities (first call) | 25 → **3** | 25 → **3**    | 1 → 1         |
| Responsibilities (warm)       | 25 → **1** | 25 → **1**    | 1 → 1         |
| Internal messaging (inbox)    | 8 → 8      | 8 → **4**     | 1 → **5**     |
| Workspaces hub                | 10 → 10    | 10 → **1**    | 1 → **10**    |
| Authorization (cold)          | 7 → 7      | 4 → **3**     | 2 → **4**     |

Same statement counts for the inbox and the hub — the reads are the same, they
now go out together. At 130ms per wave: the responsibilities screen goes from
~3.3s to ~0.13s, the hub from ~1.3s to ~0.13s, the inbox from ~1.0s to ~0.5s.

### The shell's call, and the burst that is left

The context switcher lives in the page shell, so its request runs on **every**
page, not only on the hub. It renders just the context list and the identity
chip, so it now asks for `?scope=contexts` and the four hub-only reads — the
flat assignment list, the generalized program assignments, the past memberships
and the legacy active-enrollment fallback — are answered locally instead of
being sent:

| Workspaces, shell call (`?scope=contexts`) | Statements | Waves | Burst |
| ------------------------------------------ | ---------- | ----- | ----- |
| before (the parameter was ignored)         | 11         | 2     | 10    |
| now                                        | **6**      | **1** | **6** |

The hub's own call keeps its ten reads, because it renders all of them. It did
lose one dependent read: the organizational memberships are built from the
groups the authorization resolution already returned, rather than re-reading
the legacy table for them. That is why it is one wave and not two — and why its
burst is now the full pool rather than nine of ten.

These are **round-trip counts and wave depths, not response times measured in
production**. The wall-clock figures are derived from the 130ms cost observed in
the log; they must be confirmed on a representative environment before being
quoted as results.

## Runtime schema maintenance

About forty `ensure*` helpers keep older databases usable by issuing idempotent
DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `DROP … IF EXISTS`). Most were never memoised, so
every request that touched them paid for them.

`src/lib/db.js` now answers those statements locally after the first execution
in a process. The guard is deliberately narrow: only statements that are
provably no-ops when repeated, never data statements, and never inside
`db.transaction()`.

Two consequences worth knowing:

- The **first** request of a process still performs them (once). To move even
  that off the request path, run the schema migration at deploy time and set
  `SKIP_RUNTIME_SCHEMA_MAINTENANCE=true` — the app then sends no maintenance DDL
  at all and logs a warning saying so. Do not set it before the database is
  migrated.
- A statement that **failed** is not recorded as applied, so it retries on the
  next request instead of silently succeeding.

## The migration ledger — one read, not one per migration

The authorization boot used to ask the database "has this migration been
applied?" **once per migration name**. The capability backfills ask about 22
names and the eligibility seed about 6 more, so the first gated request of every
process paid **28 round trips** to learn one small list that only changes on
deploy. That is rule 4 below, and it was not being followed.

`src/models/authorization/migrations.js` now reads the ledger WHOLE, once per
process, and answers every later check from what it read.

Measured through the sequencer. The "before" figures for the ledger are the same
count measured on a FRESH database, where every check misses: the reads are issued
identically either way - they only find their name instead of not finding it, so
the count is the same on a migrated one.

|                                   | Ledger statements | Widest ledger burst |
| --------------------------------- | ----------------: | ------------------: |
| before                            |                28 |                  22 |
| now                               |            **1** |               **1** |

The cold gate AS A WHOLE, measured after the change: **8 statements in 5 waves** on
a migrated database - the resolution's own work (its budget is 7 statements and 3
waves) plus that single read. Before, the same gate added 28 ledger reads to it,
22 of them issued at once.

The burst is why this showed up as *slowness* rather than as a count: 22
concurrent reads against a pool of 10 means most of them wait for a connection,
and a statement that waits for a connection is timed as a slow one. That is
exactly what the production log showed - `SELECT name FROM authz_migrations
WHERE name = $1` taking 1.6-3.9s, a query with nothing slow about it.

Two properties worth keeping:

- the read is memoised through a promise, so callers that arrive while it is in
  flight share it rather than each starting their own;
- if it cannot be read at all, the per-name query is used exactly as before - an
  unreadable ledger costs speed, not correctness.

A fresh database still runs its 28 migrations, inside that one ledger read.

`src/__tests__/db-sequencing.test.js` asserts all three: one read for the whole
cold gate, zero round trips to ask again about a migration this process already
applied, and no re-application on a migrated database.

## Instrumentation (guard against regression)

- `getDbMetrics()` / `resetDbMetrics()` in `src/lib/db.js` expose `queries`,
  `ddl`, `skippedDdl`, `dbMs` and `slow` for the process.
- Every maintenance statement that is actually sent is logged
  (`forensics | schema maintenance (once per process)`), so DDL on a request
  path is visible in the log rather than assumed.

## Known, deliberate non-changes

- **`requireAuth()` followed by `getSession()`.** Several routes call both. The
  second is answered by the 15s session cache (or the in-flight share), so it
  costs **zero** round trips. Refactoring fifteen files would add risk for no
  measurable gain.
- **Two reads of participant membership on the hub** — still two, and now the
  first candidate to revisit. One returns active rows, the other every status
  with different joins. They are in the same wave, so merging them saves a
  connection and not a wave, which used to read as "not worth it". It reads
  differently now that the hub's burst is the whole pool: the connection is the
  scarce resource. Note the active-rows read only feeds the flat fallback list,
  which the hub renders only when every context list is empty.
- **The widest burst is 10 against a pool of 10** on the hub itself: one hub
  load takes every connection, so anything else in flight at that instant waits.
  The shell's call is 6, which is what every other page pays. The hub's number is
  the one to watch, and the threshold is not the count alone: two simultaneous
  hub loads ask for 20 connections out of 10, and the surplus only drains as fast
  as the reads finish, against the 5s a request may wait for a free connection
  before it fails. Reducing the count buys tolerance to that; it does not remove
  the ceiling. The harness reports `maxInFlight` so this can be re-checked.

## When a screen is slow again

1. Open it with the sequencer (or read `getDbMetrics()` before/after).
2. Compare `waves` with the budget table above.
3. If `waves` grew, find the new `await` that could be a wave.
4. If `statements` grew, ask whether it is per request or per process.
5. If `schemaStatements` is non-zero on a steady-state request, a new `ensure*`
   helper was added on the request path — move it to the migration.
