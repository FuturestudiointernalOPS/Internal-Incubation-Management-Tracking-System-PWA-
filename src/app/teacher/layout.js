import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * TEACHER LAYOUT — persistent dashboard shell.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between teacher pages.
 */
export default function TeacherLayout({ children }) {
  return <DashboardLayout role="teacher">{children}</DashboardLayout>;
}
