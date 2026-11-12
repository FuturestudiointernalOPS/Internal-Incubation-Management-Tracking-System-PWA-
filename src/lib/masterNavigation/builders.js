/**
 * ImpactOS — Master Navigation: projection builders.
 *
 * Pure functions that project the master tree (./nodes.js) through a role's
 * access table (./access.js) and the user's effective capabilities.
 */

import { MASTER_NAVIGATION } from "./nodes";
import {
  ROLE_ACCESS,
  NAV_CAPABILITY_REQUIREMENTS,
  NON_ADMIN_HREF_FALLBACKS,
  requirementAlternatives,
} from "./access";
import { spaceForRole } from "@/spaces/registry";
import { NAV_CAPABILITY_PROPOSAL } from "@/models/authorization/navData";

// Fallback access for a role absent from ROLE_ACCESS (an unknown/legacy
// identity). It is NOT a role: it only gives such an identity three neutral
// doors, and the server-side gate remains authoritative.
const FALLBACK_ACCESS = {
  top: ["dashboard", "projects", "reports"],
  children: {},
  hrefs: { reports: "/admin/reports" },
  icons: { reports: "barChart3" },
};

// Phase H — a legacy contextual PROFILE value is not a role. An account still
// carrying one resolves to its BASELINE mask (staff for a staff-only profile,
// member otherwise), so it keeps a working sidebar instead of the neutral
// fallback, until the role alignment has run everywhere.
const LEGACY_PROFILE_SURFACES = {
  program_manager: "staff",
  facilitator: "member",
  participant: "member",
  founder: "member",
  investor: "member",
};

/** The role's access table, with the legacy profile values normalized. */
function accessForRole(role) {
  return (
    ROLE_ACCESS[role] ||
    ROLE_ACCESS[LEGACY_PROFILE_SURFACES[role]] ||
    FALLBACK_ACCESS
  );
}

/** Pure capability check against an effective matrix. */
export function hasCapability(effective, module, capability, minLevel = 1) {
  return Number(effective?.[module]?.[capability] ?? 0) >= minLevel;
}

/** Étape 3 — the menu derives from rights. Default OFF while the mapping is reviewed. */
const navFromRightsEnabled = () =>
  process.env.AUTHZ_NAV_FROM_RIGHTS === "true";

/** Parse one proposal value: "public" | "module.capability" | "a OR b" (dotted caps allowed). */
function proposalAlternatives(value) {
  if (!value || value === "public") return null;
  return String(value)
    .split(" OR ")
    .map((part) => {
      const index = part.indexOf(".");
      if (index < 0) return null;
      return { module: part.slice(0, index), capability: part.slice(index + 1) };
    })
    .filter(Boolean);
}

/** A node's alternatives: declared first, then the step-3 proposal. */
function rightsAlternatives(id) {
  const declared = NAV_CAPABILITY_REQUIREMENTS[id];
  if (declared) return requirementAlternatives(declared);
  return proposalAlternatives(NAV_CAPABILITY_PROPOSAL[id]);
}

/** Public nodes pass; a capability node passes when one alternative is held. */
function passesRights(id, effective) {
  const alternatives = rightsAlternatives(id);
  if (!alternatives) return true; // public (explicit or no requirement)
  if (!effective) return true; // not loaded yet: show, server stays authoritative
  return alternatives.some((alternative) =>
    hasCapability(effective, alternative.module, alternative.capability),
  );
}

/** The space an address belongs to; unknown prefixes are shared. */
function spaceOfHref(href) {
  if (!href) return "shared";
  if (href.startsWith("/admin")) return "admin";
  if (href.startsWith("/staff")) return "staff";
  if (href.startsWith("/member")) return "member";
  return "shared";
}

/** Project one master section for a role (role child list + href/icon overrides). */
function projectMasterSection(node, access) {
  // Child list precedence: the role's own list, then Super Admin's canonical
  // expression of the master tree (which omits role-specific extras such as
  // `groups`), then the raw master children.
  const childIds =
    (access.children && access.children[node.id]) ||
    ROLE_ACCESS.super_admin.children[node.id] ||
    (node.children || []).map((child) => child.id);
  return {
    id: node.id,
    name: node.name,
    icon: (access.icons && access.icons[node.id]) || node.icon,
    subItems: childIds
      .map(
        (id) =>
          (node.children || []).find((child) => child.id === id) ||
          NAV_NODE_INDEX[id],
      )
      .filter(Boolean)
      .map((child) => ({
        id: child.id,
        name: child.name,
        icon: child.icon,
        href: (access.hrefs && access.hrefs[child.id]) || child.href,
      })),
  };
}

/**
 * Étape 3 — project the master tree through RIGHTS instead of a role mask.
 *
 * Only the staff and admin spaces use this mode for now: a member's personal
 * doors (facilitator / investor / participant) are context-owned and are not
 * safe to derive from a single right yet. The role tables are still used for
 * ADDRESS overrides and icons, never for visibility.
 */
function buildRightsNav(role, effective) {
  const access = accessForRole(role);
  const roleSpace = spaceForRole(role) || "member";
  const roleHrefs = access.hrefs || {};
  const canOpenAdmin = roleSpace === "admin";

  const resolveHref = (id, href) => {
    if (canOpenAdmin || !href) return href;
    if (roleHrefs[id]) return roleHrefs[id];
    const fallback = NON_ADMIN_HREF_FALLBACKS[id];
    if (fallback) return fallback;
    return href.startsWith("/admin") ? null : href;
  };

  const allowsSpace = (id, href) => {
    if (!href) return false;
    // An explicit role address is a deliberate cross-space mapping (the finance
    // role's profile page, for example) and always wins.
    if (roleHrefs[id]) return true;
    // The platform owner can open the admin and staff surfaces (and shared
    // ones), but NOT the member context doors: those belong to a person's
    // facilitator / investor / participant context, not to the owner.
    // Staff stay inside the staff and shared surfaces; "/admin" nodes without
    // a non-admin fallback are already dropped by `resolveHref`.
    const nodeSpace = spaceOfHref(href);
    if (roleSpace === "admin") {
      return nodeSpace === "admin" || nodeSpace === "staff" || nodeSpace === "shared";
    }
    return nodeSpace === "shared" || nodeSpace === roleSpace;
  };

  const project = (node) => {
    const isSection = Array.isArray(node.children) && node.children.length > 0;
    const icon = (access.icons && access.icons[node.id]) || node.icon;

    if (isSection) {
      const subItems = node.children.map(project).filter(Boolean);
      if (subItems.length > 0) {
        return { id: node.id, name: node.name, icon, subItems };
      }
      // A section whose children are unreachable in this space collapses to
      // the role's scoped address (staff programs, team programs, …).
      const href = resolveHref(node.id, roleHrefs[node.id] || node.href);
      if (href && allowsSpace(node.id, href) && passesRights(node.id, effective)) {
        return { id: node.id, name: node.name, icon, href };
      }
      return null;
    }

    if (!passesRights(node.id, effective)) return null;
    const rawHref = (access.hrefs && access.hrefs[node.id]) || node.href;
    const href = resolveHref(node.id, rawHref);
    if (!href || !allowsSpace(node.id, href)) return null;
    return { id: node.id, name: node.name, icon, href };
  };

  const seen = new Set();
  const dedupe = (items) =>
    (items || [])
      .map((item) => {
        if (seen.has(item.id)) return null;
        if (item.subItems) {
          const kids = dedupe(item.subItems).filter(Boolean);
          if (kids.length === 0) return null;
          seen.add(item.id);
          return { ...item, subItems: kids };
        }
        seen.add(item.id);
        return item;
      })
      .filter(Boolean);

  return dedupe(MASTER_NAVIGATION.map(project).filter(Boolean));
}

/**
 * The single source of sidebar truth: a role's navigation projected against the
 * user's effective capabilities.
 *
 *   base   = buildRoleNav(role) — the role's own doors (hrefs already resolved)
 *   grants = master sections the role matrix omits but the capabilities grant
 *
 * One pass then:
 *   - drops every node whose NAV_CAPABILITY_REQUIREMENTS entry is not met;
 *   - resolves non-admin hrefs through the role's scoped href or
 *     NON_ADMIN_HREF_FALLBACKS, and DROPS the node when neither exists
 *     (no dead links, and no leak from another role's flat menu);
 *   - drops a section left without children;
 *   - renders every id at most once (first occurrence wins).
 *
 * `effective === null` (capabilities not loaded yet) fails OPEN on visibility —
 * the server stays authoritative — but never on hrefs.
 */
export function buildAccessNav(role, effective) {
  const roleSpace = spaceForRole(role);
  if (navFromRightsEnabled() && (roleSpace === "staff" || roleSpace === "admin")) {
    return buildRightsNav(role, effective);
  }

  const access = accessForRole(role);
  // The admin surface is a SPACE, not a role label: the registry is the only
  // mapping from an identity to its space, so the gate asks it instead of
  // comparing the role string here.
  const canOpenAdmin = spaceForRole(role) === "admin";
  const roleHrefs = access.hrefs || {};

  const passes = (id) => {
    const req = NAV_CAPABILITY_REQUIREMENTS[id];
    if (!req || !effective) return true;
    // A requirement may offer alternatives ("crm.view OR contacts.view"); one
    // allowed alternative is enough, and each child keeps its own requirement.
    return requirementAlternatives(req).some((alternative) =>
      hasCapability(effective, alternative.module, alternative.capability),
    );
  };

  const resolveHref = (id, href) => {
    if (canOpenAdmin || !href) return href;
    if (roleHrefs[id]) return roleHrefs[id];
    const fallback = NON_ADMIN_HREF_FALLBACKS[id];
    if (fallback) return fallback;
    return href.startsWith("/admin") ? null : href;
  };

  const base = buildRoleNav(role);
  const present = new Set();
  const collect = (items) =>
    (items || []).forEach((item) => {
      present.add(item.id);
      collect(item.subItems);
    });
  collect(base);

  // Top-level nodes that carry a requirement can be ADDED by a capability when
  // the role matrix omits them (sections get their canonical children, leaves
  // such as `finance` are added as a single link). Grants require an effective
  // matrix: while it is still loading we show the role's own doors, never guess.
  const grants = !effective
    ? []
    : MASTER_NAVIGATION.filter(
        (node) =>
          NAV_CAPABILITY_REQUIREMENTS[node.id] &&
          !present.has(node.id) &&
          passes(node.id),
      ).map((node) =>
        Array.isArray(node.children) && node.children.length > 0
          ? projectMasterSection(node, access)
          : {
              id: node.id,
              name: node.name,
              icon: (access.icons && access.icons[node.id]) || node.icon,
              href: (access.hrefs && access.hrefs[node.id]) || node.href,
            },
      );

  // Capability gate. A role's OWN doors keep their hrefs (a role matrix may
  // legitimately point at /admin); only GRANTED nodes get href surgery, because
  // they come from another role's world and must not become dead links.
  const gate = (items, dropUnreachable) =>
    (items || [])
      .map((item) => {
        if (!passes(item.id)) return null;
        if (item.subItems && item.subItems.length > 0) {
          const kids = gate(item.subItems, dropUnreachable).filter(Boolean);
          return kids.length > 0 ? { ...item, subItems: kids } : null;
        }
        const href = dropUnreachable
          ? resolveHref(item.id, item.href)
          : item.href;
        return href ? { ...item, href } : null;
      })
      .filter(Boolean);

  const seen = new Set();
  const dedupe = (items) =>
    (items || [])
      .map((item) => {
        if (seen.has(item.id)) return null;
        if (item.subItems) {
          const kids = dedupe(item.subItems).filter(Boolean);
          if (kids.length === 0) return null;
          seen.add(item.id);
          return { ...item, subItems: kids };
        }
        seen.add(item.id);
        return item;
      })
      .filter(Boolean);

  return dedupe([...gate(base, false), ...gate(grants, true)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Node index — id → node. Every node in the master tree is reachable by id,
// so role masks can hoist any node to any position without duplicating it.
// ─────────────────────────────────────────────────────────────────────────────
const NAV_NODE_INDEX = {};
(function indexNodes(items) {
  (items || []).forEach((item) => {
    if (!NAV_NODE_INDEX[item.id]) NAV_NODE_INDEX[item.id] = item;
    if (item.children && item.children.length > 0) indexNodes(item.children);
  });
})(MASTER_NAVIGATION);

function projectNode(node, access, depth) {
  // Only master nodes that are themselves sections can project children.
  const isSectionNode = Array.isArray(node.children) && node.children.length > 0;
  const childIds =
    isSectionNode && access.children ? access.children[node.id] : undefined;
  if (childIds && childIds.length > 0) {
    return {
      id: node.id,
      name: node.name,
      icon: depth === 0 ? (access.icons && access.icons[node.id]) || node.icon : undefined,
      subItems: childIds
        .map((cid) => {
          // Prefer the parent's own child node. This is required because the
          // "security" section and its first child share the id "security":
          // the flat index would resolve that id to the section and recurse
          // forever, while the parent's children array holds the leaf.
          const child =
            (node.children || []).find((candidate) => candidate.id === cid) || NAV_NODE_INDEX[cid];
          return child ? projectNode(child, access, depth + 1) : null;
        })
        .filter(Boolean),
    };
  }
  return {
    id: node.id,
    name: node.name,
    icon: depth === 0 ? (access.icons && access.icons[node.id]) || node.icon : undefined,
    href: (access.hrefs && access.hrefs[node.id]) || node.href,
  };
}

/**
 * Project the master navigation for a role.
 * Output shape is identical to the legacy per-role matrices: top-level items
 * with `subItems` (sections) or `href` (leaves). Sections with no visible
 * children collapse to leaves using the role's resolved href.
 */
export function buildRoleNav(role) {
  const access = accessForRole(role);
  return (access.top || [])
    .map((id) => {
      const node = NAV_NODE_INDEX[id];
      return node ? projectNode(node, access, 0) : null;
    })
    .filter(Boolean);
}
