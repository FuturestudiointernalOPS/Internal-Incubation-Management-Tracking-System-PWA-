"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, UserPlus, Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const ROLE_LABELS = {
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

export default function CrmDashboardPage() {
  const { t } = useI18n();
  const goBack = useSafeBack("/admin");
  const [stats, setStats] = useState(null);
  const [recentContacts, setRecentContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData(bypassCache = false) {
      const urls = [
        "/api/contacts?status=active",
        "/api/contacts?status=pending",
        // Active programme count — the same figure as the admin dashboard.
        "/api/superadmin/full-state",
      ];
      const apply = (contactsData, pendingData, stateData) => {
        if (!contactsData?.success || !pendingData?.success) return;
        const contacts = contactsData.contacts || [];
        const now = new Date();
        const addedThisMonth = contacts.filter((contact) => {
          if (!contact.created_at) return false;
          const created = new Date(contact.created_at);
          return (
            created.getFullYear() === now.getFullYear() &&
            created.getMonth() === now.getMonth()
          );
        }).length;
        setStats({
          totalContacts: contacts.length,
          pendingApprovals: pendingData.contacts?.length || 0,
          // null when the count is unavailable, so the card shows "—" only then
          activePrograms: stateData?.success
            ? Number(stateData.stats?.programs ?? 0)
            : null,
          addedThisMonth,
        });
        // The API returns contacts by name; "recent" means newest first.
        setRecentContacts(
          [...contacts]
            .sort(
              (first, second) =>
                new Date(second.created_at || 0) - new Date(first.created_at || 0),
            )
            .slice(0, 10),
        );
      };
      setLoading(true);
      try {
        // Cache-first paint: returning to the CRM overview renders instantly
        // from fresh snapshots of both queries.
        if (!bypassCache) {
          const cached = urls.map((url) => cacheGet(url));
          if (
            cached
              .slice(0, 2)
              .every((snapshot) => snapshot !== null && snapshot.success)
          ) {
            apply(cached[0], cached[1], cached[2]);
            setLoading(false);
          }
        }
        const responses = await Promise.all(
          urls.map((url) =>
            fetch(url)
              .then((response) => response.json())
              .catch(() => ({ success: false })),
          ),
        );
        urls.forEach((url, index) => {
          if (responses[index]?.success) cacheSet(url, responses[index]);
        });
        apply(responses[0], responses[1], responses[2]);
      } catch (error) {
        console.error("CRM dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <>
      <div className="space-y-6">
        {/* Back nav */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wide hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToPrevious")}
          </button>
        </nav>

        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {t("crm.overview.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("crm.overview.subtitle")}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, color: "text-[var(--brand-orange)]", value: stats?.totalContacts, label: t("crm.overview.totalContacts") },
            { icon: UserPlus, color: "text-amber-500", value: stats?.pendingApprovals, label: t("crm.overview.pendingApprovals") },
            { icon: Activity, color: "text-emerald-500", value: stats?.activePrograms, label: t("crm.overview.activePrograms") },
            { icon: Clock, color: "text-blue-500", value: stats?.addedThisMonth, label: t("crm.overview.thisMonth") },
          ].map(({ icon: Icon, color, value, label }) => (
            <div key={label} className="card !p-5">
              <Icon className={`w-5 h-5 ${color} mb-2`} />
              {loading && !stats ? (
                <div className="h-8 w-12 mb-1 rounded-lg bg-[var(--surface-3)] animate-pulse" />
              ) : (
                <p className="text-2xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">
                  {value ?? "—"}
                </p>
              )}
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("crm.overview.allPeople"), href: "/admin/communications/contacts" },
            { label: t("crm.overview.pendingApprovals"), href: "/admin/pending-users" },
            { label: t("crm.overview.bulkImport"), href: "/admin/bulk-upload" },
            { label: t("crm.overview.groups"), href: "/admin/crm" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="card !p-4 text-center text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--brand-orange)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Recent Contacts */}
        <div className="card !p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4">{t("crm.overview.recentContacts")}</h2>
          {loading && recentContacts.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">{t("crm.overview.loading")}</p>
          ) : recentContacts.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              {t("crm.overview.noContacts")}
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-secondary)]">
              {recentContacts.slice(0, 8).map((contact) => {
                const displayName = contact.name || contact.email || "?";
                return (
                  <Link
                    key={contact.cid}
                    href={`/admin/crm/timeline?cid=${contact.cid}`}
                    className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-tertiary transition-colors"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-brand-orange/10 text-[var(--brand-orange)] text-xs font-bold flex items-center justify-center uppercase">
                      {displayName.trim().charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
                      {contact.name && contact.email && (
                        <p className="text-xs text-[var(--text-secondary)] truncate">{contact.email}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-tertiary text-[var(--text-secondary)]">
                      {t(ROLE_LABELS[contact.role] || "") || contact.role || t("crm.roles.unassigned")}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[10px] font-medium text-[var(--text-secondary)] text-center">
          {t("crm.overview.foundationNote")}
        </p>
      </div>
    </>
  );
}
