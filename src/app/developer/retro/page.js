"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DeveloperRetro() {
  const [userRole, setUserRole] = useState("developer");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [retroData, setRetroData] = useState({
    went_well: "",
    to_improve: "",
    action_items: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (!sessionData.authenticated) {
        setError("Session expired");
        setSubmitting(false);
        return;
      }

      const userId = sessionData.user.cid;
      const userName = sessionData.user.name;
      const now = new Date();
      const weekNumber = getWeekNumber(now);
      const year = now.getFullYear();

      const res = await fetch("/api/standups/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          report_type: "retro",
          week_number: weekNumber,
          year,
          accomplishments: retroData.went_well,
          plans: retroData.to_improve,
          blockers: retroData.action_items,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setRetroData({ went_well: "", to_improve: "", action_items: "" });
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        setError(data.error || "Failed to submit retro");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout role={userRole} activeTab="retro">
      <div className="space-y-8 pb-20">
        <header className="border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Developer Workspace
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Retro
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Weekly retrospective
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] font-bold text-red-400">{error}</p>
            </div>
          )}

          {submitted && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-[10px] font-bold text-emerald-400">Retro submitted successfully!</p>
            </div>
          )}

          <div>
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
              What went well?
            </label>
            <textarea
              value={retroData.went_well}
              onChange={(e) => setRetroData({ ...retroData, went_well: e.target.value })}
              rows={4}
              placeholder="What went well this week..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
              required
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
              What could be improved?
            </label>
            <textarea
              value={retroData.to_improve}
              onChange={(e) => setRetroData({ ...retroData, to_improve: e.target.value })}
              rows={4}
              placeholder="What could be better..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
              required
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
              Action Items
            </label>
            <textarea
              value={retroData.action_items}
              onChange={(e) => setRetroData({ ...retroData, action_items: e.target.value })}
              rows={3}
              placeholder="Action items for next week..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Submit Retro</>
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
