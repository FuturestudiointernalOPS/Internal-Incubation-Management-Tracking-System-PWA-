import DashboardLayout from "@/components/layout/DashboardLayout";

export const dynamic = "force-dynamic";

/**
 * MEMBER SPACE SHELL — one frame for every member context.
 *
 * Rendered once for `/member/participant`, `/member/founder`,
 * `/member/investor`, `/member/facilitator` and `/member/team`: moving from one
 * context to another no longer remounts the sidebar or re-asks the session and
 * badge reads.
 *
 * The hub (`/member`) is deliberately OUTSIDE this group: it is the space's
 * chooser screen and carries its own full-page design, so a sidebar there would
 * be a second navigation.
 *
 * The `role` prop is the pre-session fallback only — the effective role, and
 * therefore the sidebar, always comes from the connected user's session.
 */
export default function MemberContextsLayout({ children }) {
  return <DashboardLayout role="member">{children}</DashboardLayout>;
}
