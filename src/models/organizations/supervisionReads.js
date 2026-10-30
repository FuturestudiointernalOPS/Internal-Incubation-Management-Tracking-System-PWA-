import db from "@/lib/db";
import { createProgramReader } from "./programReads";

// No cache: authentication, identity, commercial state and mandate are read
// again at audit time before the transaction may release any programme data.
const AUTHORIZED_SUPERVISION = `
  FROM user_sessions s
  JOIN contacts person ON person.cid = s.user_cid
  JOIN organizations o ON o.id = ? AND o.is_platform = FALSE AND o.status = 'active'
  JOIN organization_supervision_grants g ON g.organization_id = o.id AND g.staff_person_id = person.cid
    AND g.status = 'active' AND g.ended_at IS NULL AND g.scope = 'read'
    AND g.starts_at <= clock_timestamp() AND g.ends_at > clock_timestamp()
  WHERE s.user_cid = ? AND s.expires_at > clock_timestamp()
    AND (s.token_hash = ? OR (s.token_hash IS NULL AND s.token = ?))
    AND person.status IN ('active', 'approved') AND person.deleted = 0
    AND lower(btrim(person.role)) IN ('staff', 'super_admin')
    AND EXISTS (SELECT 1 FROM organization_contracts c WHERE c.organization_id = o.id
      AND c.status = 'active' AND c.signed_at <= clock_timestamp()
      AND (c.starts_at IS NULL OR c.starts_at <= CURRENT_DATE)
      AND (c.ends_at IS NULL OR c.ends_at >= CURRENT_DATE))
    AND EXISTS (SELECT 1 FROM organization_modules m WHERE m.organization_id = o.id
      AND m.module_key = 'programs' AND m.status IN ('enabled', 'trial')
      AND (m.starts_at IS NULL OR m.starts_at <= CURRENT_DATE)
      AND (m.ends_at IS NULL OR m.ends_at >= CURRENT_DATE))`;

function credentialsArgs({ organizationId, cid, tokenHash, token }) {
  return [organizationId, cid, tokenHash, token];
}

export async function withSupervisedProgramRead(credentials, callback) {
  return db.transaction(async (query) => callback({
    ...createProgramReader(query),
    async mandate() {
      const result = await query(
        `SELECT g.id, g.organization_id, person.cid AS actor_cid,
          lower(btrim(person.role)) AS actor_role ${AUTHORIZED_SUPERVISION}
         ORDER BY g.ends_at DESC, g.id LIMIT 1 FOR SHARE OF g`,
        credentialsArgs(credentials),
      );
      return result.rows[0] || null;
    },
    async recordUsage({ mandateId, action, entityId, count, requestId }) {
      const result = await query(
        `INSERT INTO organization_audit_events
          (organization_id, actor_person_id, actor_role, action, entity_type, entity_id, metadata, request_id)
         SELECT o.id, person.cid, lower(btrim(person.role)), ?, 'program', ?,
           jsonb_build_object('source', 'supervision', 'mandate_id', g.id, 'result_count', ?::integer), ?
         ${AUTHORIZED_SUPERVISION} AND g.id = ? RETURNING id`,
        [action, entityId, count, requestId, ...credentialsArgs(credentials), mandateId],
      );
      return result.rows.length === 1;
    },
  }));
}
