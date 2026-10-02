"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import {
  MONTHS,
  pickBlockers,
  pickProjects,
  pickReports,
  pickTasks,
} from "@/components/admin/op-reports/constants";
import ReportsHeader from "@/components/admin/op-reports/ReportsHeader";
import ReportsTabs from "@/components/admin/op-reports/ReportsTabs";
import ReportsFilters from "@/components/admin/op-reports/ReportsFilters";
import FeedTab from "@/components/admin/op-reports/FeedTab";
import MonthlyBreakdown from "@/components/admin/op-reports/MonthlyBreakdown";
import TasksTab from "@/components/admin/op-reports/TasksTab";
import BlockersTab from "@/components/admin/op-reports/BlockersTab";
import TrendsDashboard from "@/components/admin/op-reports/TrendsDashboard";
import UserTimelineModal from "@/components/admin/op-reports/UserTimelineModal";
import ReportDetailModal from "@/components/admin/op-reports/ReportDetailModal";

/**
 * SUPER ADMIN OPERATIONAL REPORTS DASHBOARD
 *
 * Full company-wide visibility with:
 * - Filter by user, date range, month, week, report type
 * - Individual staff reporting timelines
 * - Monthly activity breakdown
 * - Blockers tracking
 * - PDF export via browser print
 */

export default function AdminOpReports() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("All Users");
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [viewingReport, setViewingReport] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [activeTab, setActiveTab] = useState("feed");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBlocker, setFilterBlocker] = useState("all");
  const [filterCarryOver, setFilterCarryOver] = useState("all");
  const [filterWorkspace, setFilterWorkspace] = useState("main");
  const [blockerFilterWeek, setBlockerFilterWeek] = useState("all");
  const [blockerFilterStatus, setBlockerFilterStatus] = useState("all");
  const PAGE_SIZE = 20;

  // Which page of the feed is shown is remembered TOGETHER WITH the filter
  // combination it was turned to: choosing a filter therefore shows the first
  // page again by derivation, and no effect has to watch the filters to write
  // that reset (§4.3 - a reset reachable during render is derived, not written).
  const reportsFilterKey = JSON.stringify([
    search,
    filterUser,
    filterType,
    filterMonth,
    filterProject,
    filterStatus,
    filterBlocker,
    filterCarryOver,
    filterWorkspace,
  ]);
  const [reportsPageState, setReportsPageState] = useState({
    key: reportsFilterKey,
    page: 1,
  });
  const reportsPage =
    reportsPageState.key === reportsFilterKey ? reportsPageState.page : 1;
  const setReportsPage = (next) =>
    setReportsPageState({
      key: reportsFilterKey,
      page: typeof next === "function" ? next(reportsPage) : next,
    });
  const [blockersPage, setBlockersPage] = useState(1);

  // Who is signed in comes from the shell's session cache rather than the
  // browser's stored copy, so the request addresses below can be a plain result
  // of it - and no read has to wait on an effect to learn the identity.
  const { user: sessionUser, cid, role } = useSessionUser();
  const isSA = role === "super_admin";
  const userId = cid || sessionUser?.id || null;

  // ─── Reads ────────────────────────────────────────────────────────────────
  // The shared hook owns the cache, the cache-first paint and the discarding of
  // a stale answer, so the screen keeps no copy of any of these values.
  const { data: reports, loading: reportsLoading } = useApi(
    `/api/op-reports?workspace=${filterWorkspace}`,
    { defaultValue: [], transform: pickReports },
  );
  const { data: allProjects, loading: projectsLoading } = useApi(
    "/api/projects",
    {
      defaultValue: [],
      transform: pickProjects,
      // The old loader re-asked for all three reads when the workspace filter
      // changed; this address does not carry it, so that re-ask is kept here.
      deps: [filterWorkspace],
    },
  );
  const blockersUrl = isSA
    ? "/api/blockers"
    : userId
      ? `/api/blockers?user_id=${userId}`
      : null;
  // The blockers read waits for the identity, so it is not part of the feed's
  // gate: the feed is not waiting on it, and counting it would drop the skeleton
  // back over the feed a second time, in the moment the identity arrives.
  const { data: blockersList } = useApi(blockersUrl, {
    defaultValue: [],
    transform: pickBlockers,
    deps: [isSA, userId, filterWorkspace],
  });
  const loading = reportsLoading || projectsLoading;

  // The task list is read only while a tab that shows it is open: a closed tab
  // has no address, so nothing is read and nothing is loading.
  const tasksTabOpen = activeTab === "tasks" || activeTab === "blockers";
  const allTasksUrl = isSA
    ? "/api/tasks?brief=true&limit=200"
    : userId
      ? `/api/tasks?user_id=${userId}&brief=true&limit=200`
      : null;
  const { data: allTasks, loading: tasksLoading } = useApi(
    tasksTabOpen ? allTasksUrl : null,
    { defaultValue: [], transform: pickTasks, deps: [isSA, userId] },
  );

  // The member list the filters offer is not stored: it is the reports' own
  // authors, derived during render from the read's value.
  const users = useMemo(() => {
    const userMap = {};
    reports.forEach((report) => {
      if (report.user_id && !userMap[report.user_id]) {
        userMap[report.user_id] = {
          id: report.user_id,
          name: report.user_name,
          role: report.user_role,
        };
      }
    });
    return Object.values(userMap);
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports
      .filter((report) => {
        const matchesSearch =
          report.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          String(report.week_number).includes(search) ||
          String(report.year).includes(search);
        const matchesUser =
          filterUser === "All Users" || report.user_id === filterUser;
        const matchesType =
          filterType === "all" || report.report_type === filterType;

        let matchesMonth = true;
        if (filterMonth !== "all") {
          const created = new Date(report.created_at);
          const monthIndex = created.getMonth();
          matchesMonth = MONTHS[monthIndex] === filterMonth;
        }

        return matchesSearch && matchesUser && matchesType && matchesMonth;
      })
      .sort((reportA, reportB) => {
        // Sort by year desc, then week desc, then created_at desc
        if (reportB.year !== reportA.year) return reportB.year - reportA.year;
        if (reportB.week_number !== reportA.week_number)
          return reportB.week_number - reportA.week_number;
        return new Date(reportB.created_at) - new Date(reportA.created_at);
      });
  }, [reports, search, filterUser, filterType, filterMonth]);

  // Compute per-user stats
  const userStats = useMemo(() => {
    const stats = {};
    reports.forEach((report) => {
      if (!stats[report.user_id]) {
        stats[report.user_id] = {
          id: report.user_id,
          name: report.user_name,
          role: report.user_role,
          standups: 0,
          retros: 0,
          latest: null,
          blockers: [],
        };
      }
      if (report.report_type === "standup") stats[report.user_id].standups++;
      else stats[report.user_id].retros++;
      if (
        !stats[report.user_id].latest ||
        new Date(report.created_at) > new Date(stats[report.user_id].latest)
      ) {
        stats[report.user_id].latest = report.created_at;
      }
      // Track blockers from stand-ups
      if (report.has_blockers) stats[report.user_id].blockers.push(report);
    });
    return Object.values(stats);
  }, [reports]);

  // Aggregated blocker data (from both op-reports AND dedicated blockers table)
  const _blockerData = useMemo(() => {
    // From op-reports (old format)
    const reportBlockers = reports.filter((report) => report.has_blockers);
    const byUser = {};
    reportBlockers.forEach((report) => {
      if (!byUser[report.user_id])
        byUser[report.user_id] = {
          name: report.user_name,
          count: 0,
          reports: [],
          taskBlockers: 0,
        };
      byUser[report.user_id].count++;
      byUser[report.user_id].reports.push(report);
    });
    // From dedicated blockers table (new format)
    blockersList.forEach((blocker) => {
      if (!byUser[blocker.user_id])
        byUser[blocker.user_id] = {
          name: blocker.user_name || blocker.user_id,
          count: 0,
          reports: [],
          taskBlockers: 0,
        };
      byUser[blocker.user_id].taskBlockers++;
    });
    return Object.values(byUser).sort(
      (userA, userB) =>
        userB.count + userB.taskBlockers - (userA.count + userA.taskBlockers),
    );
  }, [reports, blockersList]);

  const userReports = useMemo(() => {
    if (!viewingUser) return [];
    return reports
      .filter((report) => report.user_id === viewingUser.id)
      .sort(
        (reportA, reportB) =>
          reportB.year - reportA.year ||
          reportB.week_number - reportA.week_number,
      );
  }, [reports, viewingUser]);

  return (
    <>
      <div className="space-y-10 pb-20 text-left">
        <ReportsHeader
          totalReports={reports.length}
          memberCount={users.length}
          monthCount={filteredReports.length}
          onBack={() => router.push("/admin")}
        />

        <ReportsTabs activeTab={activeTab} onSelectTab={setActiveTab} />

        <ReportsFilters
          search={search}
          setSearch={setSearch}
          users={users}
          filterUser={filterUser}
          setFilterUser={setFilterUser}
          filterType={filterType}
          setFilterType={setFilterType}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          filterProject={filterProject}
          setFilterProject={setFilterProject}
          allProjects={allProjects}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterBlocker={filterBlocker}
          setFilterBlocker={setFilterBlocker}
          filterCarryOver={filterCarryOver}
          setFilterCarryOver={setFilterCarryOver}
          filterWorkspace={filterWorkspace}
          setFilterWorkspace={setFilterWorkspace}
        />

        {activeTab === "feed" && (
          <FeedTab
            userStats={userStats}
            viewingUser={viewingUser}
            setViewingUser={setViewingUser}
            loading={loading}
            filteredReports={filteredReports}
            reportsPage={reportsPage}
            PAGE_SIZE={PAGE_SIZE}
            setReportsPage={setReportsPage}
            setViewingReport={setViewingReport}
          />
        )}

        {activeTab === "monthly" && (
          <MonthlyBreakdown reports={filteredReports} />
        )}

        {activeTab === "tasks" && (
          <TasksTab
            allTasks={allTasks}
            tasksLoading={tasksLoading}
            onViewAllTasks={() => router.push("/admin/tasks")}
          />
        )}

        {activeTab === "blockers" && (
          <BlockersTab
            blockersList={blockersList}
            allTasks={allTasks}
            allProjects={allProjects}
            blockersPage={blockersPage}
            setBlockersPage={setBlockersPage}
            blockerFilterWeek={blockerFilterWeek}
            setBlockerFilterWeek={setBlockerFilterWeek}
            blockerFilterStatus={blockerFilterStatus}
            setBlockerFilterStatus={setBlockerFilterStatus}
            PAGE_SIZE={PAGE_SIZE}
          />
        )}

        {activeTab === "trends" && (
          <TrendsDashboard
            reports={filteredReports}
            allReports={reports}
            onViewReport={setViewingReport}
          />
        )}
      </div>

      {viewingUser && activeTab === "feed" && (
        <UserTimelineModal
          viewingUser={viewingUser}
          userReports={userReports}
          setViewingUser={setViewingUser}
          setViewingReport={setViewingReport}
        />
      )}

      {viewingReport && (
        <ReportDetailModal
          report={viewingReport}
          onClose={() => setViewingReport(null)}
        />
      )}
    </>
  );
}
