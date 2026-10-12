"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { defer } from "@/components/permissions/effectUtils";

/**
 * PHASE C — the "Profiles" control of the Person Access screen.
 *
 * ONE bar, three controls on the same line, and one connected detail below:
 *
 *   [ pick a profile ▾ ]   [ Profiles held ]   [ Replace access profile ]
 *
 *   • picking a profile shows WHAT THAT PROFILE OPENS (its eligibility, i.e.
 *     the sections an administrator may grant through it) — read-only;
 *   • "Profiles held" switches the same detail to the person's ASSIGNMENT
 *     HISTORY (period, context, source, status), where a period can be closed;
 *   • "Replace access profile" opens the ACCESS-PROFILE override dialog (owned
 *     by the editor, which holds that flow's state) — a different thing from
 *     the profiles held here, and named so on purpose.
 *
 * The registry DESCRIBES assignments; it does not decide access. A profile's
 * "permissions" here are ELIGIBILITY (which sections it may open), never a
 * grant — the hint says so, because a reader must not expect an immediate
 * effect.
 *
 * It runs its own reads (the person's assignments + the catalogue + the
 * eligibility configuration) and asks the parent to open the override dialog
 * through `onReplaceProfile`, so it adds no value to the screen's ctx contract.
 */

const STATUS_CLASS = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  ended: "bg-secondary text-[var(--text-secondary)] border-[var(--border-primary)]",
  revoked: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_LABEL_KEY = {
  active: "engineering.permissions.profileAssignmentsStatusActive",
  ended: "engineering.permissions.profileAssignmentsStatusEnded",
  revoked: "engineering.permissions.profileAssignmentsStatusRevoked",
};

const SOURCE_LABEL_KEY = {
  manual: "engineering.permissions.profileAssignmentsSourceManual",
  automatic: "engineering.permissions.profileAssignmentsSourceAutomatic",
};

export default function ProfileAssignmentsSection({ cid, onReplaceProfile = null }) {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();
  const [data, setData] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // Which detail the bar shows: the history of held profiles, or the
  // permissions of the profile currently picked in the selector.
  const [view, setView] = useState("held");
  const [picked, setPicked] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!cid) return;
    try {
      const res = await fetch(
        `/api/engineering/permissions/profile-assignments?cid=${encodeURIComponent(cid)}`,
      );
      const json = await res.json();
      if (json.success) setData(json);
      else setErr(json.error || t("engineering.permissions.profileAssignmentsLoadFailed"));
    } catch {
      setErr(t("engineering.permissions.profileAssignmentsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [cid, t]);

  // The eligibility configuration answers "what does this profile open?" — the
  // same rows the engine enforces, read here (never a fabricated preview).
  const loadEligibility = useCallback(async () => {
    try {
      const res = await fetch("/api/engineering/permissions/eligibility");
      const json = await res.json();
      if (json.success) setEligibility(json);
    } catch {
      /* the permissions view states it has no answer rather than guessing */
    }
  }, []);

  useEffect(() => {
    defer(() => load());
    defer(() => loadEligibility());
  }, [load, loadEligibility]);

  const assign = async () => {
    if (!picked) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/engineering/permissions/profile-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, profile_key: picked, reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || t("engineering.permissions.profileAssignmentsAssignFailed"));
      setMsg(t("engineering.permissions.profileAssignmentsAssigned"));
      setReason("");
      await load();
    } catch (error) {
      setErr(error.message || t("engineering.permissions.profileAssignmentsAssignFailed"));
    } finally {
      setBusy(false);
    }
  };

  const close = async (row) => {
    const accepted = await confirm({
      message: t("engineering.permissions.profileAssignmentsCloseConfirm"),
      tone: "danger",
      confirmLabel: t("engineering.permissions.profileAssignmentsClose"),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    setBusyId(row.id);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/engineering/permissions/profile-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, action: "close" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || t("engineering.permissions.profileAssignmentsCloseFailed"));
      setMsg(t("engineering.permissions.profileAssignmentsClosed"));
      await load();
    } catch (error) {
      setErr(error.message || t("engineering.permissions.profileAssignmentsCloseFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (value) =>
    value ? new Date(value).toLocaleDateString(lang) : null;

  const profileLabel = (row) =>
    row.label_key ? t(row.label_key) : String(row.key).replace(/_/g, " ");

  const contextLabel = (context) =>
    t(`engineering.permissions.contextRolesContexts.${context}`);

  const featureLabel = (feature) => {
    const key = `engineering.permissions.features.${feature}`;
    const value = t(key);
    return value && value !== key ? value : String(feature).replace(/_/g, " ");
  };

  const periodOf = (row) => {
    const start = fmtDate(row.started_at);
    const end = row.ends_at
      ? fmtDate(row.ends_at)
      : t("engineering.permissions.profileAssignmentsOpenEnded");
    return `${start} → ${end}`;
  };

  const profiles = (data?.profiles || []).filter((profile) => Number(profile.is_active) === 1);
  const assignments = data?.assignments || [];

  const labelFor = (key) => {
    const definition = profiles.find((profile) => profile.key === key);
    return definition ? profileLabel(definition) : String(key).replace(/_/g, " ");
  };

  const selectedDef = profiles.find((profile) => profile.key === picked) || null;
  // Status as the registry reports it (the same value the history table shows).
  const activeForSelected = assignments.find(
    (row) => row.profile_key === picked && row.status === "active",
  );

  // The sections this profile MAY open — eligibility only, never a grant.
  const eligibleFeatures = useMemo(() => {
    if (!picked || !eligibility) return [];
    const set = new Set();
    for (const row of eligibility.rows || []) {
      if (
        row.identity_type === "profile" &&
        row.identity_value === picked &&
        Number(row.eligible) === 1
      ) {
        set.add(row.feature_key);
      }
    }
    return [...set].sort();
  }, [picked, eligibility]);

  return (
    <div className="ios-card !p-5 border-[var(--border-primary)] space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[var(--brand-orange)]" />
          <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
            {t("engineering.permissions.profilePanelTitle")}
          </h4>
        </div>
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.profilePanelHint")}
        </p>
      </div>

      {/* The bar: three controls, one line. */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={picked}
          onChange={(event) => {
            setPicked(event.target.value);
            setView("profile");
            setErr("");
            setMsg("");
          }}
          aria-label={t("engineering.permissions.profileAssignmentsSelectProfile")}
          className="flex-1 min-w-[220px] bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
        >
          <option value="">
            {t("engineering.permissions.profileAssignmentsSelectProfile")}
          </option>
          {profiles.map((profile) => (
            <option key={profile.key} value={profile.key}>
              {profileLabel(profile)}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={view === "held"}
          onClick={() => setView("held")}
          className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${
            view === "held"
              ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]"
              : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {t("engineering.permissions.profileAssignmentsTitle")}
        </button>

        {onReplaceProfile && (
          <button
            type="button"
            onClick={onReplaceProfile}
            className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t("engineering.permissions.assignProfile")}
          </button>
        )}
      </div>

      {err && <p className="text-[10px] font-bold text-red-400">{err}</p>}
      {msg && <p className="text-[10px] font-bold text-emerald-400">{msg}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : view === "profile" ? (
        /* ── Permissions of the picked profile (eligibility) ─────────────── */
        <div className="space-y-3">
          {!selectedDef ? (
            <p className="text-[10px] font-bold text-[var(--text-secondary)]">
              {t("engineering.permissions.profilePanelSelectPrompt")}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-[var(--text-primary)]">
                  {profileLabel(selectedDef)}
                </span>
                <span className="px-1.5 py-0.5 rounded border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {contextLabel(selectedDef.context)}
                </span>
                {activeForSelected && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    {t("engineering.permissions.profileAssignmentsStatusActive")}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.profilePanelPermissionsTitle")}
                </p>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
                  {t("engineering.permissions.profilePanelPermissionsHint")}
                </p>
                {eligibleFeatures.length === 0 ? (
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.profilePanelPermissionsEmpty")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {eligibleFeatures.map((feature) => (
                      <span
                        key={feature}
                        className="px-2 py-0.5 rounded-md border border-[var(--border-primary)] bg-secondary/40 text-[10px] font-bold text-[var(--text-primary)]"
                      >
                        {featureLabel(feature)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Attribute this profile to the person — the same write as before,
                  offered from where the profile is being examined. */}
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("engineering.permissions.profilesReasonPlaceholder")}
                  className="flex-1 min-w-[220px] bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
                />
                <button
                  onClick={assign}
                  disabled={!picked || busy || Boolean(activeForSelected)}
                  className="px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {busy
                    ? t("engineering.permissions.profileAssignmentsAssigning")
                    : t("engineering.permissions.profileAssignmentsAssign")}
                </button>
              </div>
            </>
          )}
        </div>
      ) : /* ── History of held profiles ──────────────────────────────────── */
      assignments.length === 0 ? (
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.profileAssignmentsEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                {[
                  "profileAssignmentsProfile",
                  "profileAssignmentsContext",
                  "profileAssignmentsPeriod",
                  "profileAssignmentsSource",
                  "profileAssignmentsStatus",
                ].map((key) => (
                  <th
                    key={key}
                    className="p-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]"
                  >
                    {t(`engineering.permissions.${key}`)}
                  </th>
                ))}
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((row) => (
                <tr key={row.id} className="border-b border-divider/50">
                  <td className="p-2 text-xs font-bold text-[var(--text-primary)]">
                    {labelFor(row.profile_key)}
                  </td>
                  <td className="p-2 text-xs text-[var(--text-secondary)]">
                    {contextLabel(row.context_type)}
                    {row.context_id ? ` · ${row.context_id}` : ""}
                  </td>
                  <td className="p-2 text-xs text-[var(--text-secondary)]">
                    {periodOf(row)}
                  </td>
                  <td className="p-2 text-xs text-[var(--text-secondary)]">
                    {t(SOURCE_LABEL_KEY[row.source] || SOURCE_LABEL_KEY.manual)}
                  </td>
                  <td className="p-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                        STATUS_CLASS[row.status] || STATUS_CLASS.ended
                      }`}
                    >
                      {t(STATUS_LABEL_KEY[row.status] || STATUS_LABEL_KEY.ended)}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    {row.status === "active" && (
                      <button
                        onClick={() => close(row)}
                        disabled={busyId === row.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                        {busyId === row.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {t("engineering.permissions.profileAssignmentsClose")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
