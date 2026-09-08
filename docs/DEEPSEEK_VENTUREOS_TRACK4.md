# Venture OS — Sprint 3, Track 4 (Documents, Assets & Transition)

**Branch: `Sprint-3-Track-1`. Do NOT push to `dev` or `main`. Push only to `Sprint-3-Track-1` when done and locally tested.**

Covers Tickets **5.1-5.6** from the spec (numbered "5.x" in the source doc despite being Track 4 — quirk in the original PDF, kept as-is), pages 22-26: Venture Document Vault, File Management, Version History, Document Permissions, Advisor Review, Investor Transition.

Depends only on: Venture Profile schema from Track 1 (`ventures` — live). Runs fully independent of Track 2/3.

## 0. MANDATORY — auth pattern

Same rule as every prior Venture OS batch: every route checks the caller is an active `venture_members` row for the `venture_id` (or a privileged role: `staff, program_manager, super_admin, developer`), else `404`. Additionally for this track: `investor` role callers must ONLY ever see documents where `approval_status = 'shared_with_investor'` — never private/pending/approved-but-unshared documents, and never any document at all if the investor isn't yet linked to this venture (Investor OS linkage doesn't fully exist until Sprint 4 — for now, if a route is ever called with `session.role === 'investor'`, return an empty list rather than guessing at a linkage table that doesn't exist yet; don't build speculative Investor OS integration).

## 1. Schema — already migrated, do not modify shape

`src/migrations/venture_os_track4_documents.sql` already applied.

```sql
CREATE TABLE venture_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general', -- business | legal | financial | investment | brand | general
  folder TEXT,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  approval_status TEXT NOT NULL DEFAULT 'private', -- private | pending_review | approved | shared_with_investor
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venture_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  version_notes TEXT,
  uploaded_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);

CREATE TABLE venture_document_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
  role_scope TEXT NOT NULL, -- founder | team | advisor | administrator | investor
  access_level TEXT NOT NULL DEFAULT 'view', -- view | edit
  UNIQUE(document_id, role_scope)
);

CREATE TABLE venture_document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES contacts(cid),
  comment TEXT,
  decision TEXT, -- comment | approved | revision_requested
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Reuse `src/lib/storage.js` (`uploadFile(bucket, path, file)` / `deleteFile(bucket, path)`) for actual file bytes — do not write a second storage integration.** Use a dedicated bucket, e.g. `"venture-documents"` (confirm the bucket exists in Supabase Storage or create it via the Supabase dashboard/API before testing uploads — check how `src/app/api/upload/route.js` picks its bucket name today and follow the same convention).

## 2. Business rules in scope (36-45)

- Every document belongs to one Venture.
- Documents organized by category (`category` + `folder` columns).
- Every uploaded document supports version history (`venture_document_versions` — on re-upload of the same logical document, insert a new version row, don't overwrite `venture_documents.file_url` directly without also archiving the prior version).
- Previous versions never auto-deleted (`venture_document_versions` rows are never deleted by app code, only `venture_documents.is_deleted` soft-delete on the parent).
- Document permissions configurable (`venture_document_permissions`, default sensible values on upload: founder/team = edit, advisor = view, investor = no row until explicitly shared).
- Advisors review without modifying originals (`venture_document_reviews` — comments/approve/request-revision only, advisors never get `access_level='edit'` by default).
- Investor OS only accesses approved+shared documents (`approval_status = 'shared_with_investor'`).
- Sensitive documents stay private unless explicitly shared (default `approval_status = 'private'` on upload — an explicit action changes it).
- Historical document activity preserved (`venture_document_reviews` never deleted).
- EN/FR everywhere.

## 3. API

- `GET /api/ventures/[id]/documents` (list, optional `?category=`/`?folder=` filter, excludes `is_deleted=true`) + `POST /api/ventures/[id]/documents` (upload — multipart form or base64, call `uploadFile()` from `src/lib/storage.js`, insert `venture_documents` row, insert default `venture_document_permissions` rows for founder/team=edit, advisor=view).
- `PATCH /api/ventures/[id]/documents` (body `{id, ...fields}` — rename, change category/folder, or soft-delete via `is_deleted: true`/restore via `is_deleted: false`).
- `POST /api/ventures/[id]/documents/[docId]/versions` (upload new version — call `uploadFile()` again with a new path, insert `venture_document_versions` row with incremented `version_number`, update `venture_documents.file_url`/`storage_path` to point at the new version while old version rows remain queryable).
- `GET /api/ventures/[id]/documents/[docId]/versions` (list version history).
- `PATCH /api/ventures/[id]/documents/[docId]/permissions` (body `{role_scope, access_level}` — upsert a permission row; only founders or privileged roles may call this).
- `POST /api/ventures/[id]/documents/[docId]/reviews` (advisor adds comment/approval/revision-request) + `GET .../reviews` (history).
- `PATCH /api/ventures/[id]/documents/[docId]/transition` (body `{approval_status}` — moves a document through private → pending_review → approved → shared_with_investor; restrict to founders/privileged roles, not advisors or team members).

## 4. UI

Extend `src/app/participant/ventures/[id]/page.js` with a **Documents** tab: folder/category browser, upload button, per-document version history view, permission editor (founder-only), advisor review panel (visible to advisors — note: advisor role/assignment doesn't exist until Track 5 ships; for now, gate the review UI behind the existing role check pattern used elsewhere, e.g. any `staff`/`teacher` role acting as a stand-in reviewer is acceptable until Track 5's `venture_advisors` table exists — leave a `// TODO Track 5: scope to actual assigned advisor` comment), transition-status badge + action buttons (founder-only).

Reuse `useI18n()`, match existing dark-theme conventions.

## 5. i18n

Extend `venture` namespace with `venture.documents.*` (title, upload, category, folder, versions, permissions, review, approve, requestRevision, transitionStatus, private, pendingReview, approved, sharedWithInvestor).

## 6. Explicitly out of scope

- Actual Investor OS UI/access (Sprint 4) — only the `approval_status` gate on this side.
- Advisor assignment (Track 5) — this track's "advisor" checks are a placeholder gate, not full advisor management.
- Investment Readiness Assessment (Sprint 4, held back).

## 7. Self-testing checklist

- [ ] Upload a document → file lands in Supabase Storage via `uploadFile()`, `venture_documents` row created, default permissions created.
- [ ] Upload a new version of the same document → `venture_document_versions` gets a new row, old version still queryable, nothing deleted.
- [ ] Soft-delete a document (`is_deleted=true`) → disappears from list, still exists in DB.
- [ ] Change document permissions as a founder → persists; attempt as a non-founder team_member → rejected (edit-permission routes are founder/privileged-only per §3).
- [ ] Add advisor review comment/approval → persists, `venture_document_reviews` history grows, original document `file_url` unchanged.
- [ ] Transition a document private → approved → shared_with_investor as a founder → persists; attempt as a team_member → rejected.
- [ ] **Auth**: non-member gets 404 on every new venture-scoped GET endpoint.
- [ ] EN/FR complete, no missing-key fallback text.
- [ ] `npm run build` passes clean.

## 8. Definition of done

Track 4 is complete when every venture has a working Document Vault backed by the existing Supabase Storage helper, version history is preserved on every re-upload, permissions are configurable and founder-gated, advisors can review without altering originals, the transition-status gate correctly restricts what would eventually reach Investor OS, EN/FR complete, `npm run build` clean.
