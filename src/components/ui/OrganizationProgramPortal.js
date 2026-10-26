"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppSelect from "./AppSelect";
import AppInput from "./AppInput";
import AppEmptyState from "./AppEmptyState";
import AppStatusBadge from "./AppStatusBadge";
import PageHero from "./PageHero";

const CHANGE_KEY = "impactos_organization_changed";
const privateRead = { cache: false, fetchOptions: { cache: "no-store" } };

export default function OrganizationProgramPortal({ organizationCode }) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const refresh = () => setEpoch((value) => value + 1);
    const storage = (event) => { if (event.key === CHANGE_KEY) refresh(); };
    const pageshow = (event) => { if (event.persisted) refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", pageshow);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("storage", storage); window.removeEventListener("pageshow", pageshow); };
  }, []);
  // Remount removes old data and detaches all previous requests before rereading
  // session context. Storage contains only an invalidation signal, no authority.
  return <OrganizationContextView key={epoch} organizationCode={organizationCode} />;
}

function OrganizationContextView({ organizationCode }) {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useApi("/api/org/context", privateRead);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  async function switchTo() {
    setBusy(true); setFailure(null);
    try {
      const response = await fetch("/api/org/context", { method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: selected, expected_organization_id: data.activeOrganizationId ?? null }) });
      const result = await response.json();
      if (!response.ok || !result.success) { setFailure(result.error || "errors.somethingWrong"); return; }
      try { localStorage.setItem(CHANGE_KEY, String(Date.now())); } catch { /* Storage-disabled tabs recheck on focus. */ }
      window.location.assign(`/o/${encodeURIComponent(result.organization.code)}`);
    } catch { setFailure("errors.somethingWrong"); }
    finally { setBusy(false); }
  }
  if (loading || !data) return <AppEmptyState title={t(error ? "errors.somethingWrong" : "common.loading")} action={error ? <AppButton onClick={refresh}>{t("common.retry")}</AppButton> : null} />;
  if (!data.success) return <AppEmptyState title={t(data.error || "errors.insufficientPermissions")} description={t("common.organizationPortal.denied")} action={<AppButton onClick={refresh}>{t("common.retry")}</AppButton>} />;
  const organization = data.organization;
  if (organizationCode && organization?.code === organizationCode) return <OrganizationPrograms key={organization.id} organization={organization} />;
  return <div className="space-y-6">
    <PageHero kicker={t("common.organizationPortal.brand")} title={t("common.organizationPortal.choose")} subtitle={t("common.organizationPortal.chooseHint")} />
    {organizationCode && <p role="alert">{t("errors.organizationContextChanged")}</p>}
    <AppCard>
      <div className="space-y-4">
        <AppSelect label={t("common.organizationPortal.organization")} placeholder={t("common.organizationPortal.choose")} value={selected} onChange={(event) => setSelected(event.target.value)} options={data.organizations.map((item) => ({ value: item.id, label: item.name }))} />
        {failure && <p role="alert">{t(failure)}</p>}
        {!data.organizations.length && <p>{t("common.organizationPortal.noOrganizations")}</p>}
        {data.truncated && <p>{t("common.organizationPortal.truncated")}</p>}
        <AppButton loading={busy} disabled={!selected} onClick={switchTo}>{t("common.organizationPortal.open")}</AppButton>
      </div>
    </AppCard>
    <p className="text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.readOnly")}</p>
  </div>;
}

function OrganizationPrograms({ organization }) {
  const { t, lang } = useI18n();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const read = { cache: false, fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": organization.id } } };
  const list = useApi(`/api/org/programs?${new URLSearchParams({ search, page: String(page) })}`, read);
  const detail = useApi(selected ? `/api/org/programs/${encodeURIComponent(selected)}` : null, read);
  const current = selected ? detail : list;
  const body = current.data;
  const date = (value) => value ? new Date(value).toLocaleDateString(lang) : t("common.organizationPortal.notSpecified");
  return <div className="space-y-6">
    <PageHero kicker={organization.name} title={t("common.organizationPortal.programmes")} subtitle={t("common.organizationPortal.readOnly")} action={<AppButton variant="secondary" onClick={() => window.location.assign("/o/select")}>{t("common.organizationPortal.change")}</AppButton>} />
    {!selected && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(input); }}>
      <div className="flex-1"><AppInput label={t("common.search")} value={input} onChange={(event) => setInput(event.target.value)} /></div>
      <AppButton type="submit">{t("common.search")}</AppButton>
    </form>}
    {selected && <AppButton variant="secondary" onClick={() => setSelected(null)}>{t("common.back")}</AppButton>}
    {current.loading ? <AppEmptyState title={t("common.loading")} /> : current.error ? <AppEmptyState title={t("errors.somethingWrong")} action={<AppButton onClick={current.refresh}>{t("common.retry")}</AppButton>} />
      : !body?.success || body.organizationId !== organization.id ? <AppEmptyState title={t(body?.error || "errors.insufficientPermissions")} action={<AppButton onClick={() => window.location.assign("/o/select")}>{t("common.organizationPortal.choose")}</AppButton>} />
        : selected ? <AppCard><h2 className="text-2xl font-black">{body.program.name}</h2><AppStatusBadge status={body.program.status} /><p className="mt-4 text-sm text-[var(--text-secondary)]">{body.program.description}</p><dl className="grid gap-4 sm:grid-cols-2 mt-6"><div><dt>{t("common.organizationPortal.start")}</dt><dd>{date(body.program.start_date)}</dd></div><div><dt>{t("common.organizationPortal.end")}</dt><dd>{date(body.program.end_date)}</dd></div></dl></AppCard>
          : <><div className="stf-grid">{body.programs.map((program) => <AppCard key={program.id}><AppStatusBadge status={program.status} /><h2 className="text-lg font-black mt-3">{program.name}</h2><p className="text-sm text-[var(--text-secondary)] my-4">{program.description}</p><AppButton onClick={() => setSelected(program.id)}>{t("common.organizationPortal.details")}</AppButton></AppCard>)}</div>
            {!body.programs.length && <AppEmptyState title={t("common.noResults")} />}
            <div className="flex gap-3"><AppButton variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</AppButton><AppButton disabled={!body.pagination.hasMore} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</AppButton></div></>}
    <p className="text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.future")}</p>
  </div>;
}
