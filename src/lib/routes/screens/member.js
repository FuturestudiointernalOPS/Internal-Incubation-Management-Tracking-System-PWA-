/**
 * The address catalogue — the member space — participant, founder, investor, facilitator, team.
 *
 * Generated from the page tree for P0. Each row is one screen: where it must
 * live (`path`, plus `tab`/`query` when the view sits behind a parameter),
 * the addresses that still answer to it (`legacy`), and the role/context/
 * feature it belongs to. See docs/ADDRESS_CONTRACT.md.
 *
 * `pending: true` means the move has not happened yet: the first legacy
 * address still serves its own page and NOTHING redirects. Removing the flag is
 * the last step of a move — the check then requires `path` to exist and turns
 * every legacy address into a redirect.
 *
 * Do not invent rows: every `path` here must exist as a page.
 */

export const MEMBER_SCREENS = [
  { id: "member.home", role: "member", context: null, feature: null, path: "/member" },
  { id: "member.dashboard", role: "member", context: null, feature: "dashboard", path: "/member/dashboard", legacy: ["/dashboard"], pending: true },
  { id: "member.facilitator.profile", role: "member", context: "facilitator", feature: "profile", path: "/member/facilitator/profile" },
  { id: "member.facilitator.program.detail", role: "member", context: "facilitator", feature: "program", path: "/member/facilitator/program/[id]" },
  { id: "member.facilitator.programs", role: "member", context: "facilitator", feature: "programs", path: "/member/facilitator/programs" },
  { id: "member.facilitator.reviews", role: "member", context: "facilitator", feature: "reviews", path: "/member/facilitator/reviews" },
  { id: "member.founder.meetings", role: "member", context: "founder", feature: "meetings", path: "/member/founder/meetings" },
  { id: "member.investor.deal-flow", role: "member", context: "investor", feature: "deal-flow", path: "/member/investor/deal-flow" },
  { id: "member.investor.deck.detail", role: "member", context: "investor", feature: "deck", path: "/member/investor/deck/[deckId]" },
  { id: "member.investor.diligence", role: "member", context: "investor", feature: "diligence", path: "/member/investor/diligence" },
  { id: "member.investor.history", role: "member", context: "investor", feature: "history", path: "/member/investor/history" },
  { id: "member.investor.organizations", role: "member", context: "investor", feature: "organizations", path: "/member/investor/organizations" },
  { id: "member.investor.portfolio", role: "member", context: "investor", feature: "portfolio", path: "/member/investor/portfolio" },
  { id: "member.investor.profile", role: "member", context: "investor", feature: "profile", path: "/member/investor/profile" },
  { id: "member.investor.setup-password", role: "member", context: "investor", feature: "setup-password", path: "/member/investor/setup-password" },
  { id: "member.participant.detail", role: "member", context: "participant", feature: null, path: "/member/participant/[id]" },
  { id: "member.participant.announcements", role: "member", context: "participant", feature: "announcements", path: "/member/participant/announcements" },
  { id: "member.participant.assignments", role: "member", context: "participant", feature: "assignments", path: "/member/participant/assignments" },
  { id: "member.participant.certificates", role: "member", context: "participant", feature: "certificates", path: "/member/participant/certificates" },
  { id: "member.participant.dashboard", role: "member", context: "participant", feature: "dashboard", path: "/member/participant/dashboard" },
  { id: "member.participant.followups", role: "member", context: "participant", feature: "followups", path: "/member/participant/followups" },
  { id: "member.participant.learning", role: "member", context: "participant", feature: "learning", path: "/member/participant/learning" },
  { id: "member.participant.learning.detail", role: "member", context: "participant", feature: "learning", path: "/member/participant/learning/[courseId]" },
  { id: "member.participant.learning.detail.assessments.detail", role: "member", context: "participant", feature: "learning", path: "/member/participant/learning/[courseId]/assessments/[assessmentId]" },
  { id: "member.participant.learning.detail.lessons.detail", role: "member", context: "participant", feature: "learning", path: "/member/participant/learning/[courseId]/lessons/[lessonId]" },
  { id: "member.participant.messages", role: "member", context: "participant", feature: "messages", path: "/member/participant/messages" },
  { id: "member.participant.profile", role: "member", context: "participant", feature: "profile", path: "/member/participant/profile" },
  { id: "member.participant.progress", role: "member", context: "participant", feature: "progress", path: "/member/participant/progress" },
  { id: "member.participant.rituals", role: "member", context: "participant", feature: "rituals", path: "/member/participant/rituals" },
  { id: "member.participant.timeline", role: "member", context: "participant", feature: "timeline", path: "/member/participant/timeline" },
  { id: "member.participant.ventures", role: "member", context: "participant", feature: "ventures", path: "/member/participant/ventures" },
  { id: "member.participant.ventures.detail", role: "member", context: "participant", feature: "ventures", path: "/member/participant/ventures/[id]" },
  { id: "member.team.detail", role: "member", context: "team", feature: null, path: "/member/team/[id]" },
];
