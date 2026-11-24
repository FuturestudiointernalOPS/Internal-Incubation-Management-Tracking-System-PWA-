import VenturesDirectory from "@/spaces/staff/core/components/VenturesDirectory";

/**
 * Staff → Venture administration → All Ventures.
 *
 * The directory reads `GET /api/ventures`, which returns the whole portfolio
 * only to a holder of `ventures.view_all`. Opening a Venture reuses the shared
 * staff workspace, where every write is decided again by the API.
 */
export default function VentureAdminDirectoryPage() {
  return <VenturesDirectory />;
}
