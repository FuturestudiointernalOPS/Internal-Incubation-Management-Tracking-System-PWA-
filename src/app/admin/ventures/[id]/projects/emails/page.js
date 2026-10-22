"use client";

import React from "react";
import { useParams } from "next/navigation";
import ProjectReminderEmailsView from "@/components/ventures/projects/ProjectReminderEmailsView";

/**
 * Super Admin → Ventures → [Venture] → Projects → Sent emails.
 *
 * The same reminder log the Lead Manager sees, reached from the Venture's
 * Project page. It reads the one Venture-scoped endpoint, so the two roles
 * cannot be shown different mail.
 */
export default function AdminVentureProjectEmailsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  return (
    <div className="space-y-5 pb-20">
      <ProjectReminderEmailsView
        ventureId={id}
        backHref={`/admin/ventures/${id}/projects`}
      />
    </div>
  );
}
