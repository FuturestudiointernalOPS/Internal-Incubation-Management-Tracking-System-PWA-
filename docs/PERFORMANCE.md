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
| Workspaces hub                | 10 → **8** | 10 → **1**    | 1 → **8**     |
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

The hub's own call renders all of it. It lost one dependent read — the
organizational memberships are built from the groups the authorization resolution
already returned, rather than re-reading the legacy table for them — which is why
it is one wave and not two.

It then went from ten reads to EIGHT, by asking two of its questions of rows it
was already holding: the ended group memberships ride along with the group
resolution, and the active enrollments are a FILTERED SUBSET of the membership
list. Reducing the burst without adding a wave is the only kind of reduction that
is free, and the burst is now eight of the ten connections rather than the whole
pool.

These are **round-trip counts and wave depths, not response times measured in
production**. The wall-clock figures are derived from the 130ms cost observed in
the log; they must be confirmed on a representative environment before being
quoted as results.

### The navigation list is cached, per person

The shell's call asks for the same list every time it mounts, and that list is a
function of the person's access and NOTHING else: it changes when their access
changes, which is rare. It is now cached per person and per scope
(`src/lib/workspaceContextCache.js`), and it is dropped by the SAME calls that
drop the authorization context — so the rule stays "whoever changes access drops
the cached understanding of it", and a future writer cannot drop one view without
the other.

| Workspaces                    | Statements | Waves | Burst |
| ----------------------------- | ---------- | ----- | ----- |
| first navigation (hub / shell) | 8 / 6     | 1     | 8 / 6 |
| every navigation after that    | **1**     | 1     | **1** |

The one statement left is deliberate, and it is why this is a cache of the
navigation list and not of the whole answer: the identity chip's stored role is
read FRESH, never from the cache, so a cached list can never mislabel the person
it belongs to. It rides in the SAME wave as the navigation read, which is why a
first navigation is still one wave rather than two.

The 30s TTL is the BACKSTOP rather than the mechanism. It covers the writes that
do not pass through the invalidation calls — assigning somebody to a programme,
adding a venture membership — which therefore appear on the next mount after the
window instead of immediately. Both the cached call and the post-invalidation
call are asserted, so neither the cache nor its invalidation can be lost quietly.

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

## Bulk participant work — one statement per chunk of 30

Enrolling a programme's people, or assigning several of them at once, was written
one person at a time: a conflict check, the assignment, an audit entry, and one
enrolment statement per required course - in series. The programmes here run to
hundreds of people, so the largest operations the application offers were also the
ones it could not finish.

The work is now GROUPED and QUEUED: one statement writes a whole chunk, and the
chunks are applied in order. The size of a chunk lives in one place,
`src/lib/participantBatches.js`, at 30 - small enough to stay an ordinary
statement, and a FRACTION of the ten connections the whole application shares
rather than a multiple of them.

Measured through the shared fake, with one published required course:

| Operation                | Statements | Per person |
| ------------------------ | ---------: | ---------: |
| add 30 people, before    |        181 |       6.03 |
| add 30 people, now       |      **7** |       0.23 |
| add 65 people, before    |        391 |       6.02 |
| add 65 people, now       |     **19** |       0.29 |
| remove 40 people, before |         80 |       2.00 |
| remove 40 people, now    |      **4** |       0.10 |

The "per person" column is the point: it used to be a CONSTANT - six statements
for an add, two for a remove, whatever the size - and it is now divided by 30,
because the number of statements follows the number of CHUNKS. At the ~130ms
round trip measured above, the old 391 is a minute of waiting inside one request.

Two consequences, both deliberate:

- **the chunk is the unit that lands or fails.** A database error used to be
  collected for the person it happened on; it is reported now for that chunk's
  people. A failed chunk does not hold up the chunks after it, and a refused
  facilitator is still reported individually.
- a chunk costs three statements of its own because the enrolment reads the
  programme's requirements once per CHUNK instead of once per person.

Both are asserted rather than assumed:
`src/__tests__/participant-programs-bulk.test.js` drives the real route against
the fake, and checks the shape (one assignment statement for thirty people, three
for sixty-five) as well as the outcome - everyone assigned, everyone enrolled, the
facilitator refused rather than assigned, and a removal that does not revoke the
learning already granted.

## The run detail screen — twelve sequential reads, now four waves

The platform Run screen (the Responses table) awaited each of its reads one
before the next: the run, then assignments, then submissions, then reviews, then
the AI evaluations, the email logs, the form's fields, the report file, the
contacts, the tokens and the assignment enrichment. **Twelve statements, twelve
waves** — every one waiting on the one before it.

Only the Run itself is a dependency: everything else needs just its id, or the
`form_id` the Run carries. So the seven reads that need only the id go out in one
wave, the contact lookups overlap the assignment enrichment, and the token
lookup follows the contacts (it is keyed on them).

| Run detail (`GET /api/platform/form-runs?id=…`) | Statements | Waves | Burst |
| ----------------------------------------------- | ---------: | ----: | ----: |
| before                                          |         12 |    12 |     1 |
| now                                             |         12 | **5** |     7 |

Five is the FIRST call of a process; on a warm process the report-file read (it
is preceded by a once-per-process schema check) joins the second wave and it is
**four**. Same statement count — the reads are the same, they no longer queue.
`src/__tests__/db-audit-form-runs.test.js` asserts the budget.

## The contacts registry — the self-heal left the read path

`/api/contacts/full-state` called `reconcileProgramGroups()` on every load. That
routine is a safety net for records that predate the event-driven repair — the
normal path fixes a person when their submission is approved
(`syncApprovedSubmissionToProgramGroup`) — but it is **several writing
statements**, and a read endpoint was paying for them on every visit.

It now runs at most once per window per process (60s), shared by callers that
arrive while it is in flight, and never retried inside the window after a
failure. The net is kept; the per-request cost is gone.

The other reads were also a chain of their own: contacts, then families, then
teams, then the invitation tokens, then the activation email log. The three
registry reads are independent (one wave) and the two status reads are
independent of each other (a second wave).

| Registry (`GET /api/contacts/full-state`, repeat load) | Statements | Waves | Burst |
| ------------------------------------------------------ | ---------: | ----: | ----: |
| before                                                 |         10 |    10 |     1 |
| now                                                    |      **5** | **2** |     3 |

The measurement is a REPEAT load (the case every visit but the first one is):
the first load pays the reconciliation once. `src/__tests__/db-audit-form-runs.test.js`
asserts both the fall in statements and the two waves.

The program Full State bundle is also measured there: **eighteen statements in
ONE wave**, with a burst of fifteen against the ten-connection pool. The wave
depth is right — the surplus simply waits for a slot, which is why its statement
COUNT, not its burst, is the thing to reduce next.

## The program workspace bundle — the extras that rode on top

The program workspace reads its fourteen tables in ONE wave already, so its wave
depth was never the problem. What rode on top of the bundle was:

- **the note's attachments were a second read, and a dependent step.** The bundle
  returns the program row; the attachments were then asked for using the note id
  that row carries, so they cost a round trip *and* a wave. They are now
  aggregated into the program row itself (`jsonb_agg`), so listing them costs
  neither.
- **the staleness question was asked on EVERY load with metrics.** "When was this
  program's progress last calculated?" is one cheap read, but it was a read per
  load, issued in the background — competing for the same ten connections the
  response needs. It is now asked at most once per 30-second window per program.
  The five-minute TTL still decides whether anything is recalculated; the window
  only removes the per-load round trip.

| Program workspace (`GET /api/pm/full-state`, steady load) | Statements |
| --------------------------------------------------------- | ---------: |
| before                                                    |         18 |
| now                                                       |     **15** |

Both figures come from the same harness in `src/__tests__/db-sequencing-audit.test.js`,
which asserts the budget. The two removals are exact — one read that was also a
dependent step, and one read per load.

What is deliberately NOT done: collapsing the bundle's fourteen single-table
reads into one aggregated row. That would take the statement count far lower,
but it changes every column's serialized shape for every consumer of this
payload, and it needs a real database to measure — the "rewrite all the queries
first" this guide rules out. The burst still exceeds the ten-connection pool, so
the surplus waits for a slot; the statement COUNT is the lever, and it is a
larger, riskier change than this pass.

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
  differently now that the hub's burst is eight of the ten connections: the
  connection is the scarce resource. Note the active-rows read only feeds the flat
  fallback list, which the hub renders only when every context list is empty.
- **The widest burst is 8 against a pool of 10** on the hub itself: it was 10, and
  the two statements that came off were tables being read TWICE for the same
  person. One hub load no longer takes every connection, so a second request
  arriving at that instant finds a slot rather than waiting for one.

  Where the two came from, since the pair is a pattern and not a one-off: the
  ended group memberships were a second read of the same group rows the group
  resolution had already fetched and then discarded, and the active enrollments
  are a FILTERED SUBSET of the membership list (same table, same join, same
  person) — so both are now derived from the read that was already happening. See
  `getEffectiveGroupsAndHistory` and `getParticipantProgramMemberships`.

  The shell's call is 6, which is what every other page pays, and it did not
  change. The threshold is not the count alone: two simultaneous hub loads ask
  for 16 connections out of 10, and the surplus only drains as fast as the reads
  finish, against the 5s a request may wait for a free connection before it
  fails. Reducing the count buys tolerance to that; it does not remove the
  ceiling — and the ceiling is really set by the SLOWEST read, because one query
  may hold its connection for 30s. The harness reports `maxInFlight` so this can
  be re-checked.

## When a screen is slow again

1. Open it with the sequencer (or read `getDbMetrics()` before/after).
2. Compare `waves` with the budget table above.
3. If `waves` grew, find the new `await` that could be a wave.
4. If `statements` grew, ask whether it is per request or per process.
5. If `schemaStatements` is non-zero on a steady-state request, a new `ensure*`
   helper was added on the request path — move it to the migration.
