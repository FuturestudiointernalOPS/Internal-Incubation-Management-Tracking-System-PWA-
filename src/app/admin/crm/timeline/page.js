"use client";

import TimelineScreen from "@/components/crm/TimelineScreen";

/**
 * Admin route for the person timeline. The screen itself lives in
 * src/components/crm/TimelineScreen.js and is shared with the non-admin CRM
 * workspace (/crm/timeline) — only `basePath` differs.
 */
export default function TimelinePage() {
  return <TimelineScreen basePath="/admin/crm" />;
}
