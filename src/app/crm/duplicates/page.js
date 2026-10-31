"use client";

import DuplicatesScreen from "@/components/crm/DuplicatesScreen";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — the duplicate review queue.
 *
 * Reading requires `duplicates.view`; reviewing, dismissing and merging require
 * `duplicates.resolve`. The legacy `/admin/crm/duplicates` route redirects here.
 */
export default function CrmDuplicatesPage() {
  return <DuplicatesScreen />;
}
