"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2, Pause, Plus, Rocket, Upload, X } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";

const pickEntries = (payload) => (payload?.success ? payload.entries || [] : []);
const EMPTY = [];
const EMPTY_FORM = { venture_id: "", target_amount: "", currency: "USD", instrument: "", use_of_funds: "" };
const CURRENCIES = ["USD", "EUR", "XOF", "GBP", "NGN", "ZAR", "KES", "GHS"];

function validate(form, t) {
  const errors = {};
  if (!String(form.venture_id || "").trim()) {
    errors.venture_id = t("investorAdmin.dealFlow.errVentureId");
  }
  const amount = Number(form.target_amount);
  if (String(form.target_amount ?? "").trim() === "" || !Number.isFinite(amount) || amount <= 0) {
    errors.target_amount = t("investorAdmin.dealFlow.errAmount");
  }
  if (!String(form.currency || "").trim()) {
    errors.currency = t("investorAdmin.dealFlow.errCurrency");
  }
  return errors;
}

function Field({ label, error, children }) {
  return (
    <label className="stf-small" style={{ display: "block" }}>
      {label}
      {children}
      {error && (
        <span className="stf-small" style={{ display: "block", marginTop: 4, color: "var(--stf-crit)" }}>
          {error}
        </span>
      )}
    </label>
  );
}

/**
 * /admin/investors/deal-flow
 *
 * The studio marks a venture as raising, uploads/publishes its deck, and opens
 * or closes the entry. Validation is inline; every state change is confirmed and
 * acknowledged. An entry goes live only with a published deck (server-enforced).
 */
export default function DealFlowAdminPage() {
  const { t } = useI18n();
  const { confirm, prompt, alert } = useDialogs();
  const { data: entries, loading, refresh } = useApi("/api/admin/investors/deal-flow", {
    defaultValue: EMPTY,
    transform: pickEntries,
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionBusy, setActionBusy] = useState(null);

  const errors = useMemo(() => validate(form, t), [form, t]);
  const hasErrors = Object.keys(errors).length > 0;
  const fieldError = (field) => (showErrors ? errors[field] : null);
  const inputStyle = (field) => ({
    background: "var(--surface-2)",
    border: `1px solid ${fieldError(field) ? "var(--stf-crit)" : "var(--border-primary)"}`,
  });

  const send = async (body, method = "POST") => {
    const response = await fetch("/api/admin/investors/deal-flow", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!json.success) throw new Error(json.error || "Failed");
    return json;
  };

  const create = async () => {
    setShowErrors(true);
    if (hasErrors) return;

    setCreating(true);
    try {
      await send(form);
      setForm(EMPTY_FORM);
      setShowErrors(false);
      refresh();
      await alert({ message: t("investorAdmin.dealFlow.created") });
    } catch (error) {
      await alert({ message: error.message });
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (entry, status) => {
    let close_reason = null;
    if (status === "closed") {
      close_reason = await prompt({
        message: t("investorAdmin.dealFlow.closeReason"),
        required: true,
        inputLabel: t("investorAdmin.dealFlow.closeReasonLabel"),
      });
      if (!close_reason) return;
    }
    if (!(await confirm({ message: t("investorAdmin.dealFlow.confirmStatus", { status }) }))) return;

    setActionBusy(entry.id);
    try {
      await send({ id: entry.id, status, close_reason }, "PUT");
      refresh();
      await alert({ message: t("investorAdmin.dealFlow.statusChanged", { status }) });
    } catch (error) {
      await alert({ message: error.message });
    } finally {
      setActionBusy(null);
    }
  };

  const addDeck = async (entry, file) => {
    if (!file) return;
    const key = `add-${entry.id}`;
    setActionBusy(key);
    try {
      const body = new FormData();
      body.append("deal_flow_entry_id", String(entry.id));
      body.append("file", file);
      const response = await fetch("/api/admin/investors/deal-flow", { method: "PUT", body });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "investorAdmin.dealFlow.uploadFailed");
      refresh();
      await alert({ message: t("investorAdmin.dealFlow.deckAdded") });
    } catch (error) {
      await alert({ message: t(error.message) });
    } finally {
      setActionBusy(null);
    }
  };

  const publishDeck = async (deck) => {
    if (!(await confirm({ message: t("investorAdmin.dealFlow.confirmPublishDeck") }))) return;

    const key = `pub-${deck.id}`;
    setActionBusy(key);
    try {
      await send({ action: "publish_deck", deck_id: deck.id }, "PUT");
      refresh();
      await alert({ message: t("investorAdmin.dealFlow.deckPublished") });
    } catch (error) {
      await alert({ message: error.message });
    } finally {
      setActionBusy(null);
    }
  };

  if (loading && entries.length === 0) {
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
          <h1 className="stf-title">{t("investorAdmin.dealFlow.title")}</h1>
          <p className="stf-sub">{t("investorAdmin.dealFlow.subtitle")}</p>
        </div>
      </div>

      <section className="stf-sec">
        <div className="stf-card" style={{ padding: 16 }}>
          <h3 className="stf-card-title">
            <Plus size={15} /> {t("investorAdmin.dealFlow.newEntry")}
          </h3>

          {showErrors && hasErrors && (
            <p className="stf-small" style={{ color: "var(--stf-crit)", marginBottom: 8 }}>
              {t("investorAdmin.dealFlow.fixErrors")}
            </p>
          )}

          <div className="stf-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label={t("investorAdmin.dealFlow.ventureId")} error={fieldError("venture_id")}>
              <input
                value={form.venture_id}
                onChange={(event) => setForm({ ...form, venture_id: event.target.value })}
                placeholder="VNT-1"
                aria-invalid={Boolean(fieldError("venture_id"))}
                className="w-full mt-1 px-3 py-2 rounded-lg"
                style={inputStyle("venture_id")}
              />
            </Field>
            <Field label={t("investorAdmin.dealFlow.amount")} error={fieldError("target_amount")}>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={form.target_amount}
                onChange={(event) => setForm({ ...form, target_amount: event.target.value })}
                aria-invalid={Boolean(fieldError("target_amount"))}
                className="w-full mt-1 px-3 py-2 rounded-lg"
                style={inputStyle("target_amount")}
              />
            </Field>
            <Field label={t("investorAdmin.dealFlow.currency")} error={fieldError("currency")}>
              <input
                list="deal-flow-currency-options"
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
                aria-invalid={Boolean(fieldError("currency"))}
                className="w-full mt-1 px-3 py-2 rounded-lg"
                style={inputStyle("currency")}
              />
              <datalist id="deal-flow-currency-options">
                {CURRENCIES.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </Field>
            <Field label={t("investorAdmin.dealFlow.instrument")}>
              <input
                value={form.instrument}
                onChange={(event) => setForm({ ...form, instrument: event.target.value })}
                placeholder="equity"
                className="w-full mt-1 px-3 py-2 rounded-lg"
                style={inputStyle("instrument")}
              />
            </Field>
          </div>

          <div style={{ marginTop: 12 }}>
            <AppButton
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={create}
              disabled={creating || !form.venture_id.trim()}
            >
              {creating ? t("investorAdmin.dealFlow.creating") : t("investorAdmin.dealFlow.create")}
            </AppButton>
          </div>
        </div>
      </section>

      <section className="stf-sec">
        {entries.length === 0 ? (
          <p className="stf-small">{t("investorAdmin.dealFlow.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {entries.map((entry) => (
              <div key={entry.id} className="stf-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <b>
                      {t("investorAdmin.dealFlow.venture")} {entry.venture_id}
                    </b>
                    <div className="stf-small">
                      {entry.target_amount} {entry.currency} · {entry.instrument || "—"}
                    </div>
                  </div>
                  <span className="stf-tag">{entry.status}</span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <label
                    className="stf-btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: actionBusy === `add-${entry.id}` ? "wait" : "pointer",
                      opacity: actionBusy === `add-${entry.id}` ? 0.6 : 1,
                    }}
                  >
                    {actionBusy === `add-${entry.id}` ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {t("investorAdmin.dealFlow.addDeck")}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      aria-label={t("investorAdmin.dealFlow.addDeck")}
                      disabled={actionBusy === `add-${entry.id}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) addDeck(entry, file);
                      }}
                      style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: "hidden",
                        clip: "rect(0, 0, 0, 0)",
                        whiteSpace: "nowrap",
                        border: 0,
                      }}
                    />
                  </label>
                  <span className="stf-small" style={{ alignSelf: "center" }}>
                    {t("investorAdmin.dealFlow.deckUploadHelp")}
                  </span>
                  {entry.status !== "live" && (
                    <AppButton
                      variant="primary"
                      size="sm"
                      icon={Rocket}
                      onClick={() => setStatus(entry, "live")}
                      disabled={actionBusy === entry.id}
                    >
                      {t("investorAdmin.dealFlow.goLive")}
                    </AppButton>
                  )}
                  {entry.status === "live" && (
                    <AppButton
                      variant="secondary"
                      size="sm"
                      icon={Pause}
                      onClick={() => setStatus(entry, "paused")}
                      disabled={actionBusy === entry.id}
                    >
                      {t("investorAdmin.dealFlow.pause")}
                    </AppButton>
                  )}
                  {entry.status !== "closed" && (
                    <AppButton
                      variant="secondary"
                      size="sm"
                      icon={X}
                      onClick={() => setStatus(entry, "closed")}
                      disabled={actionBusy === entry.id}
                    >
                      {t("investorAdmin.dealFlow.close")}
                    </AppButton>
                  )}
                </div>

                <label className="stf-small" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(entry.show_founder_names)}
                    disabled={actionBusy === entry.id}
                    onChange={async (event) => {
                      setActionBusy(entry.id);
                      try {
                        await send(
                          {
                            action: "show_founder_names",
                            id: entry.id,
                            show_founder_names: event.target.checked,
                          },
                          "PUT",
                        );
                        refresh();
                      } catch (error) {
                        await alert({ message: error.message });
                      } finally {
                        setActionBusy(null);
                      }
                    }}
                  />
                  {t("investorAdmin.dealFlow.showFounderNames")}
                </label>

                {(entry.decks || []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="stf-small" style={{ fontWeight: 700 }}>
                      {t("investorAdmin.dealFlow.decks")}
                    </div>
                    {(entry.decks || []).map((deck) => (
                      <div
                        key={deck.id}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}
                      >
                        <span className="stf-small">
                          <FileText size={12} /> {deck.file_name || deck.file_ref || `#${deck.id}`} · {deck.status}
                        </span>
                        {deck.status !== "published" && (
                          <AppButton
                            variant="secondary"
                            size="sm"
                            onClick={() => publishDeck(deck)}
                            disabled={actionBusy === `pub-${deck.id}`}
                          >
                            {t("investorAdmin.dealFlow.publishDeck")}
                          </AppButton>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
