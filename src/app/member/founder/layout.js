import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * FOUNDER LAYOUT — dedicated executive shell for startup founders.
 * Inherits DashboardLayout shell with role="founder".
 */
export const dynamic = "force-dynamic";

export default function FounderLayout({ children }) {
  return (
    <DashboardLayout role="founder">
      <div className="w-full">{children}</div>
    </DashboardLayout>
  );
}
