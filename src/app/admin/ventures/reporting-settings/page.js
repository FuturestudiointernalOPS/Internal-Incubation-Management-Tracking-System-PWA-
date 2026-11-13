"use client";

import VentureReportingSettings from "@/components/shared/ventures/console/reporting/VentureReportingSettings";

/**
 * /admin/ventures/reporting-settings
 *
 * The studio's reporting configuration. Global (not per-Venture), which is why
 * it sits beside the Ventures list rather than inside one Venture.
 */
export default function VentureReportingSettingsPage() {
  return <VentureReportingSettings />;
}
