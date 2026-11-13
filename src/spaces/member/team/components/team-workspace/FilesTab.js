"use client";

import AppCard from "@/components/ui/AppCard";
import EmptyState from "./EmptyState";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "./constants";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Globe,
} from "lucide-react";

/**
 * The files tab: the programme's own links, then the files this team has
 * submitted, one row per deliverable that has one.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function FilesTab({ program, submissions, deliverables }) {
  const { t } = useI18n();

  /** The submissions that carry a file, flattened with the deliverable they answer. */
  const submittedFiles = Object.entries(submissions)
    .flatMap(([deliverableId, submissionList]) =>
      (submissionList || [])
        .filter((submission) => submission.file_url)
        .map((submission, index) => ({
          key: `${deliverableId}-${index}`,
          deliverableId,
          submission,
        })),
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
          {t("rootMisc.team.sharedFiles")}
        </h3>
      </div>
      {!program?.resources_link &&
      !program?.pitch_deck_url &&
      !program?.demo_link ? (
        <EmptyState
          icon={<BookOpen className="w-6 h-6 text-[var(--text-tertiary)]" />}
          title={t("rootMisc.team.noFiles")}
          description={t("rootMisc.team.noFilesDesc")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {program?.pitch_deck_url && (
            <AppCard padding="md" hover>
              <a
                href={program.pitch_deck_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {t("rootMisc.team.pitchDeck")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                    {t("rootMisc.team.viewPresentation")}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-auto" />
              </a>
            </AppCard>
          )}
          {program?.demo_link && (
            <AppCard padding="md" hover>
              <a
                href={program.demo_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {t("rootMisc.team.liveDemo")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                    {t("rootMisc.team.openApplication")}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-auto" />
              </a>
            </AppCard>
          )}
          {program?.resources_link && (
            <AppCard padding="md" hover>
              <a
                href={program.resources_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {t("rootMisc.team.resources")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                    {t("rootMisc.team.sharedMaterials")}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-auto" />
              </a>
            </AppCard>
          )}
        </div>
      )}

      {/* Submission files list */}
      {submittedFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            {t("rootMisc.team.submittedFiles")}
          </h4>
          <div className="space-y-2">
            {submittedFiles.map(({ key, deliverableId, submission }) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-3)]"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {deliverables.find((deliverable) => deliverable.id === deliverableId)
                        ?.title || t("rootMisc.team.file")}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                      {fmtDate(submission.created_at)}
                    </p>
                  </div>
                </div>
                <a
                  href={submission.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-blue)] hover:underline"
                >
                  <Download className="w-3 h-3" />
                  {t("rootMisc.team.download")}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}