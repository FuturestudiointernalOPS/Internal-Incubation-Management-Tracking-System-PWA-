"use client";

import React, { useState, use, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Users, Plus, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import TeamFormModal from "@/components/admin/programs/teams/TeamFormModal";
import TeamsTable from "@/components/admin/programs/teams/TeamsTable";
import DeleteTeamModal from "@/components/admin/programs/teams/DeleteTeamModal";
import TeamsLoadingState from "@/components/admin/programs/teams/TeamsLoadingState";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop. The assignable-staff list is filtered here rather than in
// the loader, so the rule is stated once and a failed read cannot return
// unfiltered contacts.
const pickProgramName = (payload) =>
  payload?.success && payload.program ? payload.program.name || "" : "";
const pickTeams = (payload) => (payload?.success && Array.isArray(payload.teams) ? payload.teams : []);
const pickParticipants = (payload) =>
  payload?.success && Array.isArray(payload.participants) ? payload.participants : [];
const pickStaff = (payload) =>
  payload?.success && Array.isArray(payload.contacts)
    ? payload.contacts.filter(
        (contact) =>
          contact &&
          (contact.role === "super_admin" ||
            contact.role === "program_manager" ||
            contact.role === "admin" ||
            contact.role === "staff"),
      )
    : [];

export default function TeamManagementPage({ params }) {
  const unwrappedParams = use(params);
  const { id: programId } = unwrappedParams;
  const router = useRouter();
  const { t } = useI18n();

  // The loaders' work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no list state of its own and never sets state from an effect. Each read
  // carries its own loading flag so the screen leaves the spinner only once all
  // of them have settled, as the old combined loader did. Every mutation calls
  // refresh(), which bypasses the cache like bypassCache did.
  const { data: programName, loading: programNameLoading } = useApi(
    `/api/pm/full-state?id=${programId}`,
    { defaultValue: "", transform: pickProgramName, deps: [programId] },
  );
  const { data: teams, loading: teamsLoading, refresh } = useApi(
    `/api/teams?program_id=${programId}`,
    { defaultValue: [], transform: pickTeams, deps: [programId] },
  );

  const { data: participants, loading: participantsLoading } = useApi(
    `/api/participants?program_id=${programId}`,
    { defaultValue: [], transform: pickParticipants, deps: [programId] },
  );
  const { data: staff, loading: staffLoading } = useApi(
    "/api/contacts/full-state",
    { defaultValue: [], transform: pickStaff },
  );
  const loading =
    programNameLoading || teamsLoading || participantsLoading || staffLoading;

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
      .filter((participant) => participant.v2_team_id === team.id || participant.team_id === team.id)
      .map((participant) => participant.id?.toString() || participant.cid);
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

  const handleSave = async (event) => {
    event.preventDefault();
    if (!teamName.trim()) {
      setFormError(t("adminMisc.programTeams.teamNameRequired"));
      return;
    }

    const handler = staff.find((staffMember) => (staffMember.cid || staffMember.id) === handlerId);
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

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json();
      if (payload.success) {
        notify(
          "success",
          isEdit
            ? t("admin.teams.updateSuccess")
            : t("admin.teams.createSuccess"),
        );
        closeModal();
        refresh();
      } else {
        setFormError(t((payload.error || t("adminMisc.programTeams.operationFailed")) || "") || (payload.error || t("adminMisc.programTeams.operationFailed")));
      }
    } catch {
      setFormError(t("adminMisc.programTeams.networkError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const payload = await response.json();
      if (payload.success) {
        notify("success", t("admin.teams.deleteSuccess"));
        setDeleteTarget(null);
        refresh();
      }
    } catch {
      notify("error", t("adminMisc.programTeams.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  // ---- Venture Ready toggle ----
  const toggleVentureReady = async (team) => {
    try {
      const response = await fetch("/api/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: team.id,
          name: team.name,
          is_venture_ready: !team.is_venture_ready,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        notify(
          "success",
          team.is_venture_ready
            ? t("adminMisc.programTeams.ventureReadyUnmarked")
            : t("adminMisc.programTeams.markedVentureReady"),
        );
        refresh();
      }
    } catch (_) {
      notify("error", t("adminMisc.programTeams.updateFailed"));
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

  const filteredParticipants = participants.filter((participant) => {
    if (!memberSearch) return true;
    const search = memberSearch.toLowerCase();
    return (
      (participant.name || "").toLowerCase().includes(search) ||
      (participant.email || "").toLowerCase().includes(search)
    );
  });

  // ---- Render helpers ----

  const getHandlerDisplay = (team) => {
    if (team.handler_name) return team.handler_name;
    if (team.handler_id) {
      const handler = staff.find((staffMember) => (staffMember.cid || staffMember.id) === team.handler_id);
      return handler ? handler.name || handler.email || team.handler_id : team.handler_id;
    }
    return t("admin.unassigned");
  };

  const getMemberCount = (team) => {
    if (team.members_count !== undefined && team.members_count !== null) {
      return Number(team.members_count);
    }
    // Fallback: count from participants
    return participants.filter(
      (participant) => participant.v2_team_id === team.id || participant.team_id === team.id,
    ).length;
  };

  // ---- Loading state ----

  if (loading) {
    return <TeamsLoadingState />;
  }

  // ---- Main render ----

  return (
    <>
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
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 transition-all shadow-lg shadow-brand-orange/20"
          >
            <Plus className="w-4 h-4" />
            {t("admin.teams.createTeam")}
          </button>
        </header>

        {/* TEAMS TABLE */}
        <TeamsTable
          teams={teams}
          getHandlerDisplay={getHandlerDisplay}
          getMemberCount={getMemberCount}
          toggleVentureReady={toggleVentureReady}
          openEditModal={openEditModal}
          setDeleteTarget={setDeleteTarget}
          router={router}
        />
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <TeamFormModal
          editingTeam={editingTeam}
          closeModal={closeModal}
          handleSave={handleSave}
          saving={saving}
          formError={formError}
          teamName={teamName}
          setTeamName={setTeamName}
          handlerId={handlerId}
          setHandlerId={setHandlerId}
          staff={staff}
          memberSearch={memberSearch}
          setMemberSearch={setMemberSearch}
          selectedMembers={selectedMembers}
          filteredParticipants={filteredParticipants}
          participants={participants}
          toggleMember={toggleMember}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <DeleteTeamModal
          deleteTarget={deleteTarget}
          setDeleteTarget={setDeleteTarget}
          handleDelete={handleDelete}
          deleting={deleting}
        />
      )}
    </>
  );
}
