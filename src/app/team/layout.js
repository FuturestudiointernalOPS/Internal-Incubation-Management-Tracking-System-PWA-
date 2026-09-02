import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * TEAM LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between team pages.
 */
export default function TeamLayout({ children }) {
  return <DashboardLayout role="team">{children}</DashboardLayout>;
}
