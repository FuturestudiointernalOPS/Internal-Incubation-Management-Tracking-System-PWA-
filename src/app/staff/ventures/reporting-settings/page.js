"use client";

import VentureReportingSettings from "@/components/shared/ventures/console/reporting/VentureReportingSettings";

/**
 * Staff → Ventures → Reporting settings.
 *
 * The studio's global reporting configuration, gated by `ventures.setup`
 * (already held by the staff default profile and delegable independently of
 * `ventures.edit`). The glossary stays Super Admin-only, as on the admin screen.
 */
export default function StaffVentureReportingSettingsPage() {
  return (
    <VentureReportingSettings
      backHref="/staff/ventures/all"
      homeHref="/staff"
    />
  );
}
