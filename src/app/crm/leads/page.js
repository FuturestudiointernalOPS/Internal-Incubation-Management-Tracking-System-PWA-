"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Target, Plus, Search, FileText } from "lucide-react";
import AppTable from "@/components/ui/AppTable";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";
import CrmLeadCreateModal from "@/components/crm/CrmLeadCreateModal";
import CrmNextActionCell from "@/components/crm/CrmNextActionCell";
import { useCrmCapabilities } from "@/components/crm/useCrmCapabilities";

export const dynamic = "force-dynamic";

export default function CrmLeadsPage() {
  const { t } = useI18n();
  const { can } = useCrmCapabilities();

  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);

  async function fetchLeads() {
    try {
      const res  = await fetch("/api/crm/leads");
      const data = await res.json();
      if (data.success) setLeads(data.leads ?? []);
      else setError(t(data.error || "errors.somethingWrong"));
    } catch {
      setError(t("errors.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeads(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.title?.toLowerCase().includes(q) ||
        l.contact_name?.toLowerCase().includes(q) ||
        l.organization_name?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const columns = [
    {
      key: "title",
      label: t("crm.leads.titleLabel"),
      render: (_value, row) => (
        <div>
          <a href={`/crm/leads/${row.id}`} className="font-semibold text-[var(--brand-orange)] hover:underline">
            {row.title}
          </a>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {row.contact_name || row.organization_name || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: t("crm.leads.statusLabel"),
      render: (_value, row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface-3)] text-[var(--text-primary)]">
          {t(`crm.leads.statuses.${row.status}`)}
        </span>
      ),
    },
    {
      key: "next_action_due",
      label: t("crm.activities.nextAction"),
      render: (_value, row) => <CrmNextActionCell record={row} />,
    },
    {
      key: "qualification_state",
      label: t("crm.leads.qualificationLabel"),
      render: (_value, row) => t(`crm.leads.qualifications.${row.qualification_state}`),
    },
    {
      key: "owner_name",
      label: t("crm.leads.ownerLabel"),
      render: (_value, row) => row.owner_name || "—",
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-[var(--brand-orange)]" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
                {t("crm.leads.title")}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {t("crm.leads.subtitle")}
              </p>
            </div>
          </div>
          {can("create") && (
            <AppButton icon={Plus} onClick={() => setShowModal(true)} className="shrink-0">
              {t("crm.leads.createLead")}
            </AppButton>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <AppEmptyState
            icon={FileText}
            title={search ? t("common.noResults") : t("crm.leads.noLeads")}
            description={!search ? t("crm.leads.noLeadsHint") : undefined}
          />
        ) : (
          <AppTable columns={columns} data={filtered} />
        )}
      </div>

      <CrmLeadCreateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreated={async () => {
          setShowModal(false);
          await fetchLeads();
        }}
      />
    </>
  );
}
