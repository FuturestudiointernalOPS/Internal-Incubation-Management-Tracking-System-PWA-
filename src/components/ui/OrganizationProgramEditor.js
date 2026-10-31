"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import useOrganizationMutation from "@/lib/hooks/useOrganizationMutation";
import { useDialogs } from "./DialogProvider";
import AppButton from "./AppButton";
import AppInput from "./AppInput";
import AppSelect from "./AppSelect";
import AppTextarea from "./AppTextarea";
import AppModal from "./AppModal";

export default function OrganizationProgramEditor({ organizationId, initial, cohort = false, url, onClose, onSaved }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const key = "common.organizationPortal.";
  const [values, setValues] = useState({ name: initial?.name || "", description: initial?.description || "",
    start_date: initial?.start_date?.slice(0, 10) || "", end_date: initial?.end_date?.slice(0, 10) || "",
    duration_weeks: initial?.duration_weeks ?? 13, duration_days: initial?.duration_days ?? 0,
    status: initial?.status?.toLowerCase().replace("in progress", "active") || "planned", year: new Date().getFullYear() });
  const mutation = useOrganizationMutation(organizationId);
  const change = (field) => (event) => setValues((old) => ({ ...old, [field]: event.target.value }));
  async function save(event) {
    event.preventDefault();
    if (initial && ["completed", "archived"].includes(values.status) && !(await confirm({ message: t(key + "closeRecordConfirm"), tone: "danger" }))) return;
    const body = { name: values.name, start_date: values.start_date || null, end_date: values.end_date || null };
    if (cohort) {
      if (!initial) body.year = Number(values.year);
    } else Object.assign(body, { description: values.description || null, duration_weeks: Number(values.duration_weeks), duration_days: Number(values.duration_days) });
    if (initial) Object.assign(body, { status: values.status, revision: initial.revision });
    const result = await mutation.mutate(url, initial ? "PATCH" : "POST", body);
    if (result) onSaved(result);
  }
  const title = t(key + (cohort ? initial ? "editCohort" : "newCohort" : initial ? "editProgram" : "newProgram"));
  return <AppModal isOpen onClose={mutation.busy ? undefined : onClose} title={title}>
    <form onSubmit={save} className="space-y-4">
      <AppInput label={t(key + "name")} value={values.name} onChange={change("name")} required maxLength={160} />
      {!cohort && <AppTextarea label={t(key + "description")} value={values.description} onChange={change("description")} maxLength={10000} />}
      {cohort && !initial && <AppInput type="number" label={t(key + "year")} value={values.year} onChange={change("year")} min={2000} max={2200} required />}
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput type="date" label={t(key + "start")} value={values.start_date} onChange={change("start_date")} />
        <AppInput type="date" label={t(key + "end")} value={values.end_date} min={values.start_date || undefined} onChange={change("end_date")} />
      </div>
      {!cohort && <div className="grid gap-4 sm:grid-cols-2">
        <AppInput type="number" label={t(key + "weeks")} value={values.duration_weeks} onChange={change("duration_weeks")} min={1} max={520} required />
        <AppInput type="number" label={t(key + "days")} value={values.duration_days} onChange={change("duration_days")} min={0} max={3650} required />
      </div>}
      {initial && <AppSelect label={t(key + "status")} value={values.status} onChange={change("status")} options={["planned", "active", "completed", "archived"].map((value) => ({ value, label: t(key + "states." + value) }))} />}
      {mutation.error && <p role="alert" className="text-sm text-[var(--text-secondary)]">{t(mutation.error)}</p>}
      <p className="text-sm text-[var(--text-secondary)]">{t(key + "preserveHistory")}</p>
      <div className="flex gap-3"><AppButton type="submit" loading={mutation.busy}>{t("common.save")}</AppButton><AppButton variant="secondary" type="button" onClick={onClose} disabled={mutation.busy}>{t("common.cancel")}</AppButton></div>
    </form>
  </AppModal>;
}
