/**
 * ADMIN VENTURE CREATION
 *
 * The super-admin fast-path: a Future Studio administrator records a Venture by
 * name and hands it to its founder, instead of waiting for the founder to come
 * through the intake form. This is deliberately DIFFERENT from the retired
 * self-service registration flows — it is not open to the public, it is an
 * authenticated super-admin action, and it never collects founder data on the
 * founder's behalf beyond their email.
 *
 * The SQL for the `ventures` row and its `venture_origins` provenance lives here
 * (models only — routes never run SQL). Founder onboarding itself is NOT done
 * here: the caller creates a founder invitation whose acceptance screen lets the
 * founder create their account and join (see `ventureMemberInvitations`).
 */

import db, { initDb } from "@/lib/db";
import { generateVentureId } from "@/services/ventures/intake";
import { ensureVentureSchema } from "@/services/ventures/schema";

/**
 * A Venture already carrying this company name, if any (case-insensitive).
 * One name, one Venture — the same rule the approval pipeline enforces.
 */
export async function findVentureIdByCompanyName(companyName) {
  const result = await db.execute({
    sql: "SELECT venture_id FROM ventures WHERE LOWER(company_name) = LOWER(?) LIMIT 1",
    args: [companyName],
  });
  return result.rows?.[0]?.venture_id || null;
}

/**
 * Create an active Venture for `companyName`, attributed to the administrator.
 *
 * Returns `{ conflict: true, venture_id }` when the name is already taken, so
 * the caller can answer with a clear refusal instead of a duplicate row.
 */
export async function createAdminVenture({
  companyName,
  createdByCid = null,
  industry = null,
  businessStage = "idea",
}) {
  await initDb();
  await ensureVentureSchema();

  const name = String(companyName || "").trim();
  if (!name) throw new Error("company_name is required.");

  const existingVentureId = await findVentureIdByCompanyName(name);
  if (existingVentureId) {
    return { conflict: true, venture_id: existingVentureId };
  }

  const ventureId = generateVentureId();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO ventures
            (venture_id, name, company_name, industry, business_stage, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
          ON CONFLICT (venture_id) DO NOTHING`,
    args: [ventureId, name, name, industry, businessStage, createdByCid, now, now],
  });

  // Provenance keys on the INTERNAL id (Phase 0 — docs/VENTURE_IDENTITY_PHASE0.md):
  // the code is the access key, not a stored reference. Read the id back from
  // the row we just created rather than guessing it.
  const created = await db.execute({
    sql: "SELECT id::text AS id FROM ventures WHERE venture_id = ? LIMIT 1",
    args: [ventureId],
  });
  const internalId = created.rows?.[0]?.id || null;

  // Provenance: this Venture has no submission behind it. `admin` records the
  // manual origin so reporting can tell it apart from an approved intake.
  if (internalId) {
    await db.execute({
      sql: `INSERT INTO venture_origins (venture_id, source_type, approved_by_cid, approved_at, created_at)
            VALUES (?, 'admin', ?, ?, ?)
            ON CONFLICT (venture_id) DO NOTHING`,
      args: [internalId, createdByCid, now, now],
    });
  }

  return { venture_id: ventureId, company_name: name };
}

export default {
  findVentureIdByCompanyName,
  createAdminVenture,
};
