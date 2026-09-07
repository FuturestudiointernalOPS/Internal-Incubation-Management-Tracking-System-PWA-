import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * PARTICIPANT LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between participant pages.
 */
export default function ParticipantLayout({ children }) {
  return (
    <DashboardLayout role="participant">{children}</DashboardLayout>
  );
}
