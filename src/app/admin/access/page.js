"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import UserAccessView from "@/components/admin/access/UserAccessView";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const CONTACTS_URL = "/api/contacts";
const PERMISSIONS_URL = "/api/engineering/permissions";

// Stable shapes: the hook keys its internal work on these too.
const EMPTY_MODULES = {};

/**
 * The people list, people who are active first and then by name. The payload is
 * copied before sorting because it comes back through a shared cache: sorting it
 * in place would reorder the cached copy for every other screen reading it.
 */
const pickPeople = (payload) => {
  if (!payload?.success) return [];
  return [...(payload.contacts || [])].sort((first, second) => {
    if (first.status === "active" && second.status !== "active") return -1;
    if (first.status !== "active" && second.status === "active") return 1;
    return (first.name || "").localeCompare(second.name || "");
  });
};

const pickModules = (payload) => (payload?.success ? payload.modules || {} : EMPTY_MODULES);

const filterPeople = (people, query) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return people;
  return people.filter(
    (person) =>
      (person.name || "").toLowerCase().includes(normalizedQuery) ||
      (person.email || "").toLowerCase().includes(normalizedQuery) ||
      (person.cid || "").toLowerCase().includes(normalizedQuery),
  );
};

export default function UserAccessSummary() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 20;

  // The people and the module catalogue, read through the shared hook: it owns
  // the cache, the cache-first paint and the discarding of a stale answer, so
  // the page keeps no copy of its own and reads its data during render.
  const {
    data: allUsers,
    loading: usersLoading,
    error: usersError,
    status: usersStatus,
    refresh: refreshUsers,
  } = useApi(CONTACTS_URL, {
    defaultValue: [],
    transform: pickPeople,
  });
  const { data: modules } = useApi(PERMISSIONS_URL, {
    defaultValue: EMPTY_MODULES,
    transform: pickModules,
  });

  // The visible list is the whole list filtered by what is typed, so it is
  // derived: held as a second copy it could disagree with the query that made it.
  const searchResults = filterPeople(allUsers, searchQuery);
  const [supervisorQuery, setSupervisorQuery] = useState("");
  const [showSupervisorPicker, setShowSupervisorPicker] = useState(false);
  const [savingSupervisor, setSavingSupervisor] = useState(false);
  const [supervisorMsg, setSupervisorMsg] = useState("");
  const [supervisorError, setSupervisorError] = useState("");

  const fetchUserSummary = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    setSummaryError("");
    try {
      // Fetch permissions + profile + groups + assignments in parallel
      const [permsRes, groupsRes, respRes, profileRes, rolesRes] =
        await Promise.all([
          fetch(`/api/engineering/permissions?user_cid=${user.cid}`),
          fetch(`/api/user-groups?user_cid=${user.cid}`),
          fetch(`/api/responsibilities?user_cid=${user.cid}`),
          fetch(`/api/access-profiles/assign?user_cid=${user.cid}`),
          fetch(`/api/contacts/${user.cid}/roles`),
        ]);

      const permsData = await permsRes.json();
      const groupsData = await groupsRes.json();
      const respData = await respRes.json();
      const profileData = await profileRes.json();
      const rolesData = await rolesRes.json();

      setUserData({
        user: permsData.user || user,
        groups: groupsData.groups || [],
        responsibilities: respData.responsibilities || [],
        profile: {
          assigned: profileData.assignedProfile || null,
          roleDefault: profileData.roleDefault || null,
          effectiveSource: profileData.effectiveSource || "legacy",
        },
        effectivePermissions: permsData.effectivePermissions || {},
        individualGrants: permsData.individualGrants || [],
        individualRestrictions: permsData.individualRestrictions || [],
        assignments: rolesData.success ? rolesData.roles || [] : [],
      });
    } catch (error) {
      console.error("Failed to fetch user summary", error);
      // The summary is five parallel reads; if any failed there is nothing to
      // show. Say so rather than leaving the panel blank.
      setUserData(null);
      setSummaryError(t("adminMisc.access.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const currentSupervisor = userData?.user?.supervisor_cid
    ? allUsers.find((person) => person.cid === userData.user.supervisor_cid) || {
        cid: userData.user.supervisor_cid,
        name: userData.user.supervisor_cid,
        email: "",
      }
    : null;

  const filteredSupervisors = (() => {
    if (!supervisorQuery.trim()) return allUsers.slice(0, 8);
    const normalizedQuery = supervisorQuery.toLowerCase();
    return allUsers
      .filter(
        (person) =>
          (person.name || "").toLowerCase().includes(normalizedQuery) ||
          (person.email || "").toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 8);
  })();

  const assignSupervisor = async (supervisor) => {
    setSavingSupervisor(true);
    setSupervisorMsg("");
    setSupervisorError("");
    try {
      const response = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_supervisor",
          user_cid: selectedUser.cid,
          supervisor_cid: supervisor.cid,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSupervisorMsg(t("adminMisc.access.supervisorAssigned"));
        setShowSupervisorPicker(false);
        setSupervisorQuery("");
        await fetchUserSummary(selectedUser);
      } else {
        setSupervisorError(
          t((data.error || t("adminMisc.access.supervisorError")) || "") ||
            (data.error || t("adminMisc.access.supervisorError")),
        );
      }
    } catch {
      setSupervisorError(t("adminMisc.access.supervisorError"));
    } finally {
      setSavingSupervisor(false);
    }
  };

  const removeSupervisor = async () => {
    setSavingSupervisor(true);
    setSupervisorMsg("");
    setSupervisorError("");
    try {
      const response = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_supervisor",
          user_cid: selectedUser.cid,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSupervisorMsg(t("adminMisc.access.supervisorRemoved"));
        await fetchUserSummary(selectedUser);
      } else {
        setSupervisorError(
          t((data.error || t("adminMisc.access.supervisorError")) || "") ||
            (data.error || t("adminMisc.access.supervisorError")),
        );
      }
    } catch {
      setSupervisorError(t("adminMisc.access.supervisorError"));
    } finally {
      setSavingSupervisor(false);
    }
  };

  // Pagination
  //
  // The page belongs to the query it was chosen under: changing the query starts
  // again at the first page. Kept as an effect this ran after the render, so the
  // list was drawn for one frame under the previous query's page number.
  const [pageChoice, setPageChoice] = useState({ query: "", page: 1 });
  const currentPage = pageChoice.query === searchQuery ? pageChoice.page : 1;
  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = searchResults.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const goToPage = (page) => setPageChoice({ query: searchQuery, page });
  const ctx = {
    assignSupervisor,
    currentSupervisor,
    fetchUserSummary,
    filteredSupervisors,
    goToPage,
    loading,
    modules,
    paginatedUsers,
    refreshUsers,
    removeSupervisor,
    safePage,
    savingSupervisor,
    searchQuery,
    selectedUser,
    setSearchQuery,
    setSelectedUser,
    setShowSupervisorPicker,
    setSupervisorQuery,
    setUserData,
    showSupervisorPicker,
    summaryError,
    supervisorError,
    supervisorMsg,
    supervisorQuery,
    t,
    totalPages,
    userData,
    usersError,
    usersLoading,
    usersStatus,
  };

  return <UserAccessView ctx={ctx} />;
}
