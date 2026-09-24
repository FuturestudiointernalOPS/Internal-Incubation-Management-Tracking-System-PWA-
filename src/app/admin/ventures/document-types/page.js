"use client";

import VentureDocumentTypePicker from "@/components/ventures/VentureDocumentTypePicker";

/**
 * SUPER ADMIN → VENTURES → DATA BANK DOCUMENTS
 *
 * Picks the Venture whose document list is to be defined (every Venture, for a
 * Super Admin). The /admin layout already renders the shell.
 */
export default function AdminVentureDocumentTypesPage() {
  return <VentureDocumentTypePicker scope="admin" backHref="/admin/ventures" />;
}
