import db from "@/lib/db";

// Only data access: the service decides permissions and allowed transitions.
export async function withWhiteLabelAdministration(credentials, callback, { write = false } = {}) {
  return db.transaction(async (query) => {
    await query(write ? "SET TRANSACTION ISOLATION LEVEL READ COMMITTED" : "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    await query("SET LOCAL statement_timeout='10s'");
    await query("SET LOCAL lock_timeout='3s'");
    const actor = (await query(`SELECT c.cid,c.role,c.name,c.email FROM user_sessions s
      JOIN contacts c ON c.cid=s.user_cid WHERE s.user_cid=? AND s.expires_at>clock_timestamp()
      AND (s.token_hash=? OR (s.token_hash IS NULL AND s.token=?))
      AND c.status IN ('active','approved') AND c.deleted=0
      ${write ? "FOR SHARE OF s,c" : ""}`,
    [credentials.cid, credentials.tokenHash, credentials.token])).rows[0] || null;
    if (write && actor) await query("SELECT set_config('app.actor_person_id',?,true),set_config('app.request_id',?,true)", [actor.cid, credentials.requestId]);
    return callback({
      actor,
      async list({ search, status, offset }) {
        const args = [search, search, status, status];
        const where = "NOT o.is_platform AND (?='' OR o.name ILIKE '%' || ? || '%') AND (?='' OR o.status=?)";
        const rows = (await query(`SELECT o.id,o.code,o.name,o.kind,o.status,
          COALESCE((SELECT jsonb_agg(m.module_key ORDER BY m.module_key) FROM organization_modules m
            WHERE m.organization_id=o.id AND m.status IN ('enabled','trial')
            AND (m.starts_at IS NULL OR m.starts_at<=CURRENT_DATE) AND (m.ends_at IS NULL OR m.ends_at>=CURRENT_DATE)), '[]'::jsonb) AS modules,
          (SELECT count(*)::integer FROM organization_memberships mem WHERE mem.organization_id=o.id AND mem.status='active'
            AND mem.ended_at IS NULL AND (mem.started_at IS NULL OR mem.started_at<=NOW()) AND (mem.expires_at IS NULL OR mem.expires_at>NOW())) AS members
          FROM organizations o WHERE ${where} ORDER BY o.created_at DESC,o.id LIMIT 20 OFFSET ?`, [...args,offset])).rows;
        const total = Number((await query(`SELECT count(*) AS total FROM organizations o WHERE ${where}`, args)).rows[0].total);
        const summary = (await query(`SELECT count(*)::integer AS total,
          count(*) FILTER(WHERE status='active')::integer AS active,
          count(*) FILTER(WHERE status='suspended')::integer AS suspended FROM organizations WHERE NOT is_platform`)).rows[0];
        return { rows,total,summary };
      },
      async detail(id) {
        const organization = (await query(`SELECT id,code,name,kind,status,default_locale,timezone,updated_at::text AS updated_at
          FROM organizations WHERE id=? AND NOT is_platform ${write ? "FOR UPDATE" : ""}`, [id])).rows[0];
        if (!organization) return null;
        const profile = (await query("SELECT contact_name,contact_email,contact_phone,website FROM organization_client_profiles WHERE organization_id=?", [id])).rows[0] || {};
        const branding = (await query(`SELECT display_name,logo_url,primary_color,updated_at::text AS updated_at FROM organization_branding WHERE organization_id=? ${write ? "FOR UPDATE" : ""}`, [id])).rows[0] || {};
        const contracts = (await query("SELECT id,plan_key,status,starts_at::text,ends_at::text,signed_at::text FROM organization_contracts WHERE organization_id=? ORDER BY created_at DESC,id DESC", [id])).rows;
        const modules = (await query(`SELECT module_key,status,starts_at::text,ends_at::text FROM organization_modules WHERE organization_id=? ORDER BY module_key ${write ? "FOR UPDATE" : ""}`, [id])).rows;
        return { organization,profile,branding,contracts,modules };
      },
      async people(id) {
        return (await query(`SELECT m.id,m.person_id,m.status,m.started_at,m.expires_at,m.ended_at,c.name,c.email,c.status AS account_status,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('key',r.template_key,'scope',a.scope_type,'scopeId',a.scope_id))
            FROM organization_role_assignments a JOIN organization_roles r ON r.id=a.role_id AND r.organization_id=a.organization_id
            WHERE a.membership_id=m.id AND a.organization_id=m.organization_id AND a.status='active' AND r.is_active
              AND (a.starts_at IS NULL OR a.starts_at<=NOW()) AND (a.ends_at IS NULL OR a.ends_at>NOW())), '[]'::jsonb) AS roles
          FROM organization_memberships m JOIN contacts c ON c.cid=m.person_id WHERE m.organization_id=? ORDER BY m.created_at DESC,m.id LIMIT 100`, [id])).rows;
      },
      async history(id) {
        return (await query(`SELECT e.id,e.action,e.entity_type,e.created_at,COALESCE(c.name,e.actor_role) AS actor
          FROM organization_audit_events e LEFT JOIN contacts c ON c.cid=e.actor_person_id
          WHERE e.organization_id=? ORDER BY e.created_at DESC,e.id DESC LIMIT 100`, [id])).rows;
      },
      async supervision(id) {
        return (await query(`SELECT g.id,g.staff_person_id,c.name,c.email,g.scope,g.reason,g.starts_at,g.ends_at,g.status
          FROM organization_supervision_grants g JOIN contacts c ON c.cid=g.staff_person_id
          WHERE g.organization_id=? ORDER BY g.created_at DESC,g.id LIMIT 100`, [id])).rows;
      },
      async staff() {
        return (await query(`SELECT cid,name,email FROM contacts WHERE role IN ('staff','super_admin') AND deleted=0 AND status IN ('active','approved') ORDER BY name,cid LIMIT 100`)).rows;
      },
      async insertOrganization(v) {
        return (await query(`INSERT INTO organizations(code,name,kind,status,default_locale,timezone)
          VALUES (?,?,?,'draft',?,?) RETURNING id`, [v.code,v.name,v.kind,v.default_locale,v.timezone])).rows[0].id;
      },
      async updateOrganization(id,v) {
        await query("UPDATE organizations SET name=?,kind=?,status=?,default_locale=?,timezone=?,updated_at=clock_timestamp() WHERE id=? AND NOT is_platform", [v.name,v.kind,v.status,v.default_locale,v.timezone,id]);
      },
      async touch(id) { await query("UPDATE organizations SET updated_at=clock_timestamp() WHERE id=? AND NOT is_platform", [id]); },
      async setProfile(id,v) {
        await query(`INSERT INTO organization_client_profiles(organization_id,contact_name,contact_email,contact_phone,website)
          VALUES (?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET contact_name=EXCLUDED.contact_name,
          contact_email=EXCLUDED.contact_email,contact_phone=EXCLUDED.contact_phone,website=EXCLUDED.website`, [id,v.contact_name,v.contact_email,v.contact_phone,v.website]);
      },
      async setModules(id,modules,window=null) {
        for (const key of ["programs","lms","venture"]) await query(`INSERT INTO organization_modules(organization_id,module_key,status)
          VALUES (?,?,?) ON CONFLICT(organization_id,module_key) DO UPDATE SET status=EXCLUDED.status
          WHERE organization_modules.status IS DISTINCT FROM EXCLUDED.status`, [id,key,modules.includes(key) ? "enabled" : "disabled"]);
        if (window) await query(`UPDATE organization_modules SET starts_at=?,ends_at=? WHERE organization_id=?
          AND module_key IN (${modules.map(() => "?").join(",")})`, [window.starts_at,window.ends_at,id,...modules]);
      },
      async setBranding(id,v) {
        await query(`INSERT INTO organization_branding(organization_id,display_name,logo_url,primary_color,updated_by)
          VALUES (?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET display_name=EXCLUDED.display_name,logo_url=EXCLUDED.logo_url,
          primary_color=EXCLUDED.primary_color,updated_by=EXCLUDED.updated_by`, [id,v.displayName,v.logoUrl,v.primaryColor,actor.cid]);
      },
      async insertContract(id,v) {
        return (await query(`INSERT INTO organization_contracts(organization_id,plan_key,status,starts_at,ends_at,signed_at)
          VALUES (?,?,?,?,?,?) RETURNING id`, [id,v.plan_key,v.status,v.starts_at,v.ends_at,v.signed_at])).rows[0].id;
      },
      async updateContract(id,v) {
        await query("UPDATE organization_contracts SET plan_key=?,status=?,starts_at=?,ends_at=?,signed_at=? WHERE id=? AND organization_id=?", [v.plan_key,v.status,v.starts_at,v.ends_at,v.signed_at,v.id,id]);
      },
      async contact(email) {
        await query("SELECT pg_advisory_xact_lock(hashtextextended(?,0))", [`white-label-account:${email}`]);
        return (await query(`SELECT cid,name,email,role,status,deleted,deleted_at,
          (password IS NOT NULL AND length(btrim(password))>0) AS activated FROM contacts WHERE lower(btrim(email))=? FOR UPDATE`, [email])).rows;
      },
      async insertContact(cid,v) {
        await query("INSERT INTO contacts(cid,name,email,role,status,language) VALUES (?,?,?,'member','pending',?)", [cid,v.name,v.email,v.language]);
      },
      async membership(id,cid) {
        return (await query("SELECT id,status FROM organization_memberships WHERE organization_id=? AND person_id=? AND status<>'ended' AND ended_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [id,cid])).rows[0];
      },
      async insertMembership(id,cid) {
        return (await query("INSERT INTO organization_memberships(organization_id,person_id,status,started_at) VALUES (?,?,'active',NOW()) RETURNING id", [id,cid])).rows[0].id;
      },
      async changeMembership(id,membershipId,status) {
        return (await query(`UPDATE organization_memberships SET status=?,ended_at=CASE WHEN ?='ended' THEN NOW() ELSE ended_at END
          WHERE id=? AND organization_id=? AND status<>'ended' AND ended_at IS NULL RETURNING person_id`, [status,status,membershipId,id])).rows[0];
      },
      async assignRoles(id,membershipId,templates) {
        await query(`UPDATE organization_role_assignments SET status='ended',ends_at=COALESCE(ends_at,GREATEST(NOW(),starts_at+INTERVAL '1 microsecond'))
          WHERE organization_id=? AND membership_id=? AND scope_type='organization' AND status IN ('active','suspended')
            AND role_id IN (SELECT id FROM organization_roles WHERE organization_id=? AND template_key NOT IN (${templates.map(() => "?").join(",")}))`, [id,membershipId,id,...templates]);
        for (const template of templates) {
          await query(`INSERT INTO organization_roles(organization_id,template_key,label) VALUES (?,?,?)
            ON CONFLICT(organization_id,template_key) DO NOTHING`, [id,template,template]);
          // Do not silently revive suspended, inactive or expired assignments.
          await query(`INSERT INTO organization_role_assignments(organization_id,membership_id,role_id,scope_type,status,starts_at)
            SELECT ?,?,r.id,'organization','active',NOW() FROM organization_roles r
            WHERE r.organization_id=? AND r.template_key=? AND r.is_active
            AND NOT EXISTS(SELECT 1 FROM organization_role_assignments a WHERE a.membership_id=? AND a.role_id=r.id AND a.status='active')`, [id,membershipId,id,template,membershipId]);
        }
      },
      async setupToken(cid,hash,legacyToken) {
        // Use the existing password-setup reader; keep the new token hashed at rest
        // where supported. On legacy NOT NULL schemas, use its existing raw field.
        const nullable = (await query("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='password_setup_tokens' AND column_name='token'")).rows[0]?.is_nullable === "YES";
        await query(`INSERT INTO password_setup_tokens(contact_cid,token,token_hash,expires_at,used,token_type)
          VALUES (?,?,?,NOW()+INTERVAL '48 hours',0,'staff_invite')`, [cid,nullable ? null : legacyToken,hash]);
      },
      async insertSupervision(id,v) {
        return (await query(`INSERT INTO organization_supervision_grants(organization_id,staff_person_id,scope,reason,ends_at,granted_by)
          VALUES (?,?,'read',?,NOW()+(CAST(? AS INTEGER) * INTERVAL '1 hour'),?) RETURNING id`, [id,v.staff_person_id,v.reason,v.hours,actor.cid])).rows[0].id;
      },
      async endSupervision(id,grantId) {
        return (await query("UPDATE organization_supervision_grants SET status='ended',ended_at=NOW() WHERE id=? AND organization_id=? AND status='active' RETURNING id", [grantId,id])).rows[0];
      },
      async audit(id,action,metadata={},before=null,after=null) {
        await query(`INSERT INTO organization_audit_events(organization_id,actor_person_id,actor_role,action,entity_type,entity_id,metadata,request_id,before,after)
          VALUES (?,?,'super_admin',?,'organization',?,?,?,?,?)`, [id,actor.cid,action,id,JSON.stringify(metadata),credentials.requestId,
        before ? JSON.stringify(before) : null,after ? JSON.stringify(after) : null]);
      },
    });
  });
}
