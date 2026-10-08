"use client";

import React, { useState } from "react";
import { useApi, useApiMulti } from "@/lib/hooks/useApi";
import {
  Zap,
  CheckCircle2,
  Send,
  Lightbulb,
} from "lucide-react";
import { motion } from "framer-motion";
import AppCard from "@/components/ui/AppCard";
import AppTable from "@/components/ui/AppTable";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import { useI18n } from "@/lib/i18n";

// ─── RITUAL TYPES ──────────────────────────────────────────────────
// NOTE: Retrospective ('retro') is intentionally suspended for participants.
// It was removed from the active set below pending further UX review.
// Do NOT re-enable without explicit approval from the product owner.
// If re-enabled, also check:
//   - fieldConfigs.retro below
//   - src/app/api/participant/rituals/retro/route.js
//   - The Ritual Participation metric in Dashboard Home and Progress pages

const RITUAL_TYPES = [
  {
    id: "standup",
    label: "Standup",
    icon: Zap,
    color: "text-[var(--brand-orange)]",
    bg: "bg-brand-orange/10",
  },
  {
    id: "checkin",
    label: "Check-in",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  // retro — SUSPENDED (see note above)
  {
    id: "reflect",
    label: "Reflection",
    icon: Lightbulb,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
];

// One read per ritual type, issued together. A type's answers arrive on its own
// endpoint under the type name with an "s" (standups) or an "ions" (checkins) -
// the two shapes the API has always used. Built at module scope so the list has
// one identity for the life of the page, which is what the multi-read needs.
const RITUAL_ENDPOINTS = RITUAL_TYPES.map((ritualType) => ({
  key: ritualType.id,
  url: `/api/participant/rituals/${ritualType.id}`,
  transform: (payload) =>
    payload && payload.success ? payload[`${ritualType.id}s`] || payload[`${ritualType.id}ions`] || [] : [],
}));

const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);

function RitualForm({ type, programs, onSubmit, onClose }) {
  const { t } = useI18n();
  const config = RITUAL_TYPES.find((ritualType) => ritualType.id === type);
  const [programId, setProgramId] = useState(programs[0]?.id || "");
  const [weekNumber, setWeekNumber] = useState(1);
  const [fields, setFields] = useState({});

  const fieldConfigs = {
    standup: [
      {
        key: "what_done",
        label: t("participantMisc.rituals.fieldWhatDone"),
        placeholder: t("participantMisc.rituals.placeholderWhatDone"),
      },
      {
        key: "what_today",
        label: t("participantMisc.rituals.fieldWhatToday"),
        placeholder: t("participantMisc.rituals.placeholderWhatToday"),
      },
      {
        key: "blockers",
        label: t("participantMisc.rituals.fieldBlockers"),
        placeholder: t("participantMisc.rituals.placeholderBlockers"),
      },
    ],
    checkin: [
      {
        key: "status",
        label: t("participantMisc.rituals.fieldStatus"),
        type: "select",
        options: ["checked_in", "absent", "excused"],
      },
      {
        key: "notes",
        label: t("participantMisc.rituals.fieldNotes"),
        placeholder: t("participantMisc.rituals.placeholderNotes"),
      },
    ],
    // retro — intentionally SUSPENDED (see RITUAL_TYPES note at top of file)
    // retro: [
    //   { key: "went_well", label: "What went well?", ... },
    //   { key: "improve", label: "What could improve?", ... },
    //   { key: "action_items", label: "Action items", ... },
    // ],
    reflect: [
      {
        key: "learnings",
        label: t("participantMisc.rituals.fieldLearnings"),
        placeholder: t("participantMisc.rituals.placeholderLearnings"),
      },
      {
        key: "challenges",
        label: t("participantMisc.rituals.fieldChallenges"),
        placeholder: t("participantMisc.rituals.placeholderChallenges"),
      },
      {
        key: "suggestions",
        label: t("participantMisc.rituals.fieldSuggestions"),
        placeholder: t("participantMisc.rituals.placeholderSuggestions"),
      },
    ],
  };

  const handleSubmit = async () => {
    if (!programId) return;
    await onSubmit(type, {
      program_id: programId,
      week_number: weekNumber,
      ...fields,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${config?.bg}`}
          >
            {config && <config.icon className={`w-5 h-5 ${config.color}`} />}
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("participantMisc.rituals.newForm", {
              type: t("participantMisc.rituals." + type),
            })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={programId}
          onChange={(event) => setProgramId(event.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
        >
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={weekNumber}
          onChange={(event) => setWeekNumber(parseInt(event.target.value) || 1)}
          className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
          placeholder={t("participantMisc.rituals.week")}
        />
      </div>

      <div className="space-y-3">
        {(fieldConfigs[type] || []).map((field) => (
          <div key={field.key}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">
              {field.label}
            </label>
            {field.type === "select" ? (
              <select
                value={fields[field.key] || field.options[0]}
                onChange={(event) =>
                  setFields({ ...fields, [field.key]: event.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
              >
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={fields[field.key] || ""}
                onChange={(event) =>
                  setFields({ ...fields, [field.key]: event.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold outline-none resize-none"
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:bg-surface-2 transition-all"
        >
          {t("participantMisc.rituals.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 py-2.5 rounded-lg bg-[var(--brand-orange)] text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          <Send className="w-3 h-3" /> {t("participantMisc.rituals.submit")}
        </button>
      </div>
    </motion.div>
  );
}

export default function RitualsView() {
  const { t } = useI18n();
  const [activeForm, setActiveForm] = useState("standup");

  // The programmes and the ritual history are reads through the shared hook,
  // which owns the cache, the cache-first paint and the discarding of a stale
  // answer. The history is one read per ritual type, issued together.
  const { data: programs } = useApi("/api/participant/programs", {
    defaultValue: [],
    transform: pickPrograms,
  });
  const {
    data: history,
    loading,
    refresh: refreshHistory,
  } = useApiMulti(RITUAL_ENDPOINTS);

  const handleSubmit = async (type, payload) => {
    try {
      await fetch(`/api/participant/rituals/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      refreshHistory();
    } catch {
      /* ignore */
    }
  };

  const allHistory = Object.entries(history)
    .flatMap(([type, items]) =>
      items.map((item) => ({ ...item, ritualType: type })),
    )
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("participantMisc.rituals.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("participantMisc.rituals.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[
        [t("participant.template.submitted"), allHistory.length],
        ...RITUAL_TYPES.map(type => [t("participantMisc.rituals." + type.id), history[type.id]?.length || 0]),
      ].map(([label, value]) => <AppCard key={label} padding="sm"><p className="text-xs text-[var(--text-secondary)]">{label}</p><strong className="block mt-3 text-3xl font-bold font-mono text-[var(--text-primary)]">{loading ? t("common.loading") : value}</strong></AppCard>)}</div>
      {/* Ritual type buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {RITUAL_TYPES.map((ritualType) => (
          <button
            key={ritualType.id}
            onClick={() => setActiveForm(activeForm === ritualType.id ? null : ritualType.id)}
            className={`p-4 rounded-xl border transition-all text-left ${
              activeForm === ritualType.id
                ? "border-[var(--brand-orange)] bg-brand-orange/5"
                : "border-[var(--border-primary)] bg-[var(--bg-tertiary)] hover:border-brand-orange/30"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${ritualType.bg} mb-2`}
            >
              <ritualType.icon className={`w-5 h-5 ${ritualType.color}`} />
            </div>
            <p className="text-[11px] font-bold text-[var(--text-primary)]">
              {t("participantMisc.rituals." + ritualType.id)}
            </p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
              {t("participantMisc.rituals.submittedCount", {
                count: history[ritualType.id]?.length || 0,
              })}
            </p>
          </button>
        ))}
      </div>

      {/* Active form */}
      {activeForm && (
        <RitualForm
          type={activeForm}
          programs={programs}
          onSubmit={handleSubmit}
          onClose={() => setActiveForm(null)}
        />
      )}

      {/* History */}
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
          {t("participantMisc.rituals.recentActivity")}
        </h2>
        <AppTable data={allHistory.slice(0, 20)} loading={loading} emptyMessage={t("participantMisc.rituals.noSubmissions")} columns={[
          { key: "ritualType", label: t("participant.template.ritualTypeColumn"), render: value => t("participantMisc.rituals." + value) },
          { key: "week_number", label: t("participantMisc.rituals.week") },
          { key: "summary", label: t("participant.template.summaryColumn"), render: (_, item) => item.what_done || item.learnings || item.went_well || item.notes || t("participantMisc.rituals.submitted") },
          { key: "status", label: t("participant.template.statusColumn"), render: () => <AppStatusBadge status="completed" label={t("participantMisc.rituals.submitted")} /> },
        ]} />
      </div>
    </motion.div>
  );
}
