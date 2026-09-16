"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LifeBuoy,
  Clock,
  Check,
  X as XIcon,
  CheckCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";

/**
 * COACHING REQUESTS (Phase 8 — Program Manager experience)
 *
 * The queue of learner requests raised from the participant LMS view ("I need
 * coaching before / during / after this course"). The panel lists the program's
 * requests and records the decision — accept, decline or complete — with an
 * optional note the learner sees on their own surface.
 *
 * Authorization: reads require `lms.view`, decisions require `lms.view` too
 * (Program Manager profile holds it); `canEdit` only hides the actions.
 */

const STATUS_STYLES = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  accepted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  declined: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const DECISIONS = [
  { status: "accepted", icon: Check, key: "accept" },
  { status: "completed", icon: CheckCheck, key: "complete" },
  { status: "declined", icon: XIcon, key: "decline" },
];

export default function CoachingRequestsPanel({ programId, canEdit = false }) {
  const { t } = useI18n();
  const [requests, setRequests] = useState(null);
  const [open, setOpen] = useState(true);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!programId) return;
    setRequests(null);
    try {
      const res = await fetch(
        `/api/lms/coaching-requests?program_id=${encodeURIComponent(programId)}`,
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.loadFailed");
      setRequests(data.requests || []);
    } catch (e) {
      notify("error", e.message || "lms.errors.loadFailed");
      setRequests([]);
    }
  }, [programId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const submitDecision = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lms/coaching-requests/${decision.request.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decision.status,
          response_note: note || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.coaching.updated");
      setDecision(null);
      setNote("");
      fetchRequests();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = (requests || []).filter((r) => r.status === "pending").length;

  return (
    <div className="card border border-[var(--border-primary)] !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <LifeBuoy className="w-4 h-4 text-indigo-400" />
          </div>
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--text-primary)" }}
          >
            {t("lms.coaching.panelTitle")}
          </span>
          {pendingCount > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25">
              {t("lms.coaching.pendingCount", { n: pendingCount })}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2">
          {requests === null ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <p
              className="text-[9px] font-bold uppercase tracking-widest text-center py-6"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("lms.coaching.empty")}
            </p>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="p-3 rounded-xl border"
                style={{ borderColor: "var(--border-primary)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-black uppercase tracking-tight truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {request.learner_name}
                    </p>
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest mt-0.5 truncate"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {request.course_title || request.course_id}
                      {request.lesson_title ? ` · ${request.lesson_title}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      {t(`lms.coaching.timing.${request.timing}`)}
                    </span>
                    <span
                      className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                        STATUS_STYLES[request.status] || STATUS_STYLES.pending
                      }`}
                    >
                      {t(`lms.coaching.status.${request.status}`)}
                    </span>
                  </div>
                </div>

                {(request.topic || request.message) && (
                  <p
                    className="text-[10px] mt-2 leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {request.topic && (
                      <span className="font-black">{request.topic} — </span>
                    )}
                    {request.message}
                  </p>
                )}

                {request.response_note && (
                  <p className="text-[10px] mt-1 italic text-emerald-500">
                    {request.response_note}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 mt-2">
                  <span
                    className="text-[8px] font-bold uppercase tracking-widest flex items-center gap-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <Clock className="w-3 h-3" />
                    {request.created_at
                      ? new Date(request.created_at).toLocaleDateString()
                      : ""}
                  </span>
                  {canEdit && (request.status === "pending" || request.status === "accepted") && (
                    <div className="flex items-center gap-1">
                      {DECISIONS.map(({ status, icon: Icon, key }) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setDecision({ request, status });
                            setNote(request.response_note || "");
                          }}
                          title={t(`lms.coaching.${key}`)}
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border flex items-center gap-1 ${
                            STATUS_STYLES[status]
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {t(`lms.coaching.${key}`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AppModal
        isOpen={!!decision}
        onClose={() => setDecision(null)}
        title={t("lms.coaching.decisionTitle")}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            {decision?.request?.learner_name} · {decision?.request?.course_title}
          </p>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("lms.coaching.notePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border text-xs"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setDecision(null)}>
              {t("common.cancel")}
            </AppButton>
            <AppButton variant="primary" loading={saving} onClick={submitDecision}>
              {t("lms.coaching.confirm")}
            </AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
