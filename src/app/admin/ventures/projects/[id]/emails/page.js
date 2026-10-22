"use client";

import React from "react";
import { useParams } from "next/navigation";
import ProjectReminderEmailsView from "@/components/ventures/projects/ProjectReminderEmailsView";

/**
 * Super Admin → Ventures → Project Management → [Venture] → Sent emails.
 *
 * The reminder log for the Venture opened from the project directory. The
 * Projects screen links here, so the emails are read on a page rather than in a
 * panel squeezed under the work items.
 */
export default function AdminProjectVentureEmailsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  return (
    <div className="space-y-5 pb-20">
      <ProjectReminderEmailsView
        ventureId={id}
        backHref={`/admin/ventures/projects/${id}`}
      />
    </div>
  );
}
