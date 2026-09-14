"use client";

import TimelineScreen from "@/components/crm/TimelineScreen";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — person timeline.
 *
 * Same screen as the admin route, with the CRM workspace as its base path.
 * Reading a timeline requires the `contacts.view` capability (enforced by
 * GET /api/contacts/[cid]/timeline), which is exactly what grants the CRM
 * section in the first place.
 */
export default function CrmTimelinePage() {
  return <TimelineScreen basePath="/crm" />;
}
