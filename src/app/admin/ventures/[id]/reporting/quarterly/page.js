"use client";

import { useParams } from "next/navigation";
import VentureQuarterlyReview from "@/components/shared/ventures/console/reporting/VentureQuarterlyReview";

/**
 * /admin/ventures/[id]/reporting/quarterly
 *
 * The quarterly half of the studio's review queue. The shell comes from the
 * /admin layout (already `force-dynamic`), so this page returns only content.
 */
export default function VentureQuarterlyReviewPage() {
  const { id } = useParams();
  return <VentureQuarterlyReview ventureId={id} />;
}
