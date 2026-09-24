"use client";

import { useParams } from "next/navigation";
import DocumentTypeManager from "@/components/ventures/DocumentTypeManager";

/**
 * SUPER ADMIN → one Venture → the documents its Data bank asks for.
 * Reached from the Venture's Data bank page, or from the Databank documents
 * list above it.
 */
export default function AdminVentureDocumentTypesForVenturePage() {
  const { id } = useParams();
  return <DocumentTypeManager ventureId={id} backHref={`/admin/ventures/${id}/verification`} />;
}
