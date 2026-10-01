/**
 * Platform — the CSV/XLSX import (SERVICE layer).
 *
 * The domain work behind `/api/platform/import/{preview,execute,review-flags}`:
 * the file parsing and column→question fuzzy matching (preview), the lookup-first
 * contact resolution and the row loop (execute), and the identity-review flag
 * read/write. The CONTROLLER keeps `initDb`, the `super_admin` gate, the body
 * parsing and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { parseCSVRows } from "@/lib/csv";
import { resolveSubmissionEmail } from "@/lib/email";
import {
  accumulateImportBatchCounts,
  createImportBatch,
  createImportReviewFlag,
  createPlatformFormSubmission,
  ensureImportBatchesTable,
  ensureImportReviewFlagsTable,
  findContactByCidForImport,
  findContactByLowerEmailForImport,
  findContactByPhoneForImport,
  findPreviousImportBatch,
  findSubmissionByRunAndSubmitter,
  getFormFieldLabels,
  getFormFieldsForPreview,
  getFormRunByIdForImport,
  getFormRunByIdForPreview,
  getPlatformFormById,
  listImportReviewFlags,
  selectAllContactsForImport,
  updateImportReviewFlagStatus,
  upsertImportedContact,
} from "@/models/platformImport";

// ── Preview: parse + fuzzy match ────────────────────────────────────────────

function parseCSV(text) {
  // RFC 4180-aware: quoted cells may contain commas and embedded newlines, so
  // logical rows are derived from the parser, never from physical lines.
  const grid = parseCSVRows(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = (grid[0] || []).map((header) => header.trim());
  const rows = [];
  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const cells = grid[rowIndex];
    if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) continue;
    const row = {};
    headers.forEach((header, columnIndex) => {
      row[header] = cells[columnIndex] !== undefined ? cells[columnIndex].trim() : "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Accept either legacy CSV text or normalized headers + rows (both CSV and XLSX
 * arrive from the client as the same row-object shape). Returns the canonical
 * { headers, rows } used by the rest of the preview flow.
 */
function normalizeInput({ csv_text, headers, rows }) {
  if (Array.isArray(rows) && rows.length > 0) {
    const headerList =
      Array.isArray(headers) && headers.length > 0 ? headers : Object.keys(rows[0] || {});
    const normalizedRows = rows.map((sourceRow) => {
      const row = {};
      headerList.forEach((header) => {
        row[header] = sourceRow[header] != null ? String(sourceRow[header]).trim() : "";
      });
      return row;
    });
    return { headers: headerList, rows: normalizedRows };
  }
  return parseCSV(csv_text || "");
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function wordOverlapScore(colName, fieldLabel) {
  const colTokens = new Set(tokenize(colName));
  const labelTokens = tokenize(fieldLabel);
  if (labelTokens.length === 0) return 0;
  let matches = 0;
  for (const token of labelTokens) {
    if (colTokens.has(token)) matches++;
  }
  return matches / labelTokens.length;
}

export function fuzzyMatchColumns(columns, fields) {
  const mapping = {};
  const usedFields = new Set();

  for (const column of columns) {
    let bestField = null;
    let bestScore = 0;

    for (const field of fields) {
      if (usedFields.has(field.id)) continue;
      const score = wordOverlapScore(column, field.label);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }

    if (bestField && bestScore >= 0.4) {
      mapping[column] = bestField.id;
      usedFields.add(bestField.id);
    }
  }

  const unmatched = columns.filter((column) => !mapping[column]);
  return { mapping, unmatched };
}

/**
 * Build the import preview: resolve the run's authoritative form, fetch its
 * questions, fuzzy-match the file's columns to them and return the suggested
 * mapping plus a sample of rows.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function buildImportPreview({
  csv_text,
  headers: inputHeaders,
  rows: inputRows,
  form_id,
  run_id,
  total_rows,
}) {
  if (!csv_text || (!form_id && !run_id)) {
    return {
      status: 400,
      body: { success: false, error: "csv_text and form_id (or run_id) are required" },
    };
  }

  // Parse the file payload — legacy CSV text or normalized headers+rows
  // (CSV and XLSX both arrive pre-parsed from the client in row form).
  let parsed;
  try {
    parsed = normalizeInput({ csv_text, headers: inputHeaders, rows: inputRows });
  } catch (error) {
    return { status: 400, body: { success: false, error: "Failed to parse file: " + error.message } };
  }

  // ── Resolve the authoritative form by tracing Run → Form ──
  // When a run is selected, its form is the single source of truth — the
  // client-passed form_id is ignored so questions can never come from a
  // different form than the run being imported into.
  let effectiveFormId = form_id != null ? String(form_id) : null;
  let runInfo = null;
  let formInfo = null;

  if (run_id) {
    const runResult = await getFormRunByIdForPreview(run_id);
    if (runResult.rows.length === 0) {
      return { status: 404, body: { success: false, error: "Selected run not found" } };
    }
    runInfo = runResult.rows[0];
    effectiveFormId = String(runInfo.form_id);
  }

  if (!effectiveFormId) {
    return { status: 400, body: { success: false, error: "Could not determine the form" } };
  }

  const formResult = await getPlatformFormById(effectiveFormId);
  if (formResult.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Form not found for the selected run" } };
  }
  formInfo = formResult.rows[0];

  // ── Fetch THIS form's questions AND their configured answer options ──
  const fieldsResult = await getFormFieldsForPreview(effectiveFormId);

  const formFields = fieldsResult.rows.map((formField) => {
    let options = null;
    if (formField.options) {
      try {
        options = typeof formField.options === "string" ? JSON.parse(formField.options) : formField.options;
      } catch (_) {
        options = null;
      }
    }
    return {
      id: formField.id,
      label: formField.label,
      field_type: formField.field_type,
      options: Array.isArray(options) ? options : null,
      required: !!formField.required,
    };
  });

  // Fuzzy match
  const { mapping, unmatched } = fuzzyMatchColumns(parsed.headers, formFields);

  // Build suggested mapping array for response
  const suggestedMapping = parsed.headers.map((column) => ({
    csv_column: column,
    field_id: mapping[column] || null,
    field_label: mapping[column]
      ? formFields.find((formField) => formField.id === mapping[column])?.label || ""
      : "",
  }));

  // Preview rows (first 5)
  const previewRows = parsed.rows.slice(0, 5);

  return {
    status: 200,
    body: {
      success: true,
      form: { id: formInfo.id, name: formInfo.name },
      run: runInfo ? { id: runInfo.id, name: runInfo.name } : null,
      form_fields: formFields,
      form_field_count: formFields.length,
      csv_columns: parsed.headers,
      suggested_mapping: suggestedMapping,
      unmatched,
      preview_rows: previewRows,
      // Chunked clients send only a sample of the CSV but know the real count;
      // prefer their number so the UI shows the actual row total.
      total_rows:
        Number.isFinite(Number(total_rows)) && Number(total_rows) > parsed.rows.length
          ? Number(total_rows)
          : parsed.rows.length,
    },
  };
}

// ── Execute: contact resolution + the row loop ──────────────────────────────

export function sortNameTokens(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function fileHash(csvRows) {
  try {
    return crypto.createHash("sha256").update(JSON.stringify(csvRows)).digest("hex").substring(0, 24);
  } catch (_) {
    return "hash-" + Date.now().toString(36);
  }
}

/**
 * Resolve the applicant email for one imported row using the exact same rules
 * as the Run view (resolveSubmissionEmail — label-aware, EN/FR, placeholder-safe):
 *   1. the form's email question value,
 *   2. any other real email in the row,
 *   3. the explicit _email column mapping.
 * Returns "" when the row genuinely has no real email — only then is the
 * import placeholder (import-…@placeholder.impactos.local) used.
 */
function resolveRowEmail(row, mapping, fieldLabels) {
  const rowData = {};
  for (const csvCol of Object.keys(row)) {
    const fieldId = mapping[csvCol];
    if (fieldId && !String(fieldId).startsWith("_")) {
      rowData[String(fieldId)] = row[csvCol];
    }
  }
  const emailKey = Object.keys(mapping).find((key) => mapping[key] === "_email");
  const explicitEmail = emailKey && row[emailKey] != null ? String(row[emailKey]) : "";
  return resolveSubmissionEmail({
    submissionData: rowData,
    fieldLabels,
    contactEmail: explicitEmail,
  });
}

export async function resolveContact(row, mapping, email) {
  // 1. CRM ID (degrade gracefully if column missing)
  const crmIdField = Object.keys(mapping).find((key) => mapping[key] === "_crm_id");
  if (crmIdField && row[crmIdField]) {
    try {
      const contactResult = await findContactByCidForImport(row[crmIdField]);
      if (contactResult.rows.length > 0) return { contact: contactResult.rows[0], method: "crm_id", uncertain: false };
    } catch (_) {}
  }

  // 2. Email (exact, lowercase) — resolved upstream with the same label-aware,
  // placeholder-safe logic as the Run view, so it matches whether the column
  // was mapped to _email or to the form's email question.
  if (email) {
    const contactResult = await findContactByLowerEmailForImport(email);
    if (contactResult.rows.length > 0) return { contact: contactResult.rows[0], method: "email", uncertain: false };
  }

  // 3. Phone (normalized)
  const phoneField = Object.keys(mapping).find(
    (key) =>
      mapping[key] === "_phone" ||
      (typeof mapping[key] === "string" &&
        (mapping[key].toLowerCase().includes("phone") ||
          mapping[key].toLowerCase().includes("telephone")))
  );
  if (phoneField && row[phoneField]) {
    const phone = String(row[phoneField]).replace(/[^\d+]/g, "");
    if (phone.length >= 7) {
      const contactResult = await findContactByPhoneForImport(phone);
      if (contactResult.rows.length > 0) return { contact: contactResult.rows[0], method: "phone", uncertain: false };
    }
  }

  // 4. Name matching — ALWAYS uncertain (never silently merge by name alone)
  const nameField = Object.keys(mapping).find(
    (key) =>
      mapping[key] === "_name" ||
      (typeof mapping[key] === "string" &&
        (mapping[key].toLowerCase().includes("name") ||
          mapping[key].toLowerCase().includes("full")))
  );
  if (nameField && row[nameField]) {
    const sorted = sortNameTokens(row[nameField]);
    if (sorted) {
      let allContacts;
      try {
        allContacts = await selectAllContactsForImport();
      } catch (_) {
        allContacts = { rows: [] };
      }
      for (const contactRow of allContacts.rows) {
        if (sortNameTokens(contactRow.name) === sorted) {
          return { contact: contactRow, method: "name", uncertain: true };
        }
      }
      const tokens = sorted.split(" ");
      if (tokens.length >= 2) {
        for (const contactRow of allContacts.rows) {
          const cTokens = sortNameTokens(contactRow.name).split(" ");
          const overlap = tokens.filter((token) => cTokens.includes(token)).length;
          if (overlap >= 2) {
            return { contact: contactRow, method: "name_partial", uncertain: true };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Execute one import batch. PHASE 1 SAFETY MODEL:
 *  - Submissions created with status 'submitted' (visible to review + AI eval)
 *  - Contacts created as role 'participant', status 'pending' (never approved)
 *  - No automation, no emails, no credentials, no group assignment
 *  - Lookup-first contact matching (email, phone, name); name-only matches are
 *    flagged needs_review and never silently merged
 *  - Duplicate protection: skips rows where submitter already has a submission
 *    in this run; records import batch with file hash for idempotency detection
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function executeImport({ form_id, run_id, mapping, csv_rows, batch_id, file_hash }) {
  if ((!form_id && !run_id) || !mapping || !csv_rows) {
    return {
      status: 400,
      body: { success: false, error: "form_id (or run_id), mapping, and csv_rows are required" },
    };
  }

  // ── Resolve the run's actual form — server-side source of truth ──
  // The run determines the form, so a mismatched client form_id can never cause
  // data to be imported against the wrong form.
  let effectiveFormId = form_id != null ? parseInt(form_id) : null;
  if (run_id) {
    const runResult = await getFormRunByIdForImport(run_id);
    if (runResult.rows.length === 0) {
      return { status: 404, body: { success: false, error: "Run not found" } };
    }
    effectiveFormId = runResult.rows[0].form_id;
  }
  if (effectiveFormId == null) {
    return { status: 400, body: { success: false, error: "Could not determine the form for this run" } };
  }

  // Form field labels — used to resolve the applicant email label-aware (same
  // logic as the Run view), so imports keep real emails whether the CSV/XLSX
  // column was mapped to _email or to the form's email question.
  let fieldLabels = {};
  try {
    const labelsResult = await getFormFieldLabels(effectiveFormId);
    for (const field of labelsResult.rows) fieldLabels[String(field.id)] = field.label;
  } catch (_) {}

  // Self-heal: ensure import batch + review flag tables exist (additive, idempotent)
  try {
    await ensureImportBatchesTable();
    await ensureImportReviewFlagsTable();
  } catch (error) {
    console.warn("[Import] Could not ensure batch tables:", error.message);
  }

  // Chunked imports send a client-computed hash of the FULL file so every chunk
  // (and every re-upload of the same file) maps to one stable hash.
  const hash = file_hash || fileHash(csv_rows);

  let duplicateBatch = false;
  let previousBatch = null;
  let activeBatchId = batch_id ? parseInt(batch_id) : null;

  // Detect previous import of the same file (only when starting a fresh batch)
  if (!activeBatchId) {
    try {
      const previousBatchResult = await findPreviousImportBatch(run_id, hash);
      if (previousBatchResult.rows.length > 0) {
        duplicateBatch = true;
        previousBatch = previousBatchResult.rows[0];
      }
    } catch (_) {}
  }

  // Create the batch row upfront so review flags can reference it
  if (!activeBatchId) {
    try {
      const batchResult = await createImportBatch(effectiveFormId, run_id, hash);
      activeBatchId = batchResult.rows[0]?.id || null;
    } catch (error) {
      console.warn("[Import] Batch row creation failed:", error.message);
    }
  }

  let imported = 0;
  let skipped = 0;
  let needsReview = 0;
  const errors = [];
  const reviewRows = [];

  for (let rowIndex = 0; rowIndex < csv_rows.length; rowIndex++) {
    const row = csv_rows[rowIndex];
    try {
      const hasData = Object.values(row).some(
        (value) => value !== undefined && value !== null && String(value).trim() !== ""
      );
      if (!hasData) {
        skipped++;
        continue;
      }

      // Applicant email: label-aware + placeholder-safe (see resolveRowEmail).
      // "" means the row has no real email — only then is a placeholder used.
      const email = resolveRowEmail(row, mapping, fieldLabels);

      const resolved = await resolveContact(row, mapping, email);
      let contact = resolved?.contact || null;
      const uncertain = resolved?.uncertain || false;
      const matchMethod = resolved?.method || null;

      let name = "Unknown";
      const nameKey = Object.keys(mapping).find(
        (key) =>
          mapping[key] === "_name" ||
          (typeof mapping[key] === "string" &&
            (mapping[key].toLowerCase().includes("name") ||
              mapping[key].toLowerCase().includes("full")))
      );
      if (nameKey && row[nameKey]) name = String(row[nameKey]).trim();

      let phone = null;
      const phoneKey = Object.keys(mapping).find(
        (key) =>
          mapping[key] === "_phone" ||
          (typeof mapping[key] === "string" &&
            (mapping[key].toLowerCase().includes("phone") ||
              mapping[key].toLowerCase().includes("telephone")))
      );
      if (phoneKey && row[phoneKey]) {
        phone = String(row[phoneKey]).replace(/[^\d+]/g, "");
      }

      if (!contact) {
        const cid = "USER_" + uuidv4().split("-")[0].toUpperCase() + Math.floor(Math.random() * 10000);

        const contactEmail = email || `import-${cid.toLowerCase()}@placeholder.impactos.local`;

        const insertResult = await upsertImportedContact(cid, name, contactEmail, phone);
        if (insertResult.rows.length > 0) contact = insertResult.rows[0];
      }

      if (!contact) {
        errors.push({ row: rowIndex + 1, error: "Could not resolve or create contact" });
        skipped++;
        continue;
      }

      const existingSubmission = await findSubmissionByRunAndSubmitter(run_id, contact.cid);
      if (existingSubmission.rows.length > 0) {
        skipped++;
        continue;
      }

      const submissionData = {};
      for (const csvCol of Object.keys(row)) {
        const fieldId = mapping[csvCol];
        if (fieldId && !String(fieldId).startsWith("_")) {
          submissionData[fieldId] = row[csvCol];
        }
      }

      await createPlatformFormSubmission(run_id, contact.cid, contact.name, submissionData);

      if (uncertain) {
        needsReview++;
        const reason =
          matchMethod === "name_partial"
            ? "Partial name match — possible duplicate, verify identity"
            : "Name-only match with different email/phone — verify identity";
        reviewRows.push({
          row: rowIndex + 1,
          name,
          email: email || null,
          matched_cid: contact.cid,
          matched_name: contact.name,
          method: matchMethod,
          reason,
        });
        // Persist flag for the review screen (non-blocking)
        try {
          await createImportReviewFlag(
            activeBatchId,
            effectiveFormId,
            run_id,
            rowIndex + 1,
            name,
            email,
            contact.cid,
            contact.name,
            matchMethod,
            reason,
          );
        } catch (_) {}
      }

      imported++;
    } catch (rowError) {
      errors.push({ row: rowIndex + 1, error: rowError.message });
      skipped++;
    }
  }

  // Accumulate counts into the batch row
  const batchId = activeBatchId;
  try {
    await accumulateImportBatchCounts(csv_rows.length, imported, skipped, needsReview, batchId);
  } catch (error) {
    console.warn("[Import] Batch record failed:", error.message);
  }

  return {
    status: 200,
    body: {
      success: true,
      imported,
      skipped,
      needs_review: needsReview,
      review_rows: reviewRows,
      errors,
      total: csv_rows.length,
      duplicate_batch: duplicateBatch,
      previous_batch: previousBatch,
      batch: { id: batchId, file_hash: hash },
    },
  };
}

// ── Review flags ────────────────────────────────────────────────────────────

/** @returns {Promise<{status: number, body: Object}>} */
export async function listReviewFlags({ status, runId, formId }) {
  const result = await listImportReviewFlags(status, runId, formId);
  return { status: 200, body: { success: true, flags: result.rows } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function setReviewFlagStatus({ id, status }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const valid = ["pending", "resolved"];
  if (status && !valid.includes(status)) {
    return { status: 400, body: { success: false, error: "Invalid status" } };
  }

  const result = await updateImportReviewFlagStatus(status, id);
  return { status: 200, body: { success: true, flag: result.rows[0] || null } };
}
