"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppEmptyState from "./AppEmptyState";
import AppStatusBadge from "./AppStatusBadge";
import OrganizationPortalHeader from "./OrganizationPortalHeader";
import PageHero from "./PageHero";

export default function OrganizationVenturePortal({ organization, onBrandChanged }) {
  const { t } = useI18n();
  const router = useRouter();
  const read = {
    cache: false,
    fetchOptions: {
      cache: "no-store",
      headers: { "X-Organization-Id": organization.id },
    },
  };
  const result = useApi("/api/org/ventures", read);
  const data = result.data;
  const valid = data?.success && data.organizationId === organization.id;

  return <div className="space-y-6">
    <OrganizationPortalHeader organization={organization} activePage="venture" onBrandChanged={onBrandChanged} />
    <PageHero
      title={t("common.organizationPortal.venture.title")}
      subtitle={t("common.organizationPortal.venture.readOnly")}
    />
    {result.loading && <AppEmptyState title={t("common.loading")} />}
    {!result.loading && result.error && <AppEmptyState
      title={t("errors.somethingWrong")}
      action={<AppButton onClick={result.refresh}>{t("common.retry")}</AppButton>}
    />}
    {!result.loading && !result.error && !valid && <AppEmptyState
      title={t(data?.error || "errors.insufficientPermissions")}
      action={<AppButton onClick={() => router.push("/o/select")}>{t("common.organizationPortal.choose")}</AppButton>}
    />}
    {valid && (data.ventures.length
      ? <section className="space-y-4">
        <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.venture.assigned")}</h2>
        <div className="stf-grid">{data.ventures.map((venture) => <AppCard key={venture.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-[var(--text-primary)]">{venture.company_name || t("common.noData")}</h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{venture.code}</p>
            </div>
            <AppStatusBadge status={venture.status} label={t(`status.${venture.status}`)} />
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {t(`common.organizationPortal.venture.assignment.${venture.assignment_type}`)}
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {venture.industry || venture.business_stage || t("common.noData")}
          </p>
        </AppCard>)}</div>
      </section>
      : <AppEmptyState title={t("common.organizationPortal.venture.noAssigned")} />)}
  </div>;
}
