"use client";

import React from "react";
import { useParams } from "next/navigation";
import ProjectReminderEmailsView from "@/components/ventures/projects/ProjectReminderEmailsView";

/**
 * Staff → Ventures → [Venture] → Sent emails.
 *
 * The reminder log of this Venture's projects, on its own screen. The Projects
 * tab links here so the work itself stays the thing on screen, and the question
 * "what has actually been chased?" gets a page of its own.
 */
export default function StaffVentureEmailsPage() {
  const { id } = useParams();
  const ventureId = Array.isArray(id) ? id[0] : id;

  return (
    <div className="mx-auto max-w-6xl p-6 pb-20">
      <ProjectReminderEmailsView
        ventureId={ventureId}
        backHref={`/staff/ventures/${ventureId}?tab=projects`}
      />
    </div>
  );
}
