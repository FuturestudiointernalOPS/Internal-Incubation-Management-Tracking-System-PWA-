"use client";

import React from "react";
import Link from "next/link";
import { Clock, Shield, Upload, Users, UserPlus, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApiMulti } from "@/lib/hooks/useApi";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";
import LinkCard from "@/components/ui/LinkCard";

/**
 * CRM — the people half of the one dashboard.
 *
 * The legacy /admin/crm dashboard showed four figures and the newest people;
 * they now live here, in the workspace, so there is a single CRM home. The
 * figures follow `contacts.view` (the endpoint they read), while the three
 * administration doors follow the Super Admin shell they still live in.
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

const pickContacts = (payload) =>
  payload?.success ? payload.contacts || [] : [];

const pickPrograms = (payload) =>
  payload?.success ? Number(payload.stats?.programs ?? 0) : null;

function monthCount(contacts) {
  const now = new Date();
  return contacts.filter((contact) => {
    if (!contact.created_at) return false;
    const created = new Date(contact.created_at);
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth()
    );
  }).length;
}

export default function CrmOverview({ canSeePeople = false, isSuperAdmin = false }) {
  const { t } = useI18n();

  const { data, loading } = useApiMulti([
    {
      key: "contacts",
      url: canSeePeople ? "/api/contacts?status=active" : null,
      transform: pickContacts,
    },
    {
      key: "pending",
      url: canSeePeople ? "/api/contacts?status=pending" : null,
      transform: pickContacts,
    },
    {
      key: "programs",
      url: isSuperAdmin ? "/api/superadmin/full-state" : null,
      transform: pickPrograms,
    },
  ]);

  const contacts = data.contacts || [];
  const pending = data.pending || [];
  const programs = data.programs;

  if (!canSeePeople && !isSuperAdmin) return null;

  const recent = [...contacts]
    .sort(
      (first, second) =>
        new Date(second.created_at || 0) - new Date(first.created_at || 0),
    )
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {canSeePeople && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label={t("crm.overview.totalContacts")}
            value={contacts.length}
            icon={Users}
            loading={loading}
          />
          <KpiCard
            label={t("crm.overview.pendingApprovals")}
            value={pending.length}
            icon={UserPlus}
            loading={loading}
          />
          {isSuperAdmin && (
            <KpiCard
              label={t("crm.overview.activePrograms")}
              value={programs ?? 0}
              icon={Clock}
              loading={loading}
            />
          )}
          <KpiCard
            label={t("crm.overview.thisMonth")}
            value={monthCount(contacts)}
            icon={Clock}
            loading={loading}
          />
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-3">
          <SectionHead
            letter="A"
            icon={Shield}
            title={t("crm.overview.administration")}
          />
          <div className="stf-grid">
            <LinkCard
              href="/admin/pending-users"
              icon={UserPlus}
              title={t("crm.overview.pendingApprovals")}
              text={t("crm.overview.pendingApprovalsHint")}
            />
            <LinkCard
              href="/admin/bulk-upload"
              icon={Upload}
              title={t("crm.overview.bulkImport")}
              text={t("crm.overview.bulkImportHint")}
            />
            <LinkCard
              href="/admin/crm/duplicates"
              icon={AlertTriangle}
              title={t("crm.duplicates.title")}
              text={t("crm.duplicates.subtitle")}
            />
          </div>
        </div>
      )}

      {canSeePeople && (
        <div className="space-y-3">
          <SectionHead
            letter="B"
            icon={Clock}
            title={t("crm.overview.recentContacts")}
            action={
              <Link href="/crm/contacts" className="stf-link-btn">
                {t("crm.overview.allPeople")}
              </Link>
            }
          />
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
      )}
    </div>
  );
}
