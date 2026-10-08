"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import BlockersHeader from "@/components/admin/blockers/BlockersHeader";
import BlockersStats from "@/components/admin/blockers/BlockersStats";
import BlockersFilters from "@/components/admin/blockers/BlockersFilters";
import BlockersTable from "@/components/admin/blockers/BlockersTable";
import BlockerDetailModal from "@/components/admin/blockers/BlockerDetailModal";

// Module scope on purpose: the hook keys its internal callback on these functions,
// so inline arrows would give them a new identity on every render and refetch in
// a loop.
const pickBlockers = (payload) => (payload?.success ? payload.blockers || [] : []);
const pickBlockerTasks = (payload) => (payload?.success ? payload.tasks || [] : []);

/**
 * SUPER ADMIN BLOCKERS DASHBOARD
 *
 * Dedicated blocker management page.
 * Displays all blockers with task and user context.
 * Default view: active blockers first, resolved below.
 *
 * Rules:
 *   - Only blocker creator can mark resolved
 *   - Super Admin can view, filter, monitor but NOT resolve
 */

export default function AdminBlockers() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("All Users");
  const [viewingBlocker, setViewingBlocker] = useState(null);
  const { t } = useI18n();

  // The identity comes from the shell's session cache instead of the browser's
  // stored copy, which is what allows the request addresses themselves to be a
  // plain result of it. Phase 6: anyone but a super admin sees only their own
  // blockers and tasks, so those reads wait for the identity.
  const { cid, role } = useSessionUser();
  const isSuperAdmin = role === "super_admin";
  const ready = isSuperAdmin || !!cid;
  const { data: blockers, loading: blockersLoading } = useApi(
    isSuperAdmin ? "/api/blockers" : cid ? `/api/blockers?user_id=${cid}` : null,
    { defaultValue: [], transform: pickBlockers, deps: [isSuperAdmin, cid] },
  );
  const { data: tasks, loading: tasksLoading } = useApi(
    isSuperAdmin ? "/api/tasks" : cid ? `/api/tasks?user_id=${cid}` : null,
    { defaultValue: [], transform: pickBlockerTasks, deps: [isSuperAdmin, cid] },
  );
  const loading = !ready || blockersLoading || tasksLoading;

  // Build task lookup
  const taskMap = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      map[task.id] = task;
    });
    return map;
  }, [tasks]);

  // Build user list from blockers
  const users = useMemo(() => {
    const userMap = {};
    blockers.forEach((blocker) => {
      if (blocker.user_id && !userMap[blocker.user_id]) {
        userMap[blocker.user_id] = { id: blocker.user_id, name: blocker.user_name };
      }
    });
    return Object.values(userMap);
  }, [blockers]);

  // Filtered + sorted: active first, then resolved
  const filteredBlockers = useMemo(() => {
    return blockers
      .filter((blocker) => {
        const matchesSearch =
          blocker.title?.toLowerCase().includes(search.toLowerCase()) ||
          blocker.user_name?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          filterStatus === "all" || blocker.status === filterStatus;
        const matchesUser =
          filterUser === "All Users" || blocker.user_id === filterUser;
        return matchesSearch && matchesStatus && matchesUser;
      })
      .sort((first, second) => {
        // Active first, then resolved
        if (first.status === "active" && second.status !== "active") return -1;
        if (first.status !== "active" && second.status === "active") return 1;
        // Within same status, newest first
        return new Date(second.created_at) - new Date(first.created_at);
      });
  }, [blockers, search, filterStatus, filterUser]);

  const stats = useMemo(() => {
    return {
      active: blockers.filter((blocker) => blocker.status === "active").length,
      resolved: blockers.filter((blocker) => blocker.status === "resolved").length,
      total: blockers.length,
    };
  }, [blockers]);

  const getTaskTitle = (taskId) => {
    const task = taskMap[taskId];
    return task
      ? task.title
      : t("adminMisc.blockers.taskFallback", { id: taskId });
  };

  return (
    <>
      <div className="space-y-8 pb-20 text-left">
        {/* HEADER */}
        <BlockersHeader stats={stats} onBack={() => router.push("/admin")} />

        {/* STATS ROW */}
        <BlockersStats stats={stats} />

        {/* FILTERS */}
        <BlockersFilters
          search={search}
          setSearch={setSearch}
          users={users}
          filterUser={filterUser}
          setFilterUser={setFilterUser}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
        />

        {/* BLOCKERS TABLE */}
        <BlockersTable
          loading={loading}
          filteredBlockers={filteredBlockers}
          onView={setViewingBlocker}
          onOpenTasks={() => router.push("/admin/tasks")}
          getTaskTitle={getTaskTitle}
        />

        {/* BLOCKER DETAIL MODAL */}
        {viewingBlocker && (
          <BlockerDetailModal
            viewingBlocker={viewingBlocker}
            setViewingBlocker={setViewingBlocker}
            getTaskTitle={getTaskTitle}
          />
        )}
      </div>
    </>
  );
}
