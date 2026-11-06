"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";

const pickClaims = (payload) => (payload?.success ? payload.claims || [] : []);
const EMPTY = [];

/**
 * /admin/investors/investments
 *
 * Phase 5 studio confirmation queue. Confirm (optionally correcting figures)
 * or reject with a required reason. Pending claims never create financing,
 * decisions or campaign updates until confirmed.
 */
export default function InvestmentsAdminPage() {
  const { t, lang } = useI18n();
  const { confirm, prompt, alert } = useDialogs();
  const { data: claims, loading, refresh } = useApi(
    "/api/admin/investors/investments?status=pending",
    { defaultValue: EMPTY, transform: pickClaims },
  );
  const { data: rejectReasons } = useApi("/api/investor/decline-reasons?applies_to=investment", {
    defaultValue: EMPTY,
    transform: (payload) => (payload?.success ? payload.reasons || [] : []),
  });
  const [busyId, setBusyId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("");

  const act = async (claim, action) => {
    if (action === "reject") {
      const labels = (rejectReasons || []).map((row) =>
        lang === "fr" ? row.name_fr : row.name_en,
      );
      const picked = await prompt({
        message: labels.length
          ? `${t("investorAdmin.investments.rejectReason")}\n${labels.map((label, index) => `${index + 1}. ${label}`).join("\n")}`
          : t("investorAdmin.investments.rejectReason"),
        required: true,
        inputLabel: t("investorAdmin.investments.rejectReasonLabel"),
        placeholder: labels[0] || "",
        validate: (value) =>
          String(value || "").trim() ? null : t("investorAdmin.investments.rejectRequired"),
      });
      if (!picked) return;
      const asIndex = Number(picked);
      const reason = Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= labels.length
        ? labels[asIndex - 1]
        : picked;
      if (!(await confirm({ message: t("investorAdmin.investments.rejectConfirm"), tone: "danger" }))) {
        return;
      }
      setBusyId(`${claim.id}-reject`);
      try {
        const response = await fetch("/api/admin/investors/investments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: claim.id, action: "reject", reason }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Failed");
        refresh();
        await alert({ message: t("investorAdmin.investments.rejectedDone") });
      } catch (error) {
        await alert({ message: error.message });
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (!(await confirm({ message: t("investorAdmin.investments.confirmConfirm") }))) return;

    setBusyId(`${claim.id}-confirm`);
    try {
      const body = { id: claim.id, action: "confirm" };
      if (editId === claim.id) {
        if (editAmount) body.amount = Number(editAmount);
        if (editCurrency) body.currency = editCurrency;
      }
      const response = await fetch("/api/admin/investors/investments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Failed");
      setEditId(null);
      refresh();
      await alert({ message: t("investorAdmin.investments.confirmedDone") });
    } catch (error) {
      await alert({ message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading && claims.length === 0) {
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
          <h1 className="stf-title">{t("investorAdmin.investments.title")}</h1>
          <p className="stf-sub">{t("investorAdmin.investments.subtitle")}</p>
        </div>
      </div>

      {claims.length === 0 ? (
        <p className="stf-small">{t("investorAdmin.investments.empty")}</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {claims.map((claim) => (
            <div key={claim.id} className="stf-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b>
                    {claim.organization_name || claim.investor_email || t("investorAdmin.investments.investor")}
                    {" → "}
                    {claim.venture_name || claim.venture_id}
                  </b>
                  {claim.investor_email && claim.organization_name && (
                    <div className="stf-small">{claim.investor_email}</div>
                  )}
                  <div className="stf-small">
                    {claim.amount} {claim.currency}
                    {claim.instrument ? ` · ${claim.instrument}` : ""}
                    {claim.invested_on ? ` · ${claim.invested_on}` : ""}
                  </div>
                  <div className="stf-small">
                    {claim.created_at
                      ? new Date(claim.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")
                      : t("investorAdmin.investments.unknownDate")}
                  </div>
                </div>
                <span className="stf-tag o">{t("investorAdmin.investments.pending")}</span>
              </div>

              {editId === claim.id && (
                <div style={{ display: "grid", gap: 8, marginTop: 12, maxWidth: 360 }}>
                  <AppInput
                    label={t("investorAdmin.investments.correctAmount")}
                    type="number"
                    value={editAmount}
                    onChange={(event) => setEditAmount(event.target.value)}
                  />
                  <AppInput
                    label={t("investorAdmin.investments.correctCurrency")}
                    value={editCurrency}
                    onChange={(event) => setEditCurrency(event.target.value)}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <AppButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditId(claim.id);
                    setEditAmount(String(claim.amount ?? ""));
                    setEditCurrency(claim.currency || "");
                  }}
                >
                  {t("investorAdmin.investments.correct")}
                </AppButton>
                <AppButton
                  type="button"
                  size="sm"
                  loading={busyId === `${claim.id}-confirm`}
                  disabled={Boolean(busyId)}
                  onClick={() => act(claim, "confirm")}
                >
                  {t("investorAdmin.investments.confirm")}
                </AppButton>
                <AppButton
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={busyId === `${claim.id}-reject`}
                  disabled={Boolean(busyId)}
                  onClick={() => act(claim, "reject")}
                >
                  {t("investorAdmin.investments.reject")}
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
