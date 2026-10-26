import db from "@/lib/db";

// One read-only snapshot includes the fresh server session, access and data.
// No initDb, lazy DDL, status activation or facilitator-group creation.
const ACCESS_SQL = `
  SELECT o.id AS organization_id, lower(btrim(person.role)) AS actor_role,
    o.code, o.name, o.status AS organization_status, o.is_platform,
    m.id AS membership_id,
    EXISTS (
      SELECT 1 FROM organization_contracts c
      WHERE c.organization_id = o.id AND c.status = 'active' AND c.signed_at <= NOW()
        AND (c.starts_at IS NULL OR c.starts_at <= CURRENT_DATE)
        AND (c.ends_at IS NULL OR c.ends_at >= CURRENT_DATE)
    ) AS contract_active,
    EXISTS (
      SELECT 1 FROM organization_modules om
      WHERE om.organization_id = o.id AND om.module_key = 'programs'
        AND om.status IN ('enabled', 'trial')
        AND (om.starts_at IS NULL OR om.starts_at <= CURRENT_DATE)
        AND (om.ends_at IS NULL OR om.ends_at >= CURRENT_DATE)
    ) AS module_enabled,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'scopeType', a.scope_type, 'scopeId', a.scope_id,
        'templateScope', t.scope_type, 'viewLevel', cap.access_level
      ))
      FROM organization_role_assignments a
      JOIN organization_roles r ON r.id = a.role_id
        AND r.organization_id = a.organization_id AND r.is_active = TRUE
      JOIN organization_role_templates t ON t.key = r.template_key
      JOIN organization_role_template_capabilities cap ON cap.template_key = t.key
        AND cap.module = 'programs' AND cap.capability = 'view'
      WHERE a.organization_id = o.id AND a.membership_id = m.id AND a.status = 'active'
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.ends_at IS NULL OR a.ends_at > NOW())
        AND (a.scope_type = 'organization' OR EXISTS (
          SELECT 1 FROM v2_programs p
          WHERE p.id::text = a.scope_id AND p.organization_id = o.id
        ))
    ), '[]'::jsonb) AS assignments,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'subjectType', g.subject_type, 'subjectId', g.subject_id,
        'effect', g.effect, 'scopeType', g.scope_type, 'scopeId', g.scope_id,
        'accessLevel', g.access_level
      ))
      FROM organization_grants g
      WHERE g.organization_id = o.id AND g.module = 'programs' AND g.capability = 'view'
        AND g.revoked_at IS NULL
        AND (g.starts_at IS NULL OR g.starts_at <= NOW())
        AND (g.ends_at IS NULL OR g.ends_at > NOW())
        AND ((g.subject_type = 'membership' AND g.subject_id = m.id::text)
          OR (g.subject_type = 'role_assignment' AND EXISTS (
            SELECT 1 FROM organization_role_assignments a
            JOIN organization_roles r ON r.id = a.role_id
              AND r.organization_id = a.organization_id AND r.is_active = TRUE
            JOIN organization_role_templates t ON t.key = r.template_key
            WHERE a.id::text = g.subject_id AND a.membership_id = m.id
              AND a.organization_id = o.id AND a.status = 'active'
              AND a.scope_type = t.scope_type
              AND (a.starts_at IS NULL OR a.starts_at <= NOW())
              AND (a.ends_at IS NULL OR a.ends_at > NOW())
              AND (a.scope_type = 'organization' OR EXISTS (
                SELECT 1 FROM v2_programs p
                WHERE p.id::text = a.scope_id AND p.organization_id = o.id
              ))
          )))
    ), '[]'::jsonb) AS grants
  FROM user_sessions s
  JOIN contacts person ON person.cid = s.user_cid
    AND person.status IN ('active', 'approved') AND person.deleted = 0
  LEFT JOIN organizations o ON o.id = COALESCE(?::uuid, s.active_organization_id)
  LEFT JOIN organization_memberships m ON m.organization_id = o.id
    AND m.person_id = s.user_cid AND m.status = 'active' AND m.ended_at IS NULL
    AND (m.started_at IS NULL OR m.started_at <= NOW())
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  WHERE s.user_cid = ? AND s.expires_at > NOW()
    AND (s.token_hash = ? OR (s.token_hash IS NULL AND s.token = ?))
  LIMIT 1`;

const PROGRAM_FIELDS = `p.id, p.name, p.description, p.status,
  p.start_date, p.end_date, p.duration_weeks, p.duration_days, p.created_at`;

// Null owners belong to the legacy platform, NEVER to a client. Allow/deny IDs
// are bound parameters; an empty allow list cannot broaden into the directory.
const PROGRAM_SCOPE = `p.organization_id = ?
  AND (? = TRUE OR p.id::text = ANY(?::text[]))
  AND NOT (p.id::text = ANY(?::text[]))`;

function scopeArgs(scope) {
  return [scope.organizationId, scope.allPrograms, scope.programIds, scope.deniedProgramIds];
}

export async function withOrganizationProgramRead(callback) {
  return db.transaction(async (query) => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    return callback({
      ...createProgramReader(query),
      async accessSnapshot({ cid, tokenHash, token }) {
        return readProgramAccessSnapshot(query, { cid, tokenHash, token });
      },
    });
  });
}

// Candidate selection is used only by the server-controlled context mutation;
// ordinary programme readers always resolve the persisted session context.
export async function readProgramAccessSnapshot(query, credentials, candidate = null) {
  const result = await query(ACCESS_SQL, [candidate, credentials.cid, credentials.tokenHash, credentials.token]);
  return result.rows[0] || null;
}

// Reused by supervised reads, with the same owner predicate and field allowlist.
export function createProgramReader(query) {
  return {
    async listPrograms({ scope, search, offset, limit }) {
      const result = await query(
        `SELECT ${PROGRAM_FIELDS} FROM v2_programs p
         WHERE ${PROGRAM_SCOPE} AND POSITION(LOWER(?) IN LOWER(p.name)) > 0
         ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
        [...scopeArgs(scope), search, limit, offset],
      );
      return result.rows;
    },
    async findProgram({ scope, programId }) {
      const result = await query(
        `SELECT ${PROGRAM_FIELDS} FROM v2_programs p
         WHERE ${PROGRAM_SCOPE} AND p.id = ? LIMIT 1`,
        [...scopeArgs(scope), programId],
      );
      return result.rows[0] || null;
    },
  };
}
