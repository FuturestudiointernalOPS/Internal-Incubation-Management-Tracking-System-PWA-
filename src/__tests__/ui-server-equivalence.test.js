/**
 * LOT 7 — UI / SERVER EQUIVALENCE.
 *
 * The interface must never show a door the server would refuse. This suite pins
 * the one direction that matters:
 *
 *     every node the sidebar RENDERS with a capability requirement
 *       ⇒ the server's own decision for that capability is ALLOWED.
 *
 * It runs the REAL projection (`buildAccessNav`) against the REAL decision
 * (`explainAuthorization`) for each profile family the product knows: platform
 * owner, staff, program manager, facilitator, participant, and an unassigned
 * member. The navigation's curated role masks may still HIDE an allowed node
 * (visibility is a product choice); what they may never do is SHOW a refused one.
 *
 * Visibility is not a security boundary — every API re-decides — but a sidebar
 * that lies sends people to a 403, and this is what catches it.
 */

const { buildAccessNav } = require("@/lib/masterNavigation");
const {
  NAV_CAPABILITY_REQUIREMENTS,
  requirementAlternatives,
} = require("@/lib/masterNavigation/access");
const { explainAuthorization } = require("@/services/authorization/contextDecisions");
const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
const {
  PERMISSION_MODULES,
} = require("@/models/authorization/constants/feature-module-capability");

/** Every feature the resolver can gate, eligible by default in this harness. */
const ALL_FEATURES = [...new Set(Object.values(MODULE_TO_FEATURE))];

/** A context shaped exactly as the pure decision expects. */
function contextFor(effective, { isSuperAdmin = false } = {}) {
  return {
    isSuperAdmin,
    accountStatus: "active",
    eligibility: Object.fromEntries(ALL_FEATURES.map((feature) => [feature, true])),
    effective,
    restrictions: {},
    grants: {},
  };
}

/** The platform owner's matrix: every capability in the catalogue. */
function fullMatrix() {
  const out = {};
  for (const [module, definition] of Object.entries(PERMISSION_MODULES)) {
    out[module] = {};
    for (const capability of definition.capabilities) out[module][capability] = 5;
  }
  return out;
}

/** module → { capability → level } for a flat list of dotted keys. */
function matrix(entries) {
  const out = {};
  for (const entry of entries) {
    const [module, capability] = entry.split(".");
    out[module] = out[module] || {};
    out[module][capability] = 1;
  }
  return out;
}

/** Every id the projection actually renders (sections and leaves). */
function renderedIds(nav) {
  const ids = [];
  const visit = (items) => {
    for (const item of items || []) {
      ids.push(item.id);
      visit(item.subItems);
    }
  };
  visit(nav);
  return ids;
}

const STAFF_CAPS = [
  "contacts.view",
  "messaging.view",
  "messaging.send",
  "programs.view",
  "programs.edit",
  "programs.publish",
  "projects.view",
  "projects.create",
  "projects.edit",
  "reports.view",
  "reports.create",
  "ventures.view",
  "ventures.edit",
];

const PROGRAM_MANAGER_CAPS = [
  "programs.view",
  "programs.create",
  "programs.edit",
  "programs.delete",
  "programs.publish",
  "facilitator.assignments.grade",
  "facilitator.assignments.view",
  "facilitator.participants.view",
];

const FACILITATOR_CAPS = [
  "facilitator.participants.view",
  "facilitator.attendance.view",
  "facilitator.attendance.record",
  "facilitator.assignments.view",
  "facilitator.assignments.grade",
  "facilitator.sessions.conduct",
  "facilitator.reviews.submit",
];

const PROFILES = [
  {
    label: "platform owner",
    role: "super_admin",
    effective: fullMatrix(),
    isSuperAdmin: true,
  },
  { label: "staff (Staff Default)", role: "staff", effective: matrix(STAFF_CAPS) },
  {
    label: "program manager (profile)",
    role: "staff",
    effective: matrix(PROGRAM_MANAGER_CAPS),
  },
  {
    label: "facilitator (profile)",
    role: "member",
    effective: matrix(FACILITATOR_CAPS),
  },
  {
    label: "participant (profile)",
    role: "member",
    effective: matrix(["projects.view", "messaging.view", "messaging.send"]),
  },
  { label: "unassigned member", role: "member", effective: {} },
];

describe("Lot 7 — what the sidebar shows, the server allows", () => {
  test.each(PROFILES)(
    "$label — every rendered requirement passes the server decision",
    ({ role, effective, isSuperAdmin = false }) => {
      const nav = buildAccessNav(role, effective);
      const ctx = contextFor(effective, { isSuperAdmin });
      const violations = [];

      for (const id of renderedIds(nav)) {
        const requirement = NAV_CAPABILITY_REQUIREMENTS[id];
        if (!requirement) continue;
        // A requirement may offer alternatives (crm.view OR contacts.view).
        // The sidebar is honest when at least one of them is allowed.
        const decisions = requirementAlternatives(requirement).map((alternative) => ({
          alternative,
          decision: explainAuthorization(
            ctx,
            alternative.module,
            alternative.capability,
          ),
        }));
        if (!decisions.some(({ decision }) => decision.allowed)) {
          violations.push(
            `${id} requires one of ${decisions
              .map(({ alternative }) => `${alternative.module}.${alternative.capability}`)
              .join(" or ")}`,
          );
        }
      }

      expect(violations).toEqual([]);
    },
  );

  test("the platform owner renders every requirement-bearing section", () => {
    const nav = buildAccessNav("super_admin", fullMatrix());
    const ids = new Set(renderedIds(nav));
    // Every top-level master node that carries a requirement is on the owner's
    // menu — the canonical expression of the tree.
    const major = [
      "crm",
      "communication",
      "programs",
      "ventures",
      "finance",
      "operations",
      "reports",
      "knowledge",
      "lms",
      "security",
      "settings",
    ];
    expect(major.filter((id) => !ids.has(id))).toEqual([]);
  });

  test("a capability the person does not hold hides the node instead of linking to a 403", () => {
    // A staff member without programs.view must not see the programs section.
    const withoutPrograms = matrix(STAFF_CAPS.filter((key) => !key.startsWith("programs.")));
    const nav = buildAccessNav("staff", withoutPrograms);
    expect(renderedIds(nav)).not.toContain("programs");
    expect(
      explainAuthorization(
        contextFor(withoutPrograms),
        "programs",
        "view",
      ).allowed,
    ).toBe(false);
  });

  test("the payload the UI reads is the server's own decision", () => {
    // `/api/me/permissions` returns `effective` + `decisions`; the decision for
    // a capability must agree with the matrix it is derived from.
    const effective = matrix(["programs.view"]);
    const ctx = contextFor(effective);
    expect(explainAuthorization(ctx, "programs", "view").allowed).toBe(true);
    expect(explainAuthorization(ctx, "programs", "delete").allowed).toBe(false);
  });
});
