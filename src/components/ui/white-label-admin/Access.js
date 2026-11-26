"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "../AppButton";
import AppCard from "../AppCard";
import AppInput from "../AppInput";
import AppModal from "../AppModal";
import AppSelect from "../AppSelect";
import AppTable from "../AppTable";
import { useDialogs } from "../DialogProvider";
import { roleKeys,roleModule } from "./forms";

export default function Access({data,mutate,busy,locked}) {
  const { t } = useI18n(); const label = (key) => t(`admin.whiteLabel.${key}`);
  const { confirm } = useDialogs();
  const enabled = new Set(data.modules.filter((row) => ["enabled","trial"].includes(row.status)).map((row) => row.module_key));
  const available = roleKeys.filter((role) => !roleModule[role] || enabled.has(roleModule[role]));
  const [form,setForm] = useState({name:"",email:"",roles:available.filter((key) => key!=="lms_learner")});
  const [editing,setEditing] = useState(null);
  const rights = (value,onChange) => <fieldset className="space-y-2"><legend className="mb-2 text-sm font-bold">{label("rights")}</legend>
    {available.map((key) => <label key={key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={value.includes(key)} onChange={(e) => onChange(e.target.checked ? [...value,key] : value.filter((item) => item!==key))} />{label(`roles.${key}`)}</label>)}
  </fieldset>;
  async function invite(e) {
    e.preventDefault();
    if (!await confirm({message:label("inviteConfirmation")})) return;
    await mutate({action:"invite",...form});
  }
  async function change(e) {
    e.preventDefault();
    if (!await confirm({message:label("accessConfirmation"),tone:editing.status!=="active" ? "danger" : undefined})) return;
    if (await mutate({action:"membership",membership_id:editing.id,status:editing.status,roles:editing.roles})) setEditing(null);
  }
  return <div className="space-y-5">
    <AppCard><form className="space-y-4" onSubmit={invite}>
      <h2 className="text-sm font-bold">{label("invite")}</h2><p className="text-sm text-[var(--text-secondary)]">{label("inviteHint")}</p>
      <fieldset disabled={busy || locked} className="space-y-4"><div className="grid gap-4 md:grid-cols-2">
        <AppInput label={label("personName")} value={form.name} required maxLength={160} onChange={(e) => setForm({...form,name:e.target.value})} />
        <AppInput label={label("email")} type="email" value={form.email} required maxLength={254} onChange={(e) => setForm({...form,email:e.target.value})} />
      </div>{rights(form.roles,(roles) => setForm({...form,roles}))}</fieldset>
      <AppButton type="submit" loading={busy} disabled={locked || !form.roles.length}>{label("prepareInvite")}</AppButton>
    </form></AppCard>
    <p className="text-sm text-[var(--text-secondary)]">{label("recentUsers")}</p>
    <AppTable emptyMessage={label("noUsers")} data={data.members} columns={[
      {key:"name",label:label("personName")},{key:"email",label:label("email")},
      {key:"status",label:label("status"),render:(value) => label(`statuses.${value}`)},
      {key:"roles",label:label("rights"),render:(values) => values.map((role) => roleKeys.includes(role.key) ? label(`roles.${role.key}`) : label("assignedProgramRole")).join(" · ") || "—"},
      {key:"id",label:label("action"),render:(_,row) => <AppButton variant="secondary" disabled={locked || row.status === "ended" || busy}
        onClick={() => setEditing({...row,roles:row.roles.filter((role) => role.scope==="organization" && available.includes(role.key)).map((role) => role.key)})}>{label("manageAccess")}</AppButton>},
    ]} />
    <AppModal isOpen={Boolean(editing)} onClose={() => {if (!busy) setEditing(null);}} title={label("manageAccess")}>
      {editing && <form onSubmit={change} className="space-y-4"><p className="text-sm">{editing.name}</p>
        <AppSelect label={label("status")} value={editing.status} options={["active","suspended","ended"].map((key) => ({value:key,label:label(`statuses.${key}`)}))} onChange={(e) => setEditing({...editing,status:e.target.value})} />
        {editing.status!=="ended" && rights(editing.roles,(roles) => setEditing({...editing,roles}))}
        <AppButton type="submit" loading={busy} disabled={editing.status!=="ended" && !editing.roles.length}>{t("common.save")}</AppButton>
      </form>}
    </AppModal>
  </div>;
}
