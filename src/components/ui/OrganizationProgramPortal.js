"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, BriefcaseBusiness, GraduationCap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppSelect from "./AppSelect";
import AppInput from "./AppInput";
import AppEmptyState from "./AppEmptyState";
import AppStatusBadge from "./AppStatusBadge";
import PageHero from "./PageHero";
import OrganizationProgramEditor from "./OrganizationProgramEditor";
import OrganizationProgramWorkspace from "./OrganizationProgramWorkspace";
import OrganizationPortalHeader from "./OrganizationPortalHeader";
import OrganizationLmsPortal from "./OrganizationLmsPortal";
import OrganizationLmsCoursePortal from "./OrganizationLmsCoursePortal";
import OrganizationVenturePortal from "./OrganizationVenturePortal";
import { resolveOrganizationPortalBranding } from "./organizationPortalBranding";

const CHANGE_KEY = "impactos_organization_changed";
const privateRead = { cache: false, fetchOptions: { cache: "no-store" } };

export default function OrganizationProgramPortal({ organizationCode, programId, view = "programs" }) {
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
  return <OrganizationContextView key={`${organizationCode}:${programId}:${view}:${epoch}`} organizationCode={organizationCode} programId={programId} view={view} />;
}

function OrganizationContextView({ organizationCode, programId, view }) {
  const router = useRouter();
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
  if (!data.success) return <AppEmptyState title={t(data.error || "errors.insufficientPermissions")} description={t("common.organizationPortal.denied")} action={data.error === "errors.authRequired" ? <AppButton onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}>{t("common.organizationPortal.signIn")}</AppButton> : <AppButton onClick={refresh}>{t("common.retry")}</AppButton>} />;
  const organization = data.organization;
  if (organizationCode && organization?.code === organizationCode) {
    return view === "home"
      ? <OrganizationPortalHome key={organization.id} organization={organization} onBrandChanged={refresh} />
      : view === "lms-course"
        ? <OrganizationLmsCoursePortal key={organization.id} organization={organization} courseId={programId} onBrandChanged={refresh} />
        : view === "lms"
          ? <OrganizationLmsPortal key={organization.id} organization={organization} onBrandChanged={refresh} />
          : view === "venture"
            ? <OrganizationVenturePortal key={organization.id} organization={organization} onBrandChanged={refresh} />
            : <OrganizationPrograms key={organization.id} organization={organization} programId={programId} onBrandChanged={refresh} />;
  }
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
    <p className="text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.accessHint")}</p>
  </div>;
}

function OrganizationPortalHome({ organization, onBrandChanged }) {
  const { t } = useI18n();
  const router = useRouter();
  const base = `/o/${encodeURIComponent(organization.code)}`;
  const activeModules = new Set(organization.modules || []);
  const modules = [
    { key: "programs", icon: BookOpen, active: activeModules.has("programs") },
    { key: "lms", icon: GraduationCap, active: activeModules.has("lms") },
    { key: "venture", icon: BriefcaseBusiness, active: activeModules.has("venture") },
  ];

  return <div className="space-y-6" style={organizationBrandStyle(organization)}>
    <OrganizationPortalHeader organization={organization} activePage="home" onBrandChanged={onBrandChanged} />
    <PageHero kicker={t("common.organizationPortal.home")} title={t("common.organizationPortal.welcome", { name: organization.branding?.displayName || organization.name })}
      subtitle={t("common.organizationPortal.homeHint")} />
    <section aria-label={t("common.organizationPortal.modules")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map(({ key, icon: Icon, active }) => (
        <AppCard key={key} className={active ? "border-l-4 border-l-[var(--brand-orange)]" : "opacity-75"}>
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-brand-orange/10 text-[var(--brand-orange)]" : "bg-surface-2 text-[var(--text-secondary)]"}`}>
              <Icon aria-hidden="true" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-[var(--text-primary)]">{t(`common.organizationPortal.module.${key}`)}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t(`common.organizationPortal.moduleDescription.${key}`)}
              </p>
              <div className="mt-4">
                {active
                  ? <AppButton onClick={() => router.push(`${base}/${key === "programs" ? "programs" : key}`)}>{t("common.organizationPortal.openModule")}</AppButton>
                  : <AppStatusBadge status="planned" label={t("common.organizationPortal.comingSoon")} />}
              </div>
            </div>
          </div>
        </AppCard>
      ))}
    </section>
    <p className="text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.accessHint")}</p>
  </div>;
}

function OrganizationPrograms({ organization, programId, onBrandChanged }) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const selected = programId || null;
  const router = useRouter();
  const setSelected = (id) => router.push(`/o/${encodeURIComponent(organization.code)}/programs${id ? "/" + encodeURIComponent(id) : ""}`);
  const [creating, setCreating] = useState(false);
  const read = { cache: false, fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": organization.id } } };
  const list = useApi(`/api/org/programs?${new URLSearchParams({ search, page: String(page) })}`, read);
  const current = list;
  const body = current.data;
  return <div className="space-y-6" style={organizationBrandStyle(organization)}>
    <OrganizationPortalHeader organization={organization} activePage="programs" onBrandChanged={onBrandChanged} />
    <PageHero title={t("common.organizationPortal.programmes")} subtitle={t("common.organizationPortal.accessHint")} />
    {!selected && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(input); }}>
      <div className="flex-1"><AppInput label={t("common.search")} value={input} onChange={(event) => setInput(event.target.value)} /></div>
      <AppButton type="submit">{t("common.search")}</AppButton>
    </form>}
    {selected && <OrganizationProgramWorkspace key={selected} organizationId={organization.id} programId={selected} onChanged={list.refresh} onBack={() => setSelected(null)} />}
    {!selected && body?.success && body.organizationId === organization.id && body.permissions?.create && <AppButton onClick={() => setCreating(true)}>{t("common.organizationPortal.newProgram")}</AppButton>}
    {creating && <OrganizationProgramEditor organizationId={organization.id} url="/api/org/programs" onClose={() => setCreating(false)} onSaved={(result) => { setCreating(false); list.refresh(); setSelected(result.result.id); }} />}
    {!selected && (current.loading ? <AppEmptyState title={t("common.loading")} /> : current.error ? <AppEmptyState title={t("errors.somethingWrong")} action={<AppButton onClick={current.refresh}>{t("common.retry")}</AppButton>} />
      : !body?.success || body.organizationId !== organization.id ? <AppEmptyState title={t(body?.error || "errors.insufficientPermissions")} action={<AppButton onClick={() => router.push("/o/select")}>{t("common.organizationPortal.choose")}</AppButton>} />
        : <><div className="stf-grid">{body.programs.map((program) => <AppCard key={program.id}><AppStatusBadge status={program.status} label={t("common.organizationPortal.states." + (program.status?.toLowerCase() || "planned"))} /><h2 className="text-lg font-black mt-3">{program.name}</h2><p className="text-sm text-[var(--text-secondary)] my-4">{program.description}</p><AppButton onClick={() => setSelected(program.id)}>{t("common.organizationPortal.details")}</AppButton></AppCard>)}</div>
            {!body.programs.length && <AppEmptyState title={t("common.noResults")} />}
            <div className="flex gap-3"><AppButton variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</AppButton><AppButton disabled={!body.pagination.hasMore} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</AppButton></div></>)}
    <p className="text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.future")}</p>
  </div>;
}

function organizationBrandStyle(organization) {
  const { primaryColor } = resolveOrganizationPortalBranding(organization);
  return primaryColor ? {
    "--brand-orange": primaryColor,
    "--accent": primaryColor,
    "--brand-gradient": primaryColor,
  } : undefined;
}
