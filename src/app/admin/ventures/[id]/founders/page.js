"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Shield,
  Crown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Ban,
  RefreshCw,
  ChevronRight,
  Search,
  Send,
  UserPlus,
  MoreVertical,
  Edit3,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const VENTURE_ROLES = [
  "founder",
  "co-founder",
  "ceo",
  "cto",
  "coo",
  "cfo",
  "cmo",
  "cpo",
  "cio",
  "product_manager",
  "engineering_manager",
  "marketing_lead",
  "sales_lead",
  "operations_lead",
  "finance_lead",
  "hr_lead",
  "legal_lead",
  "advisor",
  "observer",
];

const ROLE_COLORS = {
  founder: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "co-founder": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  ceo: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  cto: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  advisor: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  observer: "text-slate-500 bg-slate-500/5 border-slate-500/10",
};

export default function VentureFoundersPage() {
  const { id } = useParams();
  const router = useRouter();

  const [venture, setVenture] = useState(null);
  const [founders, setFounders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "co-founder" });
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  // Transfer ownership modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState(null);

  // Success/Error toast
  const [toast, setToast] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Menu
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const notify = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ventureRes, foundersRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/founders`),
      ]);
      const ventureData = await ventureRes.json();
      const foundersData = await foundersRes.json();

      if (!ventureData.success) throw new Error(ventureData.error || "Failed to load venture");
      if (!foundersData.success) throw new Error(foundersData.error || "Failed to load founders");

      setVenture(ventureData.venture);
      setFounders(foundersData.founders || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.name.trim() || !inviteForm.role) {
      notify("Please fill in all required fields", "error");
      return;
    }

    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch(`/api/ventures/${id}/founders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();

      if (data.success) {
        notify(`Invitation sent to ${inviteForm.name}`);
        setShowInviteModal(false);
        setInviteForm({ email: "", name: "", role: "co-founder" });
        fetchData();
      } else {
        notify(data.error || "Failed to send invitation", "error");
      }
    } catch (e) {
      notify("Network error", "error");
    } finally {
      setInviting(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;

    setTransferring(true);
    try {
      const res = await fetch(`/api/ventures/${id}/founders/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_owner_id: parseInt(transferTarget) }),
      });
      const data = await res.json();

      if (data.success) {
        notify("Ownership transferred successfully");
        setShowTransferModal(false);
        setTransferTarget("");
        setConfirmAction(null);
        fetchData();
      } else {
        notify(data.error || "Transfer failed", "error");
        setConfirmAction(null);
      }
    } catch (e) {
      notify("Network error", "error");
    } finally {
      setTransferring(false);
    }
  };

  const handleSuspend = async (founderId) => {
    try {
      const res = await fetch(`/api/ventures/${id}/founders/${founderId}/suspend`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        notify("User suspended");
        setOpenMenuId(null);
        fetchData();
      } else {
        notify(data.error || "Failed to suspend", "error");
      }
    } catch {
      notify("Network error", "error");
    }
  };

  const handleReactivate = async (founderId) => {
    try {
      const res = await fetch(`/api/ventures/${id}/founders/${founderId}/reactivate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        notify("User reactivated");
        setOpenMenuId(null);
        fetchData();
      } else {
        notify(data.error || "Failed to reactivate", "error");
      }
    } catch {
      notify("Network error", "error");
    }
  };

  const handleRemove = async (founderId) => {
    try {
      const res = await fetch(`/api/ventures/${id}/founders/${founderId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        notify("Founder removed");
        setOpenMenuId(null);
        setConfirmAction(null);
        fetchData();
      } else {
        notify(data.error || "Failed to remove", "error");
        setConfirmAction(null);
      }
    } catch {
      notify("Network error", "error");
    }
  };

  const handleRoleUpdate = async (founderId, newRole) => {
    try {
      const res = await fetch(`/api/ventures/${id}/founders/${founderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Role updated");
        setOpenMenuId(null);
        fetchData();
      } else {
        notify(data.error || "Failed to update role", "error");
      }
    } catch {
      notify("Network error", "error");
    }
  };

  const getRoleColor = (role) => {
    return ROLE_COLORS[role] || "text-blue-400 bg-blue-500/10 border-blue-500/20";
  };

  const currentUserId = founders.find((f) => f.is_owner)?.id;

  const filteredFounders = founders.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.name?.toLowerCase().includes(q) ||
      f.email?.toLowerCase().includes(q) ||
      f.role?.toLowerCase().includes(q)
    );
  });

  // ── Render ──

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !venture) {
    return (
      <DashboardLayout role="super_admin">
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Error</h2>
          <p className="text-slate-500 mb-6">{error || "Venture not found"}</p>
          <button onClick={() => router.push("/admin/ventures")} className="btn btn-primary">
            Back to Ventures
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const owner = founders.find((f) => f.is_owner);

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${
            toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
          }`}>
            {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button
              onClick={() => router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-3"
            >
              <ArrowLeft className="w-3 h-3" /> Back to {venture.company_name}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                <User className="w-6 h-6 text-[var(--brand-orange)]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  Founder Management
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {venture.company_name} · {founders.length} member{founders.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTransferModal(true)}
              disabled={!owner}
              className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-30 flex items-center gap-2"
            >
              <Crown className="w-3.5 h-3.5" /> Transfer Ownership
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite Member
            </button>
          </div>
        </div>

        {/* Owner Badge */}
        {owner && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {owner.name} · {owner.email}
              </p>
              <p className="text-[9px] text-slate-500">Current Owner — Can transfer ownership</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search founders by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
          />
        </div>

        {/* Founder List */}
        {filteredFounders.length === 0 ? (
          <div className="text-center py-20">
            <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              {searchQuery ? "No matches" : "No founders yet"}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {searchQuery ? "Try a different search" : "Invite your first team member"}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowInviteModal(true)} className="btn btn-primary gap-2">
                <UserPlus className="w-4 h-4" /> Invite Member
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFounders.map((founder) => {
              const isOwner = !!founder.is_owner;
              const isSuspended = !!founder.suspended_at;
              const isMenuOpen = openMenuId === founder.id;
              const roleColor = getRoleColor(founder.role);

              return (
                <div
                  key={founder.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isSuspended
                      ? "bg-rose-500/5 border-rose-500/20 opacity-60"
                      : isOwner
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-tertiary border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-black shrink-0 ${
                        isOwner
                          ? "bg-amber-500/20 text-amber-400 border-2 border-amber-500/30"
                          : isSuspended
                            ? "bg-rose-500/10 text-rose-500 border-2 border-rose-500/20"
                            : "bg-primary border-2 border-[var(--border-primary)] text-[var(--text-primary)]"
                      }`}>
                        {founder.name?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {founder.name}
                          </p>
                          {isOwner && (
                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                              <Crown className="w-2.5 h-2.5" /> Owner
                            </span>
                          )}
                          {isSuspended && (
                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                              Suspended
                            </span>
                          )}
                          {founder.status === "pending" && (
                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${roleColor}`}>
                            {founder.role_label || founder.role}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] text-slate-500">
                            <Mail className="w-3 h-3" /> {founder.email}
                          </span>
                          {founder.phone && (
                            <span className="flex items-center gap-1 text-[9px] text-slate-500">
                              <Phone className="w-3 h-3" /> {founder.phone}
                            </span>
                          )}
                        </div>
                        {founder.invitation_expired && founder.status === "pending" && (
                          <p className="text-[8px] text-rose-400 mt-1">Invitation expired</p>
                        )}
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setOpenMenuId(isMenuOpen ? null : founder.id)}
                        className="p-2 hover:bg-white/5 rounded-lg transition-all"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-10 z-20 w-52 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-2 space-y-0.5">
                              {/* Role selector */}
                              <div className="px-3 py-2">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Change Role</p>
                                <select
                                  value={founder.role}
                                  onChange={(e) => {
                                    if (e.target.value !== founder.role) {
                                      setConfirmAction({
                                        title: "Update Role",
                                        message: `Change ${founder.name}'s role from "${founder.role}" to "${e.target.value}"?`,
                                        confirmLabel: "Update Role",
                                        onConfirm: () => handleRoleUpdate(founder.id, e.target.value),
                                      });
                                    }
                                  }}
                                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[9px] font-bold text-[var(--text-primary)] outline-none"
                                >
                                  {VENTURE_ROLES.map((r) => (
                                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="border-t border-[var(--border-primary)] mx-3" />

                              {!isOwner && (
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      title: "Transfer Ownership",
                                      message: `Transfer ownership to ${founder.name}? This cannot be undone without another transfer.`,
                                      confirmLabel: "Transfer",
                                      onConfirm: async () => {
                                        setTransferTarget(String(founder.id));
                                        setOpenMenuId(null);
                                        setShowTransferModal(false);
                                        // Direct transfer
                                        setTransferring(true);
                                        try {
                                          const res = await fetch(`/api/ventures/${id}/founders/transfer-ownership`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ new_owner_id: founder.id }),
                                          });
                                          const data = await res.json();
                                          if (data.success) {
                                            notify("Ownership transferred");
                                            setConfirmAction(null);
                                            fetchData();
                                          } else {
                                            notify(data.error || "Transfer failed", "error");
                                            setConfirmAction(null);
                                          }
                                        } catch { notify("Network error", "error"); setConfirmAction(null); }
                                        setTransferring(false);
                                      },
                                    });
                                  }}
                                  className="w-full text-left px-3 py-2 text-[9px] font-bold text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all flex items-center gap-2"
                                >
                                  <Crown className="w-3 h-3" /> Transfer Ownership
                                </button>
                              )}

                              {isSuspended ? (
                                <button
                                  onClick={() => handleReactivate(founder.id)}
                                  className="w-full text-left px-3 py-2 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all flex items-center gap-2"
                                >
                                  <RefreshCw className="w-3 h-3" /> Reactivate
                                </button>
                              ) : (
                                !isOwner && (
                                  <button
                                    onClick={() => handleSuspend(founder.id)}
                                    className="w-full text-left px-3 py-2 text-[9px] font-bold text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all flex items-center gap-2"
                                  >
                                    <Ban className="w-3 h-3" /> Suspend
                                  </button>
                                )
                              )}

                              {!isOwner && (
                                <>
                                  <div className="border-t border-[var(--border-primary)] mx-3" />
                                  <button
                                    onClick={() => {
                                      setConfirmAction({
                                        title: "Remove Founder",
                                        message: `Are you sure you want to remove ${founder.name} from ${venture.company_name}? This action cannot be undone.`,
                                        confirmLabel: "Remove",
                                        variant: "danger",
                                        onConfirm: () => handleRemove(founder.id),
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-[9px] font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3 h-3" /> Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[var(--text-primary)]">Invite Member</h2>
                  <p className="text-[9px] text-slate-500">Add a founder, co-founder, or executive</p>
                </div>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Email *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="co-founder@example.com"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Name *</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Role *</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                >
                  {VENTURE_ROLES.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {inviting ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Ownership Modal ── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[var(--text-primary)]">Transfer Ownership</h2>
                  <p className="text-[9px] text-slate-500">Select the new owner</p>
                </div>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {founders
                .filter((f) => !f.is_owner && !f.suspended_at && f.status === "accepted")
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setConfirmAction({
                        title: "Transfer Ownership",
                        message: `Transfer ownership to ${f.name} (${f.email})? The current owner will lose owner privileges.`,
                        confirmLabel: "Transfer Ownership",
                        onConfirm: async () => {
                          setTransferTarget(String(f.id));
                          setShowTransferModal(false);
                          setTransferring(true);
                          try {
                            const res = await fetch(`/api/ventures/${id}/founders/transfer-ownership`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ new_owner_id: f.id }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              notify(`Ownership transferred to ${f.name}`);
                              setConfirmAction(null);
                              fetchData();
                            } else {
                              notify(data.error || "Transfer failed", "error");
                              setConfirmAction(null);
                            }
                          } catch { notify("Network error", "error"); setConfirmAction(null); }
                          setTransferring(false);
                        },
                      });
                    }}
                    className="w-full text-left p-4 rounded-xl bg-primary border border-[var(--border-primary)] hover:border-amber-500/30 transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-black text-amber-400">
                      {f.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{f.name}</p>
                      <p className="text-[9px] text-slate-500">{f.email} · {f.role}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
                  </button>
                ))}
              {founders.filter((f) => !f.is_owner && !f.suspended_at && f.status === "accepted").length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">
                  No eligible founders. All active, non-suspended founders can receive ownership.
                </p>
              )}
            </div>

            <button
              onClick={() => setShowTransferModal(false)}
              className="w-full py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmation Dialog ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                confirmAction.variant === "danger" ? "bg-rose-500/10" : "bg-amber-500/10"
              }`}>
                {confirmAction.variant === "danger" ? (
                  <AlertTriangle className="w-8 h-8 text-rose-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                )}
              </div>
              <h2 className="text-lg font-black text-[var(--text-primary)]">{confirmAction.title}</h2>
              <p className="text-sm text-slate-500 mt-2">{confirmAction.message}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.onConfirm) confirmAction.onConfirm();
                }}
                disabled={transferring}
                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2 ${
                  confirmAction.variant === "danger"
                    ? "bg-rose-600 text-white"
                    : "bg-[var(--brand-orange)] text-black"
                }`}
              >
                {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {transferring ? "Processing..." : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
