export const dynamic = "force-dynamic";
// Separate client entry: no internal DashboardLayout, auth badges or role menus.
export default function OrganizationLayout({ children }) {
  return <main className="min-h-screen bg-surface-1 text-[var(--text-primary)]"><div className="mx-auto max-w-6xl p-6 md:p-10">{children}</div></main>;
}
