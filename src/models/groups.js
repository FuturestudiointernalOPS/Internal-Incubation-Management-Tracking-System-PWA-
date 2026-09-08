import db from "@/lib/db";

/**
 * Groups model — data access for the group / people-organization controllers:
 * `src/app/api/groups/route.js` (contact groups — families table),
 * `src/app/api/user-groups/route.js` (user ⇄ group membership),
 * `src/app/api/participants/route.js` (enrollment + contact credential sync),
 * `src/app/api/segments/route.js` + `src/app/api/segments/run/route.js` (retired),
 * `src/app/api/invites/route.js` + `src/app/api/invites/[token]/route.js` (invites),
 * `src/app/api/teams/route.js` (CRM / organization teams — distinct from the
 * pm-teams model in `src/models/teams.js`).
 *
 * Each function wraps exactly one SQL statement, extracted 1:1 from a former
 * inline call site. Where a controller ran the same statement in two flows
 * (e.g. the insert retry after self-heal column adds, or the invite-token hash
 * backfill in both GET and POST), the model keeps one function per call site —
 * see docs/MVC_REFACTOR.md §4. SQL is byte-identical to the original queries,
 * so behavior is unchanged. Dynamic SET / IN lists are rebuilt with the same
 * expressions the controllers used.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET / POST / PUT / DELETE /api/groups (families table) ───────────────────

/** Contact groups (families), filtered by program and/or name search, newest first. */
export async function getGroups(program_id, search) {
  let sql = "SELECT * FROM families";
  let args = [];
  let conditions = [];

  if (program_id) {
    conditions.push("program_id = ?");
    args.push(program_id);
  }
  if (search) {
    conditions.push("LOWER(name) LIKE LOWER(?)");
    args.push(`%${search}%`);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** Insert a contact group (POST fast path). `insertArgs` = controller-built VALUES array. */
export async function createGroup(insertArgs) {
  return db.execute({
    sql: `INSERT INTO families (program_id, name, type, description, default_role, registration_id)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id, registration_id`,
    args: insertArgs,
  });
}

/** Self-heal on insert failure: ensure the description column exists (POST /api/groups). */
export async function addFamilyDescriptionColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS description TEXT");
}

/** Self-heal on insert failure: ensure the default_role column exists (POST /api/groups). */
export async function addFamilyDefaultRoleColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT");
}

/** Self-heal on insert failure: ensure the is_archived column exists (POST /api/groups). */
export async function addFamilyIsArchivedColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0");
}

/**
 * Insert a contact group — retry after the self-heal column adds.
 * Byte-identical query to createGroup; extracted separately so each original
 * inline call site maps 1:1 to a model function.
 */
export async function createGroupAfterColumnSelfHeal(insertArgs) {
  return db.execute({
    sql: `INSERT INTO families (program_id, name, type, description, default_role, registration_id)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id, registration_id`,
    args: insertArgs,
  });
}

/** Update a contact group's mutable fields — dynamic SET built by the controller (PUT fast path). */
export async function updateGroup(updates, args) {
  return db.execute({
    sql: `UPDATE families SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Self-heal on update failure: ensure the description column exists (PUT /api/groups). */
export async function addFamilyDescriptionColumnOnUpdate() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS description TEXT");
}

/** Self-heal on update failure: ensure the default_role column exists (PUT /api/groups). */
export async function addFamilyDefaultRoleColumnOnUpdate() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT");
}

/** Self-heal on update failure: ensure the is_archived column exists (PUT /api/groups). */
export async function addFamilyIsArchivedColumnOnUpdate() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0");
}

/**
 * Update a contact group — retry after the self-heal column adds.
 * Byte-identical query to updateGroup; extracted separately so each original
 * inline call site maps 1:1 to a model function.
 */
export async function updateGroupAfterColumnSelfHeal(updates, args) {
  return db.execute({
    sql: `UPDATE families SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Delete a contact group (families) by id. */
export async function deleteGroup(id) {
  return db.execute({
    sql: "DELETE FROM families WHERE id = ?",
    args: [id],
  });
}

// ── GET / POST / DELETE /api/user-groups ─────────────────────────────────────

/** Group names + role for one user (user_groups membership rows, by name). */
export async function getUserGroups(userCid) {
  return db.execute({
    sql: "SELECT group_name, role_in_group FROM user_groups WHERE user_cid = ? ORDER BY group_name",
    args: [userCid],
  });
}

/** Legacy fallback: the single group_name column on the user's contact row. */
export async function getContactLegacyGroup(cid) {
  return db.execute({
    sql: "SELECT group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Assign a user to a group (idempotent user_groups upsert by admin). */
export async function assignUserToGroup(user_cid, group_name) {
  return db.execute({
    sql: `INSERT INTO user_groups (user_cid, group_name, assigned_by)
            VALUES (?, ?, 'admin')
            ON CONFLICT (user_cid, group_name) DO NOTHING`,
    args: [user_cid, group_name],
  });
}

/** Open a group membership record (join history for the membership layer). */
export async function createGroupMembership(
  user_cid,
  group_name,
  started_at,
  expires_at,
  status,
  created_by,
) {
  return db.execute({
    sql: `INSERT INTO group_memberships
                (user_cid, group_name, started_at, expires_at, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
    args: [user_cid, group_name, started_at, expires_at, status, created_by],
  });
}

/** Record the join event for a group membership (legacy group API note). */
export async function createGroupMembershipEvent(
  user_cid,
  group_name,
  action,
  actor_cid,
  note,
) {
  return db.execute({
    sql: `INSERT INTO group_membership_events
                (user_cid, group_name, action, actor_cid, note)
              VALUES (?, ?, ?, ?, ?)`,
    args: [user_cid, group_name, action, actor_cid, note],
  });
}

/** Remove a user from a group (user_groups edge only — history is kept). */
export async function unassignUserFromGroup(user_cid, group_name) {
  return db.execute({
    sql: "DELETE FROM user_groups WHERE user_cid = ? AND group_name = ?",
    args: [user_cid, group_name],
  });
}

/** End (never delete) a user's group membership record. */
export async function endGroupMembership(updated_by, user_cid, group_name) {
  return db.execute({
    sql: `UPDATE group_memberships
              SET status = 'ended', updated_by = ?, updated_at = NOW()
              WHERE user_cid = ? AND group_name = ?`,
    args: [updated_by, user_cid, group_name],
  });
}

/** Record the end event for a group membership (legacy group API note). */
export async function createGroupMembershipEndEvent(user_cid, group_name, actor_cid) {
  return db.execute({
    sql: `INSERT INTO group_membership_events
                (user_cid, group_name, action, actor_cid, note)
              VALUES (?, ?, 'ended', ?, 'legacy group API')`,
    args: [user_cid, group_name, actor_cid],
  });
}

// ── POST / GET /api/participants (enrollment + contact sync) ─────────────────

/** Upsert the participant's V1 contact (unusable hash; role participant). */
export async function upsertParticipantContact(cid, name, email, phone, password) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, role, password)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              role = EXCLUDED.role`,
    args: [cid, name, email, phone || null, "participant", password],
  });
}

/** Resolve the real contact cid after the email upsert (case-insensitive). */
export async function getContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
    args: [email],
  });
}

/** Enroll a participant as pending in participant_programs (canonical membership). */
export async function enrollPendingParticipantProgram(
  participant_id,
  program_id,
  screening_status,
) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at, screening_status)
              VALUES (?, ?, 'pending', NOW(), ?)
              ON CONFLICT (participant_id, program_id) DO UPDATE SET screening_status = EXCLUDED.screening_status`,
    args: [participant_id, program_id, screening_status || "pending"],
  });
}

/** Timeline event for the direct participant enrollment (generated cid, program_id). */
export async function logParticipantEnrollment(contact_cid, program_id) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'participant_enrolled', 'Enrolled in program', 'programs', ?, 'system', '{}'::jsonb)`,
    args: [contact_cid, program_id],
  });
}

/** Active program participants (participant_programs + contacts), optionally scoped to facilitator team ids. */
export async function getProgramParticipants(programId, teamIds) {
  let sql = `
      SELECT CAST(c.cid AS TEXT) as id,
             c.cid,
             CAST(c.cid AS TEXT) as user_id,
             c.name, c.email, c.phone,
             c.status, c.created_at, c.group_name, c.v2_team_id,
             pp.screening_status,
             pp.program_id, 'enrolled' as source
      FROM participant_programs pp
      JOIN contacts c ON pp.participant_id = c.cid
      WHERE CAST(pp.program_id AS TEXT) = ?
        AND c.deleted = 0
        AND c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM v2_program_staff ps
          WHERE CAST(ps.program_id AS TEXT) = ?
            AND ps.role = 'facilitator'
            AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
        )
    `;
  const args = [String(programId), String(programId)];

  // Facilitator team scope: only participants assigned to the facilitator's
  // v2_teams (where handler_id = facilitator cid).
  if (teamIds && teamIds.length > 0) {
    sql += " AND c.v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")";
    args.push(...teamIds);
  }

  sql += " ORDER BY c.created_at DESC";

  return db.execute({ sql, args });
}

// ── GET / POST /api/segments (retired — kept for re-enable) ──────────────────

/** All saved segments, newest first (retired GET /api/segments). */
export async function listSegments() {
  return db.execute(
    "SELECT * FROM segments ORDER BY created_at DESC",
  );
}

/** Save a segment definition, returning the new id (retired POST /api/segments). */
export async function createSegment(name, criteria) {
  return db.execute({
    sql: "INSERT INTO segments (name, criteria) VALUES (?, ?) RETURNING id",
    args: [name, criteria],
  });
}

// ── POST /api/segments/run (retired — kept for re-enable) ────────────────────

/** Contacts matching a segment's campaign/status filters (retired run endpoint). */
export async function querySegmentContacts(filters) {
  let sql = `SELECT c.* FROM contacts c`;
  let conditions = [];
  let args = [];

  if (filters.campaign_id || filters.status) {
    sql += ` JOIN campaign_contacts cc ON c.cid = cc.cid`;
    if (filters.campaign_id) {
      conditions.push(`cc.campaign_id = ?`);
      args.push(filters.campaign_id);
    }
    if (filters.status) {
      if (filters.status === "NOT_RESPONDED") {
        conditions.push(`cc.status IN ('sent', 'pending')`);
      } else {
        conditions.push(`cc.status = ?`);
        args.push(filters.status.toLowerCase());
      }
    }
  }
  if (conditions.length > 0) sql += ` WHERE ` + conditions.join(" AND ");
  sql += ` GROUP BY c.id`;

  return db.execute({ sql, args });
}

// ── GET / POST /api/invites ──────────────────────────────────────────────────

/** Ensure the v2_invitations table exists (idempotent, per-request). */
export async function ensureInvitationsTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS v2_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        program_id TEXT NOT NULL,
        group_name TEXT,
        team_id TEXT,
        role TEXT DEFAULT 'participant',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    args: [],
  });
}

/** Insert a program invite link (plain token + token_hash; blank email). */
export async function createInvitation(
  token,
  token_hash,
  program_id,
  group_name,
  team_id,
  role,
  email,
  expires_at,
) {
  return db.execute({
    sql: `INSERT INTO v2_invitations (token, token_hash, program_id, group_name, team_id, role, email, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      token,
      token_hash,
      program_id,
      group_name || null,
      team_id || null,
      role,
      email,
      expires_at,
    ],
  });
}

/** Unexpired invites, optionally narrowed to one program (GET /api/invites). */
export async function listActiveInvites(program_id) {
  let query =
    "SELECT * FROM v2_invitations WHERE expires_at > datetime('now')";
  let args = [];

  if (program_id) {
    query += " AND program_id = ?";
    args.push(program_id);
  }

  return db.execute({ sql: query, args });
}

// ── GET / POST /api/invites/[token] (password-setup tokens) ──────────────────

/** Unused password-setup token row matching a token hash or raw token (GET validation). */
export async function resolveInviteToken(token_hash, token) {
  return db.execute({
    sql: "SELECT id, token, token_hash, contact_cid, expires_at FROM password_setup_tokens WHERE used = 0 AND (token_hash = ? OR token = ?)",
    args: [token_hash, token],
  });
}

/** Backfill the hash on a legacy token row seen during GET validation. */
export async function backfillInviteTokenHashOnValidate(token_hash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [token_hash, id],
  });
}

/** Password-setup token row matching a token hash or raw token, incl. used flag (POST accept). */
export async function getPasswordSetupToken(token_hash, token) {
  return db.execute({
    sql: "SELECT id, token_hash, contact_cid, used FROM password_setup_tokens WHERE (token_hash = ? OR token = ?)",
    args: [token_hash, token],
  });
}

/**
 * Backfill the hash on a legacy token row seen during POST acceptance.
 * Byte-identical query to backfillInviteTokenHashOnValidate; extracted
 * separately so each original inline call site maps 1:1 to a model function.
 */
export async function backfillInviteTokenHashOnAccept(token_hash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [token_hash, id],
  });
}

/** Contact profile row (name/email/role/group/program) for an invite acceptance. */
export async function getContactProfileByCid(cid) {
  return db.execute({
    sql: "SELECT name, email, role, group_name, program_id FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Existing (non-deleted) contact rows matching an exact email (acceptance dedupe). */
export async function findContactByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE email = ? AND deleted = 0",
    args: [email],
  });
}

/** Set the password and activate an existing contact matched by email. */
export async function activateContactWithPassword(hashed_password, contact_name, contact_email) {
  return db.execute({
    sql: "UPDATE contacts SET password = ?, name = COALESCE(NULLIF(?, ''), name), status = 'active' WHERE email = ?",
    args: [hashed_password, contact_name, contact_email],
  });
}

/** Create the contact account during invite acceptance (active, NOW()). */
export async function createContactFromInvite(
  contact_cid,
  name,
  email,
  phone,
  password,
  role,
) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, password, role, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
    args: [contact_cid, name, email, phone || null, password, role],
  });
}

/** Mark a password-setup token as used (one-time invite). */
export async function markInviteTokenUsed(id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE id = ?",
    args: [id],
  });
}

/** Enroll the accepted invite as an active participant_programs member (no-op on conflict). */
export async function addActiveProgramEnrollment(participant_id, program_id) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
                VALUES (?, ?, 'active', NOW())
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participant_id, program_id],
  });
}

// ── GET / POST / PUT / DELETE /api/teams (CRM / org teams) ───────────────────

/** Org teams (v2_teams + contacts member counts), optionally by team id or program id. */
export async function getOrgTeams(programId, teamId) {
  let sql = `SELECT t.*, (SELECT COUNT(*) FROM contacts WHERE team_id = t.id) AS members_count FROM v2_teams t`;
  let args = [];
  const conditions = [];

  // Team role: restrict to own team
  if (teamId) {
    conditions.push("t.id = ?");
    args.push(teamId);
  } else if (programId && programId !== "all") {
    conditions.push("t.program_id = ?");
    args.push(programId);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY t.name ASC";

  return db.execute({ sql, args });
}

/** Member contact rows of one org team (GET member details). */
export async function getOrgTeamMembers(teamId) {
  return db.execute({
    sql: "SELECT cid, name, email, role, group_name FROM contacts WHERE team_id = ? AND deleted = 0",
    args: [teamId],
  });
}

/** Create an org team record with generated credentials, returning the full row. */
export async function createOrgTeam(
  teamId,
  program_id,
  name,
  handler_id,
  handler_name,
  password,
  team_username,
) {
  return db.execute({
    sql: "INSERT INTO v2_teams (id, program_id, name, handler_id, handler_name, password, team_username) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [
      teamId,
      program_id,
      name,
      handler_id || null,
      handler_name || null,
      password,
      team_username,
    ],
  });
}

/** Emails of v2_participants being linked to an org team by participant id. */
export async function getOrgTeamParticipantEmails(memberIds) {
  return db.execute({
    sql: `SELECT email FROM v2_participants WHERE id::text IN (${memberIds.map(() => "?").join(",")})`,
    args: memberIds,
  });
}

/** Link contacts to an org team by matching email (POST member linking). */
export async function linkOrgTeamContactsByEmail(teamId, emails) {
  const emailPlaceholders = emails.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET team_id = ? WHERE email IN (${emailPlaceholders})`,
    args: [teamId, ...emails],
  });
}

/** Link contacts to an org team by direct cid match (POST fallback). */
export async function linkOrgTeamContactsByCid(teamId, memberIds) {
  const placeholders = memberIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET team_id = ? WHERE cid IN (${placeholders})`,
    args: [teamId, ...memberIds],
  });
}

/** Update an org team's mutable fields — dynamic SET built by the controller (PUT). */
export async function updateOrgTeam(sets, args) {
  return db.execute({
    sql: `UPDATE v2_teams SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Clear all member links of an org team (PUT re-link step). */
export async function clearOrgTeamMemberLinks(teamId) {
  return db.execute({
    sql: "UPDATE contacts SET team_id = NULL WHERE team_id = ?",
    args: [teamId],
  });
}

/**
 * Re-link contacts to an org team by direct cid match (PUT re-link step).
 * Byte-identical query to linkOrgTeamContactsByCid; extracted separately so
 * each original inline call site maps 1:1 to a model function.
 */
export async function linkOrgTeamContactsByCidOnUpdate(teamId, memberIds) {
  const placeholders = memberIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET team_id = ? WHERE cid IN (${placeholders})`,
    args: [teamId, ...memberIds],
  });
}

/**
 * Clear all member links of an org team before deleting it (DELETE step).
 * Byte-identical query to clearOrgTeamMemberLinks; extracted separately so
 * each original inline call site maps 1:1 to a model function.
 */
export async function clearOrgTeamMemberLinksOnDelete(teamId) {
  return db.execute({
    sql: "UPDATE contacts SET team_id = NULL WHERE team_id = ?",
    args: [teamId],
  });
}

/** Delete an org team by id (DELETE /api/teams). */
export async function deleteOrgTeam(id) {
  return db.execute({
    sql: "DELETE FROM v2_teams WHERE id = ?",
    args: [id],
  });
}

// ── POST/PUT/GET /api/v2/groups (legacy V2 API, still used by V1 pages) ─────

/** System-group guard: existing Facilitators group for a program (POST). */
export async function findV2FacilitatorsGroupByProgram(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'",
    args: [programId],
  });
}

/** Create a v2 group, returning its id (POST). */
export async function createV2Group(programId, name, projectDescription, groupType, isSystem) {
  return db.execute({
    sql: `INSERT INTO v2_groups (program_id, name, project_description, type, is_system)
             VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [programId, name, projectDescription, groupType, isSystem],
  });
}

/** System-group guard: name/type/is_system of a v2 group by text-cast id (PUT). */
export async function getV2GroupSystemFlagsById(id) {
  return db.execute({
    sql: "SELECT name, type, is_system FROM v2_groups WHERE CAST(id AS TEXT) = ?",
    args: [String(id)],
  });
}

/** Update a v2 group's mutable fields — dynamic SET built by the controller (PUT). */
export async function updateV2GroupFields(fields, args) {
  return db.execute({
    sql: `UPDATE v2_groups SET ${fields.join(", ")} WHERE CAST(id AS TEXT) = ?`,
    args,
  });
}

/** Families rendered as groups for the merged v2 groups list (GET). */
export async function getFamilyGroupRowsByProgram(programId) {
  let sql = "SELECT CAST(f.id AS TEXT) as id, f.program_id, f.name, f.description as project_description, f.lead_facilitator_id, c.name as lead_facilitator_name, 'participant' as type, 0 as is_system, f.created_at FROM families f LEFT JOIN contacts c ON f.lead_facilitator_id = c.cid";
  let args = [];
  if (programId) {
    sql += " WHERE f.program_id = ?";
    args.push(programId);
  }
  return db.execute({ sql, args });
}

/** v2_groups rows for the merged v2 groups list (GET). */
export async function getV2GroupRowsByProgram(programId) {
  let sql = "SELECT CAST(id AS TEXT) as id, program_id, name, project_description, type, is_system, created_at FROM v2_groups";
  let args = [];
  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }
  return db.execute({ sql, args });
}

// ── POST /api/superadmin/groups/assignment ───────────────────────────────────

/** Program existence check before assigning a group (v2_programs by id). */
export async function getV2ProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Assign program_id/program_name to every contact in a group (case-insensitive). */
export async function updateContactsProgramAssignment(programId, programName, groupName) {
  return db.execute({
    sql: "UPDATE contacts SET program_id = ?, program_name = ? WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
    args: [programId, programName || null, groupName],
  });
}

/** Contacts of a group (cid, email, name, phone) for the assignment loop. */
export async function getAssignmentContactsByGroupName(groupName) {
  return db.execute({
    sql: "SELECT cid, email, name, phone FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
    args: [groupName],
  });
}

/**
 * Sync a contact into v2_participants as Active; on a missing unique
 * constraint (email, program_id) fall back to a plain status UPDATE.
 */
export async function upsertV2ParticipantActiveWithFallback(programId, name, email, phone) {
  try {
    return await db.execute({
      sql: `INSERT INTO v2_participants (program_id, name, email, phone, status)
            VALUES (?, ?, ?, ?, 'Active')
            ON CONFLICT(email, program_id) DO UPDATE SET status = 'Active'`,
      args: [programId, name, email, phone],
    });
  } catch (_) {
    // Fallback if unique constraint (email, program_id) is not there
    return db.execute({
      sql: "UPDATE v2_participants SET status = 'Active' WHERE email = ? AND program_id = ?",
      args: [email, programId],
    });
  }
}

/** Sync the participant_programs junction row for an assigned contact. */
export async function insertParticipantProgramMembership(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                VALUES (?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}
