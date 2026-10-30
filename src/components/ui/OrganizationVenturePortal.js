"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppImage from "./AppImage";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppEmptyState from "./AppEmptyState";
import AppInput from "./AppInput";
import AppModal from "./AppModal";
import AppStatusBadge from "./AppStatusBadge";
import OrganizationPortalHeader from "./OrganizationPortalHeader";
import PageHero from "./PageHero";

export default function OrganizationVenturePortal({ organization, onBrandChanged }) {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedVenture, setSelectedVenture] = useState(null);
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
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const ventures = (data?.ventures || []).filter((venture) =>
    `${venture.company_name || ""} ${venture.code || ""} ${venture.industry || ""} ${venture.business_stage || ""}`
      .toLocaleLowerCase()
      .includes(normalizedSearch),
  );

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
    {valid && <section className="space-y-4">
        <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.venture.assigned")}</h2>
        <AppInput
          label={t("common.organizationPortal.venture.search")}
          placeholder={t("common.organizationPortal.venture.searchPlaceholder")}
          icon={Search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {ventures.length
        ? <div className="stf-grid">{ventures.map((venture) => <AppCard key={venture.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {safeHttpsUrl(venture.logo_url) && <AppImage
                src={safeHttpsUrl(venture.logo_url)}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                className="mb-3 h-12 w-12 rounded-lg object-contain"
              />}
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
          <AppButton className="mt-4" onClick={() => setSelectedVenture(venture)}>
            {t("common.organizationPortal.venture.details")}
          </AppButton>
        </AppCard>)}</div>
        : <AppEmptyState title={normalizedSearch ? t("common.noResults") : t("common.organizationPortal.venture.noAssigned")} />}
      </section>}
    {selectedVenture && <AppModal
      isOpen
      onClose={() => setSelectedVenture(null)}
      title={selectedVenture.company_name || t("common.noData")}
      size="lg"
    >
      <div className="space-y-4">
        {safeHttpsUrl(selectedVenture.logo_url) && <AppImage
          src={safeHttpsUrl(selectedVenture.logo_url)}
          alt=""
          referrerPolicy="no-referrer"
          className="h-16 w-16 rounded-lg object-contain"
        />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">{selectedVenture.code}</p>
          <AppStatusBadge status={selectedVenture.status} label={t(`status.${selectedVenture.status}`)} />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {t(`common.organizationPortal.venture.assignment.${selectedVenture.assignment_type}`)}
        </p>
        {selectedVenture.description && <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{selectedVenture.description}</p>}
        <dl className="grid gap-3 sm:grid-cols-2">
          <VentureDetail label={t("common.organizationPortal.venture.industry")} value={selectedVenture.industry} />
          <VentureDetail label={t("common.organizationPortal.venture.stage")} value={selectedVenture.business_stage} />
        </dl>
        {safeHttpsUrl(selectedVenture.website) && <a
          className="inline-flex text-sm font-bold text-[var(--brand-orange)] underline"
          href={safeHttpsUrl(selectedVenture.website)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("common.organizationPortal.venture.website")}
        </a>}
      </div>
    </AppModal>}
  </div>;
}

function VentureDetail({ label, value }) {
  if (!value) return null;
  return <div>
    <dt className="text-xs font-bold text-[var(--text-secondary)]">{label}</dt>
    <dd className="mt-1 text-sm text-[var(--text-primary)]">{value}</dd>
  </div>;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
