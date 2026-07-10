"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  TrendingUp,
  Award,
  Clock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * PROGRAM COMPLETION RECORDS (Ticket 6.2 — Historical Records)
 * View and manage participant completion records per program.
 */

const STATUS_CONFIG = {
  completed: {
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Completed",
  },
  incomplete: {
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Incomplete",
  },
  withdrawn: {
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    label: "Withdrawn",
  },
  graduated: {
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    label: "Graduated",
  },
};

export default function CompletionRecords() {
  const { t } = useI18n();
  const [user, setUser] = useState({ role: "super_admin" });
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch("/api/programs");
      const data = await res.json();
      if (data.success) setPrograms(data.programs || []);
    } catch (_) {}
    setProgramsLoading(false);
  }, []);

  const fetchRecords = useCallback(async (programId) => {
    if (!programId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/programs/completion?program_id=${programId}`,
      );
      const data = await res.json();
      if (data.success) setRecords(data.records || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);
  useEffect(() => {
    if (selectedProgram) fetchRecords(selectedProgram);
  }, [selectedProgram, fetchRecords]);

  const updateStatus = async (participantId, participantName, newStatus) => {
    setSaving((prev) => ({ ...prev, [participantId]: true }));
    try {
      await fetch("/api/programs/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: selectedProgram,
          participant_id: participantId,
          participant_name: participantName,
          completion_status: newStatus,
        }),
      });
      fetchRecords(selectedProgram);
    } catch (_) {}
    setSaving((prev) => ({ ...prev, [participantId]: false }));
  };

  return (
    <DashboardLayout
      role={user.role === "program_manager" ? "program_manager" : "super_admin"}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("completion.title") || "Program Completion Records"}
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {t("completion.subtitle") ||
                "Historical participant completion data — preserved and read-only after program closure"}
            </p>
          </div>
        </div>

        {/* Program selector */}
        <div>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[12px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          >
            <option value="">
              {t("completion.selectProgram") || "Select a program..."}
            </option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Records */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : selectedProgram && records.length === 0 ? (
          <div className="text-center py-20">
            <Award className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-30" />
            <p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">
              {t("completion.noRecords") || "No completion records yet"}
            </p>
            <p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">
              {t("completion.noRecordsHint") ||
                "Records are created automatically when a program is marked complete, or manually here"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
            <table className="w-full text-left">
              <thead className="bg-tertiary">
                <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Deliverables</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Feedback</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {records.map((r) => {
                  const cfg =
                    STATUS_CONFIG[r.completion_status] ||
                    STATUS_CONFIG.incomplete;
                  return (
                    <tr
                      key={r.id}
                      className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50 transition-colors"
                    >
                      <td className="px-4 py-3 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        {r.participant_name || r.participant_id}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-md text-[9px] font-black ${cfg.color} ${cfg.bg}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-emerald-500">
                          {r.deliverables_completed || 0}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          /{r.deliverables_total || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3 text-[var(--text-secondary)]" />
                          <span>{r.attendance_rate || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">
                          {r.final_feedback || r.coach_notes || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-[9px] text-[var(--text-secondary)]">
                          <Clock className="w-3 h-3" />
                          {r.completed_at
                            ? new Date(r.completed_at).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {["completed", "graduated"].map((status) => (
                            <button
                              key={status}
                              onClick={() =>
                                updateStatus(
                                  r.participant_id,
                                  r.participant_name,
                                  status,
                                )
                              }
                              disabled={
                                saving[r.participant_id] ||
                                r.completion_status === status
                              }
                              className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${
                                r.completion_status === status
                                  ? "bg-emerald-500/20 text-emerald-500 cursor-default"
                                  : "bg-tertiary text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-emerald-500/10"
                              }`}
                            >
                              {status === "completed" ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Award className="w-3 h-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
