import VenturePortfolioRollup from "@/components/shared/ventures/console/reporting/VenturePortfolioRollup";

/**
 * Staff → Venture administration → Portfolio.
 *
 * The same portfolio roll-up the internal screens already use. The API is the
 * authority; this page only supplies the way back to the venture administration
 * area.
 */
export default function VentureAdminPortfolioPage() {
  return (
    <VenturePortfolioRollup
      backHref="/staff/venture-admin"
      homeHref="/staff"
    />
  );
}
