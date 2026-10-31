"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppEmptyState from "./AppEmptyState";
import AppStatusBadge from "./AppStatusBadge";
import OrganizationProgramSessions from "./OrganizationProgramSessions";
import OrganizationProgramEditor from "./OrganizationProgramEditor";
import OrganizationProgramEnrollments from "./OrganizationProgramEnrollments";

export default function OrganizationProgramWorkspace({ organizationId, programId, onChanged, onBack }) {
  const { t, lang } = useI18n();
  const key = "common.organizationPortal.";
  const [page, setPage] = useState(1), [editor, setEditor] = useState(null), [cohortId, setCohortId] = useState(null);
  const url = `/api/org/programs/${programId}`;
  const read = { cache: false, fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": organizationId } } };
  const workspace = useApi(`${url}/workspace?page=${page}`, read);
  const data = workspace.data;
  const reload = () => { setEditor(null); workspace.refresh(); onChanged(); };
  const formatDate = (value) => value ? new Date(value).toLocaleDateString(lang) : t(key + "notSpecified");
  if (workspace.loading) return <AppEmptyState title={t("common.loading")} />;
  if (workspace.error || !data?.success || data.organizationId !== organizationId || data.program?.id !== programId) {
    return <AppEmptyState title={t(data?.error || "errors.insufficientPermissions")} action={<AppButton onClick={onBack}>{t("common.back")}</AppButton>} />;
  }
  const program = data.program, closed = ["completed", "archived"].includes(program.status?.toLowerCase());
  const cohort = data.items.find((item) => item.id === cohortId);
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-3"><AppButton variant="secondary" onClick={onBack}>{t("common.back")}</AppButton><AppButton variant="secondary" onClick={workspace.refresh}>{t("common.refresh")}</AppButton>
      {data.permissions.edit && !closed && <AppButton onClick={() => setEditor({ initial: program, url })}>{t(key + "editProgram")}</AppButton>}
    </div>
    <AppCard>
      <h2 className="text-2xl font-black">{program.name}</h2><AppStatusBadge status={program.status} label={t(key + "states." + (program.status?.toLowerCase() || "planned"))} />
      <p className="mt-4 text-sm text-[var(--text-secondary)]">{program.description}</p>
      <dl className="grid gap-4 sm:grid-cols-2 mt-6"><div><dt>{t(key + "start")}</dt><dd>{formatDate(program.start_date)}</dd></div><div><dt>{t(key + "end")}</dt><dd>{formatDate(program.end_date)}</dd></div></dl>
      {closed && <p className="mt-4 text-sm text-[var(--text-secondary)]">{t(key + "closedHistory")}</p>}
    </AppCard>
    <section className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-black">{t(key + "cohorts")}</h2>
        {data.permissions["cohorts.manage"] && !closed && <AppButton onClick={() => setEditor({ cohort: true, url: `${url}/cohorts` })}>{t(key + "newCohort")}</AppButton>}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{t(key + "annualHistory")}</p>
      {!data.items.length && <AppEmptyState title={t(key + "noCohorts")} />}
      <div className="stf-grid">{data.items.map((item) => <AppCard key={item.id}>
        <h3 className="text-lg font-black">{item.name} · {item.year}</h3><AppStatusBadge status={item.status} label={t(key + "states." + item.status)} />
        <p className="my-4 text-sm text-[var(--text-secondary)]">{t(key + "activeEnrollments", { count: item.active_enrollments })}</p>
        <div className="flex flex-wrap gap-2">
          {data.permissions["cohorts.manage"] && !closed && !["completed", "archived"].includes(item.status) && <AppButton variant="secondary" onClick={() => setEditor({ cohort: true, initial: item, url: `${url}/cohorts/${item.id}` })}>{t(key + "editCohort")}</AppButton>}
          <AppButton variant="secondary" onClick={() => setCohortId(item.id)}>{t(key + "viewSessions")}</AppButton>
          {data.permissions["enrollments.manage"] && <AppButton onClick={() => setCohortId(item.id)}>{t(key + "viewEnrollments")}</AppButton>}
        </div>
      </AppCard>)}</div>
      <div className="flex gap-3"><AppButton variant="secondary" disabled={page === 1} onClick={() => { setCohortId(null); setPage((p) => p - 1); }}>{t("common.previous")}</AppButton><AppButton disabled={!data.pagination.hasMore} onClick={() => { setCohortId(null); setPage((p) => p + 1); }}>{t("common.next")}</AppButton></div>
    </section>
    {cohort && <OrganizationProgramSessions key={cohort.id} organizationId={organizationId} programId={programId} cohort={cohort} editable={data.permissions["sessions.manage"] && !closed && !["completed", "archived"].includes(cohort.status)} onChanged={workspace.refresh} />}
    {cohort && data.permissions["enrollments.manage"] && <OrganizationProgramEnrollments key={cohort.id} organizationId={organizationId} programId={programId} cohort={cohort} canEnroll={data.permissions.enroll} editable={!closed && !["completed", "archived"].includes(cohort.status)} onChanged={workspace.refresh} />}
    {editor && <OrganizationProgramEditor key={editor.initial?.id || editor.url} organizationId={organizationId} {...editor} onClose={() => setEditor(null)} onSaved={reload} />}
  </div>;
}
