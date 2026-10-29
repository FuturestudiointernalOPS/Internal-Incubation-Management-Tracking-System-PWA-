import db from "@/lib/db";
import { readProgramAccessSnapshot } from "./programReads";

export async function withOrganizationBranding(credentials, callback) {
  return db.transaction(async (query) => {
    await query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await query("SET LOCAL statement_timeout = '10s'");
    await query("SET LOCAL lock_timeout = '3s'");
    const args = [credentials.cid, credentials.tokenHash, credentials.token];
    const session = await query(`SELECT active_organization_id
      FROM user_sessions
      WHERE user_cid=? AND expires_at>clock_timestamp()
        AND (token_hash=? OR (token_hash IS NULL AND token=?))
      FOR UPDATE`, args);
    if (!session.rows.length) return callback(null);

    const snapshot = await readProgramAccessSnapshot(query, credentials, null, true);
    if (!snapshot) return callback(null);
    return callback({
      snapshot,
      async hasEditPermission() {
        const result = await query(`SELECT a.id
          FROM organization_memberships m
          JOIN organization_role_assignments a
            ON a.membership_id=m.id AND a.organization_id=m.organization_id
          JOIN organization_roles r
            ON r.id=a.role_id AND r.organization_id=a.organization_id AND r.is_active=TRUE
          JOIN organization_role_templates t ON t.key=r.template_key
          JOIN organization_role_template_capabilities cap
            ON cap.template_key=t.key AND cap.module='organization_admin'
              AND cap.capability='branding.edit' AND cap.access_level>=1
          WHERE m.id=? AND m.organization_id=? AND m.person_id=?
            AND m.status='active' AND m.ended_at IS NULL
            AND (m.started_at IS NULL OR m.started_at<=clock_timestamp())
            AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp())
            AND a.status='active' AND a.scope_type='organization' AND a.scope_id IS NULL
            AND t.scope_type='organization'
            AND (a.starts_at IS NULL OR a.starts_at<=clock_timestamp())
            AND (a.ends_at IS NULL OR a.ends_at>clock_timestamp())
          LIMIT 1
          FOR SHARE OF m,a,r,t,cap`, [snapshot.membership_id, snapshot.organization_id, credentials.cid]);
        return result.rows.length > 0;
      },
      async getBranding(organizationId) {
        return (await query(`SELECT display_name,logo_url,primary_color
          FROM organization_branding WHERE organization_id=?`, [organizationId])).rows[0] || null;
      },
      async updateBranding(organizationId, personId, values) {
        await query("SELECT set_config('app.actor_person_id',?,true),set_config('app.request_id',?,true)", [personId, credentials.requestId]);
        const result = await query(`INSERT INTO organization_branding
            (organization_id,display_name,logo_url,primary_color,updated_by)
          VALUES (?,?,?,?,?)
          ON CONFLICT (organization_id) DO UPDATE SET
            display_name=EXCLUDED.display_name,
            logo_url=EXCLUDED.logo_url,
            primary_color=EXCLUDED.primary_color,
            updated_by=EXCLUDED.updated_by
          RETURNING organization_id,display_name,logo_url,primary_color,updated_at`,
        [organizationId, values.displayName, values.logoUrl, values.primaryColor, personId]);
        return result.rows[0];
      },
    });
  });
}
