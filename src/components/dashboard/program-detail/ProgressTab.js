"use client";

import { Target, Users, FileText, BarChart3 } from "lucide-react";
import SubmissionVersionHistory from "../SubmissionVersionHistory";

/** The Progress tab body: the metric tiles, the submission history and the follow-ups. */
export default function ProgressTab({ metrics, user, programId, followups, t }) {
  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-[var(--brand-orange)]" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {metrics.percentComplete}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("participant.programCompletion")}
          </p>
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
              style={{ width: `${Math.min(metrics.percentComplete, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {metrics.attendanceRate}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("participant.attendance")}
          </p>
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${Math.min(metrics.attendanceRate, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {metrics.kpiCompletion}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("participant.kpiAchievement")}
          </p>
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400 transition-all"
              style={{ width: `${Math.min(metrics.kpiCompletion, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {metrics.completedDeliverables}/{metrics.totalDeliverables}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("participant.deliverablesDone")}
          </p>
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-400 transition-all"
              style={{
                width: `${metrics.totalDeliverables > 0 ? Math.min((metrics.completedDeliverables / metrics.totalDeliverables) * 100, 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Submissions — Version History */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
          {t("participant.submissionHistory")}
        </h3>
        <SubmissionVersionHistory
          participantId={user?.cid || user?.id}
          programId={programId}
        />
      </div>

      {/* Follow-ups */}
      {followups.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
            {t("participant.followUps")}
          </h3>
          <div className="space-y-2">
            {followups.slice(0, 5).map((followup) => (
              <div
                key={followup.id}
                className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
              >
                <p className="text-[11px] font-bold text-[var(--text-primary)]">
                  {t("participant.week")} {followup.week_number}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {followup.comment}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
