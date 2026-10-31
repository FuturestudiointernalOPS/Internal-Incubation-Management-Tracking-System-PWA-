"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import SectionHead from "@/components/ui/SectionHead";

/**
 * The newest people, shown at the top of the contacts screen.
 *
 * Both contact screens (the Super Admin registry and the read-only directory)
 * load their own rows, so the caller passes them in. Sorting happens here
 * because the two sources do not guarantee the same order, and `created_at` is
 * absent on the first paint: those rows sort last instead of breaking.
 */

const PERSON_ROLE_KEYS = {
  member: "crm.roles.member",
  participant: "crm.roles.participant",
  staff: "crm.roles.staff",
  investor: "crm.roles.investor",
  finance: "crm.roles.finance",
  unassigned: "crm.roles.unassigned",
  team: "crm.roles.team",
  founder: "crm.roles.founder",
  pm: "crm.roles.pm",
};

export default function RecentContacts({ contacts = [], loading = false, limit = 8 }) {
  const { t } = useI18n();

  const recent = useMemo(
    () =>
      [...contacts]
        .sort(
          (first, second) =>
            new Date(second.created_at || 0) - new Date(first.created_at || 0),
        )
        .slice(0, limit),
    [contacts, limit],
  );

  return (
    <div className="space-y-3">
      <SectionHead icon={Clock} title={t("crm.overview.recentContacts")} />

      {loading && recent.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {t("crm.overview.loading")}
        </p>
      ) : recent.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {t("crm.overview.noContacts")}
        </p>
      ) : (
        <div className="stf-card !p-0 divide-y divide-[var(--border-secondary)]">
          {recent.map((contact) => {
            const displayName = contact.name || contact.email || "?";
            return (
              <Link
                key={contact.cid}
                href={`/crm/people/${contact.cid}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-3)] transition-colors"
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-brand-orange/10 text-[var(--brand-orange)] text-xs font-bold flex items-center justify-center uppercase">
                  {displayName.trim().charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {displayName}
                  </p>
                  {contact.name && contact.email && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {contact.email}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)]">
                  {t(PERSON_ROLE_KEYS[contact.role] || "") ||
                    contact.role ||
                    t("crm.roles.unassigned")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
