import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * INVESTOR LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between investor pages.
 */
export default function InvestorLayout({ children }) {
  return <DashboardLayout role="investor">{children}</DashboardLayout>;
}
