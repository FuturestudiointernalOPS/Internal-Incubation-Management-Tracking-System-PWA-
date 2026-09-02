import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * PM LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between program-manager pages.
 */
export default function PmLayout({ children }) {
  return (
    <DashboardLayout role="program_manager">{children}</DashboardLayout>
  );
}
