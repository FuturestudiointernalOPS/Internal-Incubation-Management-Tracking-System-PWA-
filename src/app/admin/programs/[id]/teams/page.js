"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  X,
  ArrowLeft,
  Loader2,
  Search,
  Shield,
  UserCheck,
  Check,
  AlertTriangle,
  ExternalLink,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function TeamManagementPage({ params }) {
  const unwrappedParams = use(params);
  const { id: programId } = unwrappedParams;
  const router = useRouter();
  const { t } = useI18n();

  const [teams, setTeams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [programName, setProgramName] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form fields
  const [teamName, setTeamName] = useState("");
  const [handlerId, setHandlerId] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast helper
  const notify = useCallback((type, message) => {
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message } }),
    );
  }, []);

  const fetchProgramName = useCallback(async () => {
    try {
      const res = await fetch(`/api/pm/full-state?id=${programId}`);
      const data = await res.json();
      if (data.success && data.program) {
        setProgramName(data.program.name || "");
      }
    } catch (_) {}
  }, [programId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, participantsRes, staffRes] = await Promise.all([
        fetch(`/api/teams?program_id=${programId}`),
        fetch(`/api/participants?program_id=${programId}`),
        fetch("/api/contacts/full-state"),
      ]);

      const [teamsData, participantsData, staffData] = await Promise.all([
        teamsRes.json().catch(() => ({ success: false })),
        participantsRes.json().catch(() => ({ success: false })),
        staffRes.json().catch(() => ({ success: false })),
      ]);

      if (teamsData.success) {
        setTeams(Array.isArray(teamsData.teams) ? teamsData.teams : []);
      }
      if (participantsData.success) {
        setParticipants(
          Array.isArray(participantsData.participants)
            ? participantsData.participants
            : [],
        );
      }
      if (staffData.success) {
        const staffList = (
          Array.isArray(staffData.contacts) ? staffData.contacts : []
        ).filter(
          (c) =>
            c &&
            (c.role === "super_admin" ||
              c.role === "program_manager" ||
              c.role === "admin" ||
              c.role === "staff" ||
              c.role === "teacher"),
        );
        setStaff(staffList);
      }
    } catch (e) {
      console.error("Failed to fetch team data:", e);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchProgramName();
    fetchData();
  }, [fetchProgramName, fetchData]);

  // ---- Modal handlers ----

  const openCreateModal = () => {
    setEditingTeam(null);
    setTeamName("");
    setHandlerId("");
    setSelectedMembers([]);
    setMemberSearch("");
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (team) => {
    setEditingTeam(team);
    setTeamName(team.name || "");
    setHandlerId(team.handler_id || "");
    setMemberSearch("");
    setFormError("");

    // Pre-select members whose team_id matches this team
    const memberIds = participants
      .filter((p) => p.v2_team_id === team.id || p.team_id === team.id)
      .map((p) => p.id?.toString() || p.cid);
    setSelectedMembers(memberIds);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTeam(null);
    setTeamName("");
    setHandlerId("");
    setSelectedMembers([]);
    setMemberSearch("");
    setFormError("");
  };

  // ---- CRUD handlers ----

  const handleSave = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setFormError("Team name is required.");
      return;
    }

    const handler = staff.find((s) => (s.cid || s.id) === handlerId);
    setSaving(true);
    setFormError("");

    try {
      const isEdit = !!editingTeam;
      const url = "/api/teams";
      const method = isEdit ? "PUT" : "POST";

      const body = {
        name: teamName.trim(),
        handler_id: handlerId || null,
        handler_name: handler ? handler.name || handlerId : null,
        member_ids: selectedMembers,
      };

      if (isEdit) {
        body.id = editingTeam.id;
      } else {
        body.program_id = programId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        notify(
          "success",
          isEdit
            ? t("admin.teams.updateSuccess")
            : t("admin.teams.createSuccess"),
        );
        closeModal();
        fetchData();
      } else {
        setFormError(data.error || "Operation failed.");
      }
    } catch (e) {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.success) {
        notify("success", t("admin.teams.deleteSuccess"));
        setDeleteTarget(null);
        fetchData();
      }
    } catch (e) {
      notify("error", "Failed to delete team.");
    } finally {
      setDeleting(false);
    }
  };

  // ---- Venture Ready toggle ----
  const toggleVentureReady = async (team) => {
    try {
      const res = await fetch("/api/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: team.id,
          name: team.name,
          is_venture_ready: !team.is_venture_ready,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify(
          "success",
          team.is_venture_ready
            ? "Venture Ready unmarked"
            : "Marked as Venture Ready",
        );
        fetchData();
      }
    } catch (_) {
      notify("error", "Failed to update.");
    }
  };

  // ---- Member selection helpers ----

  const toggleMember = (participantId) => {
    const idStr = participantId?.toString();
    setSelectedMembers((prev) =>
      prev.includes(idStr)
        ? prev.filter((id) => id !== idStr)
        : [...prev, idStr],
    );
  };

  const filteredParticipants = participants.filter((p) => {
    if (!memberSearch) return true;
    const search = memberSearch.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(search) ||
      (p.email || "").toLowerCase().includes(search)
    );
  });

  // ---- Render helpers ----

  const getHandlerDisplay = (team) => {
    if (team.handler_name) return team.handler_name;
    if (team.handler_id) {
      const h = staff.find((s) => (s.cid || s.id) === team.handler_id);
      return h ? h.name || h.email || team.handler_id : team.handler_id;
    }
    return t("admin.unassigned");
  };

  const getMemberCount = (team) => {
    if (team.members_count !== undefined && team.members_count !== null) {
      return Number(team.members_count);
    }
    // Fallback: count from participants
    return participants.filter(
      (p) => p.v2_team_id === team.id || p.team_id === team.id,
    ).length;
  };

  // ---- Loading state ----

  if (loading) {
    return (
      <DashboardLayout role="super_admin" activeTab="v2">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[var(--brand-orange)] animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // ---- Main render ----

  return (
    <DashboardLayout role="super_admin" activeTab="v2">
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/admin/programs/${programId}`)}
              className="flex items-center gap-2 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {programName || t("admin.teams.backToPrograms")}
            </button>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">
                  {t("admin.teams.title")}
                </h2>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  {t("admin.teams.subtitle")}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[var(--brand-orange)]/90 transition-all shadow-lg shadow-[var(--brand-orange)]/20"
          >
            <Plus className="w-4 h-4" />
            {t("admin.teams.createTeam")}
          </button>
        </header>

        {/* TEAMS TABLE */}
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left px-6 py-4 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("admin.teams.teamName")}
                  </th>
                  <th className="text-left px-6 py-4 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("admin.teams.handler")}
                  </th>
                  <th className="text-center px-6 py-4 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("admin.teams.members")}
                  </th>
                  <th className="text-right px-6 py-4 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Actions
                  </th>
                  <th className="text-right px-6 py-4 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Workspace
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Shield className="w-10 h-10 text-[var(--text-tertiary)]" />
                        <p className="text-sm font-bold text-[var(--text-secondary)]">
                          {t("admin.teams.noTeams")}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                          {t("admin.teams.noTeamsDesc")}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  teams.map((team) => (
                    <tr
                      key={team.id}
                      className="group hover:bg-primary/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center text-[var(--brand-orange)] shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-[var(--text-primary)] uppercase">
                            {team.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                          <span className="text-xs font-bold text-[var(--text-secondary)]">
                            {getHandlerDisplay(team)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[10px] font-black uppercase tracking-wider">
                          {t("admin.teams.membersCount", {
                            count: getMemberCount(team),
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => toggleVentureReady(team)}
                            title={
                              team.is_venture_ready
                                ? "Unmark Venture Ready"
                                : "Mark as Venture Ready"
                            }
                            className={`p-2 rounded-lg transition-colors ${
                              team.is_venture_ready
                                ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                : "hover:bg-primary text-[var(--text-secondary)] hover:text-emerald-500"
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${team.is_venture_ready ? "fill-current" : ""}`}
                            />
                          </button>
                          <button
                            onClick={() => openEditModal(team)}
                            title={t("admin.edit")}
                            className="p-2 rounded-lg hover:bg-primary transition-colors text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(team)}
                            title={t("common.delete")}
                            className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors text-[var(--text-secondary)] hover:text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/team/${team.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 text-[var(--brand-orange)] text-[10px] font-black uppercase tracking-wider hover:bg-[var(--brand-orange)]/20 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal card */}
          <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                {editingTeam
                  ? t("admin.teams.editTeam")
                  : t("admin.teams.createTeam")}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-[var(--text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Team Name */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest pl-1">
                  {t("admin.teams.teamName")}
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={t("admin.teams.teamNamePlaceholder")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors"
                  autoFocus
                />
              </div>

              {/* Handler */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest pl-1">
                  {t("admin.teams.handler")}
                </label>
                <select
                  value={handlerId}
                  onChange={(e) => setHandlerId(e.target.value)}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    paddingRight: "2.5rem",
                  }}
                >
                  <option value="">
                    {t("admin.teams.handlerPlaceholder")}
                  </option>
                  {staff.map((s) => (
                    <option key={s.cid || s.id} value={s.cid || s.id}>
                      {s.name || s.email || s.cid} ({s.role || "staff"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Members */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest pl-1">
                  {t("admin.teams.members")}{" "}
                  <span className="text-[var(--text-tertiary)]">
                    ({selectedMembers.length} selected)
                  </span>
                </label>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={t("admin.teams.selectMembers")}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors"
                  />
                </div>

                {/* Participant list */}
                <div className="max-h-48 overflow-y-auto border border-[var(--border-primary)] rounded-xl bg-primary divide-y divide-[var(--border-primary)]">
                  {filteredParticipants.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-[10px] text-[var(--text-tertiary)] font-bold">
                        {participants.length === 0
                          ? "No participants registered for this program."
                          : "No matching participants."}
                      </p>
                    </div>
                  ) : (
                    filteredParticipants.map((p) => {
                      const pId = p.id?.toString() || p.cid;
                      const isSelected = selectedMembers.includes(pId);
                      return (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => toggleMember(pId)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary ${
                            isSelected ? "bg-[var(--brand-orange)]/5" : ""
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {p.name || "Unnamed"}
                            </span>
                            <span className="text-[9px] text-[var(--text-tertiary)] truncate">
                              {p.email || ""}
                            </span>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ml-3 transition-all ${
                              isSelected
                                ? "bg-[var(--brand-orange)] border-[var(--brand-orange)]"
                                : "border-[var(--border-primary)]"
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-secondary transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !teamName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[var(--brand-orange)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingTeam ? t("common.update") : t("common.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[var(--border-primary)]">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                {t("admin.teams.deleteTeam")}
              </h3>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {t("admin.teams.deleteConfirm")}
              </p>
              <p className="text-xs text-[var(--text-secondary)] font-bold">
                Team:{" "}
                <span className="text-[var(--brand-orange)]">
                  {deleteTarget.name}
                </span>
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-secondary transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
