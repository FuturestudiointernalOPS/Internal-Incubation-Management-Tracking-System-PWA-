"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DeveloperStandup() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("developer");
  const [loading, setLoading] = useState(true);
  const [existingReport, setExistingReport] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [standupData, setStandupData] = useState({
    accomplishments: "",
    plans: "",
    blockers: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const fetchStandup = async () => {
      setLoading(true);
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.user) {
          const userId = sessionData.user.cid;
          const now = new Date();
          const weekNumber = getWeekNumber(now);
          const year = now.getFullYear();

          const res = await fetch(
            `/api/standups/current?user_id=${userId}&week=${weekNumber}&year=${year}`
          );
          const data = await res.json();
          if (data.success) {
            setExistingReport(data.report);
            setTasks(data.tasks || []);

            if (data.report) {
              setStandupData({
                accomplishments: data.report.accomplishments || "",
                plans: data.report.plans || "",
                blockers: data.report.blockers || "",
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch standup data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStandup();
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
          report_type: "standup",
          week_number: weekNumber,
          year,
          accomplishments: standupData.accomplishments,
          plans: standupData.plans,
          blockers: standupData.blockers,
          task_ids: tasks.filter((t) => t.selected).map((t) => t.id),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        setError(data.error || "Failed to submit standup");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout role={userRole} activeTab="standup">
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
              Standup
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {existingReport ? "Update your daily standup" : "Submit your daily standup"}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-[10px] font-bold text-red-400">{error}</p>
              </div>
            )}

            {submitted && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <p className="text-[10px] font-bold text-emerald-400">Standup submitted successfully!</p>
              </div>
            )}

            <div>
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
                What did you accomplish?
              </label>
              <textarea
                value={standupData.accomplishments}
                onChange={(e) => setStandupData({ ...standupData, accomplishments: e.target.value })}
                rows={4}
                placeholder="Describe what you worked on..."
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                required
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
                What are you planning to work on?
              </label>
              <textarea
                value={standupData.plans}
                onChange={(e) => setStandupData({ ...standupData, plans: e.target.value })}
                rows={4}
                placeholder="Your plan for today/next..."
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">
                Any blockers?
              </label>
              <textarea
                value={standupData.blockers}
                onChange={(e) => setStandupData({ ...standupData, blockers: e.target.value })}
                rows={3}
                placeholder="Anything blocking your progress..."
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
                <><Send className="w-3.5 h-3.5" /> {existingReport ? "Update Standup" : "Submit Standup"}</>
              )}
            </button>
          </form>
        )}
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
