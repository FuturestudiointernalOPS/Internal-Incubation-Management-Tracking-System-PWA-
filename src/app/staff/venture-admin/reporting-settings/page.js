import VentureReportingSettings from "@/components/shared/ventures/console/reporting/VentureReportingSettings";

/**
 * Staff → Venture administration → Reporting settings.
 *
 * Gated by `ventures.setup` (part of the Venture Admin bundle, and delegable
 * independently of `ventures.edit`). The glossary stays Super Admin-only, as on
 * the admin screen.
 */
export default function VentureAdminReportingSettingsPage() {
  return (
    <VentureReportingSettings
      backHref="/staff/venture-admin"
      homeHref="/staff"
    />
  );
}
