import db from "@/lib/db";
import { stopRoleMutationEnabled } from "@/lib/identity";

/**
 * Investor relations model — data access for the investor relationship and
 * account controllers under `src/app/api/investor/`:
 *
 *   src/app/api/investor/relationships/route.js            (12 queries)
 *   src/app/api/investor/relationships/meetings/route.js   (10 queries)
 *   src/app/api/investor/meetings/route.js                 ( 2 queries)
 *   src/app/api/investor/organizations/route.js            ( 8 queries)
 *   src/app/api/investor/profile/route.js                  ( 6 queries)
 *   src/app/api/investor/decisions/route.js                ( 6 queries)
 *   src/app/api/investor/approval/route.js                 ( 5 queries)
 *   src/app/api/investor/watchlist/route.js                ( 4 queries)
 *   src/app/api/investor/preferences/route.js              ( 2 queries)
 *   src/app/api/investor/setup-password/route.js           ( 2 queries)
 *   src/app/api/investor/campaigns/route.js                (10 queries)
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so
 * lookups that repeat the same SQL across routes (e.g. the investor_profiles
 * id-by-user_id resolver) intentionally have one function per call site.
 */

// ── GET/POST/PUT /api/investor/relationships ─────────────────────────────────

/** Single relationship workspace detail with pipeline stage + names. */
export async function getRelationshipWorkspaceDetail(workspaceId) {
  return db.execute({
    sql: `SELECT rw.*, ip.stage as pipeline_stage, ipr.organization_name, c.name as investor_name, c.email as investor_email,
                       p.name as venture_name, p.industry, p.country,
                       rm.name as relationship_manager_name, im.name as investment_manager_name
                FROM relationship_workspaces rw
                JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
                LEFT JOIN investor_profiles ipr ON rw.investor_id = ipr.id
                LEFT JOIN contacts c ON ipr.user_id = c.cid
                LEFT JOIN v2_programs p ON rw.venture_id = p.id
                LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
                LEFT JOIN contacts im ON rw.investment_manager_id = im.cid
                WHERE rw.id = ?`,
    args: [workspaceId],
  });
}

/** Meetings attached to one relationship workspace (detail view). */
export async function listWorkspaceMeetings(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM relationship_meetings WHERE workspace_id = ? ORDER BY scheduled_date ASC, scheduled_time ASC",
    args: [workspaceId],
  });
}

/** Timeline entries attached to one relationship workspace. */
export async function listWorkspaceTimeline(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM relationship_timeline WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50",
    args: [workspaceId],
  });
}

/** Relationship workspace list — investor branch or admin branch. */
export async function listRelationshipWorkspaces({ investorId, ventureId }) {
  let sql, args;

  // Scope on the PROFILE, not the role string: a baseline member holding an
  // investor profile is an investor too, and used to fall into the unfiltered
  // (admin) branch — exposing every investor's workspaces.
  if (investorId !== null && investorId !== undefined) {
    sql = `SELECT rw.*, ip.stage as pipeline_stage, p.name as venture_name, p.industry,
                    (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
             FROM relationship_workspaces rw
             JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
             LEFT JOIN v2_programs p ON rw.venture_id = p.id
             WHERE rw.investor_id = ?
             ORDER BY rw.updated_at DESC`;
    args = [investorId];
  } else {
    sql = `SELECT rw.*, ip.stage as pipeline_stage, ipr.organization_name, c.name as investor_name,
                    p.name as venture_name, p.industry,
                    rm.name as relationship_manager_name,
                    (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
             FROM relationship_workspaces rw
             JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
             LEFT JOIN investor_profiles ipr ON rw.investor_id = ipr.id
             LEFT JOIN contacts c ON ipr.user_id = c.cid
             LEFT JOIN v2_programs p ON rw.venture_id = p.id
             LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
             ORDER BY rw.updated_at DESC`;
    args = [];
  }

  if (ventureId) {
    sql += ventureId ? " AND rw.venture_id = ?" : "";
    if (ventureId) args.push(ventureId);
  }

  return db.execute({ sql, args });
}

/** Pipeline row used to seed a relationship workspace (POST). */
export async function getPipelineById(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM investment_pipeline WHERE id = ?",
    args: [pipelineId],
  });
}

/** Create/activate a relationship workspace for a pipeline. */
export async function upsertRelationshipWorkspace(pipelineId, investorId, ventureId, relationshipManagerId, investmentManagerId) {
  return db.execute({
    sql: `INSERT INTO relationship_workspaces (pipeline_id, investor_id, venture_id, relationship_manager_id, investment_manager_id, status, current_stage)
            VALUES (?, ?, ?, ?, ?, 'active', 'introduction_approved')
            ON CONFLICT (pipeline_id)
            DO UPDATE SET status = 'active', relationship_manager_id = EXCLUDED.relationship_manager_id,
                          investment_manager_id = EXCLUDED.investment_manager_id, current_stage = 'introduction_approved',
                          updated_at = NOW()
            RETURNING *`,
    args: [pipelineId, investorId, ventureId, relationshipManagerId, investmentManagerId],
  });
}

/** Timeline entry for the initial workspace creation. */
export async function insertWorkspaceCreatedTimeline(workspaceId, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
            VALUES (?, 'workspace_created', 'Relationship workspace created. Introduction approved.', ?)`,
    args: [workspaceId, actorId],
  });
}

/** Investor user_id resolver for the introduction-approval notification. */
export async function getInvestorUserIdByProfileId(profileId) {
  return db.execute({
    sql: "SELECT user_id FROM investor_profiles WHERE id = ?",
    args: [profileId],
  });
}

/** Notify the investor that their introduction was approved. */
export async function notifyIntroductionApproved(recipientId) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [
      recipientId,
      "Introduction Approved",
      "Your introduction request has been approved. A Relationship Manager will coordinate your first meeting.",
      "/investor/dashboard?tab=discover",
    ],
  });
}

/** Partial update of a relationship workspace. */
export async function updateRelationshipWorkspace(workspaceId, updates) {
  const sets = [];
  const args = [];

  if (updates.relationship_manager_id) { sets.push("relationship_manager_id = ?"); args.push(updates.relationship_manager_id); }
  if (updates.investment_manager_id) { sets.push("investment_manager_id = ?"); args.push(updates.investment_manager_id); }
  if (updates.status) { sets.push("status = ?"); args.push(updates.status); }
  if (updates.current_stage) { sets.push("current_stage = ?"); args.push(updates.current_stage); }
  if (updates.next_action !== undefined) { sets.push("next_action = ?"); args.push(updates.next_action); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(workspaceId);

  return db.execute({
    sql: `UPDATE relationship_workspaces SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Timeline entry when a workspace status changes. */
export async function insertWorkspaceStatusChangedTimeline(workspaceId, description, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
              VALUES (?, 'status_changed', ?, ?)`,
    args: [workspaceId, description, actorId],
  });
}

// ── GET/POST/PUT /api/investor/relationships/meetings ────────────────────────

/** Meetings list for one relationship workspace. */
export async function listMeetingsForWorkspace(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM relationship_meetings WHERE workspace_id = ? ORDER BY scheduled_date ASC, scheduled_time ASC",
    args: [workspaceId],
  });
}

/** Create a scheduled relationship meeting. */
export async function insertRelationshipMeeting(workspaceId, meetingType, scheduledDate, scheduledTime, durationMinutes, location, notes) {
  return db.execute({
    sql: `INSERT INTO relationship_meetings (workspace_id, meeting_type, scheduled_date, scheduled_time, duration_minutes, location, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled') RETURNING *`,
    args: [workspaceId, meetingType, scheduledDate, scheduledTime, durationMinutes, location, notes],
  });
}

/** Venture id for a relationship workspace (meeting timeline lookups). */
export async function getVentureIdByWorkspaceId(workspaceId) {
  return db.execute({
    sql: "SELECT venture_id FROM relationship_workspaces WHERE id = ?",
    args: [workspaceId],
  });
}

/** Venture name for a scheduled-meeting timeline description. */
export async function getVentureNameForScheduledMeeting(programId) {
  return db.execute({
    sql: "SELECT name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Timeline entry when a meeting is scheduled. */
export async function insertMeetingScheduledTimeline(workspaceId, description, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
            VALUES (?, 'meeting_scheduled', ?, ?)`,
    args: [workspaceId, description, actorId],
  });
}

/** Partial update of a relationship meeting. */
export async function updateRelationshipMeeting(meetingId, updates) {
  const sets = [];
  const args = [];

  if (updates.status) { sets.push("status = ?"); args.push(updates.status); }
  if (updates.notes !== undefined) { sets.push("notes = ?"); args.push(updates.notes); }
  if (updates.outcome !== undefined) { sets.push("outcome = ?"); args.push(updates.outcome); }
  if (updates.action_items !== undefined) { sets.push("action_items = ?"); args.push(typeof updates.action_items === "string" ? updates.action_items : JSON.stringify(updates.action_items)); }
  if (updates.scheduled_date) { sets.push("scheduled_date = ?"); args.push(updates.scheduled_date); }
  if (updates.scheduled_time !== undefined) { sets.push("scheduled_time = ?"); args.push(updates.scheduled_time); }
  if (updates.location !== undefined) { sets.push("location = ?"); args.push(updates.location); }
  if (updates.meeting_type) { sets.push("meeting_type = ?"); args.push(updates.meeting_type); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(meetingId);

  return db.execute({
    sql: `UPDATE relationship_meetings SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Workspace row for a meeting-completed timeline entry. */
export async function getWorkspaceForMeetingCompletion(meetingId) {
  return db.execute({
    sql: "SELECT id, venture_id FROM relationship_workspaces WHERE id = (SELECT workspace_id FROM relationship_meetings WHERE id = ?)",
    args: [meetingId],
  });
}

/** Venture name for a completed-meeting timeline description. */
export async function getVentureNameForCompletedMeeting(programId) {
  return db.execute({
    sql: "SELECT name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Timeline entry when a meeting is completed. */
export async function insertMeetingCompletedTimeline(workspaceId, description, actorId) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
                VALUES (?, 'meeting_completed', ?, ?)`,
    args: [workspaceId, description, actorId],
  });
}

/** Persist the first action item as the workspace next_action. */
export async function setWorkspaceNextAction(nextAction, workspaceId) {
  return db.execute({
    sql: "UPDATE relationship_workspaces SET next_action = ?, updated_at = NOW() WHERE id = ?",
    args: [nextAction, workspaceId],
  });
}

// ── GET/POST /api/investor/meetings ──────────────────────────────────────────

/** Investor-meeting events, optionally filtered by venture. */
export async function listInvestorMeetingEvents({ ventureId }) {
  let sql = `SELECT e.*, p.name as venture_name
               FROM v2_events e
               LEFT JOIN v2_programs p ON e.program_id = p.id
               WHERE e.event_type = 'investor_meeting'`;
  const args = [];

  if (ventureId) {
    sql += " AND e.program_id = ?";
    args.push(ventureId);
  }

  sql += " ORDER BY e.start_time DESC";

  return db.execute({ sql, args });
}

/** Schedule an investor-meeting event. */
export async function insertInvestorMeeting(ventureId, title, description, startTime, endTime, location, createdBy) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, location, created_by)
            VALUES (?, ?, ?, 'investor_meeting', ?, ?, ?, ?) RETURNING *`,
    args: [ventureId, title, description, startTime, endTime, location, createdBy],
  });
}

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

// ── GET/POST /api/investor/decisions ─────────────────────────────────────────

/** Profile id resolver for the decisions list branch. */
export async function getInvestorProfileIdForDecisions(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** All investment decisions for one investor with venture info. */
export async function listInvestorDecisions(investorProfileId) {
  return db.execute({
    sql: `SELECT d.*, ip.venture_id, p.name as venture_name, p.industry,
                   ip.stage as pipeline_stage, ip.created_at as pipeline_created
            FROM investment_decisions d
            JOIN investment_pipeline ip ON d.pipeline_id = ip.id
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.investor_id = ?
            ORDER BY d.decision_date DESC`,
    args: [investorProfileId],
  });
}

/** Investment history timeline (all pipeline activity) for one investor. */
export async function listInvestorHistoryTimeline(investorProfileId) {
  return db.execute({
    sql: `SELECT ip.id, ip.venture_id, p.name as venture_name, ip.stage,
                   ip.stage_changed_at, ip.notes, ip.created_at,
                   d.decision_type, d.investment_amount, d.decision_date
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            LEFT JOIN investment_decisions d ON d.pipeline_id = ip.id
            WHERE ip.investor_id = ?
            ORDER BY ip.stage_changed_at DESC NULLS LAST`,
    args: [investorProfileId],
  });
}

/** Decision stats (invested/declined/total) for one investor. */
export async function getInvestorDecisionStats(investorProfileId) {
  return db.execute({
    sql: `SELECT
              COUNT(*) FILTER (WHERE d.decision_type = 'invest') as total_invested,
              COALESCE(SUM(d.investment_amount) FILTER (WHERE d.decision_type = 'invest'), 0) as total_capital,
              COUNT(*) FILTER (WHERE d.decision_type = 'decline') as total_declined,
              COUNT(*) as total_decisions
            FROM investment_decisions d
            JOIN investment_pipeline ip ON d.pipeline_id = ip.id
            WHERE ip.investor_id = ?`,
    args: [investorProfileId],
  });
}

/** Record (or update) an investment decision for a pipeline. */
export async function recordInvestmentDecision(pipelineId, decisionType, investmentAmount, decisionNotes) {
  return db.execute({
    sql: `INSERT INTO investment_decisions (pipeline_id, decision_type, investment_amount, decision_notes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (pipeline_id) DO UPDATE
            SET decision_type = EXCLUDED.decision_type, investment_amount = EXCLUDED.investment_amount,
                decision_notes = EXCLUDED.decision_notes, decision_date = CURRENT_DATE`,
    args: [pipelineId, decisionType, investmentAmount, decisionNotes],
  });
}

/** Move the pipeline stage to match a recorded decision. */
export async function updatePipelineStageAfterDecision(stage, pipelineId) {
  return db.execute({
    sql: "UPDATE investment_pipeline SET stage = ?, stage_changed_at = NOW(), updated_at = NOW() WHERE id = ?",
    args: [stage, pipelineId],
  });
}

// ── GET/POST /api/investor/approval ──────────────────────────────────────────

/** Investors with contact info, filterable by approval status + search. */
export async function listInvestorsByApprovalStatus({ status, search }) {
  let sql = `SELECT ip.*, c.name, c.email, c.status as contact_status, c.created_at as joined_at
               FROM investor_profiles ip
               JOIN contacts c ON ip.user_id = c.cid
               WHERE 1=1`;
  const args = [];

  if (status !== "all") {
    sql += " AND ip.approval_status = ?";
    args.push(status);
  }
  if (search) {
    sql += " AND (c.name ILIKE ? OR c.email ILIKE ? OR ip.organization_name ILIKE ?)";
    const searchPattern = `%${search}%`;
    args.push(searchPattern, searchPattern, searchPattern);
  }

  sql += " ORDER BY ip.created_at DESC";

  return db.execute({ sql, args });
}

/** Set an investor profile's approval status. */
export async function setInvestorApprovalStatus(profileId, newStatus) {
  return db.execute({
    sql: "UPDATE investor_profiles SET approval_status = ?, updated_at = NOW() WHERE id = ?",
    args: [newStatus, profileId],
  });
}

/** Persist review notes on an investor profile. */
export async function setInvestorReviewNotes(profileId, reason) {
  return db.execute({
    sql: "UPDATE investor_profiles SET review_notes = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
    args: [reason, profileId],
  });
}

/** Investor profile + contact info for the approval notification. */
export async function getInvestorWithContactByProfileId(profileId) {
  return db.execute({
    sql: `SELECT ip.*, c.name, c.email FROM investor_profiles ip
            JOIN contacts c ON ip.user_id = c.cid WHERE ip.id = ?`,
    args: [profileId],
  });
}

/** Notify the investor that their account status changed. */
export async function notifyInvestorOfApprovalStatus(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'investor', 0, NOW())`,
    args: [recipientId, title, message],
  });
}

// ── POST /api/investor/watchlist ─────────────────────────────────────────────

/** Profile id resolver for the watchlist toggle. */
export async function getInvestorProfileIdForWatchlist(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** Existing watchlist entry for an investor + venture pair. */
export async function findWatchlistEntry(investorId, ventureId) {
  return db.execute({
    sql: "SELECT id FROM investor_watchlist WHERE investor_id = ? AND venture_id = ?",
    args: [investorId, ventureId],
  });
}

/** Remove a venture from the investor's watchlist. */
export async function removeWatchlistEntry(investorId, ventureId) {
  return db.execute({
    sql: "DELETE FROM investor_watchlist WHERE investor_id = ? AND venture_id = ?",
    args: [investorId, ventureId],
  });
}

/** Add a venture to the investor's watchlist. */
export async function addWatchlistEntry(investorId, ventureId, personalNotes) {
  return db.execute({
    sql: "INSERT INTO investor_watchlist (investor_id, venture_id, personal_notes) VALUES (?, ?, ?)",
    args: [investorId, ventureId, personalNotes],
  });
}

// ── POST /api/investor/preferences ───────────────────────────────────────────

/** Profile id resolver for the preferences upsert. */
export async function getInvestorProfileIdForPreferences(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** Upsert investor preferences (philosophy variant, self-service). */
export async function upsertInvestorPreferencesWithPhilosophy(investorId, industries, countries, startupStages, ticketSizeMin, ticketSizeMax, investmentPhilosophy) {
  return db.execute({
    sql: `INSERT INTO investor_preferences (investor_id, industries, countries, startup_stages, ticket_size_min, ticket_size_max, investment_philosophy)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (investor_id)
            DO UPDATE SET industries = EXCLUDED.industries, countries = EXCLUDED.countries,
                          startup_stages = EXCLUDED.startup_stages, ticket_size_min = EXCLUDED.ticket_size_min,
                          ticket_size_max = EXCLUDED.ticket_size_max, investment_philosophy = EXCLUDED.investment_philosophy,
                          updated_at = NOW()`,
    args: [investorId, industries, countries, startupStages, ticketSizeMin, ticketSizeMax, investmentPhilosophy],
  });
}

// ── POST /api/investor/setup-password ────────────────────────────────────────

/** Contact lookup by a valid setup token. */
export async function findContactBySetupToken(token) {
  return db.execute({
    sql: `SELECT cid, setup_token_expires FROM contacts
            WHERE setup_token = ? AND deleted_at IS NULL`,
    args: [token],
  });
}

/** Set a contact's password and clear the setup token. */
export async function clearSetupTokenAndSetPassword(hashedPassword, contactCid) {
  return db.execute({
    sql: `UPDATE contacts SET password = ?, setup_token = NULL, setup_token_expires = NULL WHERE cid = ?`,
    args: [hashedPassword, contactCid],
  });
}

// ── GET/POST/PUT /api/investor/campaigns ─────────────────────────────────────

/** Fundraising campaigns with venture info + investor counts, filterable. */
export async function listFundraisingCampaigns({ ventureId, status, investorId = null }) {
  let sql = `SELECT fc.*, p.name as venture_name, p.industry, p.country, p.business_stage,
                      p.funding_requirement, p.completion_index,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage NOT IN ('declined')) as investor_count,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage IN ('due_diligence','negotiation')) as active_dd_count
               FROM fundraising_campaigns fc
               LEFT JOIN v2_programs p ON fc.venture_id = p.id
               WHERE 1=1`;
  const args = [];

  if (ventureId) {
    sql += " AND fc.venture_id = ?";
    args.push(ventureId);
  }
  if (status) {
    sql += " AND fc.status = ?";
    args.push(status);
  }
  // Phase 1.5: non-management sessions (investor/member context) only see
  // campaigns for ventures they are engaged with in the pipeline.
  if (investorId) {
    sql +=
      " AND fc.venture_id IN (SELECT DISTINCT venture_id FROM investment_pipeline WHERE investor_id = ?)";
    args.push(investorId);
  }

  sql += " ORDER BY fc.created_at DESC";

  return db.execute({ sql, args });
}

/** Create a draft fundraising campaign. */
export async function insertFundraisingCampaign(ventureId, name, targetRaise, minInvestment, maxInvestment, currency, visibility, openingDate, closingDate) {
  return db.execute({
    sql: `INSERT INTO fundraising_campaigns (venture_id, name, target_raise, min_investment, max_investment, currency, visibility, opening_date, closing_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
            RETURNING *`,
    args: [ventureId, name, targetRaise, minInvestment, maxInvestment, currency, visibility, openingDate, closingDate],
  });
}

/** Pre-update funding snapshot for milestone detection. */
export async function getCampaignFundingSnapshot(campaignId) {
  return db.execute({
    sql: "SELECT current_raised, target_raise, venture_id FROM fundraising_campaigns WHERE id = ?",
    args: [campaignId],
  });
}

/** Partial update of a fundraising campaign. */
export async function updateFundraisingCampaign(campaignId, updates) {
  const sets = [];
  const args = [];

  if (updates.status) { sets.push("status = ?"); args.push(updates.status); }
  if (updates.current_raised !== undefined) { sets.push("current_raised = ?"); args.push(parseFloat(updates.current_raised)); }
  if (updates.target_raise !== undefined) { sets.push("target_raise = ?"); args.push(parseFloat(updates.target_raise)); }
  if (updates.min_investment !== undefined) { sets.push("min_investment = ?"); args.push(parseFloat(updates.min_investment)); }
  if (updates.max_investment !== undefined) { sets.push("max_investment = ?"); args.push(parseFloat(updates.max_investment)); }
  if (updates.name) { sets.push("name = ?"); args.push(updates.name); }
  if (updates.visibility) { sets.push("visibility = ?"); args.push(updates.visibility); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(campaignId);

  return db.execute({
    sql: `UPDATE fundraising_campaigns SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Venture profile used for campaign-launch investor matching. */
export async function getCampaignVentureProfile(ventureId) {
  return db.execute({
    sql: "SELECT name, industry, country, business_stage FROM v2_programs WHERE id = ?",
    args: [ventureId],
  });
}

/** Approved investors with their preference lists. */
export async function listApprovedInvestorsWithPreferences() {
  return db.execute({
    sql: `SELECT DISTINCT ip.user_id, ip.id as profile_id, ipr.industries, ipr.countries, ipr.startup_stages
                FROM investor_profiles ip
                LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
                WHERE ip.approval_status = 'approved'`,
    args: [],
  });
}

/** Notify an investor about a newly opened campaign. */
export async function notifyInvestorOfNewCampaign(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                    VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [recipientId, title, message, "/investor/dashboard?tab=discover"],
  });
}

/** Venture name for a funding-milestone alert. */
export async function getVentureNameForMilestoneAlert(programId) {
  return db.execute({
    sql: "SELECT name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Approved investors watching a venture. */
export async function listInvestorsWatchingVenture(ventureId) {
  return db.execute({
    sql: `SELECT DISTINCT ip.user_id FROM investor_watchlist iw
                  JOIN investor_profiles ip ON iw.investor_id = ip.id
                  WHERE iw.venture_id = ? AND ip.approval_status = 'approved'`,
    args: [ventureId],
  });
}

/** Notify a watching investor that a funding milestone was hit. */
export async function notifyInvestorOfFundingMilestone(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                    VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [recipientId, title, message, "/investor/dashboard?tab=watchlist"],
  });
}
