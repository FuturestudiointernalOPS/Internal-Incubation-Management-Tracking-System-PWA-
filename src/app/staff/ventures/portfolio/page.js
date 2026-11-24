"use client";

import VenturePortfolioRollup from "@/components/shared/ventures/console/reporting/VenturePortfolioRollup";

/**
 * Staff → Ventures → Portfolio.
 *
 * The same portfolio roll-up the Super Admin reads, for a staff member holding
 * `ventures.view_all` (or the reporting-review right, `ventures.validate`). The
 * API is the authority; this page only supplies the staff-side way back.
 */
export default function StaffVenturePortfolioPage() {
  return (
    <VenturePortfolioRollup
      backHref="/staff/ventures/all"
      homeHref="/staff"
    />
  );
}
