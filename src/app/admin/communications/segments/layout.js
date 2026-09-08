import { notFound } from "next/navigation";

// SEGMENTS RETIRED — hidden from the sidebar and disabled (404).
// The page component is intentionally kept; flip the API guards in
// /api/segments to re-enable the feature.
export default function RetiredSegmentsLayout() {
  notFound();
}
