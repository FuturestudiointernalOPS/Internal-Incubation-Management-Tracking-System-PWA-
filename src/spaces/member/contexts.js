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

/** What a person with no relationship at all carries. */
export const EMPTY_RELATIONSHIPS = {
  isProgramParticipant: false,
  isVentureMember: false,
  isFounder: false,
  isInvestor: false,
  ventures: [],
};

/**
 * The contexts, in the order their doors appear.
 *
 * `replacesDashboard` means the context owns the person's home screen, so the
 * generic dashboard door is not shown at all (an investor lands in their space,
 * not on a participant dashboard).
 */
export const MEMBER_CONTEXTS = [
  {
    key: "investor",
    labelKey: "contexts.member.investor",
    when: ({ role, rel }) =>
      normalizeRole(role) === "investor" || rel?.isInvestor === true,
    replacesDashboard: true,
    doors: [
      {
        id: "investor",
        name: "INVESTOR SPACE",
        icon: "trendingUp",
        href: "/member/investor/dashboard",
      },
      {
        id: "investor_deal_flow",
        name: "DEAL FLOW",
        icon: "briefcase",
        href: "/member/investor/deal-flow",
      },
    ],
  },
  {
    key: "learner",
    labelKey: "contexts.member.learner",
    when: ({ hasCourse }) => hasCourse === true,
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
    when: ({ rel }) => rel?.isProgramParticipant === true,
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
    when: ({ rel }) => rel?.isFounder === true,
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
export function activeMemberContexts({ role, rel, hasCourse } = {}) {
  const signals = { role, rel: rel || EMPTY_RELATIONSHIPS, hasCourse };
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
 * The person's home: a team account keeps its own workspace, a founder lands in
 * their founder space, everyone else on the participant dashboard.
 */
function dashboardDoor(role, rel) {
  const href =
    normalizeRole(role) === "team"
      ? "/member/team"
      : rel.isFounder
        ? "/member/founder"
        : "/member/participant";
  return { id: "dashboard", name: "DASHBOARD", icon: "layoutDashboard", href };
}

const MESSAGES_DOOR = {
  id: "messages",
  name: "MESSAGES",
  icon: "messageSquare",
  href: "/member/participant/messages",
};

/**
 * Compose the member sidebar: the baseline home, then the doors of every active
 * context, in their declared order.
 *
 * Two placements are deliberate and were already the product's behaviour:
 *   - a FOUNDER's ventures door sits with the programme doors (the founder
 *     contract reads Dashboard → Programmes → Ventures), not at the end;
 *   - the investor space owns the home, so it opens first and the generic
 *     dashboard is not shown.
 */
export function composeMemberNav({ role, rel, hasCourse, canReadMessages } = {}) {
  const relationships = rel || EMPTY_RELATIONSHIPS;
  const contexts = activeMemberContexts({ role, rel: relationships, hasCourse });
  const investor = hasMemberContext(contexts, "investor");

  const items = investor ? [] : [dashboardDoor(role, relationships)];

  items.push(...doorsOf(contexts, "learner"));
  items.push(...doorsOf(contexts, "program-participant"));

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

  if (investor) items.unshift(...doorsOf(contexts, "investor"));

  return items;
}
