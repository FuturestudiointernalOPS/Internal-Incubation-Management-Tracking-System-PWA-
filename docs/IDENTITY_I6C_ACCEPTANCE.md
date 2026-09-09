# ImpactOS — Phase I6C Brief (Zero-Dependency Proof + Staging Acceptance Matrix)

Status: executed. Static scan + staging matrix both green. No production touched.

## Part 1 — Zero-dependency scan (static, repeatable)

`scripts/i6c-zero-dependency-scan.mjs` walks every `src/app/api` route file and
classifies every `requireAuth([...])` allowlist that mentions a contextual role
(facilitator · teacher · participant · founder · investor · team):

| Verdict | Meaning | Count |
|---|---|---|
| (no contextual roles) | global-only gates — baselines + staff-family | — |
| WATCHLISTED | documented deferral (contract test + I6A/B briefs) | 20 files |
| WATCHLISTED(partial) | some handlers converted, one list deferred (submissions POST) | 1 file |
| UNEXPECTED / UNCLASSIFIED | gate with no documented reason → **exit 1** | 0 ✅ |

**Proof statement:** after phases I5/I6A/I6B there is **no unexplained
contextual-role gate left in the API layer**. Every remaining stored-role
allowlist is either converted (auth-only + membership/own-scope decision),
or explicitly deferred with a documented reason and a hardening recipe. Scan
report: `scratch/i6c-zero-dependency-scan-*.json`.

## Part 2 — Acceptance matrix on staging (15/15 passed, 0 skipped)

`scripts/i6c-acceptance-matrix.mjs` creates fixture "Sarah" (baseline
`contacts.role = member`) + a control contact, then executes the **real
membership SQL the authorization gates run** (identical queries to
`hasActiveParticipantProgram`, `resolveProgramAssignment`,
`isVentureFounder`/`isVentureMember`, `learnerHasEnrollments`, and the
`pm/programs` membership-keyed scope filter). Safety: full-table before-image
snapshot → writes → assertions → fixture kept for manual QA (or removed with
`--cleanup`, marker-scoped; validated end-to-end in a separate run).

| # | Assertion | Result |
|---|---|---|
| A1 | baseline = member | PASS |
| A2 | Program A join (participant_programs) does NOT mutate baseline | PASS |
| A3 | hasActiveParticipantProgram SQL → true | PASS |
| B1 | Program B join (v2_program_staff facilitator) does NOT mutate baseline | PASS |
| B2 | resolveProgramAssignment SQL (v2_program_staff) → true | PASS |
| B3 | **pm/programs scope lists exactly the facilitated program (n=1)** | PASS |
| C1 | Venture X join (venture_members founder) does NOT mutate baseline | PASS |
| C2 | isVentureFounder SQL → true | PASS |
| C3 | isVentureMember SQL → true | PASS |
| C4 | control contact is NOT a venture member (negative) | PASS |
| D1 | LMS enrollment does NOT mutate baseline | PASS |
| D2 | learnerHasEnrollments SQL → true | PASS |
| E1 | control baseline = member | PASS |
| E2 | control has empty program scope (n=0, negative) | PASS |
| F1 | **Sarah's role is STILL member after ALL four joins** | PASS |

Notes:
- Staging had only one active program → the tool created a **marker program**
  (`I6C-FIXTURE-PROGRAM`, UUID) so the facilitator context could be proven;
  cleanup removes marker programs only, never real ones.
- Fixture left on staging for manual QA (context-switcher demo):
  Sarah `USR-I6C-MTU4Y3DE`, control `USR-I6C-CTRL-MTU4Y3DE`
  (emails `*.i6c.*@future.studio.test`). Remove with
  `node scripts/i6c-acceptance-matrix.mjs --cleanup`.

## What this phase certifies

1. **Multi-context model works against the real database**: one person can be
   Member + Program Participant + Program Facilitator + Venture Founder + LMS
   Learner simultaneously — every join is additive, none mutates the baseline.
2. **Gate bridging is real, not theoretical**: the membership SQL behind the
   converted gates (facilitator console scope included) resolves for a member
   session exactly as designed; the no-context control gets nothing.
3. **Zero unexplained role gates**: the remaining stored-role allowlists are
   fully accounted for (converted or documented deferral).

## Remaining for later phases (unchanged backlog)

Stored `contacts.role` contextual values on staging are still present
(participant ×5, founder ×1, facilitator ×1 from pre-I2 mutations). They are
**no longer load-bearing** (proven by the scan: every gate is converted or
watchlisted-deferred) — the I6D backfill to `member` is the next candidate,
pending explicit approval.
