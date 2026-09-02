import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * CRM LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between CRM pages.
 */
export default function CrmLayout({ children }) {
  return <DashboardLayout role="crm">{children}</DashboardLayout>;
}
