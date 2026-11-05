import db from "@/lib/db";
import { stopRoleMutationEnabled } from "@/lib/identity";

// ── Investor Application approval provisioning ───────────────────────────────

/** Trimmed non-empty text, joining array answers; null when there is nothing. */
function asText(value) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean).join(", ") || null;
  return null;
}

/** Multi-select answers as a clean string list, from an array or a CSV string. */
function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return [];
}

/** Integer answer, or null when it is empty / not a number. */
function normalizeNumber(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Ensure the investor profile columns the intake reads and writes exist.
 *
 * Several of them live OUTSIDE the committed migrations — they exist in the
 * production database only (see the section in migrations/align_schema_with_code.sql).
 * This self-heal keeps any environment usable without waiting for a migration to
 * be run by hand. Memoised like the platform's other schema helpers: one attempt
 * per process, and a failure is retried on the next call instead of cached broken.
 */
let investorProfileSchemaPromise = null;
export function ensureInvestorProfileSchema() {
  if (!investorProfileSchemaPromise) {
    investorProfileSchemaPromise = (async () => {
      try {
        await db.execute("ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'pending_review'");
        await db.execute("ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS investment_experience TEXT");
        await db.execute("ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0");
        await db.execute("ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS review_notes TEXT");
        await db.execute("ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE");
        await db.execute("ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS reviewed_by TEXT");
        return true;
      } catch (error) {
        console.warn("[Investor] schema self-heal failed, will retry:", error.message);
        investorProfileSchemaPromise = null;
        return false;
      }
    })();
  }
  return investorProfileSchemaPromise;
}

/**
 * Make a provisioning failure VISIBLE instead of swallowing it: a plain server
 * error, plus a row in the Errors register the admins triage. Never on the
 * critical path — a logging failure must not mask the original one.
 */
async function reportInvestorProvisioningFailure(context, error, contactCid) {
  const message = `[Investor provisioning] ${context} failed: ${error?.message || error}`;
  console.error(message);
  try {
    const { insertErrorLog } = await import("@/models/adminOps");
    await insertErrorLog(
      {
        message,
        stack: error?.stack || null,
        severity: "error",
        endpoint: "automation:investor-provisioning",
        page: "Investor application approval",
        action_attempted: context,
        user_id: contactCid || null,
        method: "AUTOMATION",
      },
      "database_error",
      `investor-provisioning:${context}`,
    );
  } catch (loggingError) {
    console.error("[Investor provisioning] could not record the failure:", loggingError.message);
  }
}

/**
 * Provision the investor account when an Investor Application submission is
 * approved: create (or reuse) the investor profile, store the requested
 * preferences, and give the contact the investor context. Idempotent — a
 * re-approval updates the same profile instead of creating a second one.
 *
 * Every write is guarded so an environment problem is REPORTED, never silent,
 * and never turns a successful approval into a failed request.
 */
export async function provisionInvestorFromApproval({ contactCid, submission, formId }) {
  const cid = String(contactCid || "").trim();
  if (!cid) return { skipped: true, reason: "missing_contact" };

  // 1. Map the submission answers to their meaning via each field's settings.key.
  const data = {};
  try {
    const fieldsResult = await db.execute({
      sql: "SELECT id, settings FROM platform_form_fields WHERE form_id = ?",
      args: [formId],
    });
    const keyMap = {};
    for (const fieldRow of fieldsResult.rows || []) {
      if (fieldRow.settings?.key) keyMap[String(fieldRow.id)] = fieldRow.settings.key;
    }
    for (const [fieldId, value] of Object.entries(submission?.data || {})) {
      const key = keyMap[String(fieldId)];
      if (key) data[key] = value;
    }
  } catch (error) {
    await reportInvestorProvisioningFailure("reading the form's answer mapping", error, cid);
  }

  const organizationName = asText(data.organization_name);
  const biography = asText(data.biography);
  const website = asText(data.website);
  const linkedin = asText(data.linkedin);
  const experience =
    [asText(data.investment_experience), asText(data.prior_investments)].filter(Boolean).join("\n\n") || null;
  const industries = normalizeArray(data.industries);
  const countries = normalizeArray(data.countries);
  const stages = normalizeArray(data.startup_stages);
  const ticketMin = normalizeNumber(data.ticket_size_min);
  const ticketMax = normalizeNumber(data.ticket_size_max);

  // 2. Make sure the profile columns exist (they may be absent in a given env).
  if (!(await ensureInvestorProfileSchema())) {
    await reportInvestorProvisioningFailure(
      "ensuring the investor profile columns",
      new Error("schema self-heal failed"),
      cid,
    );
  }

  // 3. One profile per contact: reuse it when it exists, create it otherwise.
  let profileId = null;
  try {
    const existingResult = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ? LIMIT 1",
      args: [cid],
    });
    profileId = existingResult.rows[0]?.id || null;

    if (profileId) {
      await db.execute({
        sql: `UPDATE investor_profiles
                SET approval_status = 'approved',
                    organization_name = COALESCE(?, organization_name),
                    biography = COALESCE(?, biography),
                    website = COALESCE(?, website),
                    linkedin = COALESCE(?, linkedin),
                    updated_at = NOW()
              WHERE id = ?`,
        args: [organizationName, biography, website, linkedin, profileId],
      });
    } else {
      const inserted = await db.execute({
        sql: `INSERT INTO investor_profiles (user_id, organization_name, biography, website, linkedin, approval_status)
                VALUES (?, ?, ?, ?, ?, 'approved') RETURNING id`,
        args: [cid, organizationName, biography, website, linkedin],
      });
      profileId = inserted.rows[0]?.id || null;
    }
  } catch (error) {
    await reportInvestorProvisioningFailure("creating the investor profile", error, cid);
    return { success: false, error: error.message };
  }

  // 4. Qualification markers (permissions permitting — reported when refused).
  try {
    await db.execute({
      sql: `UPDATE investor_profiles
              SET qualification_status = 'approved', profile_completion = 100, investment_experience = COALESCE(?, investment_experience), updated_at = NOW()
            WHERE id = ?`,
      args: [experience, profileId],
    });
  } catch (error) {
    await reportInvestorProvisioningFailure("writing the qualification markers", error, cid);
  }

  // 5. Preferences — one row per profile.
  if (industries.length || countries.length || stages.length || ticketMin !== null || ticketMax !== null) {
    try {
      await db.execute({
        sql: `INSERT INTO investor_preferences (investor_id, industries, countries, startup_stages, ticket_size_min, ticket_size_max)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (investor_id)
                DO UPDATE SET industries = EXCLUDED.industries, countries = EXCLUDED.countries,
                              startup_stages = EXCLUDED.startup_stages, ticket_size_min = EXCLUDED.ticket_size_min,
                              ticket_size_max = EXCLUDED.ticket_size_max, updated_at = NOW()`,
        args: [profileId, industries, countries, stages, ticketMin, ticketMax],
      });
    } catch (error) {
      await reportInvestorProvisioningFailure("writing the investor preferences", error, cid);
    }
  }

  // 6. Give the contact the investor context (guarded: a baseline identity is
  //    never overwritten — see upgradeContactRoleToInvestor).
  try {
    await upgradeContactRoleToInvestor(cid);
  } catch (error) {
    await reportInvestorProvisioningFailure("granting the investor context", error, cid);
  }

  return { success: true, profile_id: profileId };
}

/** Promote an existing contact to the investor role. */
export async function setContactRoleToInvestor(name, contactId) {
  // PHASE I2 (flag-gated): investor context must not rewrite the baseline.
  if (stopRoleMutationEnabled()) {
    return db.execute({
      sql: "UPDATE contacts SET name = ? WHERE cid = ?",
      args: [name, contactId],
    });
  }
  return db.execute({
    sql: "UPDATE contacts SET role = 'investor', name = ? WHERE cid = ?",
    args: [name, contactId],
  });
}

// ── GET/POST/PUT /api/investor/organizations ─────────────────────────────────

/** Single investor organization by id. */
export async function getOrganizationById(orgId) {
  return db.execute({
    sql: "SELECT * FROM investor_organizations WHERE id = ?",
    args: [orgId],
  });
}

/** Members (with profile + contact info) of one investor organization. */
export async function listOrganizationMembers(orgId) {
  return db.execute({
    sql: `SELECT iom.*, ip.organization_name, c.name, c.email
              FROM investor_org_members iom
              JOIN investor_profiles ip ON iom.investor_id = ip.id
              JOIN contacts c ON ip.user_id = c.cid
              WHERE iom.organization_id = ?`,
    args: [orgId],
  });
}

/** Profile id resolver for the organization list branch. */
export async function getInvestorProfileIdForOrgList(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** Organizations the current investor belongs to (member role included). */
export async function listInvestorOrganizationsByMember(investorProfileId) {
  return db.execute({
    sql: `SELECT io.*, iom.role as member_role
            FROM investor_organizations io
            JOIN investor_org_members iom ON io.id = iom.organization_id
            WHERE iom.investor_id = ?
            ORDER BY io.name`,
    args: [investorProfileId],
  });
}

/** Profile id resolver for the organization create branch. */
export async function getInvestorProfileIdForOrgCreate(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** Create an investor organization. */
export async function insertOrganization(name, description, website, logoUrl) {
  return db.execute({
    sql: `INSERT INTO investor_organizations (name, description, website, logo_url)
            VALUES (?, ?, ?, ?) RETURNING *`,
    args: [name, description, website, logoUrl],
  });
}

/** Add the org creator as its admin member. */
export async function addOrganizationAdmin(orgId, investorId) {
  return db.execute({
    sql: `INSERT INTO investor_org_members (organization_id, investor_id, role)
            VALUES (?, ?, 'admin')`,
    args: [orgId, investorId],
  });
}

/** Add/update an investor organization member. */
export async function upsertOrganizationMember(organizationId, investorProfileId, role) {
  return db.execute({
    sql: `INSERT INTO investor_org_members (organization_id, investor_id, role)
            VALUES (?, ?, ?)
            ON CONFLICT (organization_id, investor_id)
            DO UPDATE SET role = EXCLUDED.role`,
    args: [organizationId, investorProfileId, role],
  });
}

// ── GET/POST/PUT /api/investor/profile ───────────────────────────────────────

/** Current investor profile joined with preferences. */
export async function getInvestorProfileWithPreferences(userId) {
  return db.execute({
    sql: `SELECT ip.*, ipr.industries, ipr.countries, ipr.startup_stages,
                   ipr.ticket_size_min, ipr.ticket_size_max, ipr.investment_philosophy
            FROM investor_profiles ip
            LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
            WHERE ip.user_id = ?`,
    args: [userId],
  });
}

/** Profile id resolver for the profile upsert branch. */
export async function getInvestorProfileIdForProfileUpsert(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** Update an existing investor profile by user_id. */
export async function updateInvestorProfileByUserId(organizationName, biography, website, linkedin, photoUrl, userId) {
  return db.execute({
    sql: `UPDATE investor_profiles
              SET organization_name = ?, biography = ?, website = ?, linkedin = ?,
                  photo_url = ?, updated_at = NOW()
              WHERE user_id = ? RETURNING *`,
    args: [organizationName, biography, website, linkedin, photoUrl, userId],
  });
}

/** Create an investor profile (photo variant, self-service). */
export async function insertInvestorProfileWithPhoto(userId, organizationName, biography, website, linkedin, photoUrl) {
  return db.execute({
    sql: `INSERT INTO investor_profiles (user_id, organization_name, biography, website, linkedin, photo_url, approval_status)
              VALUES (?, ?, ?, ?, ?, ?, 'pending_review') RETURNING *`,
    args: [userId, organizationName, biography, website, linkedin, photoUrl],
  });
}

/** Upgrade a contact record to the investor role when not staff/admin. */
export async function upgradeContactRoleToInvestor(contactId) {
  // PHASE I2 (flag-gated): same rule as setContactRoleToInvestor.
  if (stopRoleMutationEnabled()) {
    return { rows: [], rowCount: 0 };
  }
  return db.execute({
    sql: "UPDATE contacts SET role = 'investor' WHERE cid = ? AND role NOT IN ('super_admin','staff','admin')",
    args: [contactId],
  });
}

/** Admin update of any investor profile by profile id. */
export async function updateInvestorProfileById(organizationName, biography, website, linkedin, photoUrl, profileId) {
  return db.execute({
    sql: `UPDATE investor_profiles
            SET organization_name = ?, biography = ?, website = ?, linkedin = ?,
                photo_url = ?, updated_at = NOW()
            WHERE id = ? RETURNING *`,
    args: [organizationName, biography, website, linkedin, photoUrl, profileId],
  });
}
