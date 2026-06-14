"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  RefreshCw,
  BookOpen,
  MessageSquare,
  Lightbulb,
  Target,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    bg: "bg-[var(--brand-orange)]/10",
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

function RitualForm({ type, programs, onSubmit, onClose }) {
  const config = RITUAL_TYPES.find((r) => r.id === type);
  const [programId, setProgramId] = useState(programs[0]?.id || "");
  const [weekNumber, setWeekNumber] = useState(1);
  const [fields, setFields] = useState({});

  const fieldConfigs = {
    standup: [
      {
        key: "what_done",
        label: "What did you do?",
        placeholder: "Completed tasks, progress made...",
      },
      {
        key: "what_today",
        label: "What will you do today?",
        placeholder: "Next steps, priorities...",
      },
      {
        key: "blockers",
        label: "Any blockers?",
        placeholder: "Challenges, roadblocks...",
      },
    ],
    checkin: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["checked_in", "absent", "excused"],
      },
      { key: "notes", label: "Notes", placeholder: "Additional notes..." },
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
        label: "Key learnings",
        placeholder: "What did you learn?",
      },
      {
        key: "challenges",
        label: "Challenges",
        placeholder: "Difficulties encountered...",
      },
      {
        key: "suggestions",
        label: "Suggestions",
        placeholder: "Ideas for the program...",
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
          <span className="text-[12px] font-black text-[var(--text-primary)] uppercase tracking-wider">
            New {type}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={weekNumber}
          onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)}
          className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
          placeholder="Week"
        />
      </div>

      <div className="space-y-3">
        {(fieldConfigs[type] || []).map((field) => (
          <div key={field.key}>
            <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">
              {field.label}
            </label>
            {field.type === "select" ? (
              <select
                value={fields[field.key] || field.options[0]}
                onChange={(e) =>
                  setFields({ ...fields, [field.key]: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
              >
                {field.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={fields[field.key] || ""}
                onChange={(e) =>
                  setFields({ ...fields, [field.key]: e.target.value })
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
          className="flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-[var(--text-secondary)] hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 py-2.5 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          <Send className="w-3 h-3" /> Submit
        </button>
      </div>
    </motion.div>
  );
}

export default function RitualsView() {
  const [programs, setPrograms] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchPrograms = useCallback(async () => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const cid = u.cid || u.id || "";
      const res = await fetch(`/api/participant/programs?cid=${cid}`);
      const data = await res.json();
      if (data.success) setPrograms(data.programs || []);
    } catch (e) {
      /* ignore */
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        RITUAL_TYPES.map(async (rt) => {
          const u = JSON.parse(localStorage.getItem("user") || "{}");
          const cid = u.cid || u.id || "";
          const res = await fetch(
            `/api/participant/rituals/${rt.id}?cid=${cid}`,
          );
          const data = await res.json();
          return {
            type: rt.id,
            data: data.success
              ? data[`${rt.id}s`] || data[`${rt.id}ions`] || []
              : [],
          };
        }),
      );
      const hist = {};
      results.forEach((r) => {
        hist[r.type] = r.data;
      });
      setHistory(hist);
    } catch (e) {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrograms();
    fetchHistory();
  }, [fetchPrograms, fetchHistory]);

  const handleSubmit = async (type, payload) => {
    try {
      await fetch(`/api/participant/rituals/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      fetchHistory();
    } catch (e) {
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
        <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          Rituals
        </h1>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          Standups · Check-ins · Retros · Reflections
        </p>
      </div>

      {/* Ritual type buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {RITUAL_TYPES.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setActiveForm(activeForm === rt.id ? null : rt.id)}
            className={`p-4 rounded-xl border transition-all text-left ${
              activeForm === rt.id
                ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/5"
                : "border-[var(--border-primary)] bg-[var(--bg-tertiary)] hover:border-[var(--brand-orange)]/30"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${rt.bg} mb-2`}
            >
              <rt.icon className={`w-5 h-5 ${rt.color}`} />
            </div>
            <p className="text-[11px] font-black text-[var(--text-primary)]">
              {rt.label}
            </p>
            <p className="text-[8px] text-[var(--text-secondary)] mt-0.5">
              {history[rt.id]?.length || 0} submitted
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
        <h2 className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Recent Activity
        </h2>
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
              />
            ))}
          </div>
        ) : allHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Zap className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
            <p className="text-[11px] font-bold text-[var(--text-secondary)]">
              No ritual submissions yet
            </p>
            <p className="text-[9px] text-[var(--text-tertiary)] mt-1">
              Select a ritual type above to submit your first one
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {allHistory.slice(0, 10).map((item, idx) => {
              const rt = RITUAL_TYPES.find((r) => r.id === item.ritualType);
              return (
                <div
                  key={`${item.ritualType}-${item.id || idx}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                >
                  {rt && (
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${rt.bg} shrink-0`}
                    >
                      <rt.icon className={`w-4 h-4 ${rt.color}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[var(--text-primary)] capitalize">
                      {item.ritualType} · Week {item.week_number || "?"}
                    </p>
                    <p className="text-[8px] text-[var(--text-secondary)] truncate">
                      {item.what_done ||
                        item.learnings ||
                        item.went_well ||
                        item.notes ||
                        item.status ||
                        "Submitted"}
                    </p>
                  </div>
                  <span className="text-[7px] text-[var(--text-tertiary)] shrink-0">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
