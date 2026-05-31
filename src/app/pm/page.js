"use client";
import React, { useState, useEffect } from "react";
import {
  Rocket,
  Layers,
  Target,
  Activity,
  Calendar,
  ChevronRight,
  ArrowRight,
  Shield,
  Zap,
  Search,
  Filter,
  Users,
  LayoutDashboard,
  Settings,
  MessageSquare,
  TrendingUp,
  Send,
  Mail,
  Briefcase,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

/**
 * PROJECT MANAGER OPERATIONS HUB ÔÇö OPTIMIZED (V3)
 * High-density tabular interface for zero-latency program governance.
 */
export default function PMDashboard() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({
    totalParticipants: 0,
    activeDeliverables: 0,
    averageEngagement: "0%",
  });
  const [schedule, setSchedule] = useState([]);
  const { t } = useI18n();

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (!userString) {
      router.replace("/terminal");
      return;
    }
    const user = JSON.parse(userString);
    if (user.role !== "program_manager" && user.role !== "super_admin") {
      router.replace("/terminal");
      return;
    }
    fetchPMPrograms(user.cid || user.id);
    fetchGlobalSchedule();
  }, [router]);

  const fetchGlobalSchedule = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const identifier = user.cid || user.id;
      const res = await fetch(
        `/api/pm/schedule?pm_id=${identifier}&is_lead_pm=${user.isLeadPM}`,
      );
      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule || []);
      }
    } catch (e) {}
  };

  const fetchPMPrograms = async (pmId) => {
    try {
      const res = await fetch("/api/pm/programs?assigned_pm_id=" + pmId);
      const data = await res.json();

      if (data.success) {
        setPrograms(data.programs || []);
        const participants = (data.programs || []).reduce(
          (acc, p) => acc + (p.participant_count || 0),
          0,
        );
        setStats({
          totalParticipants: participants,
          activeDeliverables: (data.programs || []).length * 8,
          averageEngagement: "84%",
        });
      }
      setIsLoading(false);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (isLoading)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div
          className="w-12 h-12 border-4 border-t-[var(--brand-orange)] rounded-full animate-spin"
          style={{
            borderColor: "rgba(255, 102, 0, 0.1)",
            borderTopColor: "var(--brand-orange)",
          }}
        />
      </div>
    );

  const filtered = programs.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout role="program_manager" activeTab="v2">
      <div className="space-y-10 pb-20 text-left">
        {/* EXECUTIVE HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FF6600]" />
              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">
                {t("pm.dashboard")}
              </span>
            </div>
            <h1
              className="text-5xl font-black tracking-tighter uppercase italic"
              style={{ color: "var(--text-primary)" }}
            >
              {t("pm.dashboard")}
            </h1>
          </div>

          <div className="flex gap-4">
            <div
              className="p-4 rounded-2xl px-8 flex flex-col justify-center border"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border-primary)",
              }}
            >
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">
                {t("pm.teamOverview")}
              </span>
              <span className="text-emerald-500 font-black text-xs uppercase italic flex items-center gap-2">
                <Activity className="w-3 h-3" /> {t("status.active")}
              </span>
            </div>
          </div>
        </header>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: t("pm.dashboard"),
              value: stats.totalParticipants,
              icon: Users,
              color: "text-[#FF6600]",
            },
            {
              label: t("admin.activePrograms"),
              value: stats.activeDeliverables,
              icon: Target,
              color: "text-[#FF6600]",
            },
            {
              label: t("pm.teamOverview"),
              value: stats.averageEngagement,
              icon: TrendingUp,
              color: "text-emerald-400",
            },
          ].map((stat, i) => (
            <div key={i} className="card !p-8 group">
              <div className="flex justify-between items-center mb-4">
                <stat.icon className={`w-6 h-6 ${stat.color} opacity-40`} />
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">
                  {t("time.thisWeek")}
                </span>
              </div>
              <h4
                className="text-4xl font-black italic tracking-tighter"
                style={{ color: "var(--text-primary)" }}
              >
                {stat.value}
              </h4>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2 italic">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* TACTICAL CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div
            className="flex gap-4 p-1 rounded-xl border"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border-primary)",
            }}
          >
            <button className="px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#FF6600] text-black">
              {t("admin.activePrograms")}
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("pm-calendar")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)] transition-all"
            >
              {t("time.thisMonth")}
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full border rounded-xl py-3.5 pl-12 pr-4 text-xs font-bold outline-none focus:border-[#FF6600]/50 transition-all"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* HIGH-DENSITY PROGRAM TABLE */}
        <div className="table-container shadow-none">
          <table className="data-table w-full border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("pm.programs")}
                </th>
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("status.active")}
                </th>
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("pm.teamOverview")}
                </th>
                <th className="px-8 py-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("time.created")}
                </th>
                <th className="px-8 py-6 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                  {t("common.submit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="group cursor-pointer hover:bg-white/[0.03] transition-all"
                  onClick={() => router.push(`/pm/programs/${p.id}`)}
                >
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6600]/20 to-transparent border border-[#FF6600]/20 flex items-center justify-center text-[#FF6600]">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span
                          className="text-base font-black uppercase italic tracking-tighter"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {p.name}
                        </span>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1 italic line-clamp-1">
                          {p.description || t("status.active")}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex flex-col">
                      <span
                        className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block w-fit ${p.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-slate-500/10 text-slate-500"}`}
                      >
                        {p.status || t("status.active")}
                      </span>
                      <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-2 italic flex items-center gap-1">
                        <Clock className="w-2 h-2" /> {t("time.created")}:
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 border"
                        style={{
                          background: "var(--bg-primary)",
                          borderColor: "var(--border-primary)",
                        }}
                      >
                        <Users className="w-4 h-4" />
                      </div>
                      <span
                        className="text-xs font-black italic"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.participant_count || 0} {t("pm.teamOverview")}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="space-y-3 w-40">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-600 uppercase italic">
                          {t("status.completed")}
                        </span>
                        <span className="text-[10px] font-black text-[#FF6600] italic">
                          {Math.round(p.completion_index || 0)}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full rounded-full overflow-hidden"
                        style={{ background: "var(--bg-tertiary)" }}
                      >
                        <div
                          className="h-full bg-[#FF6600] transition-all duration-1000"
                          style={{ width: `${p.completion_index || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-8 text-right">
                    <div
                      className="inline-flex items-center justify-center p-3 rounded-xl border text-slate-700 group-hover:text-[#FF6600] group-hover:border-[#FF6600]/30 transition-all"
                      style={{
                        background: "var(--bg-secondary)",
                        borderColor: "var(--border-primary)",
                      }}
                    >
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-8 py-20 text-center text-slate-700 uppercase font-black italic tracking-widest"
                  >
                    {t("common.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CALENDAR QUICK VIEW */}
        <div
          id="pm-calendar"
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 scroll-mt-10"
        >
          <div className="card !p-10 space-y-8">
            <div className="flex items-center justify-between">
              <h3
                className="text-xl font-black uppercase italic tracking-tighter"
                style={{ color: "var(--text-primary)" }}
              >
                {t("admin.viewAllPrograms")}
              </h3>
              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest italic">
                {t("time.thisWeek")}
              </span>
            </div>
            <div className="space-y-4">
              {schedule.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-6 p-4 rounded-2xl border hover:bg-tertiary transition-all"
                  style={{
                    background: "var(--bg-secondary)",
                    borderColor: "var(--border-primary)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-[9px] font-black uppercase border"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border-primary)",
                    }}
                  >
                    <span className="text-[#FF6600]">
                      {new Date(item.scheduled_date).getDate()}
                    </span>
                    <span className="text-slate-600 text-[6px]">
                      {new Date(item.scheduled_date).toLocaleString("default", {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-xs font-black uppercase italic"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title}
                    </p>
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                      {item.program_name}
                    </p>
                  </div>
                </div>
              ))}
              {schedule.length === 0 && (
                <p className="text-[10px] font-black text-slate-800 italic uppercase">
                  {t("common.noResults")}
                </p>
              )}
            </div>
          </div>

          <div
            className="card !p-10 flex flex-col justify-between border-dashed"
            style={{
              background: "rgba(255, 102, 0, 0.02)",
              borderColor: "var(--brand-orange)",
            }}
          >
            <div className="space-y-4 text-left">
              <h3
                className="text-2xl font-black uppercase italic tracking-tighter"
                style={{ color: "var(--text-primary)" }}
              >
                {t("navigation.communication")}
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed tracking-tight">
                {t("navigation.communication")}
              </p>
            </div>
            <button
              onClick={() => router.push("/pm/communications/contacts")}
              className="w-full bg-[#FF6600] text-black font-black uppercase italic tracking-widest py-5 rounded-2xl hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 mt-10"
            >
              <MessageSquare className="w-5 h-5" />{" "}
              {t("navigation.communication")}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
