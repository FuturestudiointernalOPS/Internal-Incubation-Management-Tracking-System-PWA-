import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * STAFF LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between staff pages.
 */
export default function StaffLayout({ children }) {
  return <DashboardLayout role="staff">{children}</DashboardLayout>;
}
