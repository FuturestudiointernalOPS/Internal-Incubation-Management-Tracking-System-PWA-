/**
 * AUTHORIZATION SEED DATA — DATA ONLY.
 *
 * This file contains the initial configuration a database needs before an
 * administrator edits it: feature eligibility, the profile catalogue, the
 * role → profile defaults, and the responsibility catalogue.
 *
 * RULES
 *  - No imports, no database, no functions, no decisions. Plain values only.
 *  - The authorization DECISION engine must never import this file. The static
 *    guard in `permissions-static-guards.test.js` enforces that boundary.
 *  - The one-time seeds read these values; an existing row always wins
 *    (`ON CONFLICT DO NOTHING`). An administrator's edit is never overwritten.
 *  - To seed a databases deliberately, run
 *    `npm run authz:apply-defaults -- --env <file>` (dry-run by default).
 */

/**
 * BASELINE-role ceilings. Only the three identities an account itself carries.
 * Every contextual function is a PROFILE (see the profile defaults below).
 */
export const FEATURE_ELIGIBILITY_DEFAULTS = {
  crm: ["super_admin", "staff"],
  communication: ["super_admin", "staff"],
  programs: ["super_admin", "staff", "member"],
  ventures: ["super_admin", "staff", "member"],
  investors: ["super_admin", "staff", "member"],
  finance: ["super_admin", "staff"],
  operations: ["super_admin", "staff"],
  reports: ["super_admin", "staff"],
  knowledge: ["super_admin", "staff"],
  lms: ["super_admin", "staff"],
  security: ["super_admin", "staff"],
  settings: ["super_admin", "staff"],
};

/** PROFILE ceilings — a contextual function is eligible through the profile it holds. */
export const FEATURE_ELIGIBILITY_PROFILE_DEFAULTS = {
  communication: ["program_manager", "participant", "investor"],
  programs: ["program_manager", "participant", "facilitator"],
  ventures: ["program_manager", "investor", "founder"],
  investors: ["investor"],
  operations: ["program_manager", "participant", "investor"],
  reports: ["program_manager"],
  lms: ["program_manager"],
};

/** Assignment-derived program access on databases seeded before it existed. */
export const PROGRAM_ASSIGNMENT_ROWS = {
  programs: ["member"],
};

/**
 * The responsibility catalogue: only the display metadata. The "who" value
 * (`allowed_roles`) is derived from the eligibility defaults, below.
 */
export const RESPONSIBILITY_DEFINITIONS = [
  { name: "CRM", key: "crm", description: "People, contacts, timeline, membership, duplicates", icon: "Users" },
  { name: "Communication", key: "communication", description: "Messaging, announcements, forms — outreach suite", icon: "Send" },
  { name: "Programs", key: "programs", description: "Program oversight — programs, participants, submissions", icon: "Briefcase" },
  { name: "Ventures", key: "ventures", description: "Venture management — portfolio and registrations", icon: "Rocket" },
  { name: "Investors", key: "investors", description: "Investor management — records, reviews, campaigns", icon: "TrendingUp" },
  { name: "Finance", key: "finance", description: "Financial operations — budgets, reports", icon: "BarChart3" },
  { name: "Operations", key: "operations", description: "Internal operations — projects, tasks, standups, retros", icon: "Settings" },
  { name: "Reports", key: "reports", description: "Reports and analytics", icon: "BarChart3" },
  { name: "Knowledge", key: "knowledge", description: "Knowledge management", icon: "Library" },
  { name: "LMS", key: "lms", description: "Course management — create and maintain courses", icon: "GraduationCap" },
  { name: "Security", key: "security", description: "User administration — personnel, permissions", icon: "Users" },
  { name: "Settings", key: "settings", description: "System configuration and engineering operations", icon: "Settings" },
];

/** The responsibility defaults are the eligibility defaults — one source. */
export const RESPONSIBILITY_FEATURE_ROLES = FEATURE_ELIGIBILITY_DEFAULTS;

/**
 * The initial PROFILE catalogue. `allCapabilities` means "every capability of
 * the whole catalogue", evaluated at seed time from the capability registry.
 */
export const PROFILE_CATALOGUE_SEED = [
  { key: "super_admin_default", label: "Super Admin Default", context: "global", allowedRoles: ["super_admin"], allCapabilities: true },
  { key: "staff_default", label: "Staff Default", context: "global", allowedRoles: ["staff"], capabilities: {
    projects: { view: 1, create: 2, edit: 3 },
    programs: { view: 1, groups: 2 },
    ventures: { view: 1, view_all: 1, edit: 3, setup: 3, kpis: 3, permissions_view: 1, my_assignments: 1 },
    reports: { view: 1, create: 2 },
    messaging: { view: 1, send: 2 },
    contacts: { view: 1, invite_families: 2 },
    collections: { view: 1 },
  } },
  { key: "venture_member", label: "Venture Member", context: "venture", allowedRoles: ["member"], capabilities: {
    ventures: { view: 1, edit: 3 },
  } },
  { key: "participant", label: "Participant Default", context: "program", allowedRoles: ["member"], capabilities: {
    projects: { view: 1 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "investor", label: "Mentor", context: "investor", allowedRoles: ["member"], capabilities: {
    programs: { view: 1 },
    projects: { view: 1 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "founder", label: "Founder", context: "venture", allowedRoles: ["member"], capabilities: {
    ventures: { view: 1, edit: 3 },
  } },
  { key: "learner", label: "Learner", context: "lms", allowedRoles: ["member"], capabilities: {
    lms: { view: 1 },
  } },
  { key: "venture_manager", label: "Venture Manager", context: "venture", allowedRoles: ["staff"], capabilities: {
    ventures: { view: 1, edit: 3 },
  } },
  { key: "program_manager", label: "Assigned Program Manager", context: "program", allowedRoles: ["staff"], capabilities: {
    programs: { view: 1, edit: 3, publish: 4, groups: 2 },
    ventures: { kpis: 3 },
  } },
  { key: "project_owner", label: "Project Owner", context: "staff", allowedRoles: ["staff"], capabilities: {
    projects: { view: 1, create: 2, edit: 3, delete: 4 },
    engineering: { view: 1, manage_tasks: 2 },
    reports: { view: 1, create: 2 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "operations_manager", label: "Operations Manager", context: "staff", allowedRoles: ["staff"], capabilities: {
    programs: { view: 1, edit: 3 },
    projects: { view: 1 },
    finance: { view: 1, create: 2, edit: 3, export: 4 },
    contacts: { view: 1, create: 2, edit: 3 },
    reports: { view: 1, create: 2, export: 3 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "instructor", label: "Instructor", context: "staff", allowedRoles: ["staff"], capabilities: {
    programs: { view: 1, edit: 3 },
    projects: { view: 1 },
    messaging: { view: 1, send: 2 },
    contacts: { view: 1 },
  } },
  { key: "course_manager", label: "Course Manager", context: "staff", allowedRoles: ["staff"], capabilities: {
    lms: { view: 1, edit: 3 },
  } },
  { key: "venture_ops_contributor", label: "Venture Ops Contributor", context: "global", allowedRoles: ["staff"], capabilities: {
    lms: { view: 1, create: 2, edit: 3 },
    programs: { view: 1, create: 2, edit: 3 },
    ventures: { view: 1, create: 2, edit: 3 },
    reports: { view: 1 },
    messaging: { view: 1, send: 2 },
  } },
  { key: "facilitator", label: "Program Facilitator", context: "program", allowedRoles: ["staff", "member"], capabilities: {
    facilitator: {
      "participants.view": 2,
      "attendance.view": 2,
      "attendance.record": 2,
      "assignments.view": 2,
      "assignments.grade": 2,
      "sessions.conduct": 2,
      "reviews.submit": 2,
    },
  } },
  { key: "finance_assistant", label: "Finance Assistant", context: "staff", allowedRoles: ["staff"], capabilities: {
    finance: { view: 1, create: 2, edit: 3 },
    reports: { view: 1 },
  } },
];

/** Baseline role → default profile. Insert-only: an administrator's choice wins. */
export const ROLE_PROFILE_DEFAULTS_SEED = {
  super_admin: "super_admin_default",
  staff: "staff_default",
  participant: "participant",
  program_manager: "program_manager",
  investor: "investor",
  mentor: "investor",
  founder: "founder",
  member: "venture_member",
};

/**
 * Capabilities the route switch requires on existing profiles. They replace a
 * former `requireAuth([...])` and must reach databases seeded before them.
 * Insert-only: an administrator's explicit level is never overwritten.
 */
export const DELEGATED_PROFILE_CAPABILITY_ROWS = [
  ["staff_default", "ventures", "setup", 3],
  ["staff_default", "ventures", "kpis", 3],
  ["staff_default", "ventures", "permissions_view", 1],
  ["staff_default", "programs", "groups", 2],
  ["staff_default", "collections", "view", 1],
  ["staff_default", "contacts", "invite_families", 2],
  ["staff_default", "ventures", "my_assignments", 1],
  ["program_manager", "programs", "groups", 2],
  ["program_manager", "ventures", "kpis", 3],
];

/** The portfolio perimeter rights, on databases seeded before them. */
export const VENTURE_PORTFOLIO_CAPABILITY_ROWS = [
  ["super_admin_default", "ventures", "view_all", 5],
  ["super_admin_default", "ventures", "edit_all", 5],
  ["staff_default", "ventures", "view_all", 1],
];

/** D-7 — the Venture Member profile's write right, on older databases. */
export const VENTURE_MEMBER_EDIT_CAPABILITY = ["venture_member", "ventures", "edit", 3];
