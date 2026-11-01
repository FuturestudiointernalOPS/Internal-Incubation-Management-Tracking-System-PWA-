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
      render: (v) => (
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0 font-black text-sm"
            style={{
              background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
              color: "var(--brand-orange)",
            }}
          >
            {(v.company_name || v.name || "V").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-[13px]" style={{ color: "var(--text-primary)" }}>
              {v.company_name || v.name || "Untitled Venture"}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-secondary)" }}>
              {v.industry || "General / Tech"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "program",
      title: "Cohort / Program",
      render: (v) => (
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {v.program_name || v.cohort_name || "Direct Incubator"}
        </span>
      ),
    },
    {
      key: "stage",
      title: "Stage",
      render: (v) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          {v.business_stage || "Idea"}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (v) => (
        <AppStatusBadge status={v.status || "active"} />
      ),
    },
    {
      key: "actions",
      title: "",
      className: "text-right",
      render: (v) => {
        const ventureId = v.venture_id || v.id;
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
