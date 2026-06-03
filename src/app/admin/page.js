"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Layers,
  ListTodo,
  Users,
  Rocket,
  Activity,
  Sparkles,
  Zap,
  ChevronRight,
  Plus,
  Target,
  Bell,
  UserCheck,
  Loader2,
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  FileText,
  Calendar,
  Shield,
  TrendingUp,
  User,
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  LayoutGrid,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";

const ICONS = {
  Layers,
  Users,
  Rocket,
  Activity,
  Sparkles,
  Zap,
  ChevronRight,
  Plus,
  Target,
  Bell,
  UserCheck,
  Loader2,
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  FileText,
  Calendar,
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  badge,
  onClick,
  loading,
  subtitle,
}) => (
  <div
    onClick={onClick}
    className={`card group transition-all ${onClick ? "cursor-pointer hover:border-[var(--brand-orange)]" : ""}`}
  >
    <div className="flex justify-between items-start mb-4">
      <div
        className={`p-3 rounded-xl bg-primary border border-[var(--border-primary)] ${color} group-hover:scale-110 transition-transform`}
      >
        <Icon className="w-5 h-5" />
      </div>
      {badge && (
        <span className="text-[8px] font-black uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {badge}
        </span>
      )}
    </div>
    <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
      {title}
    </p>
    {loading ? (
      <div className="h-8 w-16 bg-[var(--border-primary)]/20 animate-pulse rounded-lg" />
    ) : (
      <>
        <h3 className="text-2xl font-bold text-[var(--text-primary)] uppercase tracking-tighter">
          {value}
        </h3>
        {subtitle && (
          <p className="text-[8px] font-bold text-slate-500 mt-1">{subtitle}</p>
        )}
      </>
    )}
  </div>
);

const SectionHeader = ({
  number,
  title,
  subtitle,
  icon: Icon,
  color,
  action,
}) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center text-sm font-black border border-white/10`}
      >
        {number}
      </div>
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[var(--brand-orange)]" />}
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && action}
  </div>
);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    programs: 0,
    participants: 0,
    totalStaff: 0,
  });
  const [activity, setActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [opStats, setOpStats] = useState({
    standups: 0,
    retros: 0,
    blockers: 0,
    support: 0,
    totalUsers: 0,
  });
  const [staffReports, setStaffReports] = useState([]);
  const [blockerTypes, setBlockerTypes] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const router = useRouter();
  const { t } = useI18n();

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const [stateRes, notifRes, opRes, blockerRes] = await Promise.all([
        fetch("/api/superadmin/full-state"),
        fetch("/api/notifications?recipient_id=sa"),
        fetch("/api/op-reports"),
        fetch("/api/blockers?status=active"),
      ]);

      const stateData = await stateRes.json();
      const notifData = await notifRes.json();
      const opData = await opRes.json();
      const blockerData = await blockerRes.json();

      if (stateData.success) {
        setStats(stateData.stats || {});
        setActivity(stateData.activity || []);
        setActivePrograms(stateData.activePrograms || []);
      }
      if (notifData.success) {
        setNotifications(notifData.notifications || []);
      }
      if (opData.success) {
        const reports = opData.reports || [];

        // Calculate op stats
        const standups = reports.filter((r) => r.report_type === "standup");
        const retros = reports.filter((r) => r.report_type === "retro");
        const blockers = reports.filter((r) => r.has_blockers);
        const support = reports.filter((r) => r.needs_support);

        // Count active blockers from dedicated blockers table
        const activeBlockersCount = blockerData.success
          ? (blockerData.blockers || []).length
          : 0;

        setOpStats({
          standups: standups.length,
          retros: retros.length,
          blockers: blockers.length + activeBlockersCount,
          support: support.length,
          totalUsers: new Set(reports.map((r) => r.user_id)).size,
        });

        // Per-staff reporting stats
        const userMap = {};
        reports.forEach((r) => {
          if (!userMap[r.user_id]) {
            userMap[r.user_id] = {
              id: r.user_id,
              name: r.user_name,
              role: r.user_role,
              standups: 0,
              retros: 0,
              blockers: 0,
              latest: null,
              weeks: new Set(),
            };
          }
          if (r.report_type === "standup") userMap[r.user_id].standups++;
          else userMap[r.user_id].retros++;
          if (r.has_blockers) userMap[r.user_id].blockers++;
          if (
            !userMap[r.user_id].latest ||
            new Date(r.created_at) > new Date(userMap[r.user_id].latest)
          ) {
            userMap[r.user_id].latest = r.created_at;
          }
          userMap[r.user_id].weeks.add(
            `${r.year}-W${String(r.week_number).padStart(2, "0")}`,
          );
        });
        setStaffReports(Object.values(userMap));

        // Blocker type aggregation
        const blockerAgg = {};
        standups
          .filter((r) => r.has_blockers && r.blocker_description)
          .forEach((r) => {
            const desc = r.blocker_description || "Other";
            blockerAgg[desc] = (blockerAgg[desc] || 0) + 1;
          });
        retros
          .filter((r) => r.had_blockers && r.blocker_type)
          .forEach((r) => {
            const type = r.blocker_type || "Other";
            blockerAgg[formatLabel(type)] =
              (blockerAgg[formatLabel(type)] || 0) + 1;
          });
        setBlockerTypes(
          Object.entries(blockerAgg)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6),
        );
      }
    } catch (err) {
      console.error("Dashboard sync failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!data.authenticated || data.user.role !== "super_admin") {
          router.replace("/login");
          return;
        }
        fetchDashboardData();
      } catch {
        router.replace("/login");
      }
    }
    checkAuth();
  }, [router, fetchDashboardData]);

  const handleApproval = async (notif) => {
    setProcessingId(notif.id);
    try {
      const contactsRes = await fetch("/api/contacts");
      const contactsData = await contactsRes.json();
      const pendingUser = contactsData.contacts.find(
        (c) => c.status === "pending" && notif.message.includes(c.name),
      );
      if (pendingUser) {
        await fetch("/api/contacts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cid: pendingUser.cid, status: "approved" }),
        });
      }
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notif.id, action: "read" }),
      });
      fetchDashboardData();
    } catch (e) {
      console.error("Approval Failed:", e);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-10 pb-20 text-left">
        {/* ──────── GLOBAL HEADER ──────── */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
                {t("reports.operationalReports")}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              {t("admin.command")}
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/programs/new")}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> {t("admin.newProgram")}
            </button>
          </div>
        </header>

        {/* ──────── NOTIFICATIONS ──────── */}
        {notifications.filter((n) => !n.read).length > 0 && (
          <div className="space-y-4">
            {notifications
              .filter((n) => !n.read)
              .map((notif) => (
                <div
                  key={notif.id}
                  className="card border-orange-500/30 bg-orange-500/5 flex flex-col md:flex-row justify-between items-center gap-6 animate-pulse hover:animate-none"
                >
                  <div className="flex items-center gap-5">
                    <div className="p-3 rounded-xl bg-orange-500/20 text-orange-500">
                      <Bell className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-tight text-[var(--text-primary)]">
                        {notif.title}
                      </h4>
                      <p className="text-[11px] font-medium text-[var(--brand-orange)] uppercase tracking-widest mt-1">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApproval(notif)}
                    disabled={processingId === notif.id}
                    className="btn btn-primary !bg-emerald-500 hover:!bg-emerald-600 border-none px-6 py-2.5 flex items-center gap-2"
                  >
                    {processingId === notif.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    <span className="text-[10px] font-black uppercase">
                      Approve Access
                    </span>
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION A — PROGRAM OPERATIONS                 */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6">
          <SectionHeader
            number="A"
            title={t("admin.programOperations")}
            subtitle="Educational / Program Performance"
            icon={Briefcase}
            color="bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
            action={
              <button
                onClick={() => router.push("/admin/programs")}
                className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline"
              >
                {t("admin.viewAllPrograms")}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title={t("admin.activePrograms")}
              value={stats.programs}
              icon={Layers}
              color="text-[var(--brand-orange)]"
              badge="LIVE"
              onClick={() => router.push("/admin/programs")}
              loading={loading}
            />
            <StatCard
              title={t("admin.totalParticipants")}
              value={stats.participants}
              icon={Users}
              color="text-blue-500"
              onClick={() => router.push("/admin/communications/contacts")}
              loading={loading}
            />
            <StatCard
              title={t("admin.operationalStaff")}
              value={stats.totalStaff}
              icon={Rocket}
              color="text-emerald-500"
              subtitle="Teachers, admins & staff"
              onClick={() => router.push("/admin/communications/contacts")}
              loading={loading}
            />
            <StatCard
              title="Projects"
              value={stats.projects || stats.totalProjects || "—"}
              icon={Briefcase}
              color="text-purple-500"
              subtitle="Active internal projects"
              onClick={() => router.push("/admin/projects")}
              loading={loading}
            />
          </div>

          {/* Activity Feed + Active Programs (existing content) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--brand-orange)]" />{" "}
                  {t("reports.recentReports")}
                </h4>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <TableSkeleton rows={4} />
                ) : activity.length > 0 ? (
                  activity.slice(0, 6).map((log, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:border-[var(--brand-orange)]">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight">
                          {log.action}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">
                          {log.user || "System"} ·{" "}
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--border-primary)]" />
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-[var(--text-secondary)] italic opacity-50 py-8 text-center">
                    {t("common.noResults")}
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-500" />{" "}
                  {t("admin.activePrograms")}
                </h4>
                <button
                  onClick={() => router.push("/admin/programs")}
                  className="text-[9px] font-bold text-[var(--brand-orange)] uppercase hover:underline"
                >
                  {t("common.viewAll")}
                </button>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <TableSkeleton rows={3} />
                ) : activePrograms.length > 0 ? (
                  activePrograms.map((prog, i) => (
                    <div
                      key={prog.id}
                      onClick={() => router.push(`/admin/programs/${prog.id}`)}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-[var(--border-primary)]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight truncate">
                          {prog.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] font-bold text-emerald-500 uppercase px-1.5 py-0.5 bg-emerald-500/10 rounded">
                            {prog.status}
                          </span>
                          <span className="text-[8px] text-[var(--text-secondary)] font-medium uppercase">
                            {new Date(prog.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-[var(--border-primary)]" />
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-[var(--text-secondary)] italic opacity-50 py-8 text-center">
                    {t("common.noResults")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION B — INTERNAL OPERATIONS                */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="B"
            title={t("admin.internalOperations")}
            subtitle="Staff Reporting & Operational Activity"
            icon={BarChart3}
            color="bg-indigo-500/10 text-indigo-500"
            action={
              <button
                onClick={() => router.push("/admin/op-reports")}
                className="text-[9px] font-black text-indigo-400 uppercase hover:underline"
              >
                {t("admin.viewAllReports")}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title={t("admin.mondayStandups")}
              value={opStats.standups}
              icon={Calendar}
              color="text-[var(--brand-orange)]"
              subtitle={`${opStats.totalUsers} active reporters`}
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.fridayRetros")}
              value={opStats.retros}
              icon={CheckCircle2}
              color="text-emerald-500"
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.blockersReported")}
              value={opStats.blockers}
              icon={AlertTriangle}
              color="text-rose-500"
              badge={opStats.blockers > 0 ? "ACTION" : ""}
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
          </div>

          {/* Quick insights row */}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div
              className="card flex items-center gap-4 p-5 cursor-pointer hover:border-[var(--brand-orange)] transition-all"
              onClick={() => router.push("/admin/op-reports")}
            >
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("admin.blockerRate")}
                </p>
                <p className="text-lg font-black">
                  {opStats.standups + opStats.retros > 0
                    ? Math.round(
                        (opStats.blockers /
                          (opStats.standups + opStats.retros)) *
                          100,
                      )
                    : 0}
                  %
                </p>
                <p className="text-[8px] font-bold text-slate-600">
                  of all reports
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section B — Internal Operations nav cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => router.push("/admin/work")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left ring-1 ring-[var(--brand-orange)]/20"
          >
            <div className="flex items-center gap-3 mb-3">
              <LayoutGrid className="w-5 h-5 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-widest">
                Work Management
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Centralized hub for all tasks, projects, categories, and blockers.
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/tasks")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <ListTodo className="w-5 h-5 text-blue-500" />
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                {t("reports.tasks")}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Track execution status across all teams.
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/blockers")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-rose-500" />
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                {t("reports.blockers")}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Monitor active blockers, resolution progress, and aging issues.
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/projects")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <Briefcase className="w-5 h-5 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                {t("reports.companyReports")}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              View project progress, task completion rates, and blocker impact.
            </p>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION C — TEAM ACCOUNTABILITY                */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="C"
            title={t("admin.teamAccountability")}
            subtitle="Reporting Reliability & Staff Consistency"
            icon={Users}
            color="bg-emerald-500/10 text-emerald-500"
            action={
              <button
                onClick={() =>
                  setExpandedSections((prev) => ({
                    ...prev,
                    teamTable: !prev.teamTable,
                  }))
                }
                className="text-[9px] font-black text-slate-500 uppercase hover:text-white transition-all flex items-center gap-1"
              >
                {expandedSections.teamTable ? "Collapse" : "Expand"}{" "}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${expandedSections.teamTable ? "rotate-180" : ""}`}
                />
              </button>
            }
          />

          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="card flex items-center gap-3 p-4 border-l-4 border-emerald-500">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("admin.consistent")}
                </p>
                <p className="text-xl font-black">
                  {
                    staffReports.filter((s) => s.standups + s.retros >= 4)
                      .length
                  }
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4 border-l-4 border-amber-500">
              <Clock className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("admin.atRisk")}
                </p>
                <p className="text-xl font-black">
                  {
                    staffReports.filter(
                      (s) =>
                        s.standups + s.retros > 0 && s.standups + s.retros < 4,
                    ).length
                  }
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4 border-l-4 border-rose-500">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("admin.inactive")}
                </p>
                <p className="text-xl font-black">
                  {stats.totalStaff - staffReports.length > 0
                    ? stats.totalStaff - staffReports.length
                    : 0}
                </p>
              </div>
            </div>
          </div>

          {/* Staff table (expandable) */}
          {(expandedSections.teamTable || staffReports.length <= 6) && (
            <div className="card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        {t("reports.teamMembers")}
                      </th>
                      <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        {t("reports.mondayStandup")}
                      </th>
                      <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        {t("reports.fridayRetro")}
                      </th>
                      <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        {t("reports.blockers")}
                      </th>
                      <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        {t("common.filter")}
                      </th>
                      <th className="text-right p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        {t("time.updated")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffReports
                      .sort(
                        (a, b) =>
                          b.standups + b.retros - (a.standups + a.retros),
                      )
                      .map((s) => {
                        const total = s.standups + s.retros;
                        const status =
                          total >= 4
                            ? "active"
                            : total > 0
                              ? "at_risk"
                              : "inactive";
                        return (
                          <tr
                            key={s.id}
                            className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-black uppercase">
                                  {s.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                                    {s.name}
                                  </p>
                                  <p className="text-[8px] text-slate-500 uppercase">
                                    {s.role}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center p-4 text-sm font-black">
                              {s.standups}
                            </td>
                            <td className="text-center p-4 text-sm font-black">
                              {s.retros}
                            </td>
                            <td className="text-center p-4">
                              <span
                                className={`text-sm font-black ${s.blockers > 0 ? "text-rose-500" : "text-slate-600"}`}
                              >
                                {s.blockers}
                              </span>
                            </td>
                            <td className="text-center p-4">
                              <span
                                className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                  status === "active"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : status === "at_risk"
                                      ? "bg-amber-500/10 text-amber-500"
                                      : "bg-rose-500/10 text-rose-500"
                                }`}
                              >
                                {status === "active"
                                  ? t("status.active")
                                  : status === "at_risk"
                                    ? t("admin.atRisk")
                                    : t("admin.inactive")}
                              </span>
                            </td>
                            <td className="text-right p-4 text-[10px] text-slate-500">
                              {s.latest
                                ? new Date(s.latest).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    {staffReports.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-[10px] text-slate-500 italic"
                        >
                          {t("reports.noReportsFound")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {expandedSections.teamTable && staffReports.length > 6 && (
            <button
              onClick={() => toggleSection("teamTable")}
              className="w-full text-center py-2 text-[9px] font-black text-slate-500 uppercase hover:text-white transition-all"
            >
              <ChevronUp className="w-3 h-3 mx-auto" /> Show Less
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION D — RISKS & BLOCKERS                   */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="D"
            title={t("admin.risksAndBlockers")}
            subtitle="Recurring Operational Problems"
            icon={AlertTriangle}
            color="bg-rose-500/10 text-rose-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top blockers by type */}
            <div className="card">
              <h4 className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-4">
                {t("admin.topBlockers")}
              </h4>
              {blockerTypes.length > 0 ? (
                <div className="space-y-3">
                  {blockerTypes.map(([type, count], i) => {
                    const maxCount = blockerTypes[0]?.[1] || 1;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            {type}
                          </span>
                          <span className="text-xs font-black text-rose-500">
                            {count} report{count > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-primary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-40" />
                  <p className="text-[10px] text-slate-500 italic">
                    {t("reports.noBlockersFound")}
                  </p>
                </div>
              )}
            </div>

            {/* Quick actions + support */}
            <div className="space-y-4">
              <div className="card">
                <h4 className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-4">
                  {t("admin.openSupportRequests")}
                </h4>
                {opStats.support > 0 ? (
                  <p className="text-3xl font-black text-amber-500">
                    {opStats.support}
                  </p>
                ) : (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-40" />
                    <p className="text-[10px] text-slate-500 italic">
                      {t("common.noResults")}
                    </p>
                  </div>
                )}
              </div>
              <div className="card">
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
                  {t("admin.quickActions")}
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push("/admin/op-reports")}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)] hover:border-rose-500/30 transition-all"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-tight">
                      {t("admin.viewAllBlockers")}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                  <button
                    onClick={() =>
                      router.push("/admin/op-reports?tab=blockers")
                    }
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)] hover:border-amber-500/30 transition-all"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-tight">
                      {t("admin.blockerReports")}
                    </span>
                    <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION E — HISTORICAL INTELLIGENCE            */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="E"
            title={t("admin.historicalIntelligence")}
            subtitle="Long-Term Operational Visibility"
            icon={Clock}
            color="bg-blue-500/10 text-blue-500"
            action={
              <button
                onClick={() => router.push("/admin/op-reports")}
                className="text-[9px] font-black text-blue-400 uppercase hover:underline"
              >
                Full Archive
              </button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push("/admin/op-reports")}
              className="card hover:border-blue-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                  {t("admin.reportArchive")}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Browse all submitted stand-ups and retros. Filter by user,
                month, or type.
              </p>
            </button>
            <button
              onClick={() => router.push("/admin/reports")}
              className="card hover:border-blue-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                  {t("admin.reportsHub")}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Historical program PM reports and intelligence feed.
              </p>
            </button>
            <button
              onClick={() => router.push("/admin/reports/responses")}
              className="card hover:border-blue-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                  {t("admin.reportResponses")}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                All submitted PM weekly report responses.
              </p>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SIDEBAR — BOTTOM SECTION CLEANED               */}
        {/* ═══════════════════════════════════════════════ */}
      </div>
    </DashboardLayout>
  );
}

function formatLabel(val) {
  if (!val || val === "—") return "—";
  if (typeof val !== "string") return String(val);
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
