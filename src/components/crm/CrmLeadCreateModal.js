"use client";

import { useState } from "react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppSelect from "@/components/ui/AppSelect";
import AppTextarea from "@/components/ui/AppTextarea";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import CrmTargetPicker, { TARGET_FIELDS } from "./CrmTargetPicker";

const LEAD_TYPES = ["partnership", "investor", "program", "ecosystem", "client", "sponsor", "mentor", "other"];

const EMPTY_FORM = { title: "", lead_type: "partnership", source: "", description: "" };
const EMPTY_TARGET = { kind: "organization", id: "" };

/**
 * CrmLeadCreateModal — the "New Lead" form.
 *
 * A lead is always attached to a person or an organization (the API refuses it
 * otherwise), so the target picker is part of the form.
 */
export default function CrmLeadCreateModal({ isOpen, onClose, onCreated }) {
  const { t } = useI18n();
  const { alert } = useDialogs();
  const [form, setForm] = useState(EMPTY_FORM);
  const [target, setTarget] = useState(EMPTY_TARGET);
  const [saving, setSaving] = useState(false);

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      await alert({ message: t("crm.leads.titleRequired") });
      return;
    }
    if (!target.id) {
      await alert({ message: t("crm.leads.targetRequired") });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          lead_type: form.lead_type,
          source: form.source.trim() || null,
          description: form.description.trim() || null,
          [TARGET_FIELDS[target.kind]]: target.id,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setForm(EMPTY_FORM);
        setTarget(EMPTY_TARGET);
        onCreated?.(data.lead);
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={t("crm.leads.createLead")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <AppInput
          label={t("crm.leads.titleLabel")}
          value={form.title}
          onChange={setField("title")}
          placeholder={t("crm.leads.titlePlaceholder")}
          required
        />
        <CrmTargetPicker kinds={["organization", "contact"]} value={target} onChange={setTarget} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AppSelect
            label={t("crm.leads.typeLabel")}
            value={form.lead_type}
            onChange={setField("lead_type")}
            options={LEAD_TYPES.map((type) => ({ value: type, label: t(`crm.leads.types.${type}`) }))}
          />
          <AppInput
            label={t("crm.leads.sourceLabel")}
            value={form.source}
            onChange={setField("source")}
            placeholder={t("crm.leads.sourcePlaceholder")}
          />
        </div>
        <AppTextarea
          label={t("crm.leads.descriptionLabel")}
          value={form.description}
          onChange={setField("description")}
        />
        <div className="flex justify-end gap-3 pt-2">
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </AppButton>
          <AppButton type="submit" loading={saving}>
            {t("crm.leads.createLead")}
          </AppButton>
        </div>
      </form>
    </AppModal>
  );
}
