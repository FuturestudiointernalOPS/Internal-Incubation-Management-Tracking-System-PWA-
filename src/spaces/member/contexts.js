/**
 * The member space — its contexts, and the sidebar they compose.
 *
 * A CONTEXT is what a person is or does inside the member space. Contexts are
 * cumulative: a founder who studies is BOTH, and each one adds its own doors.
 * The rules used to live inside the navigation hook as a chain of conditions;
 * they live here now, in the space they describe.
 *
 * What makes a context true is a RELATIONSHIP, never the role string alone:
 * a course enrolment, a programme membership, a venture membership, an
 * approved investor profile. The server resolves those; this file only reads
 * the verdict.
 *
 * Icons are named (not imported) because the shell resolves names to
 * components in one place (`attachIcons`).
 */

import { normalizeRole } from "@/lib/identity";

/** A context is open when the person HOLDS the corresponding profile. */
const holdsProfile = (profiles, key) =>
  Array.isArray(profiles) && profiles.includes(key);

/** What a person with no relationship at all carries. */
export const EMPTY_RELATIONSHIPS = {
  isProgramParticipant: false,
  isFacilitator: false,
  isVentureMember: false,
  isFounder: false,
  isInvestor: false,
  ventures: [],
};

/**
 * The contexts, in the order their doors appear.
 *
 * No context replaces the dashboard any more. Every member opens the SAME page
 * (`/dashboard`); each context only adds its own doors beside it. The investor
 * space used to own the person's home — that is exactly what the unified
 * dashboard replaces.
 */
export const MEMBER_CONTEXTS = [
  {
    key: "investor",
    labelKey: "contexts.member.investor",
    when: ({ role, rel, profiles }) =>
      holdsProfile(profiles, "investor") ||
      normalizeRole(role) === "investor" ||
      rel?.isInvestor === true,
    doors: [
      {
        id: "investor",
        name: "INVESTOR SPACE",
        icon: "trendingUp",
        href: "/member/investor/deal-flow",
      },
      {
        id: "investor_portfolio",
        name: "PORTFOLIO",
        icon: "briefcase",
        href: "/member/investor/portfolio",
      },
    ],
  },
  {
    key: "learner",
    labelKey: "contexts.member.learner",
    when: ({ hasCourse, profiles }) =>
      holdsProfile(profiles, "learner") || hasCourse === true,
    doors: [
      {
        id: "learning",
        name: "MY LEARNING",
        icon: "graduationCap",
        href: "/member/participant/learning",
      },
    ],
  },
  {
    key: "program-participant",
    labelKey: "contexts.member.programParticipant",
    when: ({ rel, profiles }) =>
      holdsProfile(profiles, "participant") || rel?.isProgramParticipant === true,
    doors: [
      {
        id: "programs",
        name: "MY PROGRAMS",
        icon: "briefcase",
        href: "/member/participant/dashboard",
      },
      {
        id: "certificates",
        name: "MY CERTIFICATES",
        icon: "fileText",
        href: "/member/participant/certificates",
      },
    ],
  },
  {
    key: "facilitator",
    labelKey: "contexts.member.facilitator",
    // An actual facilitation assignment is the truth (the dashboard and the
    // facilitator area's own guard read the same table); the resolved profile is
    // accepted as well for accounts that carry it without an assignment.
    when: ({ rel, profiles }) =>
      rel?.isFacilitator === true || holdsProfile(profiles, "facilitator"),
    doors: [
      {
        id: "my_programs",
        name: "MY PROGRAMS",
        icon: "briefcase",
        href: "/member/facilitator/programs",
      },
      {
        id: "reviews",
        name: "MY REVIEWS",
        icon: "clipboardList",
        href: "/member/facilitator/reviews",
      },
    ],
  },
  {
    key: "venture-member",
    labelKey: "contexts.member.ventureMember",
    when: ({ rel }) => rel?.isVentureMember === true,
    doors: [
      {
        id: "ventures",
        name: "MY VENTURES",
        icon: "rocket",
        href: "/member/participant/ventures",
      },
    ],
  },
  {
    key: "founder",
    labelKey: "contexts.member.founder",
    when: ({ rel, profiles }) =>
      holdsProfile(profiles, "founder") || rel?.isFounder === true,
    doors: [
      {
        id: "founder_meetings",
        name: "MEETINGS",
        icon: "calendar",
        href: "/member/founder/meetings",
      },
    ],
  },
];

/** The contexts this person actually holds right now. */
export function activeMemberContexts({ role, rel, hasCourse, profiles = [] } = {}) {
  const signals = {
    role,
    rel: rel || EMPTY_RELATIONSHIPS,
    hasCourse,
    profiles: Array.isArray(profiles) ? profiles : [],
  };
  return MEMBER_CONTEXTS.filter((context) => context.when(signals));
}

/** Whether one context is active, by key. */
export function hasMemberContext(contexts, key) {
  return (contexts || []).some((context) => context.key === key);
}

/** The doors a context contributes (empty when it is not active). */
function doorsOf(contexts, key) {
  const context = (contexts || []).find((entry) => entry.key === key);
  return context ? context.doors : [];
}

/**
 * The person's home. One address for everyone in the space: a team account
 * keeps its own workspace, every other member opens `/dashboard`.
 */
function dashboardDoor(role) {
  const href =
    normalizeRole(role) === "team" ? "/member/team" : "/dashboard";
  return { id: "dashboard", name: "DASHBOARD", icon: "layoutDashboard", href };
}

const MESSAGES_DOOR = {
  id: "messages",
  name: "MESSAGES",
  icon: "messageSquare",
  href: "/member/participant/messages",
};

/**
 * Compose the member sidebar: the one dashboard first, then the doors of every
 * active context, in their declared order.
 *
 * One placement is deliberate and was already the product's behaviour: a
 * FOUNDER's ventures door sits with the programme doors (the founder contract
 * reads Dashboard → Programmes → Ventures), not at the end. The investor doors
 * now come LAST, because the dashboard is no longer replaced by the investor
 * space.
 */
export function composeMemberNav({
  role,
  rel,
  hasCourse,
  canReadMessages,
  profiles = [],
} = {}) {
  const relationships = rel || EMPTY_RELATIONSHIPS;
  const contexts = activeMemberContexts({
    role,
    rel: relationships,
    hasCourse,
    profiles,
  });
  const investor = hasMemberContext(contexts, "investor");

  const items = [dashboardDoor(role)];

  items.push(...doorsOf(contexts, "learner"));
  items.push(...doorsOf(contexts, "program-participant"));
  items.push(...doorsOf(contexts, "facilitator"));

  if (canReadMessages && normalizeRole(role) !== "team") {
    items.push(MESSAGES_DOOR);
  }

  const ventureDoors = doorsOf(contexts, "venture-member");
  if (ventureDoors.length > 0) {
    if (relationships.isFounder) {
      const programIndex = items.findIndex((item) => item.id === "programs");
      items.splice(programIndex === -1 ? 1 : programIndex + 2, 0, ...ventureDoors);
    } else {
      items.push(...ventureDoors);
    }
  }

  // The founder's sessions door follows their venture doors; it is the only
  // door the founder context adds (the venture workspace keeps the rest).
  items.push(...doorsOf(contexts, "founder"));

  // The investor's doors are additions, never a replacement of the home.
  if (investor) items.push(...doorsOf(contexts, "investor"));

  return items;
}
