"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Send,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  AlertTriangle,
  Star,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DeveloperRetro() {
  const [userRole, setUserRole] = useState("developer");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [weekInfo, setWeekInfo] = useState({ week: 0, year: 0 });

  const [completedWork, setCompletedWork] = useState([]);
  const [newCompleted, setNewCompleted] = useState("");
  const [unfinishedTasks, setUnfinishedTasks] = useState([]);
  const [newUnfinished, setNewUnfinished] = useState("");
  const [weekStatus, setWeekStatus] = useState("");
  const [hadBlockers, setHadBlockers] = useState(null);
  const [blockerDesc, setBlockerDesc] = useState("");
  const [wins, setWins] = useState([]);
  const [newWin, setNewWin] = useState("");
  const [majorAchievement, setMajorAchievement] = useState("");
  const [carryoverItems, setCarryoverItems] = useState([]);
  const [newCarryover, setNewCarryover] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [retroNotes, setRetroNotes] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
    const now = new Date();
    setWeekInfo({ week: getWeekNumber(now), year: now.getFullYear() });
  }, []);

  const addBullet = (list, setter, input, setInput) => {
    if (input.trim()) {
      setter([...list, input.trim()]);
      setInput("");
    }
  };
  const removeBullet = (list, setter, index) =>
    setter(list.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const s = await fetch("/api/auth/session");
      const sd = await s.json();
      if (!sd.authenticated) {
        setError("Session expired");
        setSubmitting(false);
        return;
      }
      const now = new Date();
      const wn = getWeekNumber(now);
      const yr = now.getFullYear();
      const res = await fetch("/api/standups/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: sd.user.cid,
          user_name: sd.user.name,
          report_type: "retro",
          week_number: wn,
          year: yr,
          accomplishments: JSON.stringify(completedWork),
          plans: JSON.stringify(unfinishedTasks),
          blockers: blockerDesc,
          additional_notes: JSON.stringify({
            week_status: weekStatus,
            had_blockers: hadBlockers,
            wins,
            major_achievement: majorAchievement,
            carryover_items: carryoverItems,
            lessons_learned: lessonsLearned,
            retro_notes: retroNotes,
          }),
        }),
      });
      const d = await res.json();
      if (d.success) {
        setSubmitted(true);
        setCompletedWork([]);
        setUnfinishedTasks([]);
        setWeekStatus("");
        setHadBlockers(null);
        setBlockerDesc("");
        setWins([]);
        setMajorAchievement("");
        setCarryoverItems([]);
        setLessonsLearned("");
        setRetroNotes("");
        setTimeout(() => setSubmitted(false), 3000);
      } else setError(d.error || "Failed");
    } catch (e) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const iC =
    "w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all";
  const lC =
    "text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5";

  return (
    <DashboardLayout role={userRole} activeTab="retro">
      <div className="space-y-8 pb-20">
        <header className="border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Weekly Retro
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Retro
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Week {weekInfo.week}, {weekInfo.year}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] font-bold text-red-400">{error}</p>
            </div>
          )}
          {submitted && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-[10px] font-bold text-emerald-400">
                Retro submitted!
              </p>
            </div>
          )}

          {/* Completed Work */}
          <div className="space-y-3">
            <label className={lC}>What did you complete this week?</label>
            <div className="space-y-2">
              {completedWork.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1">
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      removeBullet(completedWork, setCompletedWork, i)
                    }
                    className="p-1 hover:bg-red-500/10 rounded transition-all"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newCompleted}
                onChange={(e) => setNewCompleted(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(),
                  addBullet(
                    completedWork,
                    setCompletedWork,
                    newCompleted,
                    setNewCompleted,
                  ))
                }
                placeholder="Add completed item..."
                className={iC}
              />
              <button
                type="button"
                onClick={() =>
                  addBullet(
                    completedWork,
                    setCompletedWork,
                    newCompleted,
                    setNewCompleted,
                  )
                }
                className="px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Unfinished Tasks */}
          <div className="space-y-3">
            <label className={lC}>What tasks remain unfinished?</label>
            <div className="space-y-2">
              {unfinishedTasks.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1">
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      removeBullet(unfinishedTasks, setUnfinishedTasks, i)
                    }
                    className="p-1 hover:bg-red-500/10 rounded transition-all"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newUnfinished}
                onChange={(e) => setNewUnfinished(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(),
                  addBullet(
                    unfinishedTasks,
                    setUnfinishedTasks,
                    newUnfinished,
                    setNewUnfinished,
                  ))
                }
                placeholder="Add unfinished task..."
                className={iC}
              />
              <button
                type="button"
                onClick={() =>
                  addBullet(
                    unfinishedTasks,
                    setUnfinishedTasks,
                    newUnfinished,
                    setNewUnfinished,
                  )
                }
                className="px-4 py-3 rounded-xl bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Carryover */}
          <div className="space-y-3">
            <label className={lC}>What carries over to next week?</label>
            <p className="text-[8px] font-bold text-slate-500 -mt-1">
              These will appear in next week's standup
            </p>
            <div className="space-y-2">
              {carryoverItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1">
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      removeBullet(carryoverItems, setCarryoverItems, i)
                    }
                    className="p-1 hover:bg-red-500/10 rounded transition-all"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newCarryover}
                onChange={(e) => setNewCarryover(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(),
                  addBullet(
                    carryoverItems,
                    setCarryoverItems,
                    newCarryover,
                    setNewCarryover,
                  ))
                }
                placeholder="Add carryover..."
                className={iC}
              />
              <button
                type="button"
                onClick={() =>
                  addBullet(
                    carryoverItems,
                    setCarryoverItems,
                    newCarryover,
                    setNewCarryover,
                  )
                }
                className="px-4 py-3 rounded-xl bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Wins */}
          <div className="space-y-3">
            <label className={lC}>Wins this week</label>
            <div className="space-y-2">
              {wins.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10"
                >
                  <Star className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1">
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBullet(wins, setWins, i)}
                    className="p-1 hover:bg-red-500/10 rounded transition-all"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newWin}
                onChange={(e) => setNewWin(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(),
                  addBullet(wins, setWins, newWin, setNewWin))
                }
                placeholder="Add a win..."
                className={iC}
              />
              <button
                type="button"
                onClick={() => addBullet(wins, setWins, newWin, setNewWin)}
                className="px-4 py-3 rounded-xl bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Major Achievement */}
          <div className="space-y-3">
            <label className={lC}>Major achievement this week</label>
            <textarea
              value={majorAchievement}
              onChange={(e) => setMajorAchievement(e.target.value)}
              rows={2}
              placeholder="Your biggest accomplishment..."
              className={iC + " resize-none"}
            />
          </div>

          {/* Week Status */}
          <div className="space-y-3">
            <label className={lC}>How was your week?</label>
            <textarea
              value={weekStatus}
              onChange={(e) => setWeekStatus(e.target.value)}
              rows={2}
              placeholder="Overall reflection..."
              className={iC + " resize-none"}
            />
          </div>

          {/* Blockers */}
          <div className="space-y-3">
            <label className={lC + " text-red-400"}>
              Blockers — what didn't work?
            </label>
            <p className="text-[8px] font-bold text-slate-500 -mt-1">
              Issues, problems, or obstacles you encountered
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setHadBlockers(true)}
                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${hadBlockers === true ? "bg-red-500/10 text-red-400 border border-red-500/30" : "bg-secondary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  setHadBlockers(false);
                  setBlockerDesc("");
                }}
                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${hadBlockers === false ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-secondary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
              >
                No
              </button>
            </div>
            {hadBlockers === true && (
              <textarea
                value={blockerDesc}
                onChange={(e) => setBlockerDesc(e.target.value)}
                rows={2}
                placeholder="Describe the blockers..."
                className={iC + " resize-none"}
              />
            )}
          </div>

          {/* Lessons Learned */}
          <div className="space-y-3">
            <label className={lC + " text-emerald-400"}>
              Lessons learned — what worked or surprised you?
            </label>
            <p className="text-[8px] font-bold text-slate-500 -mt-1">
              Positive discoveries, insights, techniques that worked well, or
              anything you learned while working
            </p>
            <textarea
              value={lessonsLearned}
              onChange={(e) => setLessonsLearned(e.target.value)}
              rows={3}
              placeholder="e.g. Breaking the task into smaller PRs made reviews faster. The new component library saved me hours. I learned that the API handles pagination differently than expected..."
              className={iC + " resize-none"}
            />
          </div>

          {/* Retro Notes */}
          <div className="space-y-3">
            <label className={lC}>Additional notes</label>
            <textarea
              value={retroNotes}
              onChange={(e) => setRetroNotes(e.target.value)}
              rows={3}
              placeholder="Anything else..."
              className={iC + " resize-none"}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Submit Retro
              </>
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
  const w1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) /
        7,
    )
  );
}
