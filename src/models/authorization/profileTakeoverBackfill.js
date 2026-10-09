/**
 * PROFILES TAKE OVER — the legacy access-profile NAME → profile KEY map.
 *
 * docs/PROFILES_TAKEOVER_MIGRATION.md. The one-time data migration that moved
 * the `access_profiles` rows onto the `profiles` catalogue has run everywhere
 * and the source tables are dropped. What remains here is the MAP it used: the
 * registry seed and the per-assignment key backfill still resolve a legacy
 * template NAME to its profile key through it.
 *
 * Product decisions baked into the mapping:
 *   • `program_manager` is ONE profile with PROGRAM-ONLY access — the seeded
 *     "Assigned Program Manager" set. The portfolio "Program Manager" template is
 *     NOT copied (its capabilities would re-widen the profile); it is only used
 *     to resolve the bridges that pointed at it.
 *   • The ad-hoc templates (Project Owner, Operations Manager, Instructor,
 *     Finance Assistant) become profiles too, so nothing they grant is lost.
 *   • The baseline templates (Super Admin Default, Staff Default, Venture Member)
 *     also become profiles: every capability set is dynamic and editable.
 */

/**
 * Access profile NAME → the profile it becomes.
 *
 * `key` is the target profile key; `context`/`allowedRoles` seed the row when it
 * does not exist yet; `copyCaps: false` means the template is only a bridge and
 * its capabilities are NOT copied (the "Program Manager" portfolio case, whose
 * programme-only replacement is "Assigned Program Manager").
 */
export const ACCESS_PROFILE_TO_PROFILE = [
  {
    accessProfile: "Super Admin Default",
    key: "super_admin_default",
    context: "global",
    allowedRoles: ["super_admin"],
  },
  {
    accessProfile: "Staff Default",
    key: "staff_default",
    context: "global",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Venture Member",
    key: "venture_member",
    context: "venture",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Participant Default",
    key: "participant",
    context: "program",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Mentor",
    key: "investor",
    context: "investor",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Founder",
    key: "founder",
    context: "venture",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Learner",
    key: "learner",
    context: "lms",
    allowedRoles: ["member"],
  },
  {
    accessProfile: "Venture Manager",
    key: "venture_manager",
    context: "venture",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Assigned Program Manager",
    key: "program_manager",
    context: "program",
    allowedRoles: ["staff"],
  },
  {
    // Merged away: `program_manager` keeps the programme-only set above. Present
    // here ONLY so the bridges that pointed at it resolve to the right key.
    accessProfile: "Program Manager",
    key: "program_manager",
    copyCaps: false,
  },
  {
    accessProfile: "Project Owner",
    key: "project_owner",
    context: "staff",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Operations Manager",
    key: "operations_manager",
    context: "staff",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Instructor",
    key: "instructor",
    context: "staff",
    allowedRoles: ["staff"],
  },
  {
    accessProfile: "Finance Assistant",
    key: "finance_assistant",
    context: "staff",
    allowedRoles: ["staff"],
  },
];

/** The profile key an access profile NAME becomes, or null when unmapped. */
export function profileKeyForAccessProfileName(name) {
  const mapping = ACCESS_PROFILE_TO_PROFILE.find(
    (entry) => entry.accessProfile === String(name),
  );
  return mapping ? mapping.key : null;
}
