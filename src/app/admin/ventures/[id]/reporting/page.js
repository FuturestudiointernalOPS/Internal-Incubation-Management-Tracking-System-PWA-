"use client";

import { useParams } from "next/navigation";
import VentureMonthlyReview from "@/components/shared/ventures/console/reporting/VentureMonthlyReview";

/**
 * /admin/ventures/[id]/reporting
 *
 * The studio's monthly-report review queue for ONE Venture. The shell (sidebar
 * + header) comes from the /admin layout, which is already `force-dynamic`; this
 * page therefore returns only its content.
 */
export default function VentureReportingReviewPage() {
  const { id } = useParams();
  return <VentureMonthlyReview ventureId={id} />;
}
