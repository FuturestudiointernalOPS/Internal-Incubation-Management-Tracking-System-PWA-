# Roadmap Phase 0 — Stabilize & Ratify (ops checklist + decision log)

Status: code-side steps executed (push ✅, local .env.staging flags ✅). Host
steps remain with the ops owner. Committed brief for traceability.

## 1. Backup — DONE

`origin/G` fast-forwarded `c91b8c79..0cb98b9b` (13 commits: I1 → defect batch 2).
All program work is now on the shared remote.

## 2. Staging flags — partially done

Code is flag-gated (default OFF). Local `.env.staging` (gitignored) now has:

```
IDENTITY_STOP_ROLE_MUTATION=1
IDENTITY_DERIVE_LEGACY_ROLE=1
```

**Remaining (host, ops owner):** set the same two variables in the staging
hosting environment (Vercel/Netlify/etc. dashboard) — local `.env.staging`
only affects local runs. Until the host has them, the 7 reclassified accounts
keep partial access.

## 3. Re-login the 7 reclassified accounts (ops owner, after host flags)

Contacts backfilled to `member` in 6D (existing sessions keep their old role
copy until expiry; re-login picks up the derived role):

| cid | former role | now derives to |
|---|---|---|
| USR_9ED327DED39F | facilitator | participant (has program + staff row; facilitator surface works via assignment gates) |
| USR_YYWZ9P9ITVH | founder | founder (venture owner) |
| USR_AAD66BA71667 | participant | participant |
| USR_178101C62C99 | participant | participant |
| USR_E3B5980170A5 | participant | member (no active memberships) |
| USR_CZ175WJ1005 | participant | participant |
| USR_9D96EDF2DB58 | participant | participant |

## 4. Manual QA checklist (1 hour, after flags + re-login)

- [ ] Facilitator account: login → facilitator console → program list shows only assigned program → attendance/submissions screens load
- [ ] Founder account: login → venture area → roster + venture pages load
- [ ] Participant account: login → participant dashboard → own submissions/attendance visible; other people's ids return 403/empty
- [ ] Context switcher visible; baseline chip = Member; badges show contexts
- [ ] Member account (no contexts): lands on member workspace, no contexts listed

## 5. Decision log (defaults applied during I1–I6 — ratify or override)

| Code | Decision | Applied default | Needs confirmation? |
|---|---|---|---|
| C1 (D1A) | Teacher = contextual program-staff role | A | ratify |
| C2 (D2A) | Program Manager = Staff-only | A | ratify |
| C3 (D3A) | Legacy stored contextual roles backfilled at I6 | A — executed | ratify |
| C4 | Developer may mutate venture rosters + pass programs.edit | allowed | **explicit confirmation** |
| C5 | Upload-bucket + AI-operator eligibility unchanged | unchanged | **explicit confirmation** |

## 6. Next

Phase 1 (watchlist conversions) begins after host flags + QA + C4/C5 answers.
