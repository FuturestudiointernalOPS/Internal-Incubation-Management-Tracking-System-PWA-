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
import AppStatusBadge from "./AppStatusBadge";

export default function OrganizationProgramEnrollments({ organizationId, programId, cohort, editable, canEnroll, onChanged }) {
  const { t } = useI18n(), { confirm } = useDialogs();
  const key = "common.organizationPortal.";
  const [page, setPage] = useState(1), [memberPage, setMemberPage] = useState(1);
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [member, setMember] = useState("");
  const read = { cache: false, fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": organizationId } } };
  const base = `/api/org/programs/${programId}`;
  const url = `${base}/cohorts/${cohort.id}/enrollments`;
  const roster = useApi(`${url}?page=${page}`, read);
  const members = useApi(editable && canEnroll ? `${base}/members?${new URLSearchParams({ search: query, page: String(memberPage) })}` : null, read);
  const mutation = useOrganizationMutation(organizationId);
  const currentRoster = roster.data?.success && roster.data.organizationId === organizationId ? roster.data : null;
  const currentMembers = members.data?.success && members.data.organizationId === organizationId ? members.data : null;
  async function enroll(event) {
    event.preventDefault();
    if (await mutation.mutate(url, "POST", { membership_id: member })) { setMember(""); roster.refresh(); onChanged(); }
  }
  async function end(enrollment, status) {
    if (!(await confirm({ message: t(key + "endEnrollmentConfirm"), tone: status === "withdrawn" ? "danger" : undefined }))) return;
    if (await mutation.mutate(`${url}/${enrollment.id}`, "PATCH", { status, revision: enrollment.revision })) { roster.refresh(); onChanged(); }
  }
  return <AppCard>
    <h3 className="text-lg font-black">{t(key + "enrollments")} — {cohort.name}</h3>
    {editable && canEnroll && <div className="space-y-4 mt-4">
      <form className="flex items-end gap-3" onSubmit={(event) => { event.preventDefault(); setMember(""); setMemberPage(1); setQuery(search); }}>
        <AppInput label={t(key + "findMember")} value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
        <AppButton type="submit">{t("common.search")}</AppButton>
      </form>
      {members.loading ? <p>{t("common.loading")}</p> : !currentMembers ? <p role="alert">{t(members.data?.error || "errors.somethingWrong")}</p> : <>
        <form className="flex items-end gap-3" onSubmit={enroll}>
          <div className="flex-1"><AppSelect label={t(key + "member")} placeholder={t(key + "chooseMember")} value={member} onChange={(event) => setMember(event.target.value)} options={currentMembers.items.map((item) => ({ value: item.membership_id, label: item.name || t(key + "unnamedMember") }))} /></div>
          <AppButton type="submit" disabled={!member} loading={mutation.busy}>{t(key + "enroll")}</AppButton>
        </form>
        <div className="flex gap-3"><AppButton variant="secondary" disabled={memberPage === 1} onClick={() => { setMember(""); setMemberPage((p) => p - 1); }}>{t(key + "previousMembers")}</AppButton><AppButton variant="secondary" disabled={!currentMembers.pagination.hasMore} onClick={() => { setMember(""); setMemberPage((p) => p + 1); }}>{t(key + "nextMembers")}</AppButton></div>
      </>}
    </div>}
    {mutation.error && <p role="alert" className="mt-4">{t(mutation.error)}</p>}
    {roster.loading ? <p>{t("common.loading")}</p> : !currentRoster ? <p role="alert">{t(roster.data?.error || "errors.somethingWrong")}</p> : <div className="space-y-4 mt-6">
      {!currentRoster.items.length && <p>{t(key + "noEnrollments")}</p>}
      {currentRoster.items.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-primary)] pb-3" key={item.id}>
        <span>{item.name || t(key + "unnamedMember")}</span><AppStatusBadge status={item.status} label={t(key + "states." + item.status)} />
        {editable && item.status === "active" && <div className="flex gap-2"><AppButton variant="secondary" disabled={mutation.busy} onClick={() => end(item, "completed")}>{t(key + "completeEnrollment")}</AppButton><AppButton variant="secondary" disabled={mutation.busy} onClick={() => end(item, "withdrawn")}>{t(key + "withdraw")}</AppButton></div>}
      </div>)}
      <div className="flex gap-3"><AppButton variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</AppButton><AppButton disabled={!currentRoster.pagination.hasMore} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</AppButton></div>
    </div>}
  </AppCard>;
}
