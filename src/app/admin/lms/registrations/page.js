"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, GraduationCap, Link2, Loader2, Mail, ReceiptText, RefreshCw, RotateCcw, Undo2, UserX, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppCard from "@/components/ui/AppCard";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";

const TONES = {
  ok: "bg-emerald-500/10 text-emerald-500",
  warn: "bg-amber-500/10 text-amber-500",
  bad: "bg-rose-500/10 text-rose-500",
  idle: "bg-[var(--surface-3)] text-[var(--text-secondary)]",
};

const PAYMENT_TONES = { paid: "ok", pending: "warn", failed: "bad", cancelled: "idle", refunded: "idle" };
const ACCESS_TONES = { granted: "ok", pending: "warn", failed: "bad", revoked: "idle" };
const EMAIL_TONES = { sent: "ok", pending: "warn", failed: "bad" };

const capitalize = (value) => `${String(value || "").charAt(0).toUpperCase()}${String(value || "").slice(1)}`;

function StateBadge({ tone, label }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${TONES[tone] || TONES.idle}`}
    >
      {label}
    </span>
  );
}

/**
 * ADMIN — LMS REGISTRATIONS (the team view)
 *
 * The whole chain per Execution: who registered, who paid, who has access, who
 * got the email — plus the LAST PAYMENT EVENT, which is what used to be
 * invisible (a refused amount, an unknown reference, a success we could not
 * verify).
 *
 * Counters are aggregated in the database and the list is paginated; the
 * "à examiner" filter is the queue that must never grow silently. The server
 * enforces lms.view / lms.edit on every call.
 */
export default function LmsRegistrationsPage() {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();

  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("");
  const [access, setAccess] = useState("");
  const [email, setEmail] = useState("");
  const [review, setReview] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState(null);

  // ─── Attaching a course to an Execution ───
  const [allRuns, setAllRuns] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [linkRunId, setLinkRunId] = useState("");
  const [linkCourseId, setLinkCourseId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkNotice, setLinkNotice] = useState(null);

  useEffect(() => {
    fetch("/api/platform/form-runs?per_page=200")
      .then((response) => response.json())
      .then((payload) => setAllRuns(payload.success ? payload.runs || [] : []))
      .catch(() => setAllRuns([]));
    fetch("/api/lms/courses")
      .then((response) => response.json())
      .then((payload) => setAllCourses(payload.success ? payload.courses || [] : []))
      .catch(() => setAllCourses([]));
  }, []);

  const handleLinkRun = async () => {
    if (!linkRunId) return;
    setLinking(true);
    setLinkNotice(null);
    try {
      const response = await fetch("/api/lms/registrations?action=link-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: Number(linkRunId),
          courseId: linkCourseId && linkCourseId !== "none" ? linkCourseId : null,
        }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "lms.registrations.linkFailed");
      setLinkNotice(
        t(linkCourseId && linkCourseId !== "none" ? "lms.registrations.linkDone" : "lms.registrations.unlinkDone"),
      );
      await load();
    } catch (linkError) {
      await alert({ message: t(linkError.message) || t("lms.registrations.linkFailed"), tone: "danger" });
    } finally {
      setLinking(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (runId) params.set("runId", runId);
      if (status) params.set("status", status);
      if (access) params.set("access", access);
      if (email) params.set("email", email);
      if (review) params.set("review", "1");
      params.set("page", String(page));
      params.set("events", "1");
      params.set("runs", "1");

      const response = await fetch(`/api/lms/registrations?${params.toString()}`);
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "lms.registrations.loadFailed");
      setData(payload);
      if (payload.runs) setRuns(payload.runs);
    } catch (loadError) {
      setError(t(loadError.message) || t("lms.registrations.loadFailed"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [runId, status, access, email, review, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (registration, action) => {
    if (action === "refund") {
      const confirmed = await confirm({ message: t("lms.registrations.confirmRefund"), tone: "danger" });
      if (!confirmed) return;
    }
    if (action === "revoke-access") {
      const confirmed = await confirm({ message: t("lms.registrations.confirmRevokeAccess"), tone: "danger" });
      if (!confirmed) return;
    }
    setBusyId(registration.id);
    try {
      const response = await fetch(`/api/lms/registrations/${registration.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "lms.registrations.actionFailed");

      if (action === "refund") {
        await alert({ message: t("lms.registrations.refunded") });
      } else if (action === "revoke-access") {
        await alert({ message: t("lms.registrations.accessRemoved") });
      } else if (payload.email_sent === false) {
        await alert({ message: t("lms.registrations.resendFailed"), tone: "danger" });
      } else {
        await alert({ message: t("lms.registrations.resendDone") });
      }
      await load();
    } catch (actionError) {
      await alert({ message: t(actionError.message) || t("lms.registrations.actionFailed"), tone: "danger" });
    } finally {
      setBusyId(null);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const response = await fetch("/api/lms/registrations?action=reconcile", { method: "POST" });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "lms.registrations.actionFailed");
      await alert({
        message: t("lms.registrations.reconcileDone", {
          recovered: payload.summary?.recovered ?? 0,
          access: payload.summary?.accessGranted ?? 0,
        }),
      });
      await load();
    } catch (reconcileError) {
      await alert({ message: t(reconcileError.message) || t("lms.registrations.actionFailed"), tone: "danger" });
    } finally {
      setReconciling(false);
    }
  };

  const stats = data?.stats;
  const registrations = data?.registrations || [];
  const events = data?.events || [];
  const perPage = data?.per_page || 50;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--brand-orange)", color: "#000" }}
          >
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">{t("lms.registrations.title")}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              {t("lms.registrations.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AppButton variant="secondary" icon={RotateCcw} loading={reconciling} onClick={handleReconcile}>
            {t("lms.registrations.reconcile")}
          </AppButton>
          <AppButton variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>
            {t("lms.registrations.refresh")}
          </AppButton>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: t("lms.registrations.statRegistered"), value: stats.registered },
            { label: t("lms.registrations.statPaid"), value: stats.paid },
            { label: t("lms.registrations.statPending"), value: stats.pending },
            { label: t("lms.registrations.statFailed"), value: stats.failed },
            { label: t("lms.registrations.statAccessGranted"), value: stats.accessGranted },
            { label: t("lms.registrations.statAccessFailed"), value: stats.accessFailed },
          ].map((entry) => (
            <AppCard key={entry.label} padding="sm">
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {entry.label}
              </p>
              <p className="text-xl font-black mt-1">{entry.value}</p>
            </AppCard>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AppSelect
          label={t("lms.registrations.filterRun")}
          placeholder={t("lms.registrations.allRuns")}
          value={runId}
          onChange={(event) => {
            setRunId(event.target.value);
            setPage(1);
          }}
          options={runs
            .filter((entry) => entry.run_id)
            .map((entry) => ({
              value: String(entry.run_id),
              label: `${t("lms.registrations.runLabel", { id: entry.run_id })} · ${entry.total}`,
            }))}
        />
        <AppSelect
          label={t("lms.registrations.filterStatus")}
          placeholder={t("lms.registrations.allStatuses")}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          options={[
            { value: "pending", label: t("lms.registrations.paymentPending") },
            { value: "paid", label: t("lms.registrations.paymentPaid") },
            { value: "failed", label: t("lms.registrations.paymentFailed") },
            { value: "cancelled", label: t("lms.registrations.paymentCancelled") },
            { value: "refunded", label: t("lms.registrations.paymentRefunded") },
          ]}
        />
        <AppSelect
          label={t("lms.registrations.filterAccess")}
          placeholder={t("lms.registrations.allAccess")}
          value={access}
          onChange={(event) => {
            setAccess(event.target.value);
            setPage(1);
          }}
          options={[
            { value: "granted", label: t("lms.registrations.accessGranted") },
            { value: "pending", label: t("lms.registrations.accessPending") },
            { value: "failed", label: t("lms.registrations.accessFailed") },
            { value: "revoked", label: t("lms.registrations.accessRevoked") },
          ]}
        />
        <AppSelect
          label={t("lms.registrations.filterEmail")}
          placeholder={t("lms.registrations.allEmails")}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setPage(1);
          }}
          options={[
            { value: "sent", label: t("lms.registrations.emailSent") },
            { value: "pending", label: t("lms.registrations.emailPending") },
            { value: "failed", label: t("lms.registrations.emailFailed") },
          ]}
        />
      </div>

      <div className="flex items-center gap-3">
        <AppButton
          variant={review ? "primary" : "secondary"}
          icon={AlertTriangle}
          onClick={() => {
            setReview((value) => !value);
            setPage(1);
          }}
        >
          {t("lms.registrations.reviewOnly")}
        </AppButton>
      </div>

      {/* Attaching a course turns an Execution into a paid checkout. */}
      <AppCard>
        <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: "var(--border-primary)" }}>
          <GraduationCap className="w-4 h-4" style={{ color: "var(--brand-orange)" }} />
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest">{t("lms.registrations.linkTitle")}</h2>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.registrations.linkHint")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <AppSelect
            label={t("lms.registrations.linkRun")}
            placeholder={t("lms.registrations.linkRunPlaceholder")}
            value={linkRunId}
            onChange={(event) => setLinkRunId(event.target.value)}
            options={allRuns.map((run) => ({
              value: String(run.id),
              label: `${run.name || run.form_name || "Run"} · #${run.id}`,
            }))}
          />
          <AppSelect
            label={t("lms.registrations.linkCourse")}
            placeholder={t("lms.registrations.linkCoursePlaceholder")}
            value={linkCourseId}
            onChange={(event) => setLinkCourseId(event.target.value)}
            options={[
              { value: "none", label: t("lms.registrations.linkCourseNone") },
              ...allCourses.map((course) => ({
                value: course.id,
                label: course.is_free
                  ? `${course.title} · ${t("lms.public.free")}`
                  : `${course.title} · ${Number(course.price || 0).toLocaleString()}`,
              })),
            ]}
          />
          <div className="flex items-end">
            <AppButton icon={Link2} loading={linking} disabled={!linkRunId} onClick={handleLinkRun} className="w-full">
              {t("lms.registrations.linkAction")}
            </AppButton>
          </div>
        </div>

        {linkNotice ? (
          <p className="text-[11px] pt-3" style={{ color: "var(--text-secondary)" }}>
            {linkNotice}
          </p>
        ) : null}
      </AppCard>

      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand-orange)" }} />
        </div>
      ) : error ? (
        <AppCard>
          <p className="text-xs font-bold text-rose-500">{error}</p>
        </AppCard>
      ) : registrations.length === 0 ? (
        <AppCard>
          <AppEmptyState
            icon={Users}
            title={t("lms.registrations.empty")}
            description={t("lms.registrations.emptyDescription")}
          />
        </AppCard>
      ) : (
        <AppCard padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                  <th className="px-3 py-3">{t("lms.registrations.learner")}</th>
                  <th className="px-3 py-3">{t("lms.registrations.reference")}</th>
                  <th className="px-3 py-3">{t("lms.registrations.amount")}</th>
                  <th className="px-3 py-3">{t("lms.registrations.payment")}</th>
                  <th className="px-3 py-3">{t("lms.registrations.access")}</th>
                  <th className="px-3 py-3">{t("lms.registrations.email")}</th>
                  <th className="px-3 py-3">{t("lms.registrations.lastEvent")}</th>
                  <th className="px-3 py-3 text-right">{t("lms.registrations.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => (
                  <tr
                    key={registration.id}
                    className="border-t text-xs align-top"
                    style={{ borderColor: "var(--border-primary)" }}
                  >
                    <td className="px-3 py-3">
                      <p className="font-bold">{registration.full_name}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        {registration.email}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px]">{registration.reference}</td>
                    <td className="px-3 py-3 font-bold">
                      {Number(registration.amount || 0).toLocaleString()} {registration.currency}
                    </td>
                    <td className="px-3 py-3">
                      <StateBadge
                        tone={PAYMENT_TONES[registration.status]}
                        label={t(`lms.registrations.payment${capitalize(registration.status)}`)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <StateBadge
                        tone={ACCESS_TONES[registration.access_status]}
                        label={t(`lms.registrations.access${capitalize(registration.access_status)}`)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <StateBadge
                        tone={EMAIL_TONES[registration.email_status]}
                        label={t(`lms.registrations.email${capitalize(registration.email_status)}`)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {registration.last_event ? (
                        <span
                          className={`text-[10px] font-bold ${
                            registration.last_event.status === "failed"
                              ? "text-rose-500"
                              : registration.last_event.status === "ignored"
                                ? "text-amber-500"
                                : ""
                          }`}
                        >
                          {registration.last_event.message || registration.last_event.status}
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          {t("lms.registrations.noEvent")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <AppButton
                          size="sm"
                          variant="secondary"
                          icon={RotateCcw}
                          disabled={busyId === registration.id || registration.status !== "paid"}
                          onClick={() => runAction(registration, "retry-access")}
                        >
                          {t("lms.registrations.retryAccess")}
                        </AppButton>
                        <AppButton
                          size="sm"
                          variant="secondary"
                          icon={Mail}
                          disabled={busyId === registration.id || registration.status !== "paid"}
                          onClick={() => runAction(registration, "resend-email")}
                        >
                          {t("lms.registrations.resendEmail")}
                        </AppButton>
                        <AppButton
                          size="sm"
                          variant="danger"
                          icon={Undo2}
                          disabled={
                            busyId === registration.id ||
                            registration.status !== "paid" ||
                            !registration.provider_transaction_id
                          }
                          onClick={() => runAction(registration, "refund")}
                        >
                          {t("lms.registrations.refund")}
                        </AppButton>
                        {/* Refunding never removes the access on its own: taking it
                            back is this separate, explicit act, offered for a
                            registration that was refunded and still has access. */}
                        <AppButton
                          size="sm"
                          variant="danger"
                          icon={UserX}
                          disabled={
                            busyId === registration.id ||
                            registration.status !== "refunded" ||
                            registration.access_status !== "granted"
                          }
                          onClick={() => runAction(registration, "revoke-access")}
                        >
                          {t("lms.registrations.revokeAccess")}
                        </AppButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {!review && (
        <div className="flex items-center justify-end gap-2">
          <AppButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            {t("lms.registrations.previousPage")}
          </AppButton>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
            {page}
          </span>
          <AppButton
            variant="secondary"
            size="sm"
            disabled={registrations.length < perPage}
            onClick={() => setPage((value) => value + 1)}
          >
            {t("lms.registrations.nextPage")}
          </AppButton>
        </div>
      )}

      {events.length > 0 && (
        <AppCard>
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: "var(--border-primary)" }}>
            <ReceiptText className="w-4 h-4" style={{ color: "var(--brand-orange)" }} />
            <h2 className="text-[10px] font-black uppercase tracking-widest">{t("lms.registrations.journal")}</h2>
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
            {events.slice(0, 20).map((event) => (
              <li key={event.id} className="py-3 flex items-start justify-between gap-4 text-[11px]">
                <div>
                  <p className="font-bold">
                    {event.reference || "—"}{" "}
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {event.provider_transaction_id ? `· ${event.provider_transaction_id}` : ""}
                    </span>
                  </p>
                  <p style={{ color: "var(--text-secondary)" }}>
                    {event.message || event.status}
                    {event.registration_id ? "" : ` · ${t("lms.registrations.orphanEvent")}`}
                  </p>
                </div>
                <StateBadge
                  tone={event.status === "failed" ? "bad" : event.status === "ignored" ? "warn" : "ok"}
                  label={event.status}
                />
              </li>
            ))}
          </ul>
        </AppCard>
      )}
    </div>
  );
}
