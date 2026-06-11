"use client";
import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import {
  Rocket,
  Users,
  Calendar,
  ArrowRight,
  Layers,
  Layout,
  ChevronRight,
  Briefcase,
  Search,
  Activity,
  ListTodo,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

/**
 * PM OPERATIONS REGISTRY (FULL FEATURE V2)
 * Unified list of all programs assigned to the current PM identity.
 */
export default function PMProgramsRegistry() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setTab] = useState("all");
  const router = useRouter();

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetchMyPrograms();
    fetchMyTasks();
  }, [activeTab]);

  const fetchMyPrograms = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const identifier = user.cid || user.id;

      let endpoint = `/api/pm/programs?assigned_pm_id=${identifier}`;
      if (activeTab === "all") {
        endpoint += "&show_archived=true";
      } else if (activeTab === "archived") {
        endpoint += "&show_archived=true";
      } else if (activeTab === "completed") {
        endpoint += "&status=completed&show_archived=false";
      } else {
        endpoint += "&status=active&show_archived=false";
      }

      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) {
        setPrograms(data.programs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTasks = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const identifier = user.cid || user.id;
      setTasksLoading(true);
      const res = await fetch(
        `/api/tasks?assigned_to=${encodeURIComponent(identifier)}&limit=10&brief=true`,
      );
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  };

  const filtered = programs.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description &&
        p.description.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <DashboardLayout role="program_manager" activeTab="programs">
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
              <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">
                {t("pm.dashboard")}
              </span>
              <div className="h-px w-10 bg-[#FF6600]/30" />
              <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">
                {t("status.active")}
              </span>
            </div>
            <h2 className="text-5xl font-black text-[var(--text-primary)] tracking-tighter uppercase leading-none italic">
              {t("pm.programs")}
            </h2>
            <p className="text-[var(--text-secondary)] font-bold mt-4 uppercase text-[10px] tracking-widest opacity-60 italic">
              {t("pm.programs")}
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl pl-12 pr-6 py-4 text-[var(--text-primary)] outline-none focus:border-[#FF6600]/50 font-bold transition-all"
            />
          </div>
        </header>

        <div className="flex gap-4 overflow-x-auto pb-2">
          <button
            onClick={() => setTab("all")}
            className={`px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === "all" ? "bg-[#FF6600] text-black shadow-lg shadow-[#FF6600]/20" : "bg-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            All Programs
          </button>
          <button
            onClick={() => setTab("active")}
            className={`px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === "active" ? "bg-[#FF6600] text-black shadow-lg shadow-[#FF6600]/20" : "bg-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("status.active")}
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === "completed" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("status.completed")}
          </button>
          <button
            onClick={() => setTab("archived")}
            className={`px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === "archived" ? "bg-orange-500 text-white shadow-lg" : "bg-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("status.archived")}
          </button>
        </div>

        {/* MY TASKS - compact overview */}
        {tasks.length > 0 && (
          <section className="ios-card bg-secondary border-[var(--border-primary)] !p-6 overflow-hidden shadow-2xl relative">
            <div className="flex items-center gap-2 mb-4">
              <ListTodo className="w-4 h-4 text-blue-400" />
              <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter italic">
                My Tasks
              </h3>
              <span className="text-[10px] font-bold text-slate-500 ml-auto">
                {tasks.length} total
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tasks.slice(0, 6).map((task) => {
                const isOverdue =
                  task.end_date &&
                  new Date(task.end_date) < new Date() &&
                  task.status !== "completed";
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-primary border border-[var(--border-primary)] hover:border-blue-500/20 transition-all cursor-default group"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? "bg-rose-500/10 text-rose-400" : task.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}
                    >
                      {isOverdue ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : task.status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <ListTodo className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.end_date && (
                          <span
                            className={`text-[7px] font-black ${isOverdue ? "text-rose-500" : "text-slate-500"}`}
                          >
                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                            {new Date(task.end_date).toLocaleDateString()}
                          </span>
                        )}
                        {task.priority && task.priority !== "normal" && (
                          <span
                            className={`text-[6px] font-black uppercase px-1 py-0.5 rounded ${task.priority === "high" || task.priority === "critical" ? "bg-rose-500/10 text-rose-500" : "bg-slate-500/10 text-slate-500"}`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {tasks.length > 6 && (
              <p className="text-[7px] text-slate-500 text-center pt-3">
                +{tasks.length - 6} more tasks
              </p>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-6">
          {loading ? (
            <div className="p-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#FF6600]/10 border-t-[#FF6600] rounded-full animate-spin mx-auto" />
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">
                {t("common.loading")}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="ios-card py-40 flex flex-col items-center justify-center opacity-30 border-dashed border-white/10">
              <Layers className="w-20 h-20 text-slate-800 mb-6" />
              <h4 className="text-2xl font-black text-white uppercase mb-2">
                {t("common.noResults")}
              </h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {t("common.noResults")}
              </p>
            </div>
          ) : (
            filtered.map((program) => (
              <motion.div
                key={program.id}
                onClick={() => router.push(`/pm/programs/${program.id}`)}
                className="ios-card !p-0 overflow-hidden group cursor-pointer hover:border-[#FF6600]/30 transition-all hover:bg-tertiary border-[var(--border-primary)] shadow-2xl"
              >
                <div className="flex flex-col lg:flex-row items-stretch">
                  <div className="p-10 lg:w-[400px] bg-tertiary border-r border-[var(--border-primary)] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] italic animate-pulse">
                          {t("status.active")}
                        </span>
                      </div>
                      <h3 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none italic group-hover:text-[#FF6600] transition-colors">
                        {program.name}
                      </h3>
                    </div>
                    <div className="mt-8 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                        {t("status.active")}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-10 flex flex-col justify-between">
                    <p className="text-[13px] text-[var(--text-secondary)] font-bold leading-relaxed uppercase tracking-tight line-clamp-3">
                      {t("common.noResults")}
                    </p>

                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">
                          {t("status.inProgress")}
                        </p>
                        <p className="text-xs font-black text-[#FF6600] italic leading-none">
                          {Number(program.completion_index || 0).toFixed(1)}%
                        </p>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${program.completion_index || 0}%`,
                          }}
                          className="h-full bg-gradient-to-r from-[#FF6600] to-[#FF9900] shadow-[0_0_10px_rgba(255,102,0,0.2)]"
                        />
                      </div>
                    </div>

                    <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-8 border-t border-white/5 pt-8">
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1 italic">
                          {t("pm.teamOverview")}
                        </p>
                        <p className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter flex items-center gap-2 italic">
                          {program.participants_count || 0}{" "}
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1 italic">
                          {t("common.submit")}
                        </p>
                        <p className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter flex items-center gap-2 italic">
                          {program.docs_completed || 0}/
                          {program.docs_total || 0}{" "}
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1 italic">
                          {t("status.active")}
                        </p>
                        <p className="text-lg font-black text-emerald-500 uppercase tracking-tighter flex items-center gap-2 italic">
                          {t("status.active")}{" "}
                          <Activity className="w-3.5 h-3.5 text-emerald-900" />
                        </p>
                      </div>
                      <div className="flex items-center justify-end">
                        {activeTab === "archived" ? (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await fetch("/api/pm/programs", {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    id: program.id,
                                    is_archived: 0,
                                    action: "archive",
                                  }),
                                });
                                if ((await res.json()).success) {
                                  fetchMyPrograms();
                                  window.dispatchEvent(
                                    new CustomEvent("impactos:notify", {
                                      detail: {
                                        type: "success",
                                        message: t("common.success"),
                                      },
                                    }),
                                  );
                                }
                              } catch (err) {}
                            }}
                            className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white hover:text-emerald-500 transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />{" "}
                            {t("common.refresh")}
                          </button>
                        ) : (
                          <button className="btn-prime !py-3 !px-6 shadow-xl shadow-blue-600/10">
                            {t("common.submit")}{" "}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
