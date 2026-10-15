"use client";

import { useState, useCallback, useEffect } from "react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { teamAccountability } from "@/components/admin/dashboard-page/accountabilityModel";

export function useAdminDashboardData({ router, t, lang }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    programs: 0,
    participants: 0,
    totalStaff: 0,
  });
  const [activity, setActivity] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [accountability, setAccountability] = useState(() =>
    teamAccountability({ reports: [], roster: [], blockers: [], now: new Date() }),
  );
  const [kpiSummary, setKpiSummary] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    // Staff-context reports only: a founder's or participant's stand-up is not
    // team accountability. Blockers come from the blockers table (with their
    // task), never from the report flags.
    const urls = [
      "/api/superadmin/full-state",
      "/api/op-reports?context_type=staff",
      "/api/admin/blockers?status=active",
      "/api/dashboard?summary=true",
    ];

    const apply = (stateData, opData, blockerData, kpiData) => {
      if (stateData.success) {
        setStats(stateData.stats || {});
        setActivity(stateData.activity || []);
        setActivePrograms(stateData.activePrograms || []);
      }
      if (stateData.success && opData.success && blockerData.success) {
        setAccountability(
          teamAccountability({
            reports: opData.reports || [],
            roster: stateData.staffRoster || [],
            blockers: blockerData.blockers || [],
            now: new Date(),
          }),
        );
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
    accountability,
    kpiSummary,
    fetchDashboardData,
    fetchWidgetData: () => {},
  };
}