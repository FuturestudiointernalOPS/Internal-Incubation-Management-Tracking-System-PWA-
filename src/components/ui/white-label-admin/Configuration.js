"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "../AppButton";
import AppCard from "../AppCard";
import AppInput from "../AppInput";
import AppSelect from "../AppSelect";
import AppTable from "../AppTable";
import { useDialogs } from "../DialogProvider";
import CompanyFields from "./CompanyFields";
import { dateInput,statuses,prepareCompanyPayload } from "./forms";

export default function Configuration({data,brandingOnly,mutate,busy,locked}) {
  const { t } = useI18n(); const label = (key) => t(`admin.whiteLabel.${key}`);
  const { confirm,prompt } = useDialogs();
  const agreement = data.contracts.find((row) => row.status === "active") || data.contracts[0];
  const [form,setForm] = useState({...data.organization,profile:{contact_name:"",contact_email:"",contact_phone:"",website:"",...data.profile},
    modules:data.modules.filter((row) => ["enabled","trial"].includes(row.status)).map((row) => row.module_key),
    contract:agreement ? {...agreement,starts_at:dateInput(agreement.starts_at),ends_at:dateInput(agreement.ends_at),signed_at:dateInput(agreement.signed_at)} : null});
  const [branding,setBranding] = useState({display_name:data.branding.display_name || "",logo_url:data.branding.logo_url || "",primary_color:data.branding.primary_color || ""});
  const [clientError,setClientError] = useState("");
  const setContract = (key,value) => setForm({...form,contract:{...form.contract,[key]:value}});
  async function save(e) {
    e.preventDefault();
    setClientError("");
    let payload;
    try { payload = prepareCompanyPayload(form); }
    catch (err) { setClientError(err.message); return; }
    setForm((current) => ({...current,...payload,profile:{...current.profile,...payload.profile}}));
    if (form.status !== data.organization.status && !await confirm({message:label("statusConfirmation"),tone:["suspended","closed","archived"].includes(form.status) ? "danger" : undefined})) return;
    await mutate({action:"configuration",...form,...payload,profile:payload.profile});
  }
  async function newContract() {
    const plan = await prompt({message:label("newContractPrompt"),inputLabel:label("plan"),required:true});
    if (plan) await mutate({action:"newContract",plan_key:plan});
  }
  if (brandingOnly) return <AppCard><form className="space-y-4" onSubmit={(e) => {e.preventDefault();void mutate({action:"branding",branding:Object.fromEntries(Object.entries(branding).map(([key,value]) => [key,value || null]))});}}>
    <p className="text-sm text-[var(--text-secondary)]">{label("brandingHint")}</p>
    <fieldset disabled={busy || locked} className="grid gap-4 md:grid-cols-2">
      {Object.keys(branding).map((key) => <AppInput key={key} label={label(key)} value={branding[key]} maxLength={key==="logo_url" ? 2048 : key==="primary_color" ? 7 : 80} onChange={(e) => setBranding({...branding,[key]:e.target.value})} />)}
    </fieldset><AppButton type="submit" loading={busy} disabled={locked}>{t("common.save")}</AppButton>
  </form></AppCard>;
  return <div className="space-y-5"><AppCard><form onSubmit={save} className="space-y-5">
    <fieldset disabled={busy || locked} className="space-y-5">
      <CompanyFields value={form} onChange={setForm} />
      <AppSelect label={label("status")} value={form.status} options={statuses.map((key) => ({value:key,label:label(`statuses.${key}`)}))} onChange={(e) => setForm({...form,status:e.target.value})} />
      {form.contract && <div className="space-y-4 border-t border-[var(--border-primary)] pt-5">
        <h2 className="text-sm font-bold">{label("contract")}</h2><p className="text-sm text-[var(--text-secondary)]">{label("contractHint")}</p>
        <fieldset disabled={form.contract.status === "ended" && agreement?.status === "ended"} className="grid gap-4 md:grid-cols-2">
          <AppInput label={label("plan")} value={form.contract.plan_key} required maxLength={100} onChange={(e) => setContract("plan_key",e.target.value)} />
          <AppSelect label={label("contractStatus")} value={form.contract.status} options={["draft","active","suspended","ended"].map((key) => ({value:key,label:label(`statuses.${key}`)}))} onChange={(e) => setContract("status",e.target.value)} />
          {["starts_at","ends_at","signed_at"].map((key) => (
            <AppInput
              key={key}
              type="date"
              label={label(key)}
              value={form.contract[key] || ""}
              max={key === "signed_at" ? new Date().toISOString().slice(0,10) : undefined}
              hint={key === "signed_at" ? label("signedAtHint") : undefined}
              onChange={(e) => setContract(key,e.target.value)}
            />
          ))}
        </fieldset>
      </div>}
    </fieldset>
    {clientError && <p role="alert" className="text-sm font-medium text-[var(--status-danger)]">{t(clientError)}</p>}
    <div className="flex flex-wrap gap-3"><AppButton type="submit" loading={busy} disabled={locked || !form.contract || !form.modules.length}>{t("common.save")}</AppButton>
      <AppButton variant="secondary" disabled={busy || locked || data.contracts.some((row) => row.status === "active")} onClick={newContract}>{label("newContract")}</AppButton></div>
  </form></AppCard>
    <AppTable emptyMessage={label("noContracts")} data={data.contracts} columns={[
      {key:"plan_key",label:label("plan")},{key:"status",label:label("status"),render:(value) => label(`statuses.${value}`)},
      {key:"starts_at",label:label("starts_at"),render:(value) => dateInput(value) || "—"},
      {key:"ends_at",label:label("ends_at"),render:(value) => dateInput(value) || "—"},
    ]} />
  </div>;
}
