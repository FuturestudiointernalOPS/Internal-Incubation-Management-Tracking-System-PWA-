"use client";

import { useParams } from "next/navigation";
import VentureDataDashboard from "@/components/ventures/reporting/VentureDataDashboard";

/**
 * /admin/ventures/[id]/reporting/dashboard
 *
 * The reporting dashboard (spec §12) for the studio: the same component the
 * founder sees, reading the calculated layer only.
 */
export default function VentureReportingDashboardPage() {
  const { id } = useParams();
  return <VentureDataDashboard ventureId={id} />;
}
