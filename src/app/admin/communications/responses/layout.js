import { notFound } from "next/navigation";

// RESPONSES RETIRED — hidden from the sidebar and disabled (404).
// The page component is intentionally kept; flip the API guards in
// /api/responses to re-enable the feature.
export default function RetiredResponsesLayout() {
  notFound();
}
