"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Building2, CheckCircle, PauseCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "../AppButton";
import AppInput from "../AppInput";
import AppSelect from "../AppSelect";
import AppModal from "../AppModal";
import AppCard from "../AppCard";
import AppTable from "../AppTable";
import AppStatusBadge from "../AppStatusBadge";
import AppPagination from "../AppPagination";
import AppEmptyState from "../AppEmptyState";
import PageHero from "../PageHero";
import KpiCard from "../KpiCard";
import CompanyFields from "./CompanyFields";
import { emptyCompany,statuses,saveClient,prepareCompanyPayload } from "./forms";

export default function WhiteLabelClients() {
  const { t } = useI18n(); const router = useRouter();
  const label = (key) => t(`admin.whiteLabel.${key}`);
  const [query,setQuery] = useState(""); const [search,setSearch] = useState("");
  const [status,setStatus] = useState(""); const [page,setPage] = useState(1);
  const [creating,setCreating] = useState(false); const [form,setForm] = useState(emptyCompany);
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const api = useApi(`/api/admin/white-label/clients?${new URLSearchParams({search,status,page:String(page)})}`,{cache:false,fetchOptions:{cache:"no-store"}});
  async function create(e) {
    e.preventDefault();setBusy(true);setError("");
    try {
      const payload = prepareCompanyPayload(form,{creating:true});
      setForm((current) => ({...current,...payload,profile:{...current.profile,...payload.profile}}));
      const result = await saveClient("/api/admin/white-label/clients",payload,"POST");
      router.push(`/admin/white-label/${result.id}`);
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const summary = api.data?.success ? api.data.summary : null;
  return <div className="stf space-y-6">
    <PageHero kicker={label("kicker")} title={label("title")} subtitle={label("subtitle")}
      action={<AppButton icon={Plus} onClick={() => {setForm(emptyCompany);setError("");setCreating(true);}}>{label("create")}</AppButton>} />
    <div className="stf-grid">
      <KpiCard icon={Building2} label={label("total")} value={summary?.total ?? "—"} />
      <KpiCard icon={CheckCircle} label={label("active")} value={summary?.active ?? "—"} />
      <KpiCard icon={PauseCircle} label={label("suspended")} value={summary?.suspended ?? "—"} />
    </div>
    <AppCard><form className="flex flex-wrap items-end gap-4" onSubmit={(e) => {e.preventDefault();setSearch(query);setPage(1);}}>
      <div className="min-w-48 flex-1"><AppInput label={t("common.search")} value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <AppSelect label={label("status")} value={status} options={[{value:"",label:label("allStatuses")},...statuses.map((key) => ({value:key,label:label(`statuses.${key}`)}))]} onChange={(e) => {setStatus(e.target.value);setPage(1);}} />
      <AppButton type="submit">{t("common.search")}</AppButton>
    </form></AppCard>
    {api.error || (!api.loading && !api.data?.success) ? <AppEmptyState title={t(api.data?.error || "errors.somethingWrong")} action={<AppButton onClick={api.refresh}>{t("common.retry")}</AppButton>} />
      : <AppTable loading={api.loading} emptyMessage={label("empty")} data={api.data?.rows || []} columns={[
        {key:"name",label:label("name"),render:(name,row) => <Link className="font-bold text-[var(--brand-orange)]" href={`/admin/white-label/${row.id}`}>{name}</Link>},
        {key:"kind",label:label("kind"),render:(value) => label(`kinds.${value}`)},
        {key:"status",label:label("status"),render:(value) => <AppStatusBadge status={value} label={label(`statuses.${value}`)} />},
        {key:"modules",label:label("modules"),render:(values) => values.map((key) => t(`common.organizationPortal.module.${key}`)).join(" · ") || "—"},
        {key:"members",label:label("users")},
      ]} />}
    {api.data?.total>20 && <AppPagination currentPage={page} totalPages={Math.ceil(api.data.total/20)} onPageChange={setPage} />}
    <AppModal isOpen={creating} onClose={() => {if (!busy) setCreating(false);}} title={label("create")} size="lg">
      <form onSubmit={create} className="space-y-5"><p className="text-sm text-[var(--text-secondary)]">{label("createHint")}</p>
        <CompanyFields value={form} onChange={setForm} creating />
        {error && <p role="alert">{t(error)}</p>}
        <AppButton type="submit" loading={busy} disabled={!form.modules.length}>{t("common.save")}</AppButton>
      </form>
    </AppModal>
  </div>;
}
