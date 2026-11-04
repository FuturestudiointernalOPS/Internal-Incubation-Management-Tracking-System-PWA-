"use client";

import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";
import { dataRoomCategory } from "@/lib/dataRoom";

// The kit tag for a verdict (the charter's own colours).
const TAG = { verified: "g", awaiting: "w", rejected: "r", missing: "", expired: "" };

// Dialog sections, in the order a reader cares about them.
const SECTIONS = ["verified", "awaiting", "rejected", "missing"];

/**
 * HOW THE STAGE & EVIDENCE SCORE IS BUILT — the score showing its working.
 *
 *   score = stage 40% + evidence 60%
 *
 * The evidence half is the Data Room's REQUIRED categories. They are listed here
 * by verdict: what already counts (approved), what will count once approved
 * (awaiting), what was refused, and what is still missing. Rendering only: the
 * server decided every figure and sends it in `readiness`.
 */
export default function EvidenceBreakdown({ readiness, isOpen, onClose }) {
  const { t } = useI18n();
  if (!isOpen) return null;

  const evidence = readiness?.evidence || null;
  const items = evidence?.items || [];
  const measurable = readiness?.evidence_measurable;
  const stage = String(readiness?.stage || "—").replace(/_/g, " ");

  return (
    <AppModal isOpen onClose={onClose} title={t("vadmin.dashboard.evidence.title")} size="lg">
      <div className="space-y-5">
        <div className="stf-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <div className="stf-card">
            <p className="jy-lbl">{t("vadmin.dashboard.evidence.stagePart")}</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{readiness?.stage_weight ?? 0}%</p>
            <p className="text-[12px] text-[var(--text-secondary)] capitalize">{stage} · 40%</p>
          </div>
          <div className="stf-card">
            <p className="jy-lbl">{t("vadmin.dashboard.evidence.evidencePart")}</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{measurable ? `${readiness.evidence_percent}%` : "—"}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{t("vadmin.dashboard.evidence.evidenceWeight")}</p>
          </div>
          <div className="stf-card">
            <p className="jy-lbl">{t("vadmin.dashboard.evidence.total")}</p>
            <p className="text-2xl font-black text-[var(--brand-orange)] mt-1">{readiness?.score ?? 0}%</p>
          </div>
        </div>

        {!measurable ? (
          <p className="text-[13px] text-[var(--text-secondary)]">{t("vadmin.dashboard.evidence.notMeasurable")}</p>
        ) : (
          <>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {t("vadmin.dashboard.evidence.explain", {
                verified: evidence.verified_count,
                total: evidence.required_total,
              })}
            </p>
            {SECTIONS.map((section) => {
              const rows = items.filter((item) =>
                section === "missing" ? item.status === "missing" || item.status === "expired" : item.status === section,
              );
              if (rows.length === 0) return null;
              return (
                <div key={section} className="space-y-2">
                  <p className="jy-lbl">
                    {t(`vadmin.dashboard.evidence.section.${section}`)} · {rows.length}
                  </p>
                  {rows.map((item) => {
                    const category = dataRoomCategory(item.category);
                    return (
                      <div key={item.category} className="jy-drow" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-semibold text-[var(--text-primary)] flex-1">
                            {category ? t(category.labelKey) : item.category}
                          </span>
                          <span className={`stf-tag ${TAG[item.status] || ""}`}>
                            {t(`vadmin.dashboard.evidence.verdict.${item.status}`)}
                          </span>
                        </div>
                        {item.documents.length === 0 ? (
                          <p className="text-[12px] text-[var(--text-secondary)]">{t("vadmin.dashboard.evidence.noDocument")}</p>
                        ) : (
                          item.documents.map((documentEntry) => (
                            <div key={documentEntry.id} className="flex items-center gap-2 text-[12.5px] text-[var(--text-secondary)] w-full">
                              <span className="flex-1 break-words">{documentEntry.title || t("vadmin.dashboard.evidence.untitled")}</span>
                              <span className={`stf-tag ${TAG[documentEntry.status] || ""}`}>
                                {t(`vadmin.dashboard.evidence.verdict.${documentEntry.status}`)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
      </div>
    </AppModal>
  );
}
