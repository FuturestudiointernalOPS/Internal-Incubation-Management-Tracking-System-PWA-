# WS5 — Venture Data Room audit and implementation plan

Status: **audit complete; the agreed corrections and the access journal are applied**
Branch inspected: `Ventures` after the access-journal and upload-check corrections
Scope: `src/app/api/ventures/[id]/data-room/**`, `src/services/ventures/dataRoom/**`,
`src/models/ventureDataRoomStore.js`, `src/lib/dataRoom.js`, `src/lib/ventureEvidence.js`,
`src/components/ventures/data-room/**`, and the four screens that mount the Data Room.

No database was written to during this audit. Findings are from static inspection and the
existing test suite; live-data checks used the read-only audit runner against `.env.local`
(aggregate counts only). Storage-bucket checks remain *unable to verify*.

---

## 1. What already exists (reuse map)

| Concern | Existing implementation | Reuse verdict |
|---|---|---|
| Document table | `venture_documents` (the original pitch-deck / data-room table) | Reuse — no new table |
| Version table | `venture_document_versions` | Reuse — no new table |
| File storage | private `deliverable-evidence` bucket, `data-room/<venture>/<category>/` prefix | Reuse |
| Signed reads | `signEvidencePath` / `withSignedUrl` (1-hour URLs) | Reuse |
| Vocabulary | `src/lib/dataRoom.js` — 11 categories, 5 statuses, 4 requirement levels, stage matrix | Reuse |
| Catalogue and requirements | `dataRoom/access.js` (`buildDataRoom`, `loadDataRoomRequirements`, `computeDataRoomCompleteness`) | Reuse |
| Writes | `dataRoom/documents.js` (create, replace, review, metadata, delete) | Reuse |
| Investor grants and requirement config | `dataRoom/grants.js` | Reuse |
| Readiness | `dataRoom/readiness.js` (batch + single, same engine) | Reuse — WS4 canonical |
| Schema | `ensureDataRoomSchema` (additive, idempotent) | Reuse |
| Audit | `venture_activity_log` (`DATA_ROOM*` actions) | Reuse — no new table |
| Access log table | `venture_document_access_logs` exists | Reuse — currently no writer |
| UI | one shared `VentureDataRoom` mounted by founder, staff, Super Admin and investor | Reuse |
| Tests | `src/__tests__/ventures/data-room.test.js`, `data-room-writes.test.js`, `data-room-postgres.integration.test.js`, `ws4-readiness.test.js` | Extend, do not replace |

No duplicate document table, storage system or readiness formula is needed.

---

## 2. Findings

Status values: **working** · **incomplete** · **correction** · **missing** · **unable to verify**.

### 2.1 Upload and storage — working, one correction

* The upload route requires `canManage`, writes to the private bucket, and returns only the
  storage path. `createDataRoomDocument` re-validates the path belongs to the Venture.
* **DR-01 — applied:** the upload route validates the category before writing any bytes,
  and an early refusal in the catalogue step removes the object the upload step already
  stored. A refused create no longer leaves an orphan.

### 2.2 Categories and metadata — working

* Eleven categories, title, description, expiry, version notes, and metadata editing.
* A document whose category is outside the eleven is kept, badged **Legacy**, and excluded
  from completeness until it is re-filed. Re-filing is the existing Edit action and does
  not create a version (pinned by a new WS4 test).
* **DR-02 — applied:** the category sidebar now shows a **Legacy documents** lens with a
  count when any legacy row exists. It reuses the catalogue read and the existing Edit
  action; no new storage or category was created. The live read-only audit found **0**
  legacy documents at the moment of inspection, so the lens is dormant until one appears.

### 2.3 Search and filtering — working

* Server-side `category`, `status`, `search` (title, description, file name) and
  client-side filtering of the loaded list. Investors get the same search over their
  granted subset only.

### 2.4 Version history — working

* Every version is listed with its signed URL, size, author, date and notes.
* A new version resets the review state and clears the reviewer fields, so version 2 never
  inherits version 1's verification. The first upload is version 1.
* Version restore is not offered; viewing and downloading previous versions is. That meets
  “access previous versions where permitted”.

### 2.5 Review and verification — working, one gap in history

* States: `uploaded` → `under_review` → `verified` / `rejected`; `expired` is derived on
  read from `expires_at` without rewriting the stored decision.
* A rejection requires a reason. The reviewed version is recorded, and the decision is
  written to `venture_activity_log`.
* **DR-03 (incomplete):** the document holds only the latest review notes; earlier feedback
  is visible only as audit events, not in the review dialog. Add a read of the existing
  `DATA_ROOM_DOCUMENT_*` audit rows to the review/versions dialog. No new table.

### 2.6 Stage-based requirements — working

* Requirements are seeded from the Venture's stage, roll forward when the stage changes,
  and a deliberately customized level is never overwritten.
* Levels: `required`, `recommended`, `conditional`, `not_applicable`. Only `required`
  categories enter the completeness denominator.
* Reviewers (Super Admin, or staff with the review capability) can change a level.

### 2.7 Completeness — working

* One engine: `computeDataRoomCompleteness` (required categories only; verified 1,
  rejected 0.5, everything else 0; `null` when nothing is required).
* Batch and single-Venture readers feed the same engine and are pinned by
  `ws4-readiness.test.js`.
* **DR-04 — applied:** the investment analytics document count now excludes
  soft-deleted rows.

### 2.8 Permissions — working, two corrections

* Super Admin: view, manage, review. Founder/owner: view, manage. Other member: view.
  Assigned staff: view, plus manage/review only with the matching `documents.*` capability.
  Investor: view only, and only the granted documents/categories.
* Every service re-resolves the viewer; UI visibility is never the gate. The document and
  version reads are resolved through the Venture and the live grant.
* **DR-05 — applied:** both grant reads now return an `is_expired` flag, and the access
  dialog shows **Expired** (with the expiry date) instead of “no expiry”. The read path
  already refused expired grants; revocation remains available. Live audit: **0** live
  grants, of which 0 expired.
* **DR-06 (unable to verify):** bucket policy and signed-URL behaviour can only be
  confirmed against staging/production. Verify with a private-path read and an unauthenticated
  request.

### 2.9 Investor sharing and revocation — working

* Grants target a real contact holding an investor profile, cover one document or one
  category, are read-only, can expire, are unique while live, and are revoked with an audit
  row. Removal takes effect on the next read.
* **DR-05** above applies to the presentation of expired grants.
* **DR-07 (incomplete):** access is granted per person only; there is no bulk “share the
  whole room” and no automatic expiry notification. Neither is required by the brief; do
  not add without a product decision.

### 2.10 Audit history — incomplete (gap to approve)

Live read-only check: the access-log table holds **0 rows**, confirming that the Data Room
never writes view/download events today.

* Written today: upload, new version, review decision, metadata/reclassification, delete,
  grant, revoke, requirement change. Read is the latest 200 rows; the screen shows 12.
* **DR-08 — applied:** the Data Room now records an explicit `view` when a document is
  opened and a `download` when a file (current or historical) is downloaded. The viewer is
  re-validated server-side against the same grant rule; the write is best-effort and never
  blocks the file. The journal is shown to managers/reviewers as **Consultations and
downloads**, and it feeds the analytics counters.
* **DR-09 — applied:** the analytics counters now join through the document, so they no
  longer depend on the journal's Venture key (which stores the readable code).
* **DR-10 — applied:** both the activity log and the access journal offer **Show all**
  from the rows already returned (up to 200). No pagination was added.

### 2.11 Integration with venture operations — working, one cleanup

* The Data Room reuses `venture_documents` / `venture_document_versions`; it does not
  duplicate milestones, tasks, users or fundraising records.
* Dashboard recent documents and analytics read the same table.
* **DR-11 — applied:** the founder workspace no longer carries the dead legacy documents
  state, fetches or handlers, and the unreferenced legacy documents component was deleted.
  The legacy API itself is untouched, so any remaining caller keeps working.
* **DR-12 (missing, deliberately deferred):** Data Room documents are not linked to a
  milestone, deliverable or fundraising round. The brief says “where relevant”; no current
  screen needs the link. Do not add a join table without approval.

### 2.12 Language parity — working

* `src/locales/en/dataRoom.json` and `fr/dataRoom.json` have identical key sets (verified).
* Every Data Room string goes through `t()`. Visual confirmation in both languages requires
  a running app and is part of the manual test plan.

---

## 3. Proposed WS5 implementation plan

Ordered, smallest safe change first. **No database migration is proposed.** DR-08 reuses an
existing table.

### Phase A — corrections (no new capability)

**Applied:**

* **DR-05** derived expiry for grants in the two grant reads; access dialog shows
  “Expired” and still allows revoke.
* **DR-11** removed the dead legacy document state/handlers from the founder page.
* **DR-02** added the **Legacy documents** lens and count.
* **DR-04** excluded soft-deleted documents from the analytic count.
* **DR-09** counted the journal through the document.
* **DR-01** validated the category before storage and cleaned up early refusals.
* **DR-10** added **Show all** to both journals.

The Data Room’s empty state now carries the upload action in its centre when the room has
no documents; the header action remains once documents exist.

### Phase B — audit extension (applied)

8. **DR-08 — applied.** `view` / `download` rows are written to the existing access-log
   table; the download event goes through an explicit server-side action before the signed
   URL is opened. No schema change.

### Phase C — tests

**Applied in this round:** `data-room.test.js` covers the `is_expired` grant flag, the
legacy-category classification, and the manager’s view of an expired grant;
`data-room-writes.test.js` covers the access-journal write/refusal rules; `ws4-readiness`
covers the access counters and the soft-delete exclusion.

**Still proposed:**

* Upload category refusal and orphan cleanup.
* Expired grant: refused on read, shown as expired, revocable.
* Legacy filter: legacy document appears, is excluded from completeness, and disappears
  from the legacy filter after reclassification.
* Access log: view/download rows are written and counted; wrong Venture gets 404.
* Unauthorized attempts: no session (401), non-member (404), investor without grant (404),
  investor reading another Venture's document (404), founder of another Venture (404).
* Analytics count ignores soft-deleted documents.
* English/French parity and production build.

### Phase D — staging acceptance (manual, read-only observations where possible)

1. Founder: list, upload, replace, metadata edit, version download.
2. Staff/lead manager: review to under-review, verify, reject with reason, requirement edit.
3. Investor: grant a document and a category, open them, revoke, wait for/force expiry,
   confirm the catalogue shrinks.
4. Super Admin: directory readiness agrees with the Data Room percentage and the investment
   page.
5. Legacy: re-file an old `business_plan` row and confirm completeness moves only after
   verification.

---

## 4. Risks and decisions needed

1. **DR-08 approval** — it adds audit rows on reads. It is additive and uses an existing
   table, but it changes write volume and should be accepted explicitly.
2. **Storage verification** — signed URLs and bucket privacy must be checked on staging
   before promotion; a green unit test cannot prove bucket policy.
3. **Legacy document set** — reclassification is manual by design. The audit can identify
   the obsolete categories read-only but will not rewrite them automatically.
4. **No migrations** — this plan needs none. If DR-12 (document ↔ milestone linkage) is
   wanted later, it needs a schema decision and separate approval.
