import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import { profileKeyForAccessProfileName } from "@/models/authorization/profileTakeoverBackfill";

/**
 * Authorization backfills — the investor portal.
 *
 * Split verbatim out of `models/authorization/backfill/moduleBackfills.js` — see
 * docs/LAYER_SPLIT.md. Idempotent (ON CONFLICT DO NOTHING), once per process.
 */

// ─── Phase 11: Investor portal ──────────────────────────────────────────────
// An `investor` capability module is introduced and the uniform
// [super_admin, staff, investor] routes are migrated (24 methods across 17
// files): GET → investor.view, POST → investor.create, PUT → investor.edit.
//
// Backfills:
//   - staff: investor caps via Staff Default profile
//   - investor role: investor caps via the Mentor profile (the investor role's
//     default profile per the role → profile defaults)
//   - mentor role inherits the Mentor profile caps but is NOT eligible for
//     the investor feature → no access change
//
// Deliberately NOT migrated (documented): the super_admin-only admin routes
// (admin-overview, executive-dashboard, approval, campaigns writes,
// relationships writes), the program_manager-inclusive reads (campaigns GET,
// pipeline GET, profile GET — migrating them would grant PM the whole portal
// via shared eligibility), approval GET and profile PUT ([SA, staff] —
// investor would gain via view/edit caps), and the public register/
// setup-password flows.

const INVESTOR_BACKFILL = {
  // The legacy `investor` identity keeps its row (existing databases carry it);
  // `member` is added so investor creation can be delegated to any personal
  // account through the Permission Center.
  eligibility: { investors: ["super_admin", "staff", "investor", "member"] },
  profiles: {
    "Staff Default": [
      ["investor", "view", 1],
      ["investor", "create", 2],
      ["investor", "edit", 3],
    ],
    Mentor: [
      ["investor", "view", 1],
      ["investor", "create", 2],
      ["investor", "edit", 3],
    ],
  },
};

async function ensureInvestorBackfill() {
  await ensurePermissionsSchema();

  for (const [featureKey, roles] of Object.entries(INVESTOR_BACKFILL.eligibility)) {
    for (const role of roles) {
      await db.execute({
        sql: `INSERT INTO feature_eligibility
                (feature_key, identity_type, identity_value, eligible)
              VALUES (?, 'role', ?, 1)
              ON CONFLICT (feature_key, identity_type, identity_value)
              DO NOTHING`,
        args: [featureKey, role],
      });
    }
  }

  for (const [profileName, rows] of Object.entries(INVESTOR_BACKFILL.profiles)) {
    const key = profileKeyForAccessProfileName(profileName);
    if (!key) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        args: [key, module, capability, level],
      });
    }
  }
}

// ─── Delegated record creation (programs / ventures / investors) ──────────────
// `programs.create` and `ventures.create` were always grantable to a baseline
// member (both features list `member`). Investors did not: its ceiling was
// staff-only, so an administrator could not hand `investor.create` to a
// personal account even though the capability exists. The defaults now include
// `member`; this one-time migration writes that ceiling row into databases whose
// eligibility seed already ran (the seed itself never re-runs).
//
// Insert-only: an administrator who explicitly removed the row keeps their
// decision.
const INVESTOR_CREATION_DELEGATION = { feature: "investors", role: "member" };

async function ensureInvestorCreationDelegation() {
  await ensurePermissionsSchema();

  await db.execute({
    sql: `INSERT INTO feature_eligibility
            (feature_key, identity_type, identity_value, eligible)
          VALUES (?, 'role', ?, 1)
          ON CONFLICT (feature_key, identity_type, identity_value)
          DO NOTHING`,
    args: [INVESTOR_CREATION_DELEGATION.feature, INVESTOR_CREATION_DELEGATION.role],
  });
}

export { ensureInvestorBackfill, ensureInvestorCreationDelegation };
