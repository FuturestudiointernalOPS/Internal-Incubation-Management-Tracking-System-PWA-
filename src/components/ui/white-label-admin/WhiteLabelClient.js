"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "../AppButton";
import AppCard from "../AppCard";
import AppEmptyState from "../AppEmptyState";
import AppStatusBadge from "../AppStatusBadge";
import AppTable from "../AppTable";
import AppTabs from "../AppTabs";
import AppInput from "../AppInput";
import PageHero from "../PageHero";
import Configuration from "./Configuration";
import Access from "./Access";
import Supervision from "./Supervision";
import { formatDate,saveClient } from "./forms";

export default function WhiteLabelClient({organizationId}) {
  const { t,lang } = useI18n(); const label = (key) => t(`admin.whiteLabel.${key}`);
  const [tab,setTab] = useState("configuration"); const [busy,setBusy] = useState(false);
  const [error,setError] = useState(""); const [saved,setSaved] = useState(false);
  const [invitation,setInvitation] = useState(null);
  const url = `/api/admin/white-label/clients/${encodeURIComponent(organizationId)}`;
  const api = useApi(url,{cache:false,fetchOptions:{cache:"no-store"}});
  const data = api.data?.success ? api.data : null;
  async function mutate(body) {
    if (busy || !data) return null;
    setBusy(true);setError("");setSaved(false);
    try {
      const result = await saveClient(url,{...body,version:data.version});
      if (result.setupPath) {
        setInvitation({
          path: result.setupPath,
          emailSent: result.email_sent === true,
          emailError: result.email_error || "",
        });
      }
      setSaved(true);
      await api.refresh();
      return result;
    }
    catch (err) { setError(err.message);return null; } finally { setBusy(false); }
  }
  if (api.loading && !data) return <AppEmptyState title={t("common.loading")} />;
  if (!data || api.error) return <AppEmptyState title={t(api.data?.error || "errors.somethingWrong")} action={<AppButton onClick={api.refresh}>{t("common.retry")}</AppButton>} />;
  const locked = ["closed","archived"].includes(data.organization.status);
  return <div className="stf space-y-6">
    <Link href="/admin/white-label" className="text-sm font-bold text-[var(--brand-orange)]">{label("back")}</Link>
    <PageHero kicker={label("kicker")} title={data.organization.name} subtitle={label("detailHint")} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <AppStatusBadge status={data.organization.status} label={label(`statuses.${data.organization.status}`)} />
      <AppButton variant="secondary" disabled={busy} onClick={api.refresh}>{label("refresh")}</AppButton>
    </div>
    {locked && <AppCard><p className="text-sm">{label("closedHint")}</p></AppCard>}
    {error && <AppCard><p role="alert">{t(error)}</p></AppCard>}
    {saved && <p role="status" className="text-sm text-[var(--text-secondary)]">{label("saved")}</p>}
    {invitation && <AppCard>
      <p className="mb-3 text-sm" role="status">{label(invitation.emailSent ? "inviteEmailSent" : "inviteReady")}</p>
      {!invitation.emailSent && invitation.emailError && (
        <p className="mb-3 text-sm text-[var(--status-danger)]" role="alert">{label("inviteEmailFailed")}: {invitation.emailError}</p>
      )}
      <AppInput
        label={label("inviteLink")}
        value={typeof window !== "undefined" ? new URL(invitation.path,window.location.origin).toString() : invitation.path}
        readOnly
        onFocus={(e) => e.target.select()}
      />
      <p className="my-3 text-sm text-[var(--text-secondary)]">{label("invitePrivate")}</p>
      <AppButton variant="secondary" onClick={() => setInvitation(null)}>{t("common.close")}</AppButton>
    </AppCard>}
    <AppTabs activeTab={tab} onTabChange={(key) => {setTab(key);setError("");setSaved(false);if (key==="history") void api.refresh();}}
      tabs={["configuration","branding","users","supervision","history"].map((id) => ({id,label:label(`tabs.${id}`)}))} />
    <div key={`${tab}:${data.version}`}>
      {["configuration","branding"].includes(tab) && <Configuration data={data} brandingOnly={tab === "branding"} mutate={mutate} busy={busy} locked={locked} />}
      {tab === "users" && <Access data={data} mutate={mutate} busy={busy} locked={locked} />}
      {tab === "supervision" && <Supervision data={data} mutate={mutate} busy={busy} locked={locked} />}
      {tab === "history" && <div className="space-y-3"><p className="text-sm text-[var(--text-secondary)]">{label("historyHint")}</p>
        <AppTable emptyMessage={label("noHistory")} data={data.history} columns={[
          {key:"created_at",label:label("date"),render:(value) => formatDate(value,lang)},
          {key:"actor",label:label("actor")},
          {key:"action",label:label("action"),render:(value) => label(`actions.${["client.created","client.configuration","client.branding","client.invite","client.membership","client.supervision","client.endSupervision","client.newContract","insert","update","organization.context.changed"].includes(value) ? value.replaceAll(".","_") : "other"}`)},
        ]} />
      </div>}
    </div>
  </div>;
}
