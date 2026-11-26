// Provision the explicitly requested synthetic client on the fixed staging DB.
// No SMTP, DNS, SSO, server startup, build or test execution.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

if (process.argv.length !== 3 || process.argv[2] !== "--apply") {
  console.log("No changes. Use --apply to provision the Epitech demo on staging only.");
  process.exit(0);
}
const root = fileURLToPath(new URL("../../", import.meta.url));
const env = readFileSync(path.join(root, ".env.local"), "utf8");
const connectionString = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!connectionString) throw new Error("Missing staging configuration");
const url = new URL(connectionString);
const project = decodeURIComponent(url.username).split(".").slice(1).join(".")
  || url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
if (project !== "mbpaxrfhqqclzyiefuab") throw new Error("Staging project mismatch");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000,
  query_timeout: 30000, ssl: /sslmode=/.test(connectionString) ? undefined : { rejectUnauthorized: false } });
const email = "epitech@gmail.com";
const requestId = `epitech-demo-${randomUUID()}`;
let transaction = false;
try {
  await client.connect();
  await client.query("BEGIN");
  transaction = true;
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '20s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('white-label-epitech-demo',0))");
  await client.query("SELECT set_config('app.request_id',$1,true)", [requestId]);
  const existing = (await client.query("SELECT id,name,is_platform,status FROM organizations WHERE code=$1 FOR UPDATE", ["epitech-demo"])).rows;
  if (existing.length && (existing[0].name !== "Epitech (démo)" || existing[0].is_platform || existing[0].status !== "active")) {
    throw new Error("Organisation code already used or demo inactive; refusing to overwrite");
  }
  const organizationId = existing[0]?.id || (await client.query(`INSERT INTO organizations
    (code,name,kind,status,default_locale,timezone) VALUES ('epitech-demo','Epitech (démo)','university','active','fr','Africa/Porto-Novo') RETURNING id`)).rows[0].id;
  const contracts = (await client.query("SELECT plan_key,ends_at FROM organization_contracts WHERE organization_id=$1 AND status='active'", [organizationId])).rows;
  if (contracts.length && contracts[0].plan_key !== "staging-demo-not-a-commercial-contract") throw new Error("Existing non-demo contract; refusing to overwrite");
  if (!contracts.length) await client.query(`INSERT INTO organization_contracts
    (organization_id,plan_key,status,starts_at,ends_at,signed_at)
    VALUES ($1,'staging-demo-not-a-commercial-contract','active',CURRENT_DATE,CURRENT_DATE+30,NOW())`, [organizationId]);
  await client.query(`INSERT INTO organization_modules (organization_id,module_key,status,starts_at,ends_at)
    SELECT $1,module,'enabled',CURRENT_DATE,CURRENT_DATE+30 FROM unnest(ARRAY['programs','lms','venture']) module
    ON CONFLICT (organization_id,module_key) DO NOTHING`, [organizationId]);
  await client.query(`INSERT INTO organization_branding (organization_id,display_name)
    VALUES ($1,'Epitech (démo)') ON CONFLICT (organization_id) DO NOTHING`, [organizationId]);

  // Never reset a password or alter a pre-existing identity's role or status.
  const contacts = (await client.query(`SELECT cid,name,role,status,
    (password IS NOT NULL AND length(btrim(password))>0) AS has_password,
    deleted,deleted_at FROM contacts WHERE lower(btrim(email))=$1 FOR UPDATE`, [email])).rows;
  if (contacts.length > 1) throw new Error("Ambiguous existing account; manual review required");
  if (contacts.length && (contacts[0].name !== "Epitech Démo" || contacts[0].role !== "member"
    || !["pending","active","approved"].includes(contacts[0].status) || contacts[0].deleted !== 0 || contacts[0].deleted_at)) {
    throw new Error("Email belongs to a different existing identity; no account changed");
  }
  const cid = contacts[0]?.cid || `USR_${randomUUID().replaceAll("-", "").slice(0,12).toUpperCase()}`;
  if (!contacts.length) await client.query(`INSERT INTO contacts (cid,name,email,role,status)
    VALUES ($1,'Epitech Démo',$2,'member','pending')`, [cid,email]);
  let membership = (await client.query("SELECT id FROM organization_memberships WHERE organization_id=$1 AND person_id=$2 AND status='active'", [organizationId,cid])).rows[0];
  if (!membership) membership = (await client.query(`INSERT INTO organization_memberships
    (organization_id,person_id,status,started_at,expires_at) VALUES ($1,$2,'active',NOW(),NOW()+INTERVAL '30 days') RETURNING id`, [organizationId,cid])).rows[0];
  const roles = [
    ["org_admin","Administration de la démonstration"],
    ["organization_program_editor","Gestion des programmes"],
    ["lms_content_manager","Consultation du catalogue LMS"],
    ["lms_learner","Apprentissage LMS"],
    ["venture_member","Consultation des ventures attribuées"],
  ];
  for (const [template,label] of roles) {
    await client.query(`INSERT INTO organization_roles (organization_id,template_key,label)
      VALUES ($1,$2,$3) ON CONFLICT (organization_id,template_key) DO NOTHING`, [organizationId,template,label]);
    const role = (await client.query("SELECT id,is_active FROM organization_roles WHERE organization_id=$1 AND template_key=$2", [organizationId,template])).rows[0];
    if (!role.is_active) throw new Error("Demo role disabled; refusing to restore revoked access");
    await client.query(`INSERT INTO organization_role_assignments
      (organization_id,membership_id,role_id,scope_type,status,starts_at,ends_at)
      SELECT $1,$2,$3,'organization','active',NOW(),NOW()+INTERVAL '30 days'
      WHERE NOT EXISTS (SELECT 1 FROM organization_role_assignments WHERE membership_id=$2 AND role_id=$3 AND status='active')`,
    [organizationId,membership.id,role.id]);
  }
  let setupFile = null;
  if (!contacts[0]?.has_password) {
    // Reuse the existing setup-password flow; no password is generated or read.
    const token = randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const nullable = (await client.query(`SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='password_setup_tokens' AND column_name='token'`)).rows[0]?.is_nullable === "YES";
    await client.query(`INSERT INTO password_setup_tokens (contact_cid,token,token_hash,expires_at,used,token_type)
      VALUES ($1,$2,$3,NOW()+INTERVAL '48 hours',0,'staff_invite')`, [cid,nullable ? null : token,tokenHash]);
    setupFile = `/tmp/impactos-epitech-access-${randomUUID()}.txt`;
    writeFileSync(setupFile, `Compte de démonstration staging : ${email}\nOrganisation : Epitech (démo)\n\nChoisis ton mot de passe avec ce lien personnel (48 heures, usage unique) :\nhttp://localhost:3000/setup-password/${token}?next=%2Fo%2Fselect\n\nConnecte-toi ensuite et ouvre http://localhost:3000/o/select\nAucun e-mail envoyé. Aucun lien avec le SSO my.epitech.eu.\n`, {mode:0o600,flag:"wx"});
  }
  await client.query(`INSERT INTO organization_audit_events
    (organization_id,actor_role,action,entity_type,entity_id,metadata,request_id)
    VALUES ($1::uuid,CURRENT_USER,'demo.provisioned','organization',($1::uuid)::text,
    jsonb_build_object('synthetic',true,'modules',ARRAY['programs','lms','venture'],'email_sent',false),$2)`, [organizationId,requestId]);
  await client.query("COMMIT");
  transaction = false;
  console.log(JSON.stringify({committed:true,organizationCode:"epitech-demo",setupFile,existingPasswordPreserved:contacts[0]?.has_password || false,emailSent:false}));
} catch (error) {
  if (transaction) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({committed:false,code:error.code || null,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,"[redacted]")}));
  process.exitCode=1;
} finally { await client.end().catch(() => {}); }
