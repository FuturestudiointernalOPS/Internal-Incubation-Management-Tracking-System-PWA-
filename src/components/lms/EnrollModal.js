"use client";

import { useEffect, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.
const EMPTY_ENROLLMENTS = { list: [], failure: null };

const pickEnrollments = (data) =>
  data?.success
    ? { list: data.enrollments || [], failure: null }
    : { list: [], failure: data?.error || "lms.enroll.loadFailed" };

/**
 * Admin enrollment enabler — list a course's learners and enroll by email/cid.
 * Server-side authorization: lms.edit on the API. A full enrollment
 * management experience belongs to a later phase.
 */
export default function EnrollModal({ isOpen, onClose, courseId }) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [saving, setSaving] = useState(false);

  // The roster is read through the shared hook: addressed on the course, and
  // asked for only while the modal is open. Enrolling re-reads through
  // `refresh`, which bypasses the cache.
  const {
    data,
    loading,
    error: readError,
    refresh: refreshEnrollments,
  } = useApi(isOpen ? `/api/lms/courses/${courseId}/enrollments` : null, {
    defaultValue: EMPTY_ENROLLMENTS,
    transform: pickEnrollments,
    deps: [courseId],
  });
  const enrollments = data.list;

  // A refused payload keeps the server's own key, which is what the toast showed;
  // a request that never answered says so. The loader raised one error toast per
  // failed read, and that is this effect's only job - it writes no state.
  const failure = data.failure || readError || null;
  useEffect(() => {
    if (failure) notify("error", failure);
  }, [failure]);

  const enroll = async () => {
    if (!identifier.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/lms/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          userEmail: identifier.includes("@") ? identifier.trim() : undefined,
          userCid: identifier.includes("@") ? undefined : identifier.trim(),
          source: "admin",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.enroll.userNotFound");
      notify("success", "lms.enroll.enrolled");
      setIdentifier("");
      refreshEnrollments();
    } catch (error) {
      notify("error", error.message || "lms.enroll.userNotFound");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={t("lms.enroll.title")} size="lg">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <AppInput
            className="flex-1"
            label={t("lms.enroll.emailOrCid")}
            icon={UserPlus}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={t("lms.enroll.emailOrCidPlaceholder")}
            onKeyDown={(event) => event.key === "Enter" && enroll()}
          />
          <AppButton className="sm:self-end" variant="primary" icon={Plus} loading={saving} onClick={enroll}>
            {t("lms.enroll.enroll")}
          </AppButton>
        </div>

        <div className="border-t pt-4" style={{ borderColor: "var(--border-primary)" }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : enrollments.length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-center py-6" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.enroll.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center gap-3 p-3 rounded-lg border flex-wrap"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {enrollment.learner?.name || enrollment.user_cid}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {enrollment.learner?.email || enrollment.user_cid} · {t(`lms.status.${enrollment.status}`)?.replace("lms.status.", "") || enrollment.status}
                    </p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--text-tertiary)" }}>
                    {enrollment.source} · {formatDate(enrollment.enrolled_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppModal>
  );
}
