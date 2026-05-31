"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Mail,
  Clock,
  Shield,
  UserCheck,
  UserX,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function PendingUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [total, setTotal] = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [actionMsg, setActionMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPendingUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/pending-users");
      const data = await res.json();
      if (data.success) {
        setPendingUsers(data.pendingUsers);
        setGrouped(data.grouped);
        setTotal(data.total);
        // Auto-expand all groups
        const expanded = {};
        Object.keys(data.grouped).forEach((g) => {
          expanded[g] = true;
        });
        setExpandedGroups(expanded);
      }
    } catch (err) {
      console.error("Failed to fetch pending users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  const handleApprove = async (userCid, userName) => {
    setProcessingId(userCid);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_cid: userCid, admin_name: "super_admin" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          type: "success",
          text: `${userName} approved. Setup email ${data.emailSent ? "sent" : "queued"}.`,
        });
        fetchPendingUsers();
      } else {
        setActionMsg({
          type: "error",
          text: data.error || "Failed to approve.",
        });
      }
    } catch (err) {
      setActionMsg({ type: "error", text: "Network error during approval." });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userCid, userName) => {
    setProcessingId(userCid);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/reject-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_cid: userCid, admin_name: "super_admin" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: "info", text: `${userName} rejected.` });
        fetchPendingUsers();
      } else {
        setActionMsg({
          type: "error",
          text: data.error || "Failed to reject.",
        });
      }
    } catch (err) {
      setActionMsg({ type: "error", text: "Network error during rejection." });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = searchQuery
    ? pendingUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : pendingUsers;

  const filteredGrouped = {};
  if (searchQuery) {
    // Re-group filtered results
    for (const user of filteredUsers) {
      const g = user.group_name || "UNASSIGNED";
      if (!filteredGrouped[g]) filteredGrouped[g] = [];
      filteredGrouped[g].push(user);
    }
  }

  const displayGrouped = searchQuery ? filteredGrouped : grouped;

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
                User Management
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Pending Users
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Review and approve users who have registered but not yet been
              activated.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPendingUsers}
              className="btn p-3"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => router.push("/admin/bulk-upload")}
              className="btn btn-primary text-[10px] font-black uppercase tracking-wider px-4 py-3"
            >
              Bulk Upload
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 flex items-center gap-4 border-l-4 border-[var(--brand-orange)]">
            <Users className="w-6 h-6 text-[var(--brand-orange)]" />
            <div>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                Total Pending
              </p>
              <p className="text-2xl font-black">{total}</p>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4 border-l-4 border-emerald-500">
            <Shield className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                Groups
              </p>
              <p className="text-2xl font-black">
                {Object.keys(grouped).length}
              </p>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4 border-l-4 border-amber-500">
            <Clock className="w-6 h-6 text-amber-500" />
            <div>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                Awaiting Review
              </p>
              <p className="text-2xl font-black">{total}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg py-3 pl-12 pr-4 text-sm font-medium outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>

        {/* Action message */}
        <AnimatePresence>
          {actionMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-xl flex items-center gap-3 ${
                actionMsg.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
                  : actionMsg.type === "error"
                    ? "bg-rose-500/10 border border-rose-500/20 text-rose-500"
                    : "bg-blue-500/10 border border-blue-500/20 text-blue-500"
              }`}
            >
              {actionMsg.type === "success" ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : actionMsg.type === "error" ? (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-[11px] font-bold uppercase">
                {actionMsg.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[var(--brand-orange)] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && Object.keys(displayGrouped).length === 0 && (
          <div className="card p-16 text-center">
            <UserCheck className="w-16 h-16 text-emerald-500/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight">
              No Pending Users
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
              All users have been reviewed. New registrations will appear here
              for approval.
            </p>
          </div>
        )}

        {/* Grouped users */}
        {!loading &&
          Object.entries(displayGrouped).map(([groupName, users]) => (
            <div key={groupName} className="card !p-0 overflow-hidden">
              {/* Group header */}
              <button
                onClick={() =>
                  setExpandedGroups((prev) => ({
                    ...prev,
                    [groupName]: !prev[groupName],
                  }))
                }
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors border-b border-[var(--border-primary)]"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[var(--brand-orange)]" />
                  <span className="text-sm font-bold uppercase tracking-tight text-[var(--text-primary)]">
                    {groupName}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                    {users.length}
                  </span>
                </div>
                {expandedGroups[groupName] ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                )}
              </button>

              <AnimatePresence>
                {expandedGroups[groupName] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border-primary)]/50">
                          <th className="text-left p-4 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                            Name
                          </th>
                          <th className="text-left p-4 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                            Email
                          </th>
                          <th className="text-left p-4 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest hidden md:table-cell">
                            Role
                          </th>
                          <th className="text-left p-4 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest hidden md:table-cell">
                            Registered
                          </th>
                          <th className="text-right p-4 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr
                            key={user.cid}
                            className="border-b border-[var(--border-primary)]/20 hover:bg-white/5 transition-colors"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-black uppercase">
                                  {user.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight">
                                    {user.name}
                                  </p>
                                  {user.phone && (
                                    <p className="text-[8px] text-[var(--text-secondary)]">
                                      {user.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-[var(--text-secondary)]" />
                                <span className="text-[11px] text-[var(--text-secondary)]">
                                  {user.email}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 hidden md:table-cell">
                              <span className="text-[9px] font-bold px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 uppercase">
                                {user.role}
                              </span>
                            </td>
                            <td className="p-4 hidden md:table-cell">
                              <span className="text-[10px] text-[var(--text-secondary)]">
                                {user.created_at
                                  ? new Date(
                                      user.created_at,
                                    ).toLocaleDateString()
                                  : "—"}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() =>
                                    handleReject(user.cid, user.name)
                                  }
                                  disabled={processingId === user.cid}
                                  className="btn !bg-rose-500/10 hover:!bg-rose-500/20 border border-rose-500/20 text-rose-500 p-2 rounded-lg transition-all"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleApprove(user.cid, user.name)
                                  }
                                  disabled={processingId === user.cid}
                                  className="btn !bg-emerald-500 hover:!bg-emerald-600 border-none text-white p-2 rounded-lg transition-all flex items-center gap-2"
                                  title="Approve"
                                >
                                  {processingId === user.cid ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      <span className="text-[8px] font-black uppercase hidden lg:inline">
                                        Approve
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
      </div>
    </DashboardLayout>
  );
}
