# Formal gate evidence pack — 6 November 2026

Executed against staging and local UI. Account names, database references,
record identifiers, and screenshots are intentionally omitted from this pack.

## 1. Owner baseline (`BASELINE_CHECKLIST.csv`)

- File updated: `docs/investor-platform/BASELINE_CHECKLIST.csv`
- Two columns (`run_1`, `run_2`) filled from agent browser + API + fixture evidence
- Screenshots omitted to avoid publishing account data.
- **Countersign:** Product owner — sign below after review

```
Owner review of baseline evidence: ______________________  Date: __________
```

## 2. NDA EN/FR + flag

- Migration applied: `src/migrations/20261106_investor_nda_documents.sql`
- Documents seeded: NDA + Terms, versions `DRAFT-2026-11-06`, languages `en`/`fr`, **status=`draft`**
- The feature-flag migration keeps `investor_nda_v1` disabled until legal approval.
- Verify staging flag state before testing the acceptance path.
- UI: `/investor/nda` + API `GET/POST /api/investor/nda`
- Banner warns draft-only; counsel must set `status=approved` and replace body before production reliance

## 3. E2E intro → message → meeting → investment

- Sanitized manifest: `evidence/E2E_MANIFEST.json` (`ok: true`; record identifiers omitted)
- Steps: contact → approved test investor → venture → live deal flow + deck → pipeline → approved introduction → workspace → **message** → confirmed meeting → confirmed investment (`investor_investment_records`)
- UUID investment table migration: `src/migrations/20261106_investor_investment_records_uuid.sql` (legacy bigint `investor_investments` left untouched)

## 4. Email sandbox EN/FR

- Transport: `EMAIL_PRIMARY_PROVIDER=file` → `src/lib/email/fileTransport.js`
- Evidence: `evidence/emails/` (12 captures) + `INDEX.json`
- Types: `investor_intro_{submitted,approved,declined}`, meeting confirmation/reminder, message reminder — **en + fr**
- No Gmail/Resend calls

## 5. Phase 2 / UX study

- A live moderated session was conducted; participant identity and screenshots are omitted.
- SUS session = **80.0** · tasks without help = **89 %** (T3 pitch deck partial)
- High i18n bug on profile logo/past investments: **fixed** during session
- Formal N=5 external investors still open (Guide Ref E.5)
- Earlier proxy pack retained: `evidence/PHASE2_USABILITY_STUDY.md`

## Automated regression

```
npm test -- --testPathPatterns=investor
→ 22 suites / 271 tests previously green; focused suites re-run after investment/NDA changes
```
