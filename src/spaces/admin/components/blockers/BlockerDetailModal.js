import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatSeverity, getSeverityBg, getSeverityColor } from "./severity";

export default function BlockerDetailModal({
  viewingBlocker,
  setViewingBlocker,
  getTaskTitle,
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setViewingBlocker(null)}
      />
      <div className="relative bg-secondary border border-[var(--border-primary)] rounded-2xl w-full max-w-lg p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
            {t("adminMisc.blockers.detailsTitle")}
          </h3>
          <button
            onClick={() => setViewingBlocker(null)}
            className="p-2 rounded-lg hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("adminMisc.blockers.title")}
            </p>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {viewingBlocker.title}
            </p>
          </div>

          {viewingBlocker.description && (
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("adminMisc.blockers.description")}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {viewingBlocker.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("adminMisc.blockers.owner")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {viewingBlocker.user_name || viewingBlocker.user_id || t("adminMisc.blockers.unknown")}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("adminMisc.blockers.linkedTask")}
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: "var(--chart-info)" }}
              >
                {getTaskTitle(viewingBlocker.task_id)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("adminMisc.blockers.severity")}
              </p>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getSeverityBg(viewingBlocker.severity)} ${getSeverityColor(viewingBlocker.severity)}`}
              >
                {formatSeverity(viewingBlocker.severity, t)}
              </span>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("adminMisc.blockers.status")}
              </p>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                  viewingBlocker.status === "active"
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {viewingBlocker.status === "active"
                  ? t("status.active")
                  : t("status.resolved")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("time.created")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {new Date(viewingBlocker.created_at).toLocaleDateString()}
              </p>
            </div>
            {viewingBlocker.resolved_at && (
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("adminMisc.blockers.resolvedAt")}
                </p>
                <p className="text-sm font-bold text-emerald-500">
                  {new Date(
                    viewingBlocker.resolved_at,
                  ).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[var(--border-primary)] bg-amber-500/5 p-4 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
              {t("adminMisc.blockers.superAdminNotice")}
            </p>
            <p
              className="text-[10px] font-medium mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("adminMisc.blockers.resolutionNoticePrefix")}{" "}
              <span className="font-bold text-[var(--text-primary)]">
                {viewingBlocker.user_name ||
                  t("adminMisc.blockers.theBlockerCreator")}
              </span>{" "}
              {t("adminMisc.blockers.resolutionNoticeSuffix")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
