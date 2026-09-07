/**
 * Backfill: repair contacts created by imports with placeholder emails
 * (import-…@placeholder.impactos.local).
 *
 * For each affected contact, the real applicant email is resolved from their
 * form submissions (label-aware, EN/FR, placeholder-safe):
 *
 *   A) A real contact already owns that email  → re-link submissions and
 *      enrollments to the real identity, then SOFT-DELETE the placeholder
 *      contact (reversible via the CRM recycle bin — the app's own pattern).
 *   B) No contact owns the email               → write the real email onto the
 *      placeholder contact and resolve a real name from the submission.
 *
 * One-time repair companion to the permanent import email fix. Safe to re-run.
 *
 * Usage:
 *   node scripts/backfill_placeholder_emails.mjs            # apply
 *   node scripts/backfill_placeholder_emails.mjs --dry-run  # preview only
 *
 * NOTE: the email-resolution helpers below mirror src/lib/email.js
 * (resolveSubmissionEmail / isPlaceholderEmail) because that module uses the
 * `@/` alias, which plain Node scripts cannot resolve. Keep them in sync.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx > 0 && !line.startsWith("#")) {
      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (_) {}

import { initDb } from "../src/lib/db.js";

// ── Mirrors of src/lib/email.js helpers (see NOTE above) ─────────────
function isPlaceholderEmail(email) {
  if (!email || typeof email !== "string") return true;
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return true;
  if (e.includes("placeholder")) return true;
  if (e.includes("@example.") || e.includes("@test.") || e.endsWith(".local") || e.endsWith(".invalid")) return true;
  if (e.startsWith("import-")) return true;
  return false;
}

function resolveSubmissionEmail({ submissionData, fieldLabels, contactEmail }) {
  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const labelOf = (k) => {
    const raw =
      fieldLabels && fieldLabels[String(k)] != null
        ? String(fieldLabels[String(k)])
        : String(k);
    return raw.toLowerCase().trim();
  };
  const isReal = (v) =>
    typeof v === "string" && v.includes("@") && !isPlaceholderEmail(v);
  const EMAIL_HINTS = /(e-?mail|courriel|mel|adresse\s*(e-?mail|mail))/i;

  const labeled = [];
  const anyReal = [];
  for (const [k, v] of Object.entries(data)) {
    const val = typeof v === "string" ? v.trim() : "";
    if (!isReal(val)) continue;
    if (EMAIL_HINTS.test(labelOf(k))) labeled.push(val);
    else anyReal.push(val);
  }
  if (labeled.length > 0) return labeled[0].toLowerCase();
  if (anyReal.length > 0) return anyReal[0].toLowerCase();
  if (isReal(contactEmail)) return String(contactEmail).trim().toLowerCase();
  return "";
}

// Best real name from a submission: labeled name field first, then the first
// plausible non-email value. Never returns "Unknown"/generic names.
const GENERIC_NAMES = /^(unknown|anonymous|n\/a|none|participant|null|undefined|-+|\s*)$/i;

function resolveNameFromSubmission(subData, fieldLabels) {
  const data = subData && typeof subData === "object" ? subData : {};
  const labelOf = (k) => {
    const raw =
      fieldLabels && fieldLabels[String(k)] != null
        ? String(fieldLabels[String(k)])
        : String(k);
    return raw.toLowerCase().trim();
  };
  const NAME_HINTS = /(name|nom|full)/i;
  const isNameValue = (v) =>
    typeof v === "string" &&
    v.trim().length > 1 &&
    !v.includes("@") &&
    !v.startsWith("{") &&
    !v.startsWith("import-") &&
    !GENERIC_NAMES.test(v.trim());
  for (const [k, v] of Object.entries(data)) {
    if (isNameValue(v) && NAME_HINTS.test(labelOf(k))) return v.trim();
  }
  for (const v of Object.values(data)) {
    if (isNameValue(v)) return v.trim();
  }
  return "";
}
// ───────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const db = await initDb();

// Contacts whose stored email is a system placeholder.
const placeholders = await db.execute({
  sql: `SELECT cid, name, email FROM contacts
        WHERE deleted_at IS NULL
          AND (email LIKE 'import-%@placeholder.impactos.local'
            OR email LIKE '%@placeholder.impactos.local'
            OR email LIKE '%@example.%'
            OR email LIKE '%@test.%'
            OR email LIKE '%.local'
            OR email LIKE '%.invalid')
        ORDER BY cid`,
  args: [],
});

console.log(`Found ${placeholders.rows.length} contact(s) with a placeholder email.`);

let relinked = 0;
let fixed = 0;
let unresolved = 0;
for (const contact of placeholders.rows) {
  // Latest submissions for this contact
  const subs = await db.execute({
    sql: `SELECT s.id, s.run_id, s.data FROM platform_form_submissions s
          WHERE s.submitter_id = ? ORDER BY s.id DESC LIMIT 3`,
    args: [contact.cid],
  });

  let realEmail = "";
  let subData = {};
  let foundLabels = {};
  for (const sub of subs.rows) {
    let fieldLabels = {};
    try {
      const runRes = await db.execute({
        sql: "SELECT form_id FROM platform_form_runs WHERE id = ?",
        args: [sub.run_id],
      });
      if (runRes.rows.length > 0) {
        const fRes = await db.execute({
          sql: "SELECT id, label FROM platform_form_fields WHERE form_id = ?",
          args: [runRes.rows[0].form_id],
        });
        for (const f of fRes.rows) fieldLabels[String(f.id)] = f.label;
      }
    } catch (_) {}

    const candidate = resolveSubmissionEmail({
      submissionData: sub.data || {},
      fieldLabels,
      contactEmail: contact.email,
    });
    if (candidate) {
      realEmail = candidate;
      subData = sub.data || {};
      foundLabels = fieldLabels;
      break;
    }
  }

  if (!realEmail) {
    console.log(`SKIP  ${contact.cid}  no real email found in submissions`);
    unresolved++;
    continue;
  }
  if (String(realEmail).toLowerCase() === String(contact.email).toLowerCase()) continue;

  // Does a real contact already own this email?
  const owner = await db.execute({
    sql: "SELECT cid, name, group_name FROM contacts WHERE LOWER(email) = LOWER(?) AND cid != ? LIMIT 1",
    args: [realEmail, contact.cid],
  });

  if (DRY_RUN) {
    if (owner.rows.length > 0) {
      console.log(`WOULD-LINK ${contact.cid} (${contact.email}) -> ${owner.rows[0].cid} (${realEmail})`);
      relinked++;
    } else {
      console.log(`WOULD-FIX ${contact.cid}  ${contact.email} -> ${realEmail}`);
      fixed++;
    }
    continue;
  }

  try {
    if (owner.rows.length > 0) {
      const real = owner.rows[0];

      // Re-link submissions to the real-email identity.
      const relinkedRows = await db.execute({
        sql: "UPDATE platform_form_submissions SET submitter_id = ? WHERE submitter_id = ?",
        args: [real.cid, contact.cid],
      });

      // Move program enrollments to the real identity (idempotent).
      try {
        await db.execute({
          sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
                SELECT ?, program_id, status, accepted_at FROM participant_programs
                WHERE participant_id = ? ON CONFLICT DO NOTHING`,
          args: [real.cid, contact.cid],
        });
        await db.execute({
          sql: "DELETE FROM participant_programs WHERE participant_id = ?",
          args: [contact.cid],
        });
      } catch (_) {}

      // Carry the group over when the real contact has none yet.
      if (!real.group_name || String(real.group_name).trim() === "" || String(real.group_name).toLowerCase() === "unassigned") {
        try {
          const grp = await db.execute({
            sql: "SELECT group_name FROM contacts WHERE cid = ?",
            args: [contact.cid],
          });
          const carriedGroup = grp.rows[0]?.group_name;
          if (carriedGroup && String(carriedGroup).trim() !== "") {
            await db.execute({
              sql: "UPDATE contacts SET group_name = ? WHERE cid = ?",
              args: [carriedGroup, real.cid],
            });
          }
        } catch (_) {}
      }

      // If the real contact still has a generic name, resolve a real name
      // from the submission data.
      if (!real.name || GENERIC_NAMES.test(String(real.name).trim())) {
        const betterName = resolveNameFromSubmission(subData, foundLabels);
        if (betterName) {
          await db.execute({
            sql: "UPDATE contacts SET name = ? WHERE cid = ?",
            args: [betterName, real.cid],
          });
        }
      }

      // Soft-delete the placeholder shell (app pattern — recoverable from the
      // CRM recycle bin). Never physically deletes data.
      await db.execute({
        sql: "UPDATE contacts SET deleted = 1, deleted_at = NOW(), deleted_by = 'backfill' WHERE cid = ?",
        args: [contact.cid],
      });

      console.log(`LINK  ${contact.cid} (${contact.email}) -> ${real.cid} (${realEmail}) [${relinkedRows.rowCount ?? "?"} submissions]`);
      relinked++;
    } else {
      // No real contact exists — write the real email onto this contact and
      // resolve a real name from the submission data.
      const betterName = resolveNameFromSubmission(subData, foundLabels);
      await db.execute({
        sql: "UPDATE contacts SET email = ?, name = COALESCE(NULLIF(?, ''), name) WHERE cid = ?",
        args: [realEmail, betterName, contact.cid],
      });
      console.log(`FIX   ${contact.cid}  ${contact.email} -> ${realEmail}${betterName ? ` (name: ${betterName})` : ""}`);
      fixed++;
    }
  } catch (e) {
    console.log(`FAIL  ${contact.cid}  ${e.message}`);
  }
}

console.log(`\nDone. ${DRY_RUN ? "WOULD PROCESS" : "PROCESSED"}: linked=${relinked}, fixed=${fixed}, unresolved=${unresolved}.`);
