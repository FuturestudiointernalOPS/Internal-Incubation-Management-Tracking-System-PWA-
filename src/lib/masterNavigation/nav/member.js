/**
 * Master navigation — the MEMBER surfaces hoisted for the member roles.
 *
 * Every member door is defined exactly once here; which identity sees which
 * door is the role access table's business (../access.js), never this file's.
 */

export const MEMBER_NODES = [
  { id: "my_programs", name: "MY PROGRAMS", icon: "briefcase", href: "/member/facilitator/programs" },
  { id: "reviews", name: "MY REVIEWS", icon: "clipboardList", href: "/member/facilitator/reviews" },
  { id: "profile", name: "PROFILE", icon: "user", href: "/member/facilitator/profile" },
  { id: "learning", name: "MY LEARNING", icon: "graduationCap", href: "/member/participant/learning" },
  { id: "certificates", name: "MY CERTIFICATES", icon: "fileText", href: "/member/participant/certificates" },
  { id: "timeline", name: "MY TIMELINE", icon: "clock", href: "/member/participant/profile#timeline" },
  { id: "portfolio", name: "PORTFOLIO", icon: "trendingUp", href: "/member/investor/portfolio" },
  { id: "activity", name: "ACTIVITY", icon: "clock", href: "/member/investor/history" },
];
