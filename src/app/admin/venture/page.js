"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Loader2,
  Rocket,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  User,
  Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * VENTURE RECOMMENDATIONS (Ticket 6.4)
 * PM recommends teams for Venture OS → SA reviews and approves/rejects.
 * No automatic transition — every recommendation requires manual review.
 */

const REC_STATUS = {
  pending: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Pending" },
  under_review: {
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Under Review",
  },
  approved: {
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Approved",
  },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", label: "Rejected" },
};

export default function VentureRecommendations() {
  const { t } = useI18n();
  const [user, setUser] = useState({ role: "super_admin" });
  const [programs, setPrograms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Compose
  const [showCompose, setShowCompose] = useState(false);
  const [composeProgram, setComposeProgram] = useState("");
  const [composeTeam, setComposeTeam] = useState("");
  const [composeReason, setComposeReason] = useState("");

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, recRes] = await Promise.all([
        fetch("/api/programs"),
        fetch("/api/programs/venture-recommendations"),
      ]);
      const progData = await progRes.json();
      const recData = await recRes.json();
      if (progData.success) setPrograms(progData.programs || []);
      if (recData.success) setRecommendations(recData.recommendations || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  const fetchGroups = useCallback(async (programId) => {
    if (!programId) {
      setGroups([]);
      return;
    }
    try {
      const res = await fetch(`/api/groups?program_id=${programId}`);
      const data = await res.json();
      if (data.success) setGroups(data.groups || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    fetchGroups(composeProgram);
  }, [composeProgram, fetchGroups]);

  const handleSubmit = async () => {
    if (!composeProgram || !composeTeam) return;
    const team = groups.find((g) => String(g.id) === String(composeTeam));
    setSubmitting(true);
    try {
      const res = await fetch("/api/programs/venture-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: composeProgram,
          team_id: Number(composeTeam),
          team_name: team?.name || "",
          reason: composeReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCompose(false);
        setComposeProgram("");
        setComposeTeam("");
        setComposeReason("");
        fetchData();
      }
    } catch (_) {}
    setSubmitting(false);
  };

  const handleReview = async (id, status, notes) => {
    try {
      const res = await fetch("/api/programs/venture-recommendations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, review_notes: notes }),
      });
      const data = await res.json();
      if (data.success) fetchData();
    } catch (_) {}
  };

  return (
    <DashboardLayout
      role={user.role === "program_manager" ? "program_manager" : "super_admin"}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("venture.title") || "Venture Recommendations"}
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {t("venture.subtitle") ||
                "Manual review workflow — no automatic transition into Venture OS"}
            </p>
          </div>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Rocket className="w-3.5 h-3.5" />
            {t("venture.newRecommendation") || "Recommend"}
          </button>
        </div>

        {/* Compose panel */}
        {showCompose && (
          <div className="p-6 rounded-2xl bg-secondary border border-[var(--border-primary)] space-y-4">
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
              {t("venture.newRecommendation") || "New Recommendation"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                  Program
                </label>
                <select
                  value={composeProgram}
                  onChange={(e) => setComposeProgram(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">Select program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                  Team
                </label>
                <select
                  value={composeTeam}
                  onChange={(e) => setComposeTeam(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">Select team...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                Reason for Recommendation
              </label>
              <textarea
                value={composeReason}
                onChange={(e) => setComposeReason(e.target.value)}
                rows={2}
                placeholder="Why should this team transition to Venture OS?"
                className="w-full mt-1 px-3 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !composeProgram || !composeTeam}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all"
              >
                {submitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Rocket className="w-3 h-3" />
                )}
                {t("venture.submit") || "Submit Recommendation"}
              </button>
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Recommendations list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-20">
            <Rocket className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-30" />
            <p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">
              {t("venture.noRecommendations") || "No recommendations yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec) => {
              const cfg = REC_STATUS[rec.status] || REC_STATUS.pending;
              return (
                <div
                  key={rec.id}
                  className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[12px] font-black text-[var(--text-primary)]">
                        {rec.team_name || `Team #${rec.team_id}`}
                      </p>
                      <p className="text-[9px] text-[var(--text-secondary)]">
                        {programs.find((p) => p.id === rec.program_id)?.name ||
                          rec.program_id}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-md text-[8px] font-black ${cfg.color} ${cfg.bg}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {rec.reason && (
                    <p className="text-[10px] text-[var(--text-secondary)] bg-tertiary rounded-lg p-2">
                      {rec.reason}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[9px] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {rec.recommended_by_name || rec.recommended_by}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(rec.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {rec.reviewed_by && (
                    <div className="flex items-center gap-1 text-[9px] text-[var(--text-secondary)]">
                      <Shield className="w-3 h-3" />
                      Reviewed by {rec.reviewed_by_name || rec.reviewed_by}
                    </div>
                  )}

                  {/* Review actions (SA only) */}
                  {rec.status !== "approved" && rec.status !== "rejected" && (
                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-primary)]">
                      <button
                        onClick={() => handleReview(rec.id, "approved", "")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase hover:bg-emerald-500/20 transition-all"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(rec.id, "rejected", "")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase hover:bg-rose-500/20 transition-all"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
