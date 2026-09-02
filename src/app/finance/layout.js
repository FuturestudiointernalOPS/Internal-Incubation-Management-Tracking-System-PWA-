import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * FINANCE LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between finance pages.
 */
export default function FinanceLayout({ children }) {
  return <DashboardLayout role="finance">{children}</DashboardLayout>;
}
