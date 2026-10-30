"use client";

import { useState } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import useOrganizationMutation from "@/lib/hooks/useOrganizationMutation";
import AppButton from "./AppButton";
import AppInput from "./AppInput";
import AppModal from "./AppModal";
import { resolveOrganizationPortalBranding } from "./organizationPortalBranding";

export default function OrganizationBrandingEditor({ organization, onClose, onSaved }) {
  const { t } = useI18n();
  const key = "common.organizationPortal.";
  const [values, setValues] = useState({
    displayName: organization.branding?.displayName === organization.name ? "" : organization.branding?.displayName || "",
    logoUrl: organization.branding?.logoUrl || "",
    primaryColor: organization.branding?.primaryColor || "",
  });
  const mutation = useOrganizationMutation(organization.id);
  const change = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const preview = resolveOrganizationPortalBranding({
    name: organization.name,
    branding: {
      displayName: values.displayName,
      logoUrl: values.logoUrl,
      primaryColor: values.primaryColor,
    },
  });
  const previewStyle = preview.primaryColor ? {
    "--brand-orange": preview.primaryColor,
    "--accent": preview.primaryColor,
    "--brand-gradient": preview.primaryColor,
  } : undefined;

  async function save(event) {
    event.preventDefault();
    const result = await mutation.mutate("/api/org/branding", "PATCH", {
      display_name: values.displayName.trim() || null,
      logo_url: values.logoUrl.trim() || null,
      primary_color: values.primaryColor.trim() || null,
    });
    if (result) onSaved();
  }

  return <AppModal isOpen onClose={mutation.busy ? undefined : onClose} title={t(key + "brandingTitle")}>
    <form onSubmit={save} className="space-y-4">
      <AppInput label={t(key + "displayName")} value={values.displayName} onChange={change("displayName")}
        maxLength={80} placeholder={organization.name} />
      <AppInput label={t(key + "logoUrl")} type="url" value={values.logoUrl} onChange={change("logoUrl")}
        maxLength={2048} placeholder="https://example.org/logo.png" />
      <AppInput label={t(key + "primaryColor")} value={values.primaryColor} onChange={change("primaryColor")}
        pattern="#[0-9A-Fa-f]{6}" maxLength={7} placeholder="#123456" />
      <p className="text-sm text-[var(--text-secondary)]">{t(key + "brandingContrastHint")}</p>
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border-primary)] bg-surface-2 p-3" style={previewStyle}>
        {preview.logoUrl
          ? <Image src={preview.logoUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded object-contain" />
          : <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded bg-[var(--brand-orange)] font-bold text-white">
            {preview.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
          </span>}
        <span className="font-bold text-[var(--text-primary)]">{preview.displayName}</span>
      </div>
      {mutation.error && <p role="alert" className="text-sm text-[var(--text-secondary)]">{t(mutation.error)}</p>}
      <div className="flex gap-3">
        <AppButton type="submit" loading={mutation.busy}>{t("common.save")}</AppButton>
        <AppButton variant="secondary" type="button" onClick={onClose} disabled={mutation.busy}>{t("common.cancel")}</AppButton>
      </div>
    </form>
  </AppModal>;
}
