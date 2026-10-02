"use client";

import { ArrowLeft, ExternalLink, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The workspace header: the back link, the team's name over its programme, and
 * the two links to whatever the programme published.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function TeamHeader({ team, program, onBack }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors mb-2 uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("rootMisc.team.back")}
        </button>
        <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          {team.name}
        </h1>
        <p className="text-xs text-[var(--text-secondary)] font-bold mt-1">
          {program ? program.name : ""} — {t("rootMisc.team.workspace")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {program?.demo_link && (
          <a
            href={program.demo_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--brand-orange)] transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("rootMisc.team.demo")}
          </a>
        )}
        {program?.pitch_deck_url && (
          <a
            href={program.pitch_deck_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--brand-orange)] transition-all"
          >
            <Globe className="w-3.5 h-3.5" />
            {t("rootMisc.team.pitchDeck")}
          </a>
        )}
      </div>
    </div>
  );
}