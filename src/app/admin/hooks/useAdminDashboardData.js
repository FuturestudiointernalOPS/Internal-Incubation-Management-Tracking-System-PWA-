"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export function useAdminDashboardData({ router, t, lang }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    programs: 0,
    participants: 0,
    totalStaff: 0,
  });
  const [activity, setActivity] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [opStats, setOpStats] = useState({
    standups: 0,
    retros: 0,
    blockers: 0,
    support: 0,
    totalUsers: 0,
  });
  const [staffReports, setStaffReports] = useState([]);
  const [kpiSummary, setKpiSummary] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    const urls = [
      "/api/superadmin/full-state",
      "/api/op-reports",
      "/api/blockers?status=active",
      "/api/dashboard?summary=true",
    ];

    const apply = (stateData, opData, blockerData, kpiData) => {
      if (stateData.success) {
        setStats(stateData.stats || {});
        setActivity(stateData.activity || []);
        setActivePrograms(stateData.activePrograms || []);
      }
      if (opData.success) {
        const reports = opData.reports || [];

        const standups = reports.filter(
          (report) => report.report_type === "standup",
        );
        const retros = reports.filter(
          (report) => report.report_type === "retro",
        );
        const blockers = reports.filter((report) => report.has_blockers);
        const support = reports.filter((report) => report.needs_support);

        const activeBlockersCount = blockerData.success
          ? (blockerData.blockers || []).length
          : 0;

        setOpStats({
          standups: standups.length,
          retros: retros.length,
          blockers: blockers.length + activeBlockersCount,
          support: support.length,
          totalUsers: new Set(reports.map((report) => report.user_id)).size,
        });

        const userMap = {};
        reports.forEach((report) => {
          if (!userMap[report.user_id]) {
            userMap[report.user_id] = {
              id: report.user_id,
              name: report.user_name,
              role: report.user_role,
              standups: 0,
              retros: 0,
              blockers: 0,
              latest: null,
              weeks: new Set(),
            };
          }
          if (report.report_type === "standup") userMap[report.user_id].standups++;
          else userMap[report.user_id].retros++;
          if (report.has_blockers) userMap[report.user_id].blockers++;
          if (
            !userMap[report.user_id].latest ||
            new Date(report.created_at) > new Date(userMap[report.user_id].latest)
          ) {
            userMap[report.user_id].latest = report.created_at;
          }
          userMap[report.user_id].weeks.add(
            `${report.year}-W${String(report.week_number).padStart(2, "0")}`,
          );
        });
        setStaffReports(Object.values(userMap));

        const blockerAgg = {};
        standups
          .filter((report) => report.has_blockers && report.blocker_description)
          .forEach((report) => {
            const desc = report.blocker_description || "Other";
            blockerAgg[desc] = (blockerAgg[desc] || 0) + 1;
          });
        retros
          .filter((report) => report.had_blockers && report.blocker_type)
          .forEach((report) => {
            const type = report.blocker_type || "Other";
            blockerAgg[type] = (blockerAgg[type] || 0) + 1;
          });
      }
      if (kpiData.success) {
        setKpiSummary(kpiData.programs || []);
      }
    };

    try {
      const cached = urls.map((url) => cacheGet(url));
      if (cached.every((cachedItem) => cachedItem !== null)) {
        apply(cached[0], cached[1], cached[2], cached[3]);
        setLoading(false);
      }

      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const payloads = await Promise.all(
        responses.map((response) => response.json()),
      );
      urls.forEach((url, index) => cacheSet(url, payloads[index]));
      apply(payloads[0], payloads[1], payloads[2], payloads[3]);
    } catch (err) {
      console.error("Dashboard sync failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && JSON.parse(storedUser).role === "super_admin") {
        fetchDashboardData();
      }
    } catch (_) {}

    try {
      const response = await fetch("/api/auth/session");
      const payload = await response.json();
      if (
        !payload.authenticated ||
        !payload.user ||
        payload.user.role !== "super_admin"
      ) {
        router.replace("/login");
        return;
      }
      fetchDashboardData();
    } catch {
      router.replace("/login");
    }
  }, [router, fetchDashboardData]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    loading,
    stats,
    activity,
    activePrograms,
    opStats,
    staffReports,
    kpiSummary,
    fetchDashboardData,
    fetchWidgetData: () => {},
  };
}