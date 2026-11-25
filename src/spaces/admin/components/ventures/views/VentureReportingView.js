"use client";

import { useParams, useSearchParams } from "next/navigation";
import VentureMonthlyReview from "@/components/shared/ventures/console/reporting/VentureMonthlyReview";
import VentureQuarterlyReview from "@/components/shared/ventures/console/reporting/VentureQuarterlyReview";
import VentureDataDashboard from "@/components/shared/ventures/console/reporting/VentureDataDashboard";

/**
 * The Venture's Reporting view.
 *
 * One address — /admin/ventures/[id]?tab=reporting — carries the studio's
 * reporting surfaces: the monthly review queue by default, the quarterly review
 * with `?period=quarterly`, and the reporting dashboard with `?view=dashboard`.
 * The former /reporting, /reporting/quarterly and /reporting/dashboard
 * addresses redirect here.
 */
export default function VentureReportingView() {
  const { id } = useParams();
  const searchParams = useSearchParams();

  if (searchParams?.get("view") === "dashboard") {
    return <VentureDataDashboard ventureId={id} />;
  }

  if (searchParams?.get("period") === "quarterly") {
    return <VentureQuarterlyReview ventureId={id} />;
  }

  return <VentureMonthlyReview ventureId={id} />;
}
