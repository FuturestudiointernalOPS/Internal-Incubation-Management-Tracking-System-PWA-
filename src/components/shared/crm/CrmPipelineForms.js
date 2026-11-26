"use client";

import { useState } from "react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppSelect from "@/components/ui/AppSelect";
import AppTextarea from "@/components/ui/AppTextarea";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";

/** Send a pipeline form and report the outcome through the in-app dialog. */
function useSubmit(onSaved) {
  const { t } = useI18n();
  const { alert } = useDialogs();
  const [saving, setSaving] = useState(false);

  async function submit(url, method, body) {
    setSaving(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) await onSaved?.(data);
      else await alert({ message: t(data.error || "errors.somethingWrong") });
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSaving(false);
    }
  }

  return { saving, submit, alert, t };
}

function FormActions({ saving, onClose, t }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <AppButton variant="secondary" onClick={onClose} disabled={saving}>
        {t("common.cancel")}
      </AppButton>
      <AppButton type="submit" loading={saving}>
        {t("common.save")}
      </AppButton>
    </div>
  );
}

/**
 * Create a pipeline, or rename / describe an existing one (`pipeline` given).
 * Mounted only while open, so the form always starts from the current values.
 */
export function CrmPipelineFormModal({ pipeline, onClose, onSaved }) {
  const { saving, submit, alert, t } = useSubmit(onSaved);
  const [form, setForm] = useState({
    name: pipeline?.name ?? "",
    description: pipeline?.description ?? "",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      await alert({ message: t("crm.pipelines.nameRequired") });
      return;
    }
    const body = { name: form.name.trim(), description: form.description.trim() || null };
    if (pipeline) await submit(`/api/crm/pipelines/${pipeline.id}`, "PATCH", body);
    else await submit("/api/crm/pipelines", "POST", body);
  }

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={pipeline ? t("crm.pipelines.editPipeline") : t("crm.pipelines.newPipeline")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AppInput
          label={t("crm.pipelines.nameLabel")}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <AppTextarea
          label={t("crm.pipelines.descriptionLabel")}
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          rows={2}
        />
        <FormActions saving={saving} onClose={onClose} t={t} />
      </form>
    </AppModal>
  );
}

const STAGE_KINDS = ["open", "won", "lost"];

/**
 * Add a stage at the end of a pipeline, or edit an existing one (`stage` given).
 * The page moves it afterwards. The kind (open / won / lost) is chosen at
 * creation only: it decides how the deals that reach the stage are counted.
 */
export function CrmStageFormModal({ pipelineId, stage, nextPosition, onClose, onSaved }) {
  const { saving, submit, alert, t } = useSubmit(onSaved);
  const [form, setForm] = useState({
    name: stage?.name ?? "",
    probability: String(stage?.probability ?? 0),
    targetDays: String(stage?.target_days ?? 7),
    kind: "open",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    const probability = Number(form.probability);
    const targetDays = Number(form.targetDays);
    if (!form.name.trim()) {
      await alert({ message: t("crm.pipelines.stageNameRequired") });
      return;
    }
    if (!(probability >= 0 && probability <= 100)) {
      await alert({ message: t("crm.opportunities.probabilityRange") });
      return;
    }
    if (!Number.isInteger(targetDays) || targetDays < 0 || targetDays > 365) {
      await alert({ message: t("crm.pipelines.stageTargetRange") });
      return;
    }
    if (stage) {
      await submit(`/api/crm/pipelines/${pipelineId}/stages/${stage.id}`, "PATCH", {
        name: form.name.trim(),
        probability,
        target_days: targetDays,
      });
      return;
    }
    await submit(`/api/crm/pipelines/${pipelineId}/stages`, "POST", {
      name: form.name.trim(),
      probability,
      target_days: targetDays,
      position: nextPosition,
      is_terminal: form.kind !== "open",
      outcome: form.kind === "open" ? null : form.kind,
    });
  }

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={stage ? t("crm.pipelines.editStage") : t("crm.pipelines.addStage")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AppInput
          label={t("crm.pipelines.stageNameLabel")}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AppInput
            label={t("crm.pipelines.stageProbabilityLabel")}
            type="number"
            min="0"
            max="100"
            value={form.probability}
            onChange={(event) => setForm((current) => ({ ...current, probability: event.target.value }))}
          />
          <AppInput
            label={t("crm.pipelines.stageTargetLabel")}
            type="number"
            min="0"
            max="365"
            value={form.targetDays}
            onChange={(event) => setForm((current) => ({ ...current, targetDays: event.target.value }))}
          />
          {!stage && (
            <AppSelect
              label={t("crm.pipelines.stageKindLabel")}
              value={form.kind}
              onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}
              options={STAGE_KINDS.map((kind) => ({ value: kind, label: t(`crm.pipelines.stageKinds.${kind}`) }))}
            />
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{t("crm.pipelines.stageTargetHint")}</p>
        {!stage && (
          <p className="text-xs text-[var(--text-secondary)]">{t("crm.pipelines.stageAppendHint")}</p>
        )}
        <FormActions saving={saving} onClose={onClose} t={t} />
      </form>
    </AppModal>
  );
}
