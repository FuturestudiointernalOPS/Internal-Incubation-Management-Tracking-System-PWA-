"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQualification, setFilterQualification] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [owners, setOwners] = useState([]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus)        params.set("status", filterStatus);
      if (filterQualification) params.set("qualification", filterQualification);
      if (filterOwner)         params.set("owner_cid", filterOwner);

      const query = params.toString();
      const res  = await fetch(`/api/crm/leads${query ? `?${query}` : ""}`);
      const data = await res.json();
      if (data.success) setLeads(data.leads ?? []);
      else setError(t(data.error || "errors.somethingWrong"));
    } catch {
      setError(t("errors.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterQualification, filterOwner, t]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // The owner options come from the unfiltered set, so choosing a filter never
  // removes the other owners from the list.
  useEffect(() => {
    let alive = true;
    fetch("/api/crm/leads")
      .then((response) => response.json())
      .then((data) => {
        if (!alive || !data.success) return;
        const byOwner = new Map();
        for (const lead of data.leads ?? []) {
          if (lead.owner_cid) byOwner.set(lead.owner_cid, lead.owner_name || lead.owner_cid);
        }
        setOwners([...byOwner.entries()].map(([value, label]) => ({ value, label })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
          >
            <option value="">{t("crm.leads.allStatuses")}</option>
            {["new", "contacted", "engaged", "qualified", "unqualified", "nurturing", "converted", "lost"].map((status) => (
              <option key={status} value={status}>{t(`crm.leads.statuses.${status}`)}</option>
            ))}
          </select>

          <select
            value={filterQualification}
            onChange={(e) => setFilterQualification(e.target.value)}
            className="text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
          >
            <option value="">{t("crm.leads.allQualifications")}</option>
            {["not_assessed", "in_review", "needs_review", "qualified", "unqualified"].map((state) => (
              <option key={state} value={state}>{t(`crm.leads.qualifications.${state}`)}</option>
            ))}
          </select>

          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
          >
            <option value="">{t("crm.leads.allOwners")}</option>
            {owners.map((owner) => (
              <option key={owner.value} value={owner.value}>{owner.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <AppEmptyState
            icon={FileText}
            title={search || filterStatus || filterQualification || filterOwner ? t("common.noResults") : t("crm.leads.noLeads")}
            description={!search && !filterStatus && !filterQualification && !filterOwner ? t("crm.leads.noLeadsHint") : undefined}
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
