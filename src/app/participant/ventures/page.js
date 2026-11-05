"use client";

import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { ArrowRight } from "lucide-react";
import CreateActions from "@/components/create/CreateActions";
import AppTable from "@/components/ui/AppTable";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import PageHero from "@/components/ui/PageHero";

const EMPTY_LIST = [];
const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);

export default function ParticipantVentures() {
  const { t } = useI18n();
  const router = useRouter();
  const { cid } = useSessionUser();

  const { data: ventures, loading: readLoading } = useApi(
    cid ? `/api/ventures?contact_id=${cid}` : null,
    { defaultValue: EMPTY_LIST, transform: pickVentures, deps: [cid] },
  );
  const loading = !cid || readLoading;

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
                router.push(`/founder/ventures/${ventureId}`);
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
    <div className="p-6 space-y-6">
      <PageHero
        kicker="VENTURE PORTFOLIO"
        title={t("venture.myVentures")}
        subtitle="All startups and ventures you actively own or collaborate on across Future Studio."
        action={<CreateActions only={["venture"]} tone="primary" />}
      />

      <AppCard padding="none">
        <AppTable
          columns={columns}
          data={ventures}
          loading={loading}
          emptyMessage={t("venture.noVentures")}
          onRowClick={(row) => router.push(`/founder/ventures/${row.venture_id || row.id}`)}
        />
      </AppCard>
    </div>
  );
}
