"use client";

import React, { useMemo } from "react";
import { Clock, FolderKanban, UserPlus, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import KpiCard from "@/components/ui/KpiCard";

/**
 * Contact figures shown at the top of the contacts screen.
 *
 * The totals are derived from the rows the screen already loaded, so no extra
 * request is made. The active-program figure is only offered when the caller
 * supplies the program list — the read-only directory does not read it.
 */
export default function ContactStats({ contacts = [], programs = null, loading = false }) {
  const { t } = useI18n();

  const stats = useMemo(() => {
    const now = new Date();
    let pending = 0;
    let thisMonth = 0;

    for (const contact of contacts) {
      if (contact.status === "pending") pending += 1;

      if (!contact.created_at) continue;
      const created = new Date(contact.created_at);
      if (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth()
      ) {
        thisMonth += 1;
      }
    }

    return { total: contacts.length, pending, thisMonth };
  }, [contacts]);

  return (
    <div className="stf-grid">
      <KpiCard
        label={t("crm.overview.totalContacts")}
        value={stats.total}
        icon={Users}
        loading={loading}
      />
      <KpiCard
        label={t("crm.overview.pendingApprovals")}
        value={stats.pending}
        icon={UserPlus}
        loading={loading}
      />
      {Array.isArray(programs) && (
        <KpiCard
          label={t("crm.overview.activePrograms")}
          value={programs.length}
          icon={FolderKanban}
          loading={loading}
        />
      )}
      <KpiCard
        label={t("crm.overview.thisMonth")}
        value={stats.thisMonth}
        icon={Clock}
        loading={loading}
      />
    </div>
  );
}
