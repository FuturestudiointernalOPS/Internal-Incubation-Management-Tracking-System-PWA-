// Explicit additive deployment for the super-admin client metadata table only.
// No application initialization, build, tests, account provisioning or mail sends.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

if (process.argv.length!==3 || process.argv[2]!=="--apply") {
  console.log("No changes. Use --apply to install the client administration metadata on the fixed staging project.");
  process.exit(0);
}
const root = fileURLToPath(new URL("../../",import.meta.url));
const env = readFileSync(path.join(root,".env.local"),"utf8");
const connectionString = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g,"");
if (!connectionString) throw new Error("Missing staging configuration");
const url = new URL(connectionString);
const project = decodeURIComponent(url.username).split(".").slice(1).join(".") || url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
if (project!=="mbpaxrfhqqclzyiefuab") throw new Error("Staging project mismatch");
const client = new pg.Client({connectionString,connectionTimeoutMillis:15000,query_timeout:45000,
  ssl:/sslmode=/.test(connectionString) ? undefined : {rejectUnauthorized:false}});
try {
  await client.connect();
  const prerequisite = (await client.query("SELECT to_regclass('public.organizations')::text AS relation")).rows[0];
  if (!prerequisite.relation) throw new Error("White-label foundation is required first");
  const sql = readFileSync(path.join(root,"supabase/migrations/20261126_white_label_client_profiles.sql"),"utf8");
  const result = await client.query(sql);
  if (result.at(-1)?.command!=="COMMIT") throw new Error("Deployment transaction did not commit");
  console.log(JSON.stringify({committed:true,project,migration:"20261126_white_label_client_profiles.sql"}));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({committed:false,code:error.code || null,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,"[redacted]")}));
  process.exitCode=1;
} finally { await client.end().catch(() => {}); }
