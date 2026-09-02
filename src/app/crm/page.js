"use client";

import React, { useEffect, useState } from "react";
import { Users, FileText, MessageSquare, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — non-admin entry point for users holding the CRM
 * responsibility. Full CRM administration (people, timeline, duplicates,
 * pending approvals, bulk import) stays in /admin for Super Admin.
 */
export default function CrmWorkspace() {
  const { t } = useI18n();
  const [messagesHref, setMessagesHref] = useState("/staff/messages");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) {
          const role = d.user.role;
          const href =
            role === "program_manager"
              ? "/pm/messages"
              : role === "teacher"
                ? "/teacher/messages"
                : role === "super_admin" || role === "developer"
                  ? "/admin/internal-comms"
                  : "/staff/messages";
          setMessagesHref(href);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-8 pb-20">
        <header className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-6">
          <Users className="w-6 h-6 text-[var(--brand-orange)]" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("crm.hub.title")}
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("crm.hub.subtitle")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/platform"
            className="ios-card !p-6 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/40 transition-all"
          >
            <FileText className="w-5 h-5 text-[var(--brand-orange)]" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
              {t("crm.hub.formsTitle")}
            </p>
            <p className="mt-1 text-[8px] font-bold text-[var(--text-secondary)]">
              {t("crm.hub.formsSubtitle")}
            </p>
          </a>

          <a
            href={messagesHref}
            className="ios-card !p-6 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/40 transition-all"
          >
            <MessageSquare className="w-5 h-5 text-[var(--brand-orange)]" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
              {t("crm.hub.messagesTitle")}
            </p>
            <p className="mt-1 text-[8px] font-bold text-[var(--text-secondary)]">
              {t("crm.hub.messagesSubtitle")}
            </p>
          </a>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[9px] font-bold text-amber-400">
            {t("crm.hub.adminOnlyNote")}
          </p>
        </div>
      </div>
    </>
  );
}
