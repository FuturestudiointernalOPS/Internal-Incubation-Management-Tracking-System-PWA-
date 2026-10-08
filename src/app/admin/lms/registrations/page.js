"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import LmsRegistrationsView from "@/components/admin/lms/registrations/LmsRegistrationsView";

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
    <LmsRegistrationsView
      t={t}
      data={data}
      stats={stats}
      registrations={registrations}
      events={events}
      perPage={perPage}
      runs={runs}
      runId={runId}
      setRunId={setRunId}
      status={status}
      setStatus={setStatus}
      access={access}
      setAccess={setAccess}
      email={email}
      setEmail={setEmail}
      review={review}
      setReview={setReview}
      page={page}
      setPage={setPage}
      loading={loading}
      error={error}
      busyId={busyId}
      runAction={runAction}
      reconciling={reconciling}
      onReconcile={handleReconcile}
      onRefresh={load}
      allRuns={allRuns}
      allCourses={allCourses}
      linkRunId={linkRunId}
      setLinkRunId={setLinkRunId}
      linkCourseId={linkCourseId}
      setLinkCourseId={setLinkCourseId}
      linking={linking}
      linkNotice={linkNotice}
      onLinkRun={handleLinkRun}
    />
  );
}
