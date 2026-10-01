/**
 * Venture intake (ids, validation, creation) — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/intake`: the promotion-member read,
 * the duplicate probes, the two create-Venture INSERT forms (with and without the
 * `company_name` column) and the founder INSERT.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Promotion members ────────────────────────────────────────────────────────

/** The member contacts of a program team, for Venture promotion. */
export function selectTeamMembersForPromotion(teamId) {
  return db.execute({
    sql: `SELECT c.cid AS contact_id, c.name, c.email
          FROM contacts c
          WHERE c.v2_team_id = ? AND c.deleted = 0
          UNION
          SELECT p.user_id AS contact_id, c2.name, c2.email
          FROM v2_participants p
          JOIN contacts c2 ON c2.cid = p.user_id
          WHERE p.v2_team_id = ? AND c2.deleted = 0`,
    args: [teamId, teamId],
  });
}

// ── Duplicate probes ─────────────────────────────────────────────────────────

/** The id of a Venture whose canonical company name matches (case-insensitive). */
export function selectVentureIdByCompanyName(companyName) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE LOWER(company_name) = LOWER(?)", args: [companyName] });
}

/** The id of a Venture whose legacy name matches (case-insensitive). */
export function selectVentureIdByName(companyName) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE LOWER(name) = LOWER(?)", args: [companyName] });
}

/** The id of a Venture with this registration number. */
export function selectVentureIdByRegistrationNumber(registrationNumber) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE registration_number = ?", args: [registrationNumber] });
}

/** The id of a founder with this email (case-insensitive). */
export function selectFounderIdByAnyEmail(email) {
  return db.execute({ sql: "SELECT id FROM venture_founders WHERE LOWER(email) = LOWER(?)", args: [email] });
}

// ── Creation ─────────────────────────────────────────────────────────────────

/** Insert a Venture writing both `name` and `company_name`. */
export function insertVentureWithCompanyName({
  ventureId, name, registrationNumber, industry, businessStage, description, website, logoUrl, createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO ventures (venture_id, name, company_name, registration_number, industry, business_stage, description, website, logo_url, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [ventureId, name, name, registrationNumber, industry, businessStage, description, website, logoUrl, createdBy],
  });
}

/** Insert a Venture on a schema without the `company_name` column. */
export function insertVentureLegacy({
  ventureId, name, registrationNumber, industry, businessStage, description, website, logoUrl, createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO ventures (venture_id, name, registration_number, industry, business_stage, description, website, logo_url, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [ventureId, name, registrationNumber, industry, businessStage, description, website, logoUrl, createdBy],
  });
}

/** Insert one pending founder row. */
export function insertFounderRecord(ventureId, email, name, phone, title, invitationToken) {
  return db.execute({
    sql: `INSERT INTO venture_founders (venture_id, email, name, phone, title, invitation_token, invitation_sent_at, status)
          VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending')`,
    args: [ventureId, email, name, phone, title, invitationToken],
  });
}
