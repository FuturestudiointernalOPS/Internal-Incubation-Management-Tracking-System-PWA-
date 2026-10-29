"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AppButton from "./AppButton";
import OrganizationBrandingEditor from "./OrganizationBrandingEditor";
import { resolveOrganizationPortalBranding } from "./organizationPortalBranding";

export default function OrganizationPortalHeader({ organization, activePage, onBrandChanged }) {
  const { t } = useI18n();
  const router = useRouter();
  const [editingBranding, setEditingBranding] = useState(false);
  const branding = resolveOrganizationPortalBranding(organization);
  const initials = branding.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const brandStyle = branding.primaryColor ? {
    "--brand-orange": branding.primaryColor,
    "--accent": branding.primaryColor,
    "--brand-gradient": branding.primaryColor,
  } : undefined;
  const base = `/o/${encodeURIComponent(organization.code)}`;

  return <>
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4" style={brandStyle}>
      <div className="flex min-w-0 items-center gap-3">
        {branding.logoUrl
          ? <Image src={branding.logoUrl} alt={branding.displayName} width={44} height={44} unoptimized className="h-11 w-11 rounded-lg object-contain" />
          : <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-orange)] text-sm font-black text-white">{initials}</span>}
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[var(--text-primary)]">{branding.displayName}</p>
          <p className="text-xs text-[var(--text-secondary)]">{t("common.organizationPortal.clientSpace")}</p>
        </div>
      </div>
      <nav aria-label={t("common.organizationPortal.navigation")} className="flex flex-wrap items-center gap-2">
        <AppButton variant={activePage === "home" ? "primary" : "secondary"} onClick={() => router.push(base)}>
          {t("common.organizationPortal.home")}
        </AppButton>
        {organization.modules?.includes("programs") && <AppButton variant={activePage === "programs" ? "primary" : "secondary"} onClick={() => router.push(`${base}/programs`)}>
          {t("common.organizationPortal.programmes")}
        </AppButton>}
        {organization.modules?.includes("lms") && <AppButton variant={activePage === "lms" ? "primary" : "secondary"} onClick={() => router.push(`${base}/lms`)}>
          {t("common.organizationPortal.module.lms")}
        </AppButton>}
        {organization.modules?.includes("venture") && <AppButton variant={activePage === "venture" ? "primary" : "secondary"} onClick={() => router.push(`${base}/venture`)}>
          {t("common.organizationPortal.module.venture")}
        </AppButton>}
        {organization.brandingEditable && <AppButton variant="secondary" onClick={() => setEditingBranding(true)}>
          {t("common.organizationPortal.brandingSettings")}
        </AppButton>}
        <AppButton variant="secondary" onClick={() => router.push("/o/select")}>
          {t("common.organizationPortal.change")}
        </AppButton>
      </nav>
    </header>
    {editingBranding && <OrganizationBrandingEditor organization={organization} onClose={() => setEditingBranding(false)}
      onSaved={() => { setEditingBranding(false); onBrandChanged(); }} />}
  </>;
}
