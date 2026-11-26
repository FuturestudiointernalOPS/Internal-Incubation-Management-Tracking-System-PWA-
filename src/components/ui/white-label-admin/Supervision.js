"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "../AppButton";
import AppCard from "../AppCard";
import AppInput from "../AppInput";
import AppSelect from "../AppSelect";
import AppTable from "../AppTable";
import { useDialogs } from "../DialogProvider";
import { formatDate } from "./forms";

export default function Supervision({data,mutate,busy,locked}) {
  const { t,lang } = useI18n(); const label = (key) => t(`admin.whiteLabel.${key}`);
  const { confirm } = useDialogs(); const [view,setView] = useState(false);
  const [form,setForm] = useState({staff_person_id:"",reason:"",hours:24});
  const programs = useApi(view ? `/api/platform/organizations/${data.organization.id}/programs?page=1&pageSize=20` : null,{cache:false,fetchOptions:{cache:"no-store"}});
  async function grant(e) { e.preventDefault();if (await confirm({message:label("supervisionConfirmation")})) await mutate({action:"supervision",...form}); }
  return <div className="space-y-5">
    <AppCard><form onSubmit={grant} className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">{label("supervisionHint")}</p>
      <fieldset disabled={busy || locked} className="grid gap-4 md:grid-cols-2">
        <AppSelect label={label("staff")} value={form.staff_person_id} placeholder={label("chooseStaff")} options={data.staff.map((row) => ({value:row.cid,label:`${row.name} (${row.email})`}))} onChange={(e) => setForm({...form,staff_person_id:e.target.value})} />
        <AppInput label={label("hours")} type="number" min={1} max={168} required value={form.hours} onChange={(e) => setForm({...form,hours:Number(e.target.value)})} />
        <AppInput label={label("reason")} maxLength={1000} required value={form.reason} onChange={(e) => setForm({...form,reason:e.target.value})} />
      </fieldset><AppButton type="submit" loading={busy} disabled={locked || !form.staff_person_id}>{label("grant")}</AppButton>
    </form></AppCard>
    <AppTable emptyMessage={label("noSupervision")} data={data.supervision} columns={[
      {key:"name",label:label("staff")},{key:"reason",label:label("reason")},
      {key:"ends_at",label:label("expires"),render:(value) => formatDate(value,lang)},
      {key:"status",label:label("status"),render:(value,row) => label(`statuses.${value==="active" && new Date(row.ends_at)<=new Date() ? "expired" : value}`)},
      {key:"id",label:label("action"),render:(value,row) => <AppButton variant="secondary" disabled={busy || row.status!=="active"} onClick={async () => {
        if (await confirm({message:label("revokeSupervision"),tone:"danger"})) await mutate({action:"endSupervision",grant_id:value});
      }}>{label("revoke")}</AppButton>},
    ]} />
    <AppCard><p className="mb-3 text-sm text-[var(--text-secondary)]">{label("programReadHint")}</p>
      <AppButton variant="secondary" onClick={() => {if (view) programs.refresh();else setView(true);}}>{label("viewPrograms")}</AppButton>
      {view && <div className="mt-4">{programs.error || programs.data?.success===false ? <p role="alert" className="text-sm">{label("mandateRequired")}</p>
        : <AppTable loading={programs.loading} emptyMessage={label("noPrograms")} data={programs.data?.programs || []}
          columns={[{key:"name",label:label("name")},{key:"status",label:label("status"),render:(value) => t(`common.organizationPortal.states.${value?.toLowerCase() || "planned"}`)}]} />}</div>}
    </AppCard>
  </div>;
}
