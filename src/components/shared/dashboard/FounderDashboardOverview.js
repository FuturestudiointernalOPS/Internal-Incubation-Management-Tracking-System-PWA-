"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowRight,
  Building2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import AppTable from "@/components/ui/AppTable";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import PageHero from "@/components/ui/PageHero";
import KpiCard from "@/components/ui/KpiCard";
import CreateActions from "@/components/shared/create/CreateActions";

/**
 * FounderDashboardOverview
 *
 * Dedicated executive cockpit for startup founders.
 * Displays their active ventures in a rich, dense tabular view,
 * quick action metrics, and instant links into each venture's workspace.
 */
export default function FounderDashboardOverview({
  ventures = [],
  loading = false,
  userName = "Founder",
}) {
  const router = useRouter();

  // Metrics roll-up
  const totalVentures = ventures.length;
  const activeVentures = ventures.filter((v) => (v.status || "active") === "active").length;
  const primaryVenture = ventures[0] || null;

  const columns = [
    {
      key: "company",
      title: "Company",
      render: (_cell, row) => (
        <div className="flex items-center gap-3">
          {row.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={row.logo_url}
              alt={row.company_name || row.name || ""}
              className="w-9 h-9 rounded-xl object-contain bg-[var(--surface-1)] border border-[var(--border-primary)] p-0.5 shrink-0"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0 font-black text-sm"
              style={{
                background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                color: "var(--brand-orange)",
              }}
            >
              {(row.company_name || row.name || "V").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-[13px]" style={{ color: "var(--text-primary)" }}>
              {row.company_name || row.name || "Untitled Venture"}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-secondary)" }}>
              {row.industry || "General / Tech"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "program",
      title: "Cohort / Program",
      render: (_cell, row) => (
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {row.program_name || row.cohort_name || "Direct Incubator"}
        </span>
      ),
    },
    {
      key: "stage",
      title: "Stage",
      render: (_cell, row) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          {row.business_stage || "Idea"}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (_cell, row) => (
        <AppStatusBadge status={row.status || "active"} />
      ),
    },
    {
      key: "actions",
      title: "",
      className: "text-right",
      render: (_cell, row) => {
        const ventureId = row.venture_id || row.id;
        return (
          <div className="flex justify-end">
            <AppButton
              size="sm"
              variant="ghost"
              icon={ArrowRight}
              className="text-xs font-bold"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/member/participant/ventures/${ventureId}`);
              }}
            >
              Open Workspace
            </AppButton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Hero ── */}
      <PageHero
        kicker="FOUNDER SUITE"
        title={`Welcome back, ${userName}`}
        subtitle="Manage your companies, track execution milestones, and collaborate with your assigned studio handler."
        action={
          <div className="flex items-center gap-2">
            <CreateActions only={["venture"]} tone="primary" />
          </div>
        }
      />

      {/* ── High-Level Startup Pulse KPIs ── */}
      <div className="stf-grid c4">
        <KpiCard
          label="Total Ventures"
          value={totalVentures}
          icon={Building2}
          loading={loading}
        />
        <KpiCard
          label="Active Ventures"
          value={activeVentures}
          icon={Rocket}
          loading={loading}
        />
        <KpiCard
          label="Stage Progress"
          value={primaryVenture?.business_stage ? primaryVenture.business_stage.toUpperCase() : "IDEA"}
          icon={Layers}
          loading={loading}
        />
        <KpiCard
          label="Next Sprint Cycle"
          value="Weekly"
          icon={Calendar}
          loading={loading}
        />
      </div>

      {/* ── My Ventures Table ── */}
      <AppCard padding="none">
        <div className="p-5 flex items-center justify-between border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-lg"
              style={{
                background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                color: "var(--brand-orange)",
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                My Ventures
              </h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Active startup workspaces you own or contribute to
              </p>
            </div>
          </div>

          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-3" style={{ color: "var(--text-secondary)" }}>
            {ventures.length} {ventures.length === 1 ? "Company" : "Companies"}
          </span>
        </div>

        <AppTable
          columns={columns}
          data={ventures}
          loading={loading}
          emptyMessage="No ventures linked to your account. Click '+ Add Venture' to provision one."
          onRowClick={(row) => router.push(`/member/participant/ventures/${row.venture_id || row.id}`)}
        />
      </AppCard>
    </div>
  );
}
