-- ═══════════════════════════════════════════════════════════════════════════
-- REPAIR — "Unknown" contact names (Forms / Assignments)
--
-- This file contains four sections. Run them IN ORDER, manually, in your
-- database management tool:
--
--   [0] SCHEMA CHECK     — confirm the columns exist (read-only)
--   [1] PREVIEW          — see exactly what WOULD change (read-only)
--   [2] APPLY            — transactional update, reviewable before COMMIT
--   [3] VERIFICATION     — confirm the result after applying (read-only)
--
-- SAFETY CONTRACT
--   * Only contacts.name is modified — nothing else.
--   * Only contacts whose name is a placeholder ("Unknown", "Anonymous",
--     "N/A", "None", "Participant", "null", "undefined", dashes, empty)
--     are candidates.
--   * A replacement name is proposed ONLY when a confident candidate can be
--     extracted from the person's own form submissions (full-name field,
--     first+last fields, or a bare "Name" field) using the same field-label
--     rules the application uses (src/lib/email.js resolvePersonName).
--   * No emails, CIDs, roles, assignments, programs or groups are touched.
--   * No records are deleted. Unresolvable contacts are listed separately
--     and left unchanged.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- [0] SCHEMA CHECK (read-only)
-- Run this first. Every column listed below is used by the repair queries.
-- If any row is missing, stop and re-check before continuing.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN (
        'platform_form_run_assignments', 'contacts', 'families',
        'v2_programs', 'platform_form_submissions', 'platform_form_runs',
        'platform_form_fields'
      )
  AND column_name IN (
        'id', 'cid', 'name', 'email', 'target_id', 'target_type',
        'registration_id', 'submitter_id', 'data', 'form_id', 'label',
        'run_id', 'deleted'
      )
ORDER BY table_name, column_name;


-- ═══════════════════════════════════════════════════════════════════════════
-- [1] PREVIEW — read-only, changes NOTHING
--
-- 1a. Current placeholder-name counts (baseline)
-- 1b. Proposed repairs: cid / email / current name / proposed name / source
-- 1c. Unresolved placeholder contacts that will be LEFT UNCHANGED
-- ═══════════════════════════════════════════════════════════════════════════
-- [2] APPLY — ONE atomic UPDATE statement (no temp table).
--
-- Paste this ENTIRE statement and run it as a single query. It is atomic:
-- either every repair is applied, or nothing changes — so it works even in
-- tools that execute statements one-by-one or across pooled connections.
--
-- Optional: to leave a specific contact unchanged, uncomment the exclusion
-- line inside the to_update CTE and list its cid(s).
-- ═══════════════════════════════════════════════════════════════════════════

WITH generic_contacts AS (
  SELECT cid, name, email
  FROM contacts
  WHERE deleted = 0
    AND (LOWER(name) IN ('unknown','anonymous','n/a','none','participant','null','undefined')
         OR name ~ '^[-]+$'
         OR TRIM(name) = '')
),
field_candidates AS (
  SELECT
    ps.submitter_id AS cid,
    ps.id AS submission_id,
    ps.updated_at,
    COALESCE(f.label, kv.key) AS effective_label,
    kv.value
  FROM platform_form_submissions ps
  JOIN platform_form_runs r ON ps.run_id = r.id
  CROSS JOIN LATERAL jsonb_each_text(ps.data) kv
  LEFT JOIN platform_form_fields f
    ON f.form_id::text = r.form_id::text
   AND f.id::text = kv.key
  WHERE ps.status <> 'draft'
    AND TRIM(kv.value) <> ''
    AND kv.value NOT LIKE '%@%'
    AND kv.value NOT LIKE '{%'
    AND kv.value NOT LIKE '[%'
),
per_submission AS (
  SELECT
    cid,
    submission_id,
    updated_at,
    MAX(value) FILTER (WHERE effective_label ~*
      '^(fulls*name|fullname|noms+complet|prenoms*ets*nom|pr[eé]noms*ets*nom|noms*ets*pr[eé]nom|noms*&s*pr[eé]nom)$') AS full_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '(first|given|pr[eé]nom|prenom)') AS first_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '(last|surname|family)' OR effective_label ~*
      '^(nom|noms+des+famille)$') AS last_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '^name$') AS bare_name
  FROM field_candidates
  GROUP BY cid, submission_id, updated_at
),
candidate_list AS (
  SELECT
    cid,
    submission_id,
    updated_at,
    TRIM(COALESCE(full_name, CONCAT_WS(' ', first_name, last_name), bare_name)) AS candidate,
    CASE
      WHEN full_name IS NOT NULL THEN 'full-name field'
      WHEN first_name IS NOT NULL THEN 'first + last name fields'
      ELSE 'bare "name" field'
    END AS source,
    CASE
      WHEN full_name IS NOT NULL THEN 1
      WHEN first_name IS NOT NULL THEN 2
      ELSE 3
    END AS priority
  FROM per_submission
  WHERE COALESCE(full_name, CONCAT_WS(' ', first_name, last_name), bare_name) IS NOT NULL
),
validated AS (
  SELECT
    cid,
    candidate,
    source,
    submission_id,
    ROW_NUMBER() OVER (PARTITION BY cid ORDER BY priority ASC, updated_at DESC) AS rn
  FROM candidate_list
  WHERE candidate !~*
        '^(unknown|anonymous|n/a|none|participant|test|null|undefined|-+|s*)$'
    AND candidate ~ '^[A-Za-zÀ-ÖØ-öø-ÿ''-.s]+$'
    AND LENGTH(candidate) >= 3
    AND (candidate ~ 's' OR LENGTH(candidate) >= 8)
),
to_update AS (
  SELECT c.cid, v.candidate AS proposed_name
  FROM generic_contacts c
  JOIN validated v ON v.cid = c.cid AND v.rn = 1
  -- OPTIONAL — leave a contact unchanged (uncomment and add its cid):
  -- AND c.cid NOT IN ('CID_ONE', 'CID_TWO')
)
UPDATE contacts c
SET name = t.proposed_name
FROM to_update t
WHERE c.cid = t.cid;

-- After running the statement above, run section [3a] (expect 0 rows) and
-- section [3c] (assignment resolution) to confirm the result.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Step 1 — Build the candidate list (temp table, dropped at commit/rollback)
CREATE TEMP TABLE repair_candidates ON COMMIT DROP AS
WITH generic_contacts AS (
  SELECT cid, name, email
  FROM contacts
  WHERE deleted = 0
    AND (LOWER(name) IN ('unknown','anonymous','n/a','none','participant','null','undefined')
         OR name ~ '^[-]+$'
         OR TRIM(name) = '')
),
field_candidates AS (
  SELECT
    ps.submitter_id AS cid,
    ps.id AS submission_id,
    ps.updated_at,
    COALESCE(f.label, kv.key) AS effective_label,
    kv.value
  FROM platform_form_submissions ps
  JOIN platform_form_runs r ON ps.run_id = r.id
  CROSS JOIN LATERAL jsonb_each_text(ps.data) kv
  LEFT JOIN platform_form_fields f
    ON f.form_id::text = r.form_id::text
   AND f.id::text = kv.key
  WHERE ps.status <> 'draft'
    AND TRIM(kv.value) <> ''
    AND kv.value NOT LIKE '%@%'
    AND kv.value NOT LIKE '{%'
    AND kv.value NOT LIKE '[%'
),
per_submission AS (
  SELECT
    cid,
    submission_id,
    updated_at,
    MAX(value) FILTER (WHERE effective_label ~*
      '^(full\s*name|fullname|nom\s+complet|prenom\s*et\s*nom|pr[eé]nom\s*et\s*nom|nom\s*et\s*pr[eé]nom|nom\s*&\s*pr[eé]nom)$') AS full_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '(first|given|pr[eé]nom|prenom)') AS first_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '(last|surname|family)' OR effective_label ~*
      '^(nom|nom\s+de\s+famille)$') AS last_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '^name$') AS bare_name
  FROM field_candidates
  GROUP BY cid, submission_id, updated_at
),
candidate_list AS (
  SELECT
    cid,
    submission_id,
    updated_at,
    TRIM(COALESCE(full_name, CONCAT_WS(' ', first_name, last_name), bare_name)) AS candidate,
    CASE
      WHEN full_name IS NOT NULL THEN 'full-name field'
      WHEN first_name IS NOT NULL THEN 'first + last name fields'
      ELSE 'bare "name" field'
    END AS source,
    CASE
      WHEN full_name IS NOT NULL THEN 1
      WHEN first_name IS NOT NULL THEN 2
      ELSE 3
    END AS priority
  FROM per_submission
  WHERE COALESCE(full_name, CONCAT_WS(' ', first_name, last_name), bare_name) IS NOT NULL
),
validated AS (
  SELECT
    cid,
    candidate,
    source,
    submission_id,
    ROW_NUMBER() OVER (PARTITION BY cid ORDER BY priority ASC, updated_at DESC) AS rn
  FROM candidate_list
  WHERE candidate !~*
        '^(unknown|anonymous|n\/a|none|participant|test|null|undefined|\-+|\s*)$'
    AND candidate ~ '^[A-Za-zÀ-ÖØ-öø-ÿ''\-.\s]+$'
    AND LENGTH(candidate) >= 3
    AND (candidate ~ '\s' OR LENGTH(candidate) >= 8)
)
SELECT
  c.cid,
  c.email,
  c.name AS current_name,
  v.candidate AS proposed_name,
  'submission #' || v.submission_id || ' — ' || v.source AS source
FROM generic_contacts c
JOIN validated v ON v.cid = c.cid AND v.rn = 1;

-- Step 2 — REVIEW: exactly what will change (read-only)
SELECT * FROM repair_candidates ORDER BY email;

-- Step 3 — Apply the repair (only contacts.name, only the reviewed rows)
UPDATE contacts c
SET name = r.proposed_name
FROM repair_candidates r
WHERE c.cid = r.cid;

-- Step 4 — Verify inside the transaction (expect 0 rows, or only the rows
--          you intentionally left unresolved)
SELECT cid, name, email
FROM contacts
WHERE LOWER(name) IN ('unknown','anonymous','n/a','none','participant','null','undefined')
   OR name ~ '^[-]+$'
   OR TRIM(name) = '';

-- Step 5 — DECISION:
COMMIT;      -- keep the repair (default)
-- ROLLBACK; -- undo the repair (uncomment this and comment the line above)


-- ═══════════════════════════════════════════════════════════════════════════
-- [3] VERIFICATION — run after the APPLY, read-only
--
-- 3a. Remaining placeholder-name contacts (expect none / only unresolved)
-- 3b. Contacts repaired (name now matches a submission-derived candidate)
-- 3c. Assignment resolution check (user / group / program names)
-- ═══════════════════════════════════════════════════════════════════════════

-- 3a. Remaining placeholders ────────────────────────────────────────────────
SELECT LOWER(name) AS placeholder_name, COUNT(*) AS count
FROM contacts
WHERE deleted = 0
  AND (LOWER(name) IN ('unknown','anonymous','n/a','none','participant','null','undefined')
       OR name ~ '^[-]+$'
       OR TRIM(name) = '')
GROUP BY 1
ORDER BY count DESC;


-- 3b. Repaired records — contacts whose current name equals a
--     submission-derived candidate (the repair's handiwork) ─────────────────
WITH field_candidates AS (
  SELECT
    ps.submitter_id AS cid,
    ps.id AS submission_id,
    COALESCE(f.label, kv.key) AS effective_label,
    kv.value
  FROM platform_form_submissions ps
  JOIN platform_form_runs r ON ps.run_id = r.id
  CROSS JOIN LATERAL jsonb_each_text(ps.data) kv
  LEFT JOIN platform_form_fields f
    ON f.form_id::text = r.form_id::text
   AND f.id::text = kv.key
  WHERE ps.status <> 'draft'
    AND TRIM(kv.value) <> ''
    AND kv.value NOT LIKE '%@%'
    AND kv.value NOT LIKE '{%'
    AND kv.value NOT LIKE '[%'
),
per_submission AS (
  SELECT
    cid,
    submission_id,
    MAX(value) FILTER (WHERE effective_label ~*
      '^(full\s*name|fullname|nom\s+complet|prenom\s*et\s*nom|pr[eé]nom\s*et\s*nom|nom\s*et\s*pr[eé]nom|nom\s*&\s*pr[eé]nom)$') AS full_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '(first|given|pr[eé]nom|prenom)') AS first_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '(last|surname|family)' OR effective_label ~*
      '^(nom|nom\s+de\s+famille)$') AS last_name,
    MAX(value) FILTER (WHERE effective_label ~*
      '^name$') AS bare_name
  FROM field_candidates
  GROUP BY cid, submission_id
),
candidate_list AS (
  SELECT
    cid,
    TRIM(COALESCE(full_name, CONCAT_WS(' ', first_name, last_name), bare_name)) AS candidate
  FROM per_submission
  WHERE COALESCE(full_name, CONCAT_WS(' ', first_name, last_name), bare_name) IS NOT NULL
),
validated AS (
  SELECT DISTINCT cid, candidate
  FROM candidate_list
  WHERE candidate !~*
        '^(unknown|anonymous|n\/a|none|participant|test|null|undefined|\-+|\s*)$'
    AND candidate ~ '^[A-Za-zÀ-ÖØ-öø-ÿ''\-.\s]+$'
    AND LENGTH(candidate) >= 3
    AND (candidate ~ '\s' OR LENGTH(candidate) >= 8)
)
SELECT c.cid, c.email, c.name AS current_name, v.candidate AS derived_name
FROM contacts c
JOIN validated v ON v.cid = c.cid
WHERE c.name = v.candidate
ORDER BY c.email;


-- 3c. Assignment resolution check (read-only) ────────────────────────────────
-- Shows every run assignment with the name the new server-side enrichment
-- will display: user → contact name/email, group → family name,
-- program → program name.
SELECT
  a.id AS assignment_id,
  a.run_id,
  r.name AS run_name,
  a.target_type,
  a.target_id,
  COALESCE(c.name, c.email, f.name, p.name, a.target_id) AS resolved_name,
  c.email AS contact_email,
  f.name AS group_name,
  p.name AS program_name
FROM platform_form_run_assignments a
LEFT JOIN platform_form_runs r ON a.run_id = r.id
LEFT JOIN LATERAL (
  SELECT c2.cid, c2.name, c2.email
  FROM contacts c2
  WHERE c2.cid = a.target_id OR LOWER(c2.email) = LOWER(a.target_id)
  LIMIT 1
) c ON a.target_type = 'user'
LEFT JOIN LATERAL (
  SELECT f2.name
  FROM families f2
  WHERE f2.registration_id = a.target_id OR f2.id::text = a.target_id
  LIMIT 1
) f ON a.target_type = 'group'
LEFT JOIN LATERAL (
  SELECT p2.name
  FROM v2_programs p2
  WHERE p2.id::text = a.target_id
  LIMIT 1
) p ON a.target_type = 'program'
ORDER BY a.run_id, a.id;
