"use client";

export const dynamic = "force-dynamic";

import VentureDocumentTypePicker from "@/components/ventures/VentureDocumentTypePicker";

/**
 * LEAD MANAGER → VENTURES → DATA BANK DOCUMENTS
 *
 * Picks among the Ventures this person leads (the `lead_manager` responsibility
 * — the same rule the server applies to the write). The server still decides:
 * a Venture they do not lead is read-only for them.
 */
export default function StaffVentureDocumentTypesPage() {
  return <VentureDocumentTypePicker scope="staff" backHref="/staff/ventures" />;
}
