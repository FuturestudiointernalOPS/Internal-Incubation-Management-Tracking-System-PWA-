"use client";

import React, { useState } from "react";
import { Zap, Target, ShieldCheck, ShieldAlert } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";

const QUALIFICATION_STATES = ["not_assessed", "in_review", "qualified", "unqualified"];

// Design-system semantic colors (emerald / indigo / amber), not fixed light shades
function getScoreBand(score) {
  if (score >= 80) return { key: "priority", color: "text-emerald-500 bg-emerald-500/10" };
  if (score >= 60) return { key: "high", color: "text-indigo-400 bg-indigo-400/10" };
  if (score >= 30) return { key: "medium", color: "text-amber-500 bg-amber-500/10" };
  return { key: "low", color: "text-[var(--text-secondary)] bg-[var(--surface-3)]" };
}

export default function CrmScorePanel({ lead, onUpdate }) {
  const { t } = useI18n();
  const { alert } = useDialogs();

  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showQualModal, setShowQualModal] = useState(false);

  const [scoreForm, setScoreForm] = useState({ score: lead?.score || 0, reason: "" });
  const [qualForm, setQualForm] = useState({ state: lead?.qualification_state || "not_assessed", reason: lead?.qualification_reason || "" });

  const [saving, setSaving] = useState(false);

  const band = getScoreBand(lead?.score || 0);
  const state = lead?.qualification_state || "not_assessed";
  const stateLabel = QUALIFICATION_STATES.includes(state)
    ? t(`crm.intelligence.score.states.${state}`)
    : state;

  async function handleScoreSave() {
    setSaving(true);
    try {
      const parsedScore = Math.max(0, Math.min(100, parseInt(scoreForm.score, 10) || 0));
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: parsedScore, qualification_reason: scoreForm.reason }),
      });
      const data = await res.json();
      if (data.success) {
        setShowScoreModal(false);
        if (onUpdate) onUpdate(data.lead);
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("crm.intelligence.score.errorScore") });
    } finally {
      setSaving(false);
    }
  }

  async function handleQualSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualification_state: qualForm.state,
          qualification_reason: qualForm.reason,
          qualification_date: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowQualModal(false);
        if (onUpdate) onUpdate(data.lead);
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("crm.intelligence.score.errorQual") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5 mb-6">
      <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("crm.intelligence.score.panelTitle")}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Score Block */}
        <div className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border-primary)]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t("crm.intelligence.score.leadScore")}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-[var(--text-primary)]">{lead?.score || 0}</span>
                <span className="text-sm font-medium text-[var(--text-secondary)]">/ 100</span>
              </div>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold uppercase ${band.color}`}>
                {t(`crm.intelligence.score.bands.${band.key}`)}
              </span>
            </div>
            <button onClick={() => setShowScoreModal(true)} className="text-xs font-medium text-[var(--brand-blue)] hover:underline">
              {t("crm.intelligence.score.adjust")}
            </button>
          </div>
        </div>

        {/* Qualification Block */}
        <div className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border-primary)]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t("crm.intelligence.score.qualification")}</span>
              <div className="flex items-center gap-2 mt-2">
                {state === "qualified" ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                ) : state === "unqualified" ? (
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                ) : (
                  <Target className="w-5 h-5 text-[var(--text-secondary)]" />
                )}
                <span className="text-lg font-bold text-[var(--text-primary)]">
                  {stateLabel}
                </span>
              </div>
              {lead?.qualification_reason && (
                <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2">{lead.qualification_reason}</p>
              )}
            </div>
            <button onClick={() => setShowQualModal(true)} className="text-xs font-medium text-[var(--brand-blue)] hover:underline">
              {t("crm.intelligence.score.evaluate")}
            </button>
          </div>
        </div>
      </div>

      <AppModal isOpen={showScoreModal} onClose={() => setShowScoreModal(false)} title={t("crm.intelligence.score.adjustTitle")}>
        <div className="space-y-4">
          <AppInput
            type="number"
            label={t("crm.intelligence.score.scoreLabel")}
            value={scoreForm.score}
            onChange={e => setScoreForm(f => ({ ...f, score: e.target.value }))}
            min="0" max="100"
          />
          <AppInput
            label={t("crm.intelligence.score.reasonLabel")}
            value={scoreForm.reason}
            onChange={e => setScoreForm(f => ({ ...f, reason: e.target.value }))}
            multiline rows={2}
          />
          <div className="flex justify-end gap-2 mt-4">
            <AppButton variant="ghost" onClick={() => setShowScoreModal(false)} disabled={saving}>{t("common.cancel")}</AppButton>
            <AppButton onClick={handleScoreSave} disabled={saving}>{t("common.save")}</AppButton>
          </div>
        </div>
      </AppModal>

      <AppModal isOpen={showQualModal} onClose={() => setShowQualModal(false)} title={t("crm.intelligence.score.evaluateTitle")}>
        <div className="space-y-4">
          <AppSelect
            label={t("crm.intelligence.score.stateLabel")}
            value={qualForm.state}
            onChange={v => setQualForm(f => ({ ...f, state: v }))}
            options={QUALIFICATION_STATES.map(s => ({
              value: s,
              label: t(`crm.intelligence.score.states.${s}`),
            }))}
          />
          <AppInput
            label={t("crm.intelligence.score.reasonLabel")}
            value={qualForm.reason}
            onChange={e => setQualForm(f => ({ ...f, reason: e.target.value }))}
            multiline rows={2}
          />
          <div className="flex justify-end gap-2 mt-4">
            <AppButton variant="ghost" onClick={() => setShowQualModal(false)} disabled={saving}>{t("common.cancel")}</AppButton>
            <AppButton onClick={handleQualSave} disabled={saving}>{t("common.save")}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
