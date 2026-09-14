"use client";

import React, { useEffect, useState } from "react";
import { Users, FileText, MessageSquare, ShieldAlert, Clock, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — non-admin entry point for users holding the CRM
 * responsibility. Full CRM administration (duplicates, pending approvals, bulk
 * import) stays in /admin for Super Admin.
 *
 * The cards are capability-gated, exactly like the sidebar: People and Timeline
 * need `contacts.view`, Membership needs `org_membership.view`. Nothing here is
 * a permission — the APIs authorize every request again — it only keeps the hub
 * free of doors the user cannot open.
 */
export default function CrmWorkspace() {
  const { t } = useI18n();
  const [messagesHref, setMessagesHref] = useState("/staff/messages");
  const [effective, setEffective] = useState(null);

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

  useEffect(() => {
    let alive = true;
    fetch("/api/me/permissions")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.success) setEffective(d.effective || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const has = (module, capability) =>
    Number(effective?.[module]?.[capability] ?? 0) >= 1;

  const cards = [
    {
      key: "forms",
      href: "/platform",
      icon: FileText,
      title: t("crm.hub.formsTitle"),
      subtitle: t("crm.hub.formsSubtitle"),
    },
    {
      key: "messages",
      href: messagesHref,
      icon: MessageSquare,
      title: t("crm.hub.messagesTitle"),
      subtitle: t("crm.hub.messagesSubtitle"),
    },
  ];

  if (has("contacts", "view")) {
    cards.push(
      {
        key: "people",
        href: "/crm/contacts",
        icon: Users,
        title: t("crm.overview.allPeople"),
        subtitle: t("crm.directory.subtitle"),
      },
      {
        key: "timeline",
        href: "/crm/timeline",
        icon: Clock,
        title: t("crm.timeline.timelineTitle"),
        subtitle: t("crm.hub.timelineSubtitle"),
      },
    );
  }

  if (has("org_membership", "view")) {
    cards.push({
      key: "membership",
      href: "/crm/membership",
      icon: Shield,
      title: t("membership.page.title"),
      subtitle: t("membership.page.subtitle"),
    });
  }

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-8 pb-20">
        <header className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-6">
          <Users className="w-6 h-6 text-[var(--brand-orange)]" />
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("crm.hub.title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {t("crm.hub.subtitle")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <a
                key={card.key}
                href={card.href}
                className="ios-card !p-6 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/40 transition-all"
              >
                <Icon className="w-5 h-5 text-[var(--brand-orange)]" />
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                  {card.title}
                </p>
                <p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  {card.subtitle}
                </p>
              </a>
            );
          })}
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-400">
            {t("crm.hub.adminOnlyNote")}
          </p>
        </div>
      </div>
    </>
  );
}
