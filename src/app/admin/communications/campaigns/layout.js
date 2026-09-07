import { notFound } from "next/navigation";

// CAMPAIGNS RETIRED — hidden from the sidebar and disabled (404).
// The page component is intentionally kept; flip the API guards in
// /api/campaigns to re-enable the feature.
export default function RetiredCampaignsLayout() {
  notFound();
}
