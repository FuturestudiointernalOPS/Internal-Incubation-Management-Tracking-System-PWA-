"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, RefreshCw, ShieldOff } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";

/**
 * ORPHANED PROGRAM LEARNING — the team control.
 *
 * Lists the course enrollments that still grant access through a program while
 * that program no longer holds the person: access left behind by an older
 * removal, a deleted program, or a membership recorded under another identity.
 * Suspending is reversible in the records (progress and history stay) and stops
 * the course from appearing in My Learning.
 */
export default function OrphanLearningPanel() {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/lms/orphan-enrollments");
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "errors.somethingWrong");
      setEnrollments(payload.enrollments || []);
    } catch (loadError) {
      setError(loadError.message || "errors.somethingWrong");
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const suspend = async (ids) => {
    if (ids.length === 0) return;
    const confirmed = await confirm({
      message: t("lms.registrations.orphanConfirm", { count: ids.length }),
      tone: "danger",
      confirmLabel: t("lms.registrations.orphanSuspend"),
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/lms/orphan-enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "errors.somethingWrong");
      await load();
    } catch (suspendError) {
      setError(suspendError.message || "errors.somethingWrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppCard>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <GraduationCap className="w-4 h-4 text-[var(--brand-orange)]" />
            {t("lms.registrations.orphanTitle")}
            <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {loading ? t("common.loading") : enrollments.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {t("lms.registrations.orphanSubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AppButton icon={RefreshCw} variant="secondary" onClick={load} disabled={loading || busy}>
            {t("common.retry")}
          </AppButton>
          {enrollments.length > 0 && (
            <AppButton
              icon={ShieldOff}
              variant="danger"
              disabled={busy}
              onClick={() => suspend(enrollments.map((enrollment) => enrollment.id))}
            >
              {t("lms.registrations.orphanSuspendAll")}
            </AppButton>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs font-bold" style={{ color: "var(--chart-danger)" }}>
          {t(error) || t("errors.somethingWrong")}
        </p>
      )}

      {!loading && enrollments.length === 0 && !error && (
        <p className="mt-4 text-xs text-[var(--text-secondary)]">
          {t("lms.registrations.orphanEmpty")}
        </p>
      )}

      {enrollments.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                <th className="py-2 pr-3">{t("lms.registrations.orphanColPerson")}</th>
                <th className="py-2 pr-3">{t("lms.registrations.orphanColCourse")}</th>
                <th className="py-2 pr-3">{t("lms.registrations.orphanColProgram")}</th>
                <th className="py-2 text-right">{t("lms.registrations.orphanColAction")}</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <tr
                  key={enrollment.id}
                  className="border-t border-[var(--border-primary)] align-top"
                >
                  <td className="py-2 pr-3">
                    <p className="font-bold text-[var(--text-primary)]">
                      {enrollment.user_name || enrollment.user_cid}
                    </p>
                    {enrollment.user_email && (
                      <p className="text-[var(--text-secondary)]">{enrollment.user_email}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-primary)]">
                    {enrollment.course_title || enrollment.course_id}
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-secondary)]">
                    {enrollment.program_name || enrollment.program_id || t("lms.registrations.orphanNoProgram")}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => suspend([enrollment.id])}
                      className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline disabled:opacity-50"
                    >
                      {t("lms.registrations.orphanSuspend")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppCard>
  );
}
