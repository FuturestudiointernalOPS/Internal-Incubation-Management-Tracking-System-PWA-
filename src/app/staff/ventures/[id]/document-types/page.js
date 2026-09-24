"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import DocumentTypeManager from "@/components/ventures/DocumentTypeManager";

/**
 * LEAD MANAGER → one Venture → the documents its Data bank asks for.
 * A Venture this person does not lead renders read-only, because the server
 * refuses the write.
 */
export default function StaffVentureDocumentTypesForVenturePage() {
  const { id } = useParams();
  return <DocumentTypeManager ventureId={id} backHref={`/staff/ventures/${id}`} />;
}
