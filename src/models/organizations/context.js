import db from "@/lib/db";
import { readProgramAccessSnapshot } from "./programReads";

export async function withOrganizationSession(credentials, callback, { readOnly = false } = {}) {
  return db.transaction(async (query) => {
    await query(readOnly ? "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY" : "SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    const args = [credentials.cid, credentials.tokenHash, credentials.token];
    return callback({
      async session() {
        const result = await query(`SELECT s.active_organization_id, lower(btrim(c.role)) AS actor_role
          FROM user_sessions s JOIN contacts c ON c.cid=s.user_cid
          WHERE s.user_cid=? AND s.expires_at>clock_timestamp()
            AND (s.token_hash=? OR (s.token_hash IS NULL AND s.token=?))
            AND c.status IN ('active','approved') AND c.deleted=0
          ${readOnly ? "" : "FOR UPDATE OF s"}`, args);
        return result.rows[0] || null;
      },
      async memberships() {
        return (await query(`SELECT o.id,o.code,o.name FROM organizations o
          JOIN organization_memberships m ON m.organization_id=o.id
          WHERE m.person_id=? AND m.status='active' AND m.ended_at IS NULL
            AND (m.started_at IS NULL OR m.started_at<=clock_timestamp())
            AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp())
            AND o.is_platform=FALSE AND o.status='active'
          ORDER BY o.name,o.id LIMIT 51`, [credentials.cid])).rows;
      },
      access: (candidate) => readProgramAccessSnapshot(query, credentials, candidate),
      async switchTo(organizationId, expectedOrganizationId) {
        return (await query(`UPDATE user_sessions SET active_organization_id=?
          WHERE user_cid=? AND expires_at>clock_timestamp()
            AND (token_hash=? OR (token_hash IS NULL AND token=?))
            AND active_organization_id IS NOT DISTINCT FROM ?::uuid RETURNING active_organization_id`,
        [organizationId, ...args, expectedOrganizationId])).rows.length === 1;
      },
      async audit({ organizationId, previousOrganizationId, actorRole, requestId }) {
        await query(`INSERT INTO organization_audit_events
          (organization_id,actor_person_id,actor_role,action,entity_type,entity_id,metadata,request_id)
          VALUES (?,?,?,'organization.context.changed','session-context',?,jsonb_build_object('previous_organization_id',?::text),?)`,
        [organizationId, credentials.cid, actorRole, organizationId, previousOrganizationId, requestId]);
      },
    });
  });
}
