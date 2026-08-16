import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { resolveSubmissionEmail } from "@/lib/email";

/**
 * POST /api/platform/import/execute
 * Accepts form_id + run_id + mapping + csv_rows.
 *
 * PHASE 1 SAFETY MODEL:
 *  - Submissions created with status 'submitted' (visible to review + AI eval)
 *  - Contacts created as role 'participant', status 'pending' (never approved)
 *  - No automation, no emails, no credentials, no group assignment
 *  - Lookup-first contact matching (email, phone, name); name-only matches
 *    are flagged needs_review and never silently merged
 *  - Duplicate protection: skips rows where submitter already has a submission
 *    in this run; records import batch with file hash for idempotency detection
 */

function sortNameTokens(name) {
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
  const emailKey = Object.keys(mapping).find((k) => mapping[k] === "_email");
  const explicitEmail = emailKey && row[emailKey] != null ? String(row[emailKey]) : "";
  return resolveSubmissionEmail({
    submissionData: rowData,
    fieldLabels,
    contactEmail: explicitEmail,
  });
}

async function resolveContact(dbClient, row, mapping, email) {
  // 1. CRM ID (degrade gracefully if column missing)
  const crmIdField = Object.keys(mapping).find((k) => mapping[k] === "_crm_id");
  if (crmIdField && row[crmIdField]) {
    try {
      const res = await dbClient.execute({
        sql: "SELECT * FROM contacts WHERE cid = ? LIMIT 1",
        args: [String(row[crmIdField])],
      });
      if (res.rows.length > 0) return { contact: res.rows[0], method: "crm_id", uncertain: false };
    } catch (_) {}
  }

  // 2. Email (exact, lowercase) — resolved upstream with the same label-aware,
  // placeholder-safe logic as the Run view, so it matches whether the column
  // was mapped to _email or to the form's email question.
  if (email) {
    const res = await dbClient.execute({
      sql: "SELECT * FROM contacts WHERE LOWER(email) = ? LIMIT 1",
      args: [String(email).toLowerCase().trim()],
    });
    if (res.rows.length > 0) return { contact: res.rows[0], method: "email", uncertain: false };
  }

  // 3. Phone (normalized)
  const phoneField = Object.keys(mapping).find(
    (k) =>
      mapping[k] === "_phone" ||
      (typeof mapping[k] === "string" &&
        (mapping[k].toLowerCase().includes("phone") ||
          mapping[k].toLowerCase().includes("telephone")))
  );
  if (phoneField && row[phoneField]) {
    const phone = String(row[phoneField]).replace(/[^\d+]/g, "");
    if (phone.length >= 7) {
      const res = await dbClient.execute({
        sql: "SELECT * FROM contacts WHERE phone = ? LIMIT 1",
        args: [phone],
      });
      if (res.rows.length > 0) return { contact: res.rows[0], method: "phone", uncertain: false };
    }
  }

  // 4. Name matching — ALWAYS uncertain (never silently merge by name alone)
  const nameField = Object.keys(mapping).find(
    (k) =>
      mapping[k] === "_name" ||
      (typeof mapping[k] === "string" &&
        (mapping[k].toLowerCase().includes("name") ||
          mapping[k].toLowerCase().includes("full")))
  );
  if (nameField && row[nameField]) {
    const sorted = sortNameTokens(row[nameField]);
    if (sorted) {
      let allContacts;
      try {
        allContacts = await dbClient.execute({ sql: "SELECT * FROM contacts", args: [] });
      } catch (_) {
        allContacts = { rows: [] };
      }
      for (const c of allContacts.rows) {
        if (sortNameTokens(c.name) === sorted) {
          return { contact: c, method: "name", uncertain: true };
        }
      }
      const tokens = sorted.split(" ");
      if (tokens.length >= 2) {
        for (const c of allContacts.rows) {
          const cTokens = sortNameTokens(c.name).split(" ");
          const overlap = tokens.filter((t) => cTokens.includes(t)).length;
          if (overlap >= 2) {
            return { contact: c, method: "name_partial", uncertain: true };
          }
        }
      }
    }
  }

  return null;
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { form_id, run_id, mapping, csv_rows, batch_id, file_hash } = await req.json();
    if ((!form_id && !run_id) || !mapping || !csv_rows) {
      return NextResponse.json(
        { success: false, error: "form_id (or run_id), mapping, and csv_rows are required" },
        { status: 400 }
      );
    }

    // ── Resolve the run's actual form — server-side source of truth ──
    // The run determines the form, so a mismatched client form_id can never
    // cause data to be imported against the wrong form.
    let effectiveFormId = form_id != null ? parseInt(form_id) : null;
    if (run_id) {
      const runRes = await db.execute({
        sql: "SELECT id, name, form_id FROM platform_form_runs WHERE id = ?",
        args: [parseInt(run_id)],
      });
      if (runRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
      }
      effectiveFormId = runRes.rows[0].form_id;
    }
    if (effectiveFormId == null) {
      return NextResponse.json(
        { success: false, error: "Could not determine the form for this run" },
        { status: 400 }
      );
    }

    // Form field labels — used to resolve the applicant email label-aware
    // (same logic as the Run view), so imports keep real emails whether the
    // CSV/XLSX column was mapped to _email or to the form's email question.
    let fieldLabels = {};
    try {
      const labelsRes = await db.execute({
        sql: "SELECT id, label FROM platform_form_fields WHERE form_id = ?",
        args: [effectiveFormId],
      });
      for (const f of labelsRes.rows) fieldLabels[String(f.id)] = f.label;
    } catch (_) {}

    // Self-heal: ensure import batch + review flag tables exist (additive, idempotent)
    try {
      await db.execute(`CREATE TABLE IF NOT EXISTS platform_import_batches (
        id SERIAL PRIMARY KEY,
        form_id INTEGER NOT NULL,
        run_id INTEGER NOT NULL,
        file_hash TEXT NOT NULL,
        total_rows INTEGER DEFAULT 0,
        imported INTEGER DEFAULT 0,
        skipped INTEGER DEFAULT 0,
        needs_review INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS platform_import_review_flags (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER,
        form_id INTEGER NOT NULL,
        run_id INTEGER NOT NULL,
        row_number INTEGER,
        applicant_name TEXT,
        applicant_email TEXT,
        matched_cid TEXT,
        matched_name TEXT,
        method TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )`);
    } catch (e) {
      console.warn("[Import] Could not ensure batch tables:", e.message);
    }

    // Chunked imports send a client-computed hash of the FULL file so every
    // chunk (and every re-upload of the same file) maps to one stable hash.
    const hash = file_hash || fileHash(csv_rows);

    let duplicateBatch = false;
    let previousBatch = null;
    let activeBatchId = batch_id ? parseInt(batch_id) : null;

    // Detect previous import of the same file (only when starting a fresh batch)
    if (!activeBatchId) {
      try {
        const prev = await db.execute({
          sql: "SELECT id, created_at, imported, needs_review FROM platform_import_batches WHERE run_id = ? AND file_hash = ? ORDER BY id DESC LIMIT 1",
          args: [parseInt(run_id), hash],
        });
        if (prev.rows.length > 0) {
          duplicateBatch = true;
          previousBatch = prev.rows[0];
        }
      } catch (_) {}
    }

    // Create the batch row upfront so review flags can reference it
    if (!activeBatchId) {
      try {
        const batchRes = await db.execute({
          sql: `INSERT INTO platform_import_batches (form_id, run_id, file_hash, total_rows, imported, skipped, needs_review, created_by)
                VALUES (?, ?, ?, 0, 0, 0, 0, ?) RETURNING id`,
          args: [effectiveFormId, parseInt(run_id), hash, "system"],
        });
        activeBatchId = batchRes.rows[0]?.id || null;
      } catch (e) {
        console.warn("[Import] Batch row creation failed:", e.message);
      }
    }

    let imported = 0;
    let skipped = 0;
    let needsReview = 0;
    const errors = [];
    const reviewRows = [];

    for (let i = 0; i < csv_rows.length; i++) {
      const row = csv_rows[i];
      try {
        const hasData = Object.values(row).some(
          (v) => v !== undefined && v !== null && String(v).trim() !== ""
        );
        if (!hasData) {
          skipped++;
          continue;
        }

        // Applicant email: label-aware + placeholder-safe (see resolveRowEmail).
        // "" means the row has no real email — only then is a placeholder used.
        const email = resolveRowEmail(row, mapping, fieldLabels);

        const resolved = await resolveContact(db, row, mapping, email);
        let contact = resolved?.contact || null;
        const uncertain = resolved?.uncertain || false;
        const matchMethod = resolved?.method || null;

        let name = "Unknown";
        const nameKey = Object.keys(mapping).find(
          (k) =>
            mapping[k] === "_name" ||
            (typeof mapping[k] === "string" &&
              (mapping[k].toLowerCase().includes("name") ||
                mapping[k].toLowerCase().includes("full")))
        );
        if (nameKey && row[nameKey]) name = String(row[nameKey]).trim();

        let phone = null;
        const phoneKey = Object.keys(mapping).find(
          (k) =>
            mapping[k] === "_phone" ||
            (typeof mapping[k] === "string" &&
              (mapping[k].toLowerCase().includes("phone") ||
                mapping[k].toLowerCase().includes("telephone")))
        );
        if (phoneKey && row[phoneKey]) {
          phone = String(row[phoneKey]).replace(/[^\d+]/g, "");
        }

        if (!contact) {
          const cid =
            "USER_" +
            uuidv4().split("-")[0].toUpperCase() +
            Math.floor(Math.random() * 10000);

          const contactEmail = email || `import-${cid.toLowerCase()}@placeholder.impactos.local`;

          const insertRes = await db.execute({
            sql: `INSERT INTO contacts (cid, name, email, phone, role, status, password, deleted)
                  VALUES (?, ?, ?, ?, 'participant', 'pending', '', 0)
                  ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = COALESCE(EXCLUDED.phone, contacts.phone)
                  RETURNING *`,
            args: [cid, name, contactEmail, phone || null],
          });
          if (insertRes.rows.length > 0) contact = insertRes.rows[0];
        }

        if (!contact) {
          errors.push({ row: i + 1, error: "Could not resolve or create contact" });
          skipped++;
          continue;
        }

        const existingSub = await db.execute({
          sql: "SELECT id FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? LIMIT 1",
          args: [parseInt(run_id), contact.cid],
        });
        if (existingSub.rows.length > 0) {
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

        await db.execute({
          sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, data, status, submitted_at)
                VALUES (?, ?, ?, ?, 'submitted', NOW())`,
          args: [parseInt(run_id), contact.cid, contact.name, JSON.stringify(submissionData)],
        });

        if (uncertain) {
          needsReview++;
          const reason = matchMethod === "name_partial"
            ? "Partial name match — possible duplicate, verify identity"
            : "Name-only match with different email/phone — verify identity";
          reviewRows.push({
            row: i + 1,
            name,
            email: email || null,
            matched_cid: contact.cid,
            matched_name: contact.name,
            method: matchMethod,
            reason,
          });
          // Persist flag for the review screen (non-blocking)
          try {
            await db.execute({
              sql: `INSERT INTO platform_import_review_flags (batch_id, form_id, run_id, row_number, applicant_name, applicant_email, matched_cid, matched_name, method, reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                activeBatchId,
                effectiveFormId,
                parseInt(run_id),
                i + 1,
                name,
                email || null,
                contact.cid,
                contact.name,
                matchMethod,
                reason,
              ],
            });
          } catch (_) {}
        }

        imported++;
      } catch (rowErr) {
        errors.push({ row: i + 1, error: rowErr.message });
        skipped++;
      }
    }

    // Accumulate counts into the batch row
    let batchId = activeBatchId;
    try {
      await db.execute({
        sql: `UPDATE platform_import_batches
              SET total_rows = total_rows + ?,
                  imported = imported + ?,
                  skipped = skipped + ?,
                  needs_review = needs_review + ?
              WHERE id = ?`,
        args: [csv_rows.length, imported, skipped, needsReview, batchId],
      });
    } catch (e) {
      console.warn("[Import] Batch record failed:", e.message);
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
