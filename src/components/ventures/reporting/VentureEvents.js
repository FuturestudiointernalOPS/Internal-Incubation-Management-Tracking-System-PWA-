"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import AppBadge from "@/components/ui/AppBadge";
import SectionHead from "@/components/ui/SectionHead";
import { formatBand } from "./monthlyDisplay";

/**
 * FOUNDER — the Events tab (spec §7) and customer-discovery interviews.
 *
 * The two live together because the stage rules read them together: "3 pilots
 * signed" and "10 interviews" are the same kind of claim, and both need
 * evidence a reviewer can open.
 */

const EVENT_TYPES = [
  "pilot_signed",
  "mvp_launched",
  "pilot_converted",
  "financing_received",
  "new_market",
  "status_change",
];

/** Which fields each event actually asks for. */
const SHOW = {
  pilot_signed: ["customerName", "evidence"],
  mvp_launched: ["evidence"],
  pilot_converted: ["customerName"],
  financing_received: ["amount", "financingType", "source"],
  new_market: ["marketDescription", "evidence"],
  status_change: ["statusTo"],
};

const STATUSES = ["active", "dormant", "terminated", "sold"];
const FINANCING_TYPES = ["grant", "equity", "debt"];

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_EVENT = {
  eventType: "pilot_signed",
  eventDate: today(),
  title: "",
  description: "",
  customerName: "",
  amountMode: "exact",
  amountValue: "",
  amountBand: "",
  financingType: "grant",
  source: "",
  marketDescription: "",
  statusTo: "active",
  evidence: "",
  evidenceName: "",
};

const EMPTY_INTERVIEW = {
  interviewDate: today(),
  customerSegment: "",
  intervieweeName: "",
  notes: "",
  insights: "",
  evidence: "",
  evidenceName: "",
};

/**
 * Evidence: a private document OR an external link.
 *
 * The value stored is one of the two — the upload returns a storage path, the
 * link is kept as typed. `evidenceName` is only a caption for the reviewer.
 */
function EvidencePicker({ value, name, onChange, slot, base, t }) {
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState("");

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFailure("");
    const form = new FormData();
    form.append("file", file);
    form.append("slot", slot);
    const response = await fetch(`${base}/evidence/upload`, { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    setUploading(false);
    if (!response.ok || !payload?.success) {
      setFailure(t("venture.reporting.events.validation.evidence"));
      return;
    }
    onChange({ evidence: payload.path, evidenceName: payload.name });
  };

  return (
    <div className="space-y-2">
      <AppInput
        label={t("venture.reporting.events.field.evidence")}
        placeholder="https://…"
        value={value && /^https?:\/\//i.test(value) ? value : ""}
        onChange={(event) => onChange({ evidence: event.target.value, evidenceName: "" })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
          {uploading ? t("common.loading") : t("venture.reporting.events.evidence.upload")}
          <input type="file" className="hidden" onChange={upload} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" />
        </label>
        {value && !/^https?:\/\//i.test(value) ? (
          <AppBadge variant="success">
            {t("venture.reporting.events.evidence.attached")}
            {name ? ` · ${name}` : ""}
          </AppBadge>
        ) : null}
      </div>
      {failure && <p className="text-xs text-rose-500">{failure}</p>}
    </div>
  );
}

export default function VentureEvents({ ventureId }) {
  const { t, lang } = useI18n();
  const [events, setEvents] = useState([]);
  const [bands, setBands] = useState({ flow: [], cash: [] });
  const [summary, setSummary] = useState({ withEvidence: 0, minimum: 0, met: false });
  const [interviews, setInterviews] = useState([]);

  const [form, setForm] = useState(EMPTY_EVENT);
  const [interview, setInterview] = useState(EMPTY_INTERVIEW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting`;

  const load = useCallback(async () => {
    setLoading(true);
    const [eventsRes, interviewsRes] = await Promise.all([
      api(`${base}/events`),
      api(`${base}/interviews`),
    ]);
    if (eventsRes.ok) {
      setEvents(eventsRes.payload.events || []);
      setBands(eventsRes.payload.bands || { flow: [], cash: [] });
      setSummary(eventsRes.payload.interviews || { withEvidence: 0, minimum: 0, met: false });
    }
    if (interviewsRes.ok) setInterviews(interviewsRes.payload.interviews || []);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const addEvent = async () => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(`${base}/events`, { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setStatus(t("venture.reporting.events.message.added"));
    setForm({ ...EMPTY_EVENT, eventType: form.eventType, eventDate: today() });
    await load();
  };

  /**
   * Open one evidence file. A link opens directly; a private file is exchanged
   * for a short-lived signed URL — never exposed as a public path.
   */
  const openEvidence = async (path) => {
    const result = await api(`${base}/evidence/view?path=${encodeURIComponent(path)}`);
    if (result.ok && result.payload.url) {
      window.open(result.payload.url, "_blank", "noopener,noreferrer");
      return;
    }
    setErrors([result.payload.error || "venture.reporting.evidence.unavailable"]);
  };

  const removeEvent = async (id) => {
    setErrors([]);
    const result = await api(`${base}/events`, { method: "DELETE", body: JSON.stringify({ id }) });
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setStatus(t("venture.reporting.events.message.removed"));
    await load();
  };

  const addInterview = async () => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(`${base}/interviews`, { method: "POST", body: JSON.stringify(interview) });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setStatus(t("venture.reporting.interviews.message.added"));
    setInterview({ ...EMPTY_INTERVIEW });
    await load();
  };

  const visible = SHOW[form.eventType] || [];
  const flowBands = (bands?.flow || []).map((band) => ({
    value: band.code,
    label: formatBand(lang, band),
  }));

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.events.title")}
        subtitle={t("venture.reporting.events.subtitle")}
      />

      {errors.length > 0 && (
        <AppCard padding="normal">
          <ul className="space-y-1 text-xs text-rose-500">
            {errors.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </AppCard>
      )}
      {status && <p className="text-xs font-bold text-emerald-600">{status}</p>}

      <AppCard padding="normal" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <AppSelect
            label={t("venture.reporting.events.field.type")}
            value={form.eventType}
            onChange={set("eventType")}
            options={EVENT_TYPES.map((type) => ({
              value: type,
              label: t(`venture.reporting.events.type.${type}`),
            }))}
          />
          <AppInput
            type="date"
            label={t("venture.reporting.events.field.eventDate")}
            value={form.eventDate}
            onChange={set("eventDate")}
          />
        </div>

        {visible.includes("customerName") && (
          <AppInput
            label={t("venture.reporting.events.field.customerName")}
            value={form.customerName}
            onChange={set("customerName")}
          />
        )}

        {visible.includes("amount") && (
          <div className="grid gap-4 md:grid-cols-2">
            <AppSelect
              label={t("venture.reporting.monthly.mode")}
              value={form.amountMode}
              onChange={set("amountMode")}
              options={[
                { value: "exact", label: t("venture.reporting.mode.exact") },
                { value: "band", label: t("venture.reporting.mode.band") },
              ]}
            />
            {form.amountMode === "band" ? (
              <AppSelect
                label={t("venture.reporting.monthly.band")}
                value={form.amountBand}
                onChange={set("amountBand")}
                options={flowBands}
              />
            ) : (
              <AppInput
                type="number"
                min="0"
                label={t("venture.reporting.monthly.amount")}
                value={form.amountValue}
                onChange={set("amountValue")}
              />
            )}
          </div>
        )}

        {visible.includes("financingType") && (
          <AppSelect
            label={t("venture.reporting.events.field.financingType")}
            value={form.financingType}
            onChange={set("financingType")}
            options={FINANCING_TYPES.map((type) => ({
              value: type,
              label: t(`venture.reporting.events.financing.${type}`),
            }))}
          />
        )}

        {visible.includes("source") && (
          <AppInput
            label={t("venture.reporting.events.field.source")}
            value={form.source}
            onChange={set("source")}
          />
        )}

        {visible.includes("marketDescription") && (
          <AppInput
            label={t("venture.reporting.events.field.marketDescription")}
            value={form.marketDescription}
            onChange={set("marketDescription")}
          />
        )}

        {visible.includes("statusTo") && (
          <AppSelect
            label={t("venture.reporting.events.field.statusTo")}
            value={form.statusTo}
            onChange={set("statusTo")}
            options={STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
          />
        )}

        {visible.includes("evidence") && (
          <EvidencePicker
            value={form.evidence}
            name={form.evidenceName}
            slot={form.eventType}
            base={base}
            t={t}
            onChange={({ evidence, evidenceName }) =>
              setForm((current) => ({ ...current, evidence, evidenceName }))
            }
          />
        )}

        <AppInput
          label={t("venture.reporting.events.field.description")}
          value={form.description}
          onChange={set("description")}
        />

        <AppButton onClick={addEvent} disabled={saving}>
          {t("venture.reporting.events.action.add")}
        </AppButton>
      </AppCard>

      <AppCard padding="normal" className="space-y-3">
        {events.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.events.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-2 last:border-0"
                style={{ borderColor: "var(--border-primary)" }}
              >
                <div className="space-y-1">
                  <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {t(`venture.reporting.events.type.${event.type}`)}
                    {event.customerName ? ` · ${event.customerName}` : ""}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {event.date}
                    {event.amount?.mode === "band" ? ` · ${event.amount.band}` : ""}
                    {event.amount?.mode === "exact" ? ` · ${event.amount.value} CFA` : ""}
                    {event.marketDescription ? ` · ${event.marketDescription}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {event.evidence ? (
                    event.evidenceIsLink ? (
                      <a
                        href={event.evidence}
                        target="_blank"
                        rel="noreferrer"
                        className="stf-link-btn"
                      >
                        {t("venture.reporting.evidence.open")}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="stf-link-btn"
                        onClick={() => openEvidence(event.evidence)}
                      >
                        {t("venture.reporting.evidence.open")}
                      </button>
                    )
                  ) : (
                    <AppBadge>{t("venture.reporting.events.evidence.none")}</AppBadge>
                  )}
                  <AppButton size="sm" variant="danger" onClick={() => removeEvent(event.id)}>
                    {t("venture.reporting.events.action.remove")}
                  </AppButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <SectionHead
        title={t("venture.reporting.interviews.title")}
        subtitle={t("venture.reporting.interviews.subtitle")}
      />

      <AppCard padding="normal" className="space-y-4">
        <p className="text-xs font-bold" style={{ color: summary.met ? "var(--stf-done)" : "var(--text-secondary)" }}>
          {t("venture.reporting.interviews.progress", {
            count: summary.withEvidence,
            minimum: summary.minimum,
          })}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <AppInput
            type="date"
            label={t("venture.reporting.interviews.field.date")}
            value={interview.interviewDate}
            onChange={(event) => setInterview((c) => ({ ...c, interviewDate: event.target.value }))}
          />
          <AppInput
            label={t("venture.reporting.interviews.field.segment")}
            value={interview.customerSegment}
            onChange={(event) => setInterview((c) => ({ ...c, customerSegment: event.target.value }))}
          />
          <AppInput
            label={t("venture.reporting.interviews.field.name")}
            value={interview.intervieweeName}
            onChange={(event) => setInterview((c) => ({ ...c, intervieweeName: event.target.value }))}
          />
          <AppInput
            label={t("venture.reporting.interviews.field.insights")}
            value={interview.insights}
            onChange={(event) => setInterview((c) => ({ ...c, insights: event.target.value }))}
          />
        </div>

        <EvidencePicker
          value={interview.evidence}
          name={interview.evidenceName}
          slot="interview"
          base={base}
          t={t}
          onChange={({ evidence, evidenceName }) =>
            setInterview((c) => ({ ...c, evidence, evidenceName }))
          }
        />

        <AppButton onClick={addInterview} disabled={saving}>
          {t("venture.reporting.interviews.action.add")}
        </AppButton>

        {interviews.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.interviews.empty")}
          </p>
        ) : (
          <ul className="space-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {interviews.map((row) => (
              <li key={row.id}>
                {row.date} · {row.intervieweeName || row.customerSegment || "—"}
                {row.evidence ? ` · ${t("venture.reporting.events.evidence.attached")}` : ""}
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </div>
  );
}
