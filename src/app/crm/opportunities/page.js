"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Target, Plus, Search, TrendingUp } from "lucide-react";
import AppTable from "@/components/ui/AppTable";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-4">
      <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{value}</p>
      {sub && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CrmOpportunitiesPage() {
  const { t } = useI18n();
  const [opps, setOpps]         = useState([]);
  const [metrics, setMetrics]   = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [filterPipeline, setFilterPipeline] = useState("");
  const [filterStatus, setFilterStatus]     = useState("");

  async function fetchAll() {
    try {
      const params = new URLSearchParams();
      if (filterPipeline) params.set("pipeline_id", filterPipeline);
      if (filterStatus)   params.set("status", filterStatus);

      const [oppsRes, plRes] = await Promise.all([
        fetch(`/api/crm/opportunities?${params}`),
        fetch("/api/crm/pipelines"),
      ]);
      const [oppsData, plData] = await Promise.all([oppsRes.json(), plRes.json()]);

      if (oppsData.success) {
        setOpps(oppsData.opportunities ?? []);
        setMetrics(oppsData.metrics ?? null);
      } else {
        setError(t(oppsData.error || "errors.somethingWrong"));
      }
      if (plData.success) setPipelines(plData.pipelines ?? []);
    } catch {
      setError(t("errors.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [filterPipeline, filterStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return opps;
    return opps.filter(
      (o) =>
        o.name?.toLowerCase().includes(q) ||
        o.contact_name?.toLowerCase().includes(q) ||
        o.organization_name?.toLowerCase().includes(q) ||
        o.pipeline_name?.toLowerCase().includes(q),
    );
  }, [opps, search]);

  const STATUSES = ["active", "won", "lost", "on_hold"];

  const columns = [
    {
      key: "name",
      header: t("crm.opportunities.nameLabel"),
      render: (row) => (
        <div>
          <a href={`/crm/opportunities/${row.id}`} className="font-semibold text-[var(--brand-orange)] hover:underline">
            {row.name}
          </a>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {row.contact_name || row.organization_name || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "pipeline_name",
      header: t("crm.opportunities.pipelineLabel"),
      render: (row) => (
        <div>
          <div className="text-sm text-[var(--text-primary)]">{row.pipeline_name}</div>
          <div className="text-xs text-[var(--text-secondary)]">{row.stage_name}</div>
        </div>
      ),
    },
    {
      key: "value",
      header: t("crm.opportunities.valueLabel"),
      render: (row) =>
        row.value != null
          ? `${Number(row.value).toLocaleString()} ${row.currency || ""}`.trim()
          : "—",
    },
    {
      key: "probability",
      header: t("crm.opportunities.probabilityLabel"),
      render: (row) => (row.probability != null ? `${row.probability}%` : "—"),
    },
    {
      key: "status",
      header: t("crm.opportunities.statusLabel"),
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface-3)] text-[var(--text-primary)]">
          {t(`crm.opportunities.statuses.${row.status}`) || row.status}
        </span>
      ),
    },
    {
      key: "owner_name",
      header: t("crm.leads.ownerLabel"),
      render: (row) => row.owner_name || "—",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-[var(--brand-orange)]" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("crm.opportunities.title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {t("crm.opportunities.subtitle")}
            </p>
          </div>
        </div>
        <AppButton onClick={() => window.location.href = "/crm/opportunities/new"} className="shrink-0">
          <Plus className="w-4 h-4" />
          {t("crm.opportunities.newOpportunity")}
        </AppButton>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label={t("crm.opportunities.metrics.active")} value={metrics.active_count} />
          <MetricCard label={t("crm.opportunities.metrics.won")} value={metrics.won_count} />
          <MetricCard label={t("crm.opportunities.metrics.lost")} value={metrics.lost_count} />
          <MetricCard
            label={t("crm.opportunities.metrics.weighted")}
            value={Number(metrics.weighted_value || 0).toLocaleString()}
            sub={t("crm.opportunities.metrics.weightedHint")}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40 w-64"
          />
        </div>
        <select
          value={filterPipeline}
          onChange={(e) => setFilterPipeline(e.target.value)}
          className="text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
        >
          <option value="">{t("crm.opportunities.allPipelines")}</option>
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
        >
          <option value="">{t("crm.opportunities.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`crm.opportunities.statuses.${s}`)}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <AppEmptyState
          icon={Target}
          title={search || filterPipeline || filterStatus ? t("common.noResults") : t("crm.opportunities.noOpportunities")}
          description={!search && !filterPipeline && !filterStatus ? t("crm.opportunities.noOpportunitiesHint") : undefined}
        />
      ) : (
        <AppTable columns={columns} rows={filtered} rowKey="id" />
      )}
    </div>
  );
}
