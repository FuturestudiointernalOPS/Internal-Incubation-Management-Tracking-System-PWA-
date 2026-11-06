import DashboardLayout from "@/components/layout/DashboardLayout";
import InvestorAccessGate from "@/components/investor/InvestorAccessGate";

/**
 * INVESTOR LAYOUT — persistent dashboard shell + Phase 6 access gates.
 *
 * Renders the shared DashboardLayout shell once (instead of each page wrapping
 * itself) so the sidebar mounts a single time and survives client-side
 * navigation between investor pages. NDA / first-run checklist run inside the
 * client gate so flagged investors cannot skip them.
 */
export default function InvestorLayout({ children }) {
  return (
    <DashboardLayout role="investor">
      <InvestorAccessGate>{children}</InvestorAccessGate>
    </DashboardLayout>
  );
}
