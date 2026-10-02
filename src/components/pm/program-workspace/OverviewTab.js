import { useI18n } from "@/lib/i18n";
import { Activity, Copy, ExternalLink, Target, Users } from "lucide-react";
import { ProgramProgressPanel } from "@/components/pm/ProgramProgressPanel";

export default function OverviewTab({
  assignedStaff,
  families,
  onCopyRegFormLink,
  participants,
  program,
  regForm,
  reports,
  requirements,
  sessions,
  submissions,
  teams,
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="mb-6">
        <ProgramProgressPanel
          program={program}
          sessions={sessions}
          requirements={requirements}
          reports={reports}
          submissions={submissions}
          participants={participants}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card space-y-4 border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">{participants.length}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("pmMisc.workspace.overviewTotalParticipants")}
            </p>
            <p className="text-[10px] text-emerald-500 font-bold mt-1">
              {sessions.length}{" "}
              {t(
                sessions.length !== 1
                  ? "pmMisc.workspace.sessions"
                  : "pmMisc.workspace.session",
              )}{" "}
              ·{" "}
              {t("pmMisc.workspace.weekProgram", {
                weeks: program?.duration_weeks || "?",
              })}
            </p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2 leading-relaxed">
              {t("pmMisc.workspace.overviewParticipantsDesc")}
            </p>
          </div>
        </div>

        <div className="card space-y-4 border-l-4 border-orange-500">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
              <Activity className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">{submissions.length}</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">
              {t("pmMisc.workspace.overviewOperationalSubmissions")}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {t("pmMisc.workspace.overviewCompletionRate")}{" "}
              {participants.length > 0 && requirements.length > 0
                ? Math.round(
                    (submissions.length /
                      (participants.length * requirements.length)) *
                      100,
                  )
                : 0}
              %
            </p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2 leading-relaxed">
              {t("pmMisc.workspace.overviewSubmissionsDesc")}
            </p>
          </div>
        </div>

        <div className="card space-y-4 border-l-4 border-purple-500">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
              <Target className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">{teams.length}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("pmMisc.workspace.overviewActiveStudentGroups")}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {assignedStaff.length} {t("pmMisc.workspace.staff")} ·{" "}
              {reports.length}{" "}
              {t(
                reports.length !== 1
                  ? "pmMisc.workspace.reports"
                  : "pmMisc.workspace.report",
              )}
            </p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2 leading-relaxed">
              {t("pmMisc.workspace.overviewGroupsDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* REGISTRATION - assigned Form link (Form is the participant intake point) */}
      {families.length > 0 && families[0] && (
        <div className="card mt-6 border-l-4 border-emerald-500">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <p className="text-xs font-black uppercase text-[var(--text-secondary)] tracking-wider">
                {t("pmMisc.workspace.registrationLink")}
              </p>
              {regForm ? (
                <>
                  <p className="text-[10px] font-medium text-emerald-500 mt-1">
                    {t("pmMisc.workspace.assignedRegistrationForm")}:{" "}
                    <strong className="uppercase">{regForm.name}</strong>
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <code
                      className="text-[10px] font-mono bg-black/30 px-3 py-2 rounded-lg border border-[var(--border-primary)] truncate max-w-[450px] block"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {regForm.link}
                    </code>
                    <button
                      onClick={onCopyRegFormLink}
                      className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                      title={t("pmMisc.workspace.copyRegistrationLink")}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={regForm.link}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20"
                      title={t("pmMisc.workspace.openForm")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </>
              ) : (
                <div className="space-y-2 mt-2">
                  <p className="text-[10px] font-black uppercase text-amber-400">
                    {t("pmMisc.workspace.noFormYet")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.noFormYetHint")}
                  </p>
                  <a
                    href="/platform/runs"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20 text-[10px] font-bold uppercase tracking-wide"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />{" "}
                    {t("pmMisc.workspace.goToCrmForms")}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
