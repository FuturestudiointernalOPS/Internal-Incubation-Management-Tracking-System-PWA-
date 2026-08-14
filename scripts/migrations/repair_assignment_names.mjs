#!/usr/bin/env node
/**
 * REPAIR / AUDIT — Run assignment names & placeholder contact names
 * =================================================================
 * Purpose
 *   Forms → Runs → Assignments can display "Unknown" (or a raw target id)
 *   for two reasons:
 *     1. The assignment's target_id references a contact whose stored name
 *        is a placeholder ("Unknown", "Anonymous", "N/A", ...) — written by
 *        the historical CSV import when no mapped name value existed.
 *     2. The assignment's target_id cannot be resolved to any contact at all
 *        (identifier mismatch, deleted contact, or legacy data).
 *
 *   This script AUDITS both cases and can optionally repair case 1 when a
 *   real name is verifiably recoverable from the person's form submissions.
 *   Case 2 is REPORTED ONLY — unresolvable identifiers are never guessed.
 *
 * Safety
 *   - DEFAULT MODE IS DRY-RUN: report only, no writes.
 *   - Pass `--apply` to write. Writes are limited to a single column
 *     (contacts.name) for placeholder-named contacts with a confident,
 *     submission-sourced candidate. Nothing is ever deleted.
 *   - Idempotent: re-running after a successful apply is a no-op.
 *
 * Usage
 *   node scripts/migrations/repair_assignment_names.mjs            # report
 *   node scripts/migrations/repair_assignment_names.mjs --apply    # write
 *   node scripts/migrations/repair_assignment_names.mjs --env .env.staging
 *
 * NOTE: in this repository .env.local and .env.staging currently point at
 * the SAME database (verified host + db path). Running --apply therefore
 * writes to that database — confirm the environment before applying.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ── Env loading (keys only, mirrors scripts/add_setup_token.mjs) ──
const envFlag = process.argv.indexOf("--env");
const envPath = resolve(
  projectRoot,
  envFlag > -1 && process.argv[envFlag + 1]
    ? process.argv[envFlag + 1]
    : ".env.local",
);
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
} catch (_) {
  console.error(`⚠  Could not read env file: ${envPath}`);
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

// Mirrors src/lib/email.js GENERIC_NAMES — placeholder names never accepted
// as real names.
const GENERIC_NAMES = /^(unknown|anonymous|n\/a|none|participant|null|undefined|\-+|\s*)$/i;
const isGeneric = (v) => GENERIC_NAMES.test(typeof v === "string" ? v.trim() : "");

// Mirrors src/lib/email.js resolvePersonName hint regexes.
const FULL_NAME_HINTS = /^(full\s*name|fullname|nom\s+complet|prenom\s*et\s*nom|prénom\s*et\s*nom|nom\s*et\s*pr[eé]nom|nom\s*&\s*pr[eé]nom)$/i;
const FIRST_NAME_HINTS = /(first|given|pr[eé]nom|prenom)/i;
const LAST_NAME_HINTS = /(last|surname|family)/i;
const FR_LAST_NAME_HINTS = /^(nom|nom\s+de\s+famille)$/i;
const NAME_HINTS = /^(name)$/i;

const { initDb } = await import("../src/lib/db.js");
const db = await initDb();

const clean = (v) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

/**
 * Extract a confident name candidate from a submission's data payload using
 * the same field-label heuristics as resolvePersonName.
 */
function extractNameFromSubmission(data, fieldLabels) {
  if (!data || typeof data !== "object") return null;
  const labelOf = (k) => {
    const raw =
      fieldLabels && fieldLabels[String(k)] != null
        ? String(fieldLabels[String(k)])
        : String(k);
    return raw.toLowerCase().trim();
  };
  const fullNames = [];
  const firstNames = [];
  const lastNames = [];
  let bareName = "";
  for (const [k, v] of Object.entries(data)) {
    let val = clean(v);
    if (!val || val.includes("@")) continue;
    try {
      if (v.startsWith("{") && v.includes('"code"')) continue; // phone objects
    } catch (_) {}
    val = clean(v);
    if (!val) continue;
    const label = labelOf(k);
    if (!label) continue;
    if (FULL_NAME_HINTS.test(label)) fullNames.push(val);
    else if (FIRST_NAME_HINTS.test(label)) firstNames.push(val);
    else if (LAST_NAME_HINTS.test(label) || FR_LAST_NAME_HINTS.test(label)) lastNames.push(val);
    else if (NAME_HINTS.test(label)) bareName = bareName || val;
  }
  const candidates = [];
  for (const n of fullNames) candidates.push(n);
  if (firstNames.length > 0) candidates.push(`${firstNames[0]} ${lastNames[0] || ""}`.trim());
  else if (lastNames.length > 0) candidates.push(lastNames[0]);
  if (bareName) candidates.push(bareName);
  for (const c of candidates) {
    const v = clean(c);
    if (!v) continue;
    if (isGeneric(v)) continue;
    if (v.length < 3) continue;
    // A name should be words, not a phone number / uuid / code.
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-.\s]+$/.test(v)) continue;
    // Confident: at least two words, or a single long word (rare French names).
    if (v.split(/\s+/).length >= 2 || v.length >= 8) return v;
  }
  return null;
}

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(` RUN ASSIGNMENT NAME REPAIR — ${APPLY ? "APPLY MODE (writes)" : "DRY RUN (report only)"}`);
console.log(` env file: ${envPath}`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

// ── PART A — Assignment identifier audit ────────────────────────────────
const assignments = await db.execute({
  sql: "SELECT a.id, a.run_id, a.target_type, a.target_id, r.name AS run_name FROM platform_form_run_assignments a LEFT JOIN platform_form_runs r ON a.run_id = r.id ORDER BY a.run_id, a.id",
  args: [],
});
const rows = assignments.rows;
console.log(`PART A — ${rows.length} assignment record(s)`);

const userIds = [...new Set(rows.filter((r) => r.target_type === "user").map((r) => r.target_id))];
const groupIds = [...new Set(rows.filter((r) => r.target_type === "group").map((r) => r.target_id))];
const programIds = [...new Set(rows.filter((r) => r.target_type === "program").map((r) => r.target_id))];

const contactMap = new Map();
if (userIds.length > 0) {
  const emails = userIds.map((u) => String(u).toLowerCase());
  const res = await db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE cid = ANY(?) OR LOWER(email) = ANY(?)",
    args: [userIds, emails],
  });
  for (const row of res.rows) {
    contactMap.set(row.cid, row);
    if (row.email) contactMap.set(String(row.email).toLowerCase(), row);
  }
}

const groupMap = new Map();
if (groupIds.length > 0) {
  const res = await db.execute({
    sql: "SELECT id, registration_id, name FROM families WHERE registration_id = ANY(?) OR CAST(id AS TEXT) = ANY(?)",
    args: [groupIds, groupIds],
  });
  for (const row of res.rows) {
    if (row.registration_id) groupMap.set(row.registration_id, row);
    groupMap.set(String(row.id), row);
  }
}

const programMap = new Map();
if (programIds.length > 0) {
  const res = await db.execute({
    sql: "SELECT id, name FROM v2_programs WHERE id = ANY(?)",
    args: [programIds],
  });
  for (const row of res.rows) programMap.set(String(row.id), row);
}

let unresolvedUser = 0;
let placeholderUser = 0;
let groupOk = 0;
let programOk = 0;
for (const a of rows) {
  if (a.target_type === "user") {
    const c = contactMap.get(a.target_id) || contactMap.get(String(a.target_id).toLowerCase());
    if (!c) {
      unresolvedUser++;
      console.log(`  ✗ user assignment #${a.id} (run "${a.run_name || a.run_id}") target_id "${a.target_id}" → NO CONTACT MATCH (cid or email)`);
    } else if (isGeneric(c.name)) {
      placeholderUser++;
      console.log(`  ~ user assignment #${a.id} (run "${a.run_name || a.run_id}") → contact "${c.cid}" name is placeholder "${c.name}" (${c.email || "no email"})`);
    }
  } else if (a.target_type === "group") {
    const g = groupMap.get(a.target_id) || groupMap.get(String(a.target_id).toLowerCase());
    if (!g) console.log(`  ✗ group assignment #${a.id} target_id "${a.target_id}" → NO GROUP MATCH`);
    else groupOk++;
  } else if (a.target_type === "program") {
    const p = programMap.get(a.target_id) || programMap.get(String(a.target_id).toLowerCase());
    if (!p) console.log(`  ✗ program assignment #${a.id} target_id "${a.target_id}" → NO PROGRAM MATCH`);
    else programOk++;
  }
}
console.log(`  resolved: ${rows.length - unresolvedUser - placeholderUser - 0} total OK · user placeholders: ${placeholderUser} · user unresolvable: ${unresolvedUser} · groups OK: ${groupOk} · programs OK: ${programOk}\n`);

// ── PART B — Placeholder contact names with recoverable submission names ─
console.log(`PART B — contacts with placeholder names that have submissions`);

// All contacts with generic names (limit to those linked to submissions).
const genericContacts = await db.execute({
  sql: `SELECT cid, name, email FROM contacts
        WHERE deleted = 0 AND (LOWER(name) IN ('unknown','anonymous','n/a','none','participant','null','undefined') OR name ~ '^[-]+$' OR TRIM(name) = '')
        ORDER BY cid`,
  args: [],
});

let repaired = 0;
let reported = 0;
for (const c of genericContacts.rows) {
  const subs = await db.execute({
    sql: `SELECT ps.id, ps.run_id, ps.data, ps.updated_at, r.form_id
          FROM platform_form_submissions ps
          LEFT JOIN platform_form_runs r ON ps.run_id = r.id
          WHERE ps.submitter_id = ? AND ps.status != 'draft'
          ORDER BY ps.updated_at DESC LIMIT 5`,
    args: [c.cid],
  });
  if (subs.rows.length === 0) continue;

  let candidate = null;
  let source = null;
  for (const sub of subs.rows) {
    let fieldLabels = {};
    if (sub.form_id) {
      try {
        const fRes = await db.execute({
          sql: "SELECT id, label FROM platform_form_fields WHERE form_id::text = ?",
          args: [String(sub.form_id)],
        });
        for (const f of fRes.rows) fieldLabels[String(f.id)] = f.label;
      } catch (_) {}
    }
    let data = sub.data;
    try {
      data = typeof data === "string" ? JSON.parse(data) : data;
    } catch (_) {}
    candidate = extractNameFromSubmission(data, fieldLabels);
    if (candidate) {
      source = `submission #${sub.id} (run ${sub.run_id})`;
      break;
    }
  }

  if (!candidate) {
    reported++;
    console.log(`  ~ ${c.cid} (${c.email || "no email"}) name "${c.name}" → no recoverable name (leaving unchanged)`);
    continue;
  }

  if (APPLY) {
    await db.execute({
      sql: "UPDATE contacts SET name = ? WHERE cid = ?",
      args: [candidate, c.cid],
    });
    repaired++;
    console.log(`  ✓ ${c.cid} (${c.email || "no email"}) "${c.name}" → "${candidate}" (from ${source})`);
  } else {
    console.log(`  ▶ ${c.cid} (${c.email || "no email"}) "${c.name}" → would set "${candidate}" (from ${source})`);
  }
}
console.log(`  placeholder contacts scanned: ${genericContacts.rows.length} · recoverable: ${APPLY ? repaired : 0} applied / ${reported + repaired} would-be`);

console.log(`\n── SUMMARY ──`);
console.log(`  Unresolvable user assignments (reported only, never guessed): ${unresolvedUser}`);
console.log(`  User assignments with placeholder contact names: ${placeholderUser}`);
console.log(`  Contact names repaired: ${APPLY ? repaired : "0 (dry run — rerun with --apply)"}`);
if (!APPLY) console.log(`\n  Re-run with --apply to write the recoverable names.`);
process.exit(0);
