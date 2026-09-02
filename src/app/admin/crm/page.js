"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, UserPlus, Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const ROLE_LABELS = {
  participant: "crm.roles.participant",
  staff: "crm.roles.staff",
  teacher: "crm.roles.teacher",
  investor: "crm.roles.investor",
  finance: "crm.roles.finance",
  developer: "crm.roles.developer",
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
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData(bypassCache = false) {
      const urls = [
        "/api/contacts?status=active",
        "/api/contacts?status=pending",
      ];
      const apply = (contactsData, pendingData) => {
        if (!contactsData?.success || !pendingData?.success) return;
        setStats({
          totalContacts: contactsData.contacts?.length || 0,
          pendingApprovals: pendingData.contacts?.length || 0,
        });
        setRecentContacts((contactsData.contacts || []).slice(0, 10));
      };
      setLoading(true);
      try {
        // Cache-first paint: returning to the CRM overview renders instantly
        // from fresh snapshots of both queries.
        if (!bypassCache) {
          const cached = urls.map((u) => cacheGet(u));
          if (cached.every((c) => c !== null && c.success)) {
            apply(cached[0], cached[1]);
            setLoading(false);
          }
        }
        const responses = await Promise.all(
          urls.map((u) =>
            fetch(u)
              .then((r) => r.json())
              .catch(() => ({ success: false })),
          ),
        );
        urls.forEach((u, i) => {
          if (responses[i]?.success) cacheSet(u, responses[i]);
        });
        apply(responses[0], responses[1]);
      } catch (e) {
        console.error("CRM dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Back nav */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToPrevious")}
          </button>
        </nav>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            {t("crm.overview.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("crm.overview.subtitle")}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <Users className="w-5 h-5 text-[var(--brand-orange)] mb-2" />
            <p className="text-2xl font-black">{loading ? "—" : stats?.totalContacts || 0}</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t("crm.overview.totalContacts")}</p>
          </div>
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <UserPlus className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-2xl font-black">{loading ? "—" : stats?.pendingApprovals || 0}</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t("crm.overview.pendingApprovals")}</p>
          </div>
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <Activity className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-2xl font-black">—</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t("crm.overview.activePrograms")}</p>
          </div>
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <Clock className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-black">—</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t("crm.overview.thisMonth")}</p>
          </div>
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
              className="bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-center text-xs font-bold uppercase tracking-wider hover:border-[var(--brand-orange)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Recent Contacts */}
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
          <h2 className="text-sm font-black uppercase tracking-wider mb-4">{t("crm.overview.recentContacts")}</h2>
          {loading ? (
            <p className="text-xs text-[var(--text-secondary)]">{t("crm.overview.loading")}</p>
          ) : recentContacts.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] italic">
              {t("crm.overview.noContacts")}
            </p>
          ) : (
            <div className="space-y-2">
              {recentContacts.slice(0, 8).map((c) => (
                <Link
                  key={c.cid}
                  href={`/admin/crm/timeline?cid=${c.cid}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-tertiary transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold">{c.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{c.email}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-tertiary">
                    {t(ROLE_LABELS[c.role] || "") || c.role || t("crm.roles.unassigned")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-[var(--text-secondary)] text-center italic">
          {t("crm.overview.foundationNote")}
        </p>
      </div>
    </>
  );
}
