"use client";

import { useCallback, useEffect, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

/**
 * The reference lists beside the run list — forms, contacts, groups, programs
 * and the operational dashboard stats. They do not follow the status filter or
 * the page: they are read once on mount and re-read only when a write asks for
 * it (group creation passes `bypassCache`). Extracting them keeps that
 * distinction in one place and leaves the page's own reads untouched.
 *
 * The state moves with its readers: the page keeps the values it renders and
 * the one fetch a write calls (`fetchGroups`), everything else is internal.
 */
export default function useRunsReferenceData() {
  const [forms, setForms] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [programs, setPrograms] = useState([]);

  // Operational dashboard
  const [dashboardStats, setDashboardStats] = useState(null);

  const fetchForms = useCallback(async (bypassCache = false) => {
    const url = "/api/platform/forms?status=published";
    const apply = (data) => {
      if (data.success) setForms(data.forms || []);
    };
    try {
      // Cache-first paint: the form dropdown renders instantly from a fresh
      // snapshot; the network refresh keeps it current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  const fetchContacts = useCallback(async (bypassCache = false) => {
    const url = "/api/platform/form-runs?contacts=true";
    const apply = (data) => {
      if (data.success) setContacts(data.contacts || []);
    };
    try {
      // Cache-first paint: contact options render instantly from a fresh
      // snapshot; the network refresh keeps them current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  const fetchGroups = useCallback(async (bypassCache = false) => {
    const url = "/api/groups";
    const apply = (data) => {
      if (data.success) setGroups(data.groups || []);
    };
    try {
      // Cache-first paint: the group dropdown renders instantly from a fresh
      // snapshot; group creation passes bypassCache=true so it reflects the
      // newly created group immediately.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  const fetchPrograms = useCallback(async (bypassCache = false) => {
    const url = "/api/pm/programs";
    const apply = (data) => {
      if (data.success) setPrograms(data.programs || []);
    };
    try {
      // Cache-first paint: the program dropdown renders instantly from a fresh
      // snapshot; the network refresh keeps it current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  const fetchDashboardStats = useCallback(async (bypassCache = false) => {
    const url = "/api/platform/form-runs?dashboard=true";
    const apply = (data) => {
      if (data.success) setDashboardStats(data.stats);
    };
    try {
      // Cache-first paint: dashboard cards render instantly from a fresh
      // snapshot; the network refresh keeps them current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchForms();
    fetchContacts();
    fetchGroups();
    fetchPrograms();
    fetchDashboardStats();
  }, [fetchForms, fetchContacts, fetchGroups, fetchPrograms, fetchDashboardStats]);

  return {
    forms,
    contacts,
    groups,
    programs,
    dashboardStats,
    fetchGroups,
  };
}
