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

const EMPTY_FORM = {
  name: "",
  pipeline_id: "",
  value: "",
  currency: "XOF",
  probability: "",
  expected_close_date: "",
  description: "",
};
const EMPTY_TARGET = { kind: "organization", id: "" };

/**
 * CrmOpportunityCreateModal — the "New Opportunity" form.
 *
 * The opportunity starts on the first stage of the chosen pipeline and must be
 * attached to a lead, a person or an organization (the API refuses it
 * otherwise).
 */
export default function CrmOpportunityCreateModal({ isOpen, onClose, onCreated, pipelines = [] }) {
  const { t } = useI18n();
  const { alert } = useDialogs();
  const [form, setForm] = useState(EMPTY_FORM);
  const [target, setTarget] = useState(EMPTY_TARGET);
  const [saving, setSaving] = useState(false);

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  function validationError() {
    if (!form.name.trim()) return "crm.opportunities.nameRequired";
    if (!form.pipeline_id) return "crm.opportunities.pipelineRequired";
    if (!target.id) return "crm.opportunities.targetRequired";
    const probability = Number(form.probability);
    if (form.probability !== "" && !(probability >= 0 && probability <= 100)) {
      return "crm.opportunities.probabilityRange";
    }
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const invalid = validationError();
    if (invalid) {
      await alert({ message: t(invalid) });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          pipeline_id: form.pipeline_id,
          value: form.value === "" ? null : Number(form.value),
          currency: form.currency.trim().toUpperCase() || null,
          probability: form.probability === "" ? null : Number(form.probability),
          expected_close_date: form.expected_close_date || null,
          description: form.description.trim() || null,
          [TARGET_FIELDS[target.kind]]: target.id,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setForm(EMPTY_FORM);
        setTarget(EMPTY_TARGET);
        onCreated?.(data.opportunity);
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
    <AppModal isOpen={isOpen} onClose={onClose} title={t("crm.opportunities.newOpportunity")} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AppInput
          label={t("crm.opportunities.nameLabel")}
          value={form.name}
          onChange={setField("name")}
          placeholder={t("crm.opportunities.namePlaceholder")}
          required
        />
        <AppSelect
          label={t("crm.opportunities.pipelineOnlyLabel")}
          value={form.pipeline_id}
          onChange={setField("pipeline_id")}
          placeholder={t("crm.opportunities.choosePipeline")}
          options={pipelines.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))}
        />
        <CrmTargetPicker kinds={["organization", "contact", "lead"]} value={target} onChange={setTarget} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <AppInput
              label={t("crm.opportunities.valueLabel")}
              type="number"
              min="0"
              step="any"
              value={form.value}
              onChange={setField("value")}
            />
          </div>
          <AppInput
            label={t("crm.opportunities.currencyLabel")}
            value={form.currency}
            onChange={setField("currency")}
            maxLength={3}
          />
          <AppInput
            label={t("crm.opportunities.probabilityLabel")}
            type="number"
            min="0"
            max="100"
            value={form.probability}
            onChange={setField("probability")}
            placeholder="%"
          />
        </div>
        <AppInput
          label={t("crm.opportunities.expectedCloseLabel")}
          type="date"
          value={form.expected_close_date}
          onChange={setField("expected_close_date")}
        />
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
            {t("crm.opportunities.newOpportunity")}
          </AppButton>
        </div>
      </form>
    </AppModal>
  );
}
