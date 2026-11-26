"use client";
import { useI18n } from "@/lib/i18n";
import AppInput from "../AppInput";
import AppSelect from "../AppSelect";
import { kinds,modules } from "./forms";

export default function CompanyFields({value,onChange,creating=false}) {
  const { t } = useI18n();
  const label = (key) => t(`admin.whiteLabel.${key}`);
  const field = (key,options={}) => <AppInput label={label(key)} value={value[key] || ""} onChange={(e) => onChange({...value,[key]:e.target.value})} {...options} />;
  const contact = (key,options={}) => <AppInput label={label(key)} value={value.profile[key] || ""} onChange={(e) => onChange({...value,profile:{...value.profile,[key]:e.target.value}})} {...options} />;
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-2">
      {field("name",{required:true,maxLength:160})}
      {field("code",{required:true,pattern:"[a-z0-9][a-z0-9-]{1,38}[a-z0-9]",maxLength:40,title:label("codeHint"),hint:label(creating ? "codeHint" : "codeEditHint")})}
      <AppSelect label={label("kind")} value={value.kind} options={kinds.map((key) => ({value:key,label:label(`kinds.${key}`)}))} onChange={(e) => onChange({...value,kind:e.target.value})} />
      {contact("contact_name",{maxLength:160})}{contact("contact_email",{type:"email",maxLength:254})}
      {contact("contact_phone",{type:"tel",maxLength:60})}{contact("website",{maxLength:2048,placeholder:"https://example.com",hint:label("websiteHint"),title:label("websiteHint")})}
      <AppSelect label={label("language")} value={value.default_locale} options={[{value:"fr",label:label("french")},{value:"en",label:label("english")}]} onChange={(e) => onChange({...value,default_locale:e.target.value})} />
      {field("timezone",{required:true,maxLength:80})}
    </div>
    <fieldset className="rounded-xl border border-[var(--border-primary)] p-4">
      <legend className="px-2 text-sm font-bold">{label("modules")}</legend>
      <div className="flex flex-wrap gap-5">{modules.map((key) => <label key={key} className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={value.modules.includes(key)} onChange={(e) => onChange({...value,modules:e.target.checked ? [...value.modules,key] : value.modules.filter((item) => item!==key)})} />
        {t(`common.organizationPortal.module.${key}`)}
      </label>)}</div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{label("moduleHint")}</p>
    </fieldset>
  </div>;
}
