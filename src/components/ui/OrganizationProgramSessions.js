"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import useOrganizationMutation from "@/lib/hooks/useOrganizationMutation";
import { useDialogs } from "./DialogProvider";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppInput from "./AppInput";
import AppSelect from "./AppSelect";
import AppTextarea from "./AppTextarea";
import AppModal from "./AppModal";
import AppStatusBadge from "./AppStatusBadge";

function SessionEditor({ organizationId, url, initial, onClose, onSaved }) {
  const { t } = useI18n(), { confirm } = useDialogs(), key = "common.organizationPortal.";
  const [value, setValue] = useState({ title: initial?.title || "", description: initial?.description || "",
    week_number: initial?.week_number || 1, start_at: initial?.start_at?.slice(0, 16) || "",
    duration_minutes: initial?.duration_minutes || 60, status: initial?.status || "planned" });
  const mutation = useOrganizationMutation(organizationId);
  const change = (field) => (event) => setValue((old) => ({ ...old, [field]: event.target.value }));
  async function save(event) {
    event.preventDefault();
    if (initial && ["completed", "archived"].includes(value.status) && !(await confirm({ message: t(key + "closeRecordConfirm"), tone: "danger" }))) return;
    const body = { title: value.title, description: value.description || null, week_number: Number(value.week_number),
      duration_minutes: Number(value.duration_minutes), start_at: value.start_at ? `${value.start_at}:00.000Z` : null };
    if (initial) Object.assign(body, { revision: initial.revision, status: value.status });
    if (await mutation.mutate(initial ? `${url}/${initial.id}` : url, initial ? "PATCH" : "POST", body)) onSaved();
  }
  return <AppModal isOpen title={t(key + (initial ? "editSession" : "newSession"))} onClose={mutation.busy ? undefined : onClose}>
    <form onSubmit={save} className="space-y-4">
      <AppInput label={t(key + "sessionTitle")} value={value.title} onChange={change("title")} maxLength={160} required />
      <AppTextarea label={t(key + "description")} value={value.description} onChange={change("description")} maxLength={10000} />
      <AppInput type="number" label={t(key + "week")} value={value.week_number} onChange={change("week_number")} min={1} max={520} required />
      <AppInput type="datetime-local" label={t(key + "startUtc")} value={value.start_at} onChange={change("start_at")} />
      <AppInput type="number" label={t(key + "durationMinutes")} value={value.duration_minutes} onChange={change("duration_minutes")} min={1} max={1440} required />
      {initial && <AppSelect label={t(key + "status")} value={value.status} onChange={change("status")} options={["planned", "active", "completed", "archived"].map((status) => ({ value: status, label: t(key + "states." + status) }))} />}
      {mutation.error && <p role="alert">{t(mutation.error)}</p>}
      <p className="text-sm text-[var(--text-secondary)]">{t(key + "sessionHistory")}</p>
      <div className="flex gap-3"><AppButton type="submit" loading={mutation.busy}>{t("common.save")}</AppButton><AppButton type="button" variant="secondary" disabled={mutation.busy} onClick={onClose}>{t("common.cancel")}</AppButton></div>
    </form>
  </AppModal>;
}

export default function OrganizationProgramSessions({ organizationId, programId, cohort, editable, onChanged }) {
  const { t, lang } = useI18n(), key = "common.organizationPortal.";
  const [page, setPage] = useState(1), [editor, setEditor] = useState(null);
  const url = `/api/org/programs/${programId}/cohorts/${cohort.id}/sessions`;
  const sessions = useApi(`${url}?page=${page}`, { cache: false, fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": organizationId } } });
  const data = sessions.data;
  const reload = () => { setEditor(null); sessions.refresh(); onChanged(); };
  return <AppCard>
    <div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-black">{t(key + "sessions")} — {cohort.name}</h3>
      {editable && <AppButton onClick={() => setEditor({})}>{t(key + "newSession")}</AppButton>}
    </div>
    {sessions.loading ? <p>{t("common.loading")}</p> : sessions.error || !data?.success || data.organizationId !== organizationId ? <p role="alert">{t(data?.error || "errors.somethingWrong")}</p> : <div className="space-y-4 mt-4">
      {!data.items.length && <p>{t(key + "noSessions")}</p>}
      {data.items.map((item) => <div key={item.id} className="border-b border-[var(--border-primary)] pb-4 space-y-2">
        <h4 className="font-bold">{item.title}</h4><AppStatusBadge status={item.status} label={t(key + "states." + item.status)} />
        <p className="text-sm text-[var(--text-secondary)]">{t(key + "sessionSchedule", { week: item.week_number, minutes: item.duration_minutes })}</p>
        <p className="text-sm text-[var(--text-secondary)]">{item.start_at ? new Date(item.start_at).toLocaleString(lang) : t(key + "notScheduled")}</p>
        {item.description && <p className="text-sm text-[var(--text-secondary)]">{item.description}</p>}
        {editable && !["completed", "archived"].includes(item.status) && <AppButton variant="secondary" onClick={() => setEditor(item)}>{t(key + "editSession")}</AppButton>}
      </div>)}
      <div className="flex gap-3"><AppButton variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</AppButton><AppButton disabled={!data.pagination.hasMore} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</AppButton></div>
    </div>}
    {editor && <SessionEditor key={editor.id || "new"} organizationId={organizationId} url={url} initial={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={reload} />}
  </AppCard>;
}
