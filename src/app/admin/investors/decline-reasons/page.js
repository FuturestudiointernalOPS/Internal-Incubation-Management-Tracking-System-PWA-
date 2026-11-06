"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";

const pick = (payload) => (payload?.success ? payload.reasons || [] : []);
const EMPTY = [];
const APPLIES = ["intro", "investment", "application", "pass", "deal_flow_close"];

export default function DeclineReasonsAdminPage() {
  const { t } = useI18n();
  const { alert } = useDialogs();
  const { data: reasons, loading, refresh } = useApi("/api/admin/investors/decline-reasons", {
    defaultValue: EMPTY,
    transform: pick,
  });
  const [appliesTo, setAppliesTo] = useState("intro");
  const [nameEn, setNameEn] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/investors/decline-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applies_to: appliesTo, name_en: nameEn, name_fr: nameFr }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Failed");
      setNameEn("");
      setNameFr("");
      refresh();
    } catch (error) {
      await alert({ message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (reason) => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/investors/decline-reasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reason.id, active: !reason.active }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Failed");
      refresh();
    } catch (error) {
      await alert({ message: error.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading && reasons.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("investorAdmin.declineReasons.title")}</h1>
          <p className="stf-sub">{t("investorAdmin.declineReasons.subtitle")}</p>
        </div>
      </div>

      <div className="stf-card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 12, maxWidth: 520 }}>
        <AppSelect
          label={t("investorAdmin.declineReasons.appliesTo")}
          value={appliesTo}
          onChange={(event) => setAppliesTo(event.target.value)}
          options={APPLIES.map((value) => ({
            value,
            label: t(`investorAdmin.declineReasons.applies.${value}`),
          }))}
        />
        <AppInput label={t("investorAdmin.declineReasons.nameEn")} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <AppInput label={t("investorAdmin.declineReasons.nameFr")} value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
        <AppButton type="button" onClick={create} loading={busy} disabled={!nameEn.trim() || !nameFr.trim()}>
          {t("investorAdmin.declineReasons.add")}
        </AppButton>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {reasons.map((reason) => (
          <div key={reason.id} className="stf-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <b>{reason.name_en}</b>
              <div className="stf-small">{reason.name_fr}</div>
              <div className="stf-small">
                {t(`investorAdmin.declineReasons.applies.${reason.applies_to}`)}
                {" · "}
                {reason.active ? t("investorAdmin.declineReasons.active") : t("investorAdmin.declineReasons.inactive")}
              </div>
            </div>
            <AppButton type="button" size="sm" variant="secondary" onClick={() => toggle(reason)} disabled={busy}>
              {reason.active ? t("investorAdmin.declineReasons.deactivate") : t("investorAdmin.declineReasons.activate")}
            </AppButton>
          </div>
        ))}
      </div>
    </div>
  );
}
