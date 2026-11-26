// Operator-only staging configuration; not a client self-service capability.
// Example: node scripts/white-label/configure-staging-modules.mjs --organization epitech-demo --modules programs --apply
// Comma-separated subset: programs,lms,venture. No accounts, roles or content removed.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const valid = new Set(["programs", "lms", "venture"]);
const options = {};
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--apply") options.apply = true;
  else if (["--organization", "--modules"].includes(args[index]) && args[index + 1] && !args[index + 1].startsWith("--")) {
    const key = args[index].slice(2);
    if (options[key] !== undefined) throw new Error("Repeated option");
    options[key] = args[++index];
  } else throw new Error("Unsupported argument");
}
const modules = [...new Set((options.modules || "").split(",").map((item) => item.trim()).filter(Boolean))];
if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(options.organization || "")
  || !modules.length || modules.some((module) => !valid.has(module))) throw new Error("Provide --organization <code> and --modules <programs,lms,venture subset>");
if (!options.apply) {
  console.log(JSON.stringify({apply:false,organization:options.organization,enabledModules:modules}));
  process.exit(0);
}
const root = fileURLToPath(new URL("../../", import.meta.url));
const env = readFileSync(path.join(root, ".env.local"), "utf8");
const connectionString = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!connectionString) throw new Error("Missing staging configuration");
const url = new URL(connectionString);
const project = decodeURIComponent(url.username).split(".").slice(1).join(".") || url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
if (project !== "mbpaxrfhqqclzyiefuab") throw new Error("Staging project mismatch");
const client = new pg.Client({connectionString,connectionTimeoutMillis:15000,query_timeout:30000,
  ssl:/sslmode=/.test(connectionString) ? undefined : {rejectUnauthorized:false}});
let transaction = false;
try {
  await client.connect();
  await client.query("BEGIN");
  transaction = true;
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='20s'");
  const requestId = `organization-modules-${randomUUID()}`;
  await client.query("SELECT set_config('app.request_id',$1,true)", [requestId]);
  const organization = (await client.query("SELECT id,is_platform FROM organizations WHERE code=$1 FOR UPDATE",[options.organization])).rows[0];
  if (!organization || organization.is_platform) throw new Error("A client organisation is required");
  const before = (await client.query("SELECT module_key,status,starts_at,ends_at FROM organization_modules WHERE organization_id=$1 ORDER BY module_key FOR UPDATE", [organization.id])).rows;
  for (const module of valid) {
    const status = modules.includes(module) ? "enabled" : "disabled";
    await client.query(`INSERT INTO organization_modules (organization_id,module_key,status)
      VALUES ($1,$2,$3) ON CONFLICT (organization_id,module_key) DO UPDATE SET status=EXCLUDED.status
      WHERE organization_modules.status IS DISTINCT FROM EXCLUDED.status`, [organization.id,module,status]);
  }
  await client.query(`INSERT INTO organization_audit_events
    (organization_id,actor_role,action,entity_type,entity_id,before,after,request_id,metadata)
    VALUES ($1::uuid,CURRENT_USER,'organization.modules.configured','organization',($1::uuid)::text,$2::jsonb,$3::jsonb,$4,
      jsonb_build_object('source','staging-operator-script'))`,
  [organization.id,JSON.stringify(before),JSON.stringify({enabledModules:modules}),requestId]);
  await client.query("COMMIT");
  transaction = false;
  console.log(JSON.stringify({committed:true,project,organization:options.organization,enabledModules:modules,datesAndRolesPreserved:true}));
} catch (error) {
  if (transaction) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({committed:false,code:error.code || null,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,"[redacted]")}));
  process.exitCode=1;
} finally { await client.end().catch(() => {}); }
