/**
 * READ-ONLY production authorization audit.
 * No writes of any kind. Prints aggregated counts + redacted identifiers.
 * Usage: node scratch/prod-audit.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const readUrl = (file) =>
  readFileSync(file, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const pool = new pg.Pool({
  connectionString: readUrl(".env.local"),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
const q = async (sql, args = []) => (await pool.query(sql, args)).rows;

const mask = (s) => (s ? String(s).slice(0, 8) + "…" : s);

const sections = {};
sections["1. ROLES in use (contacts.role)"] = await q(
  "SELECT role, count(*) AS n FROM contacts WHERE role IS NOT NULL GROUP BY role ORDER BY n DESC",
);
sections["2. ROLES in use (user_sessions.role)"] = await q(
  "SELECT role, count(*) AS n FROM user_sessions GROUP BY role ORDER BY n DESC",
);
sections["3. ROLES in use (users table, if any)"] = await q(
  "SELECT role, count(*) AS n FROM users WHERE role IS NOT NULL GROUP BY role ORDER BY n DESC",
).catch(() => [{ note: "no users table" }]);
sections["4. role_capabilities rows (legacy fallback)"] = await q(
  "SELECT role, count(*) AS n FROM role_capabilities GROUP BY role ORDER BY role",
);
sections["5. feature_eligibility (role rows)"] = await q(
  "SELECT identity_value AS identity, count(*) FILTER (WHERE eligible=1) AS eligible, count(*) FILTER (WHERE eligible=0) AS denied, count(*) AS total FROM feature_eligibility WHERE identity_type='role' GROUP BY identity_value ORDER BY identity",
);
sections["6. feature_eligibility (group rows)"] = await q(
  "SELECT identity_value AS identity, count(*) FILTER (WHERE eligible=1) AS eligible, count(*) FILTER (WHERE eligible=0) AS denied, count(*) AS total FROM feature_eligibility WHERE identity_type='group' GROUP BY identity_value ORDER BY identity",
);
sections["7. access_profiles"] = await q(
  "SELECT id, name, is_active FROM access_profiles ORDER BY id",
);
sections["8. access_profile_capabilities per profile"] = await q(
  "SELECT profile_id, count(*) AS caps FROM access_profile_capabilities GROUP BY profile_id ORDER BY profile_id",
);
sections["9. role_access_profile_defaults"] = await q(
  "SELECT role_name, access_profile_id FROM role_access_profile_defaults ORDER BY role_name",
);
sections["10. contacts.access_profile_id (profile assigned directly)"] = await q(
  "SELECT ap.name AS profile, count(*) AS n FROM contacts c LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id GROUP BY ap.name ORDER BY n DESC",
);
sections["11. user_capabilities (individual grants)"] = await q(
  "SELECT module, capability, count(*) AS n FROM user_capabilities GROUP BY module, capability ORDER BY module, capability",
);
sections["12. user_capability_restrictions (individual restrictions)"] = await q(
  "SELECT module, capability, count(*) AS n FROM user_capability_restrictions GROUP BY module, capability ORDER BY module, capability",
);
sections["13. groups metadata (protected flag)"] = await q(
  "SELECT name, is_protected, is_active FROM groups ORDER BY name",
);
sections["14. group_memberships by status"] = await q(
  "SELECT status, count(*) AS n FROM group_memberships GROUP BY status ORDER BY n DESC",
);
sections["15. group_memberships by group"] = await q(
  "SELECT group_name, status, count(*) AS n FROM group_memberships GROUP BY group_name, status ORDER BY group_name, status",
);
sections["16. user_groups edges (legacy mirror)"] = await q(
  "SELECT group_name, count(*) AS n FROM user_groups GROUP BY group_name ORDER BY n DESC",
);
sections["17. v2_program_staff roles (program assignments)"] = await q(
  "SELECT role, count(*) AS n FROM v2_program_staff GROUP BY role ORDER BY n DESC",
);
sections["18. project_members roles"] = await q(
  "SELECT role, count(*) AS n FROM project_members GROUP BY role ORDER BY n DESC",
);
sections["19. venture_members"] = await q(
  "SELECT count(*) AS total, count(*) FILTER (WHERE removed_at IS NOT NULL) AS removed FROM venture_members",
);
sections["20. contact_roles (generalized assignments)"] = await q(
  "SELECT context_type, role, is_current, count(*) AS n FROM contact_roles GROUP BY context_type, role, is_current ORDER BY context_type, role, is_current",
);
sections["21. v2_programs assignment columns"] = await q(
  "SELECT count(*) AS total, count(*) FILTER (WHERE assigned_pm_id IS NOT NULL) AS with_pm, count(*) FILTER (WHERE assigned_assistant_id IS NOT NULL) AS with_assistant FROM v2_programs",
);
sections["22. v2_teams (handler_id)"] = await q(
  "SELECT count(*) AS total, count(*) FILTER (WHERE handler_id IS NOT NULL) AS with_handler FROM v2_teams",
);
sections["23. SUPER ADMIN candidates (contacts)"] = await q(
  "SELECT cid, role, group_name, access_profile_id, status FROM contacts WHERE UPPER(role) IN ('SUPER_ADMIN','SA','ADMIN') ORDER BY cid",
);
sections["24. grant/restriction rows for SA/ADMIN cids"] = await q(
  `SELECT c.user_cid, 'grant' AS kind, module, capability, access_level, expires_at
     FROM user_capabilities c
     WHERE c.user_cid IN (SELECT cid FROM contacts WHERE UPPER(role) IN ('SUPER_ADMIN','SA','ADMIN'))
   UNION ALL
   SELECT r.user_cid, 'restriction', r.module, r.capability, NULL, r.expires_at
     FROM user_capability_restrictions r
     WHERE r.user_cid IN (SELECT cid FROM contacts WHERE UPPER(role) IN ('SUPER_ADMIN','SA','ADMIN'))`,
);
sections["25. permission_audit_log recent actions"] = await q(
  "SELECT action, count(*) AS n FROM permission_audit_log GROUP BY action ORDER BY n DESC",
);
sections["26. group_membership_events by action"] = await q(
  "SELECT action, count(*) AS n FROM group_membership_events GROUP BY action ORDER BY n DESC",
);
sections["27. group_capabilities (group grants)"] = await q(
  "SELECT group_name, count(*) AS n FROM group_capabilities GROUP BY group_name ORDER BY n DESC",
);

for (const [title, rows] of Object.entries(sections)) {
  console.log(`\n=== ${title} ===`);
  for (const r of rows) {
    const safe = Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, k.toLowerCase().includes("cid") ? mask(v) : v]),
    );
    console.log(JSON.stringify(safe));
  }
}

await pool.end();
console.log("\n[done] read-only audit complete");
