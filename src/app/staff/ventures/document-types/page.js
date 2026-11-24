"use client";

export const dynamic = "force-dynamic";

import VentureDocumentTypePicker from "@/components/shared/ventures/console/VentureDocumentTypePicker";

/**
 * LEAD MANAGER → VENTURES → DATA BANK DOCUMENTS
 *
 * Picks among the Ventures this person leads (the `venture_manager` responsibility
 * — the same rule the server applies to the write). The server still decides:
 * a Venture they do not lead is read-only for them.
 */
export default function StaffVentureDocumentTypesPage() {
  return <VentureDocumentTypePicker scope="staff" backHref="/staff/ventures" />;
}
