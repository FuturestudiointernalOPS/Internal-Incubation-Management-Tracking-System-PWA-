/**
 * Team actions: deploying a group, moving a participant between groups,
 * reassigning a group's facilitator, the pasted-email bulk selection, and the
 * open/close wiring the participants tab and the team-details modal drive.
 */

export function teamActions({
  t,
  notify,
  id,
  participants,
  selectedParticipants,
  teamAssignmentMode,
  newTeam,
  selectedExistingTeamId,
  selectedTeam,
  oversightCandidates,
  emailInput,
  setNewTeam,
  setEmailInput,
  setSelectedParticipants,
  setSelectedExistingTeamId,
  setShowTeamModal,
  setShowTeamDetails,
  setSelectedTeam,
  setShowFacilitatorSelect,
  setFacilitatorDraftId,

  setActiveTab,
  setActiveSubTab,
  setEditingScoreFor,
  setScoreDraft,
  setConfirmTarget,
  setIsSaving,
  fetchProgramData,
}) {
  const deployTeam = async () => {
    if (teamAssignmentMode === "new" && !newTeam.name.trim()) return;
    if (teamAssignmentMode === "existing" && !selectedExistingTeamId) return;

    setIsSaving(true);
    try {
      const endpoint =
        teamAssignmentMode === "new" ? "/api/pm/teams" : "/api/pm/teams";
      const method = teamAssignmentMode === "new" ? "POST" : "PATCH";

      // Auto-detect group_name from selected participants
      const firstParticipant = participants.find(
        (participant) => participant.id === selectedParticipants[0],
      );
      const detectedGroupName = firstParticipant?.group_name || "Individual";

      const payload =
        teamAssignmentMode === "new"
          ? {
              name: newTeam.name,
              group_name: detectedGroupName,
              program_id: id,
              member_ids: selectedParticipants,
              is_management_group: true,
              ...(newTeam.handler_name
                ? { handler_name: newTeam.handler_name }
                : {}),
              ...(newTeam.staff_id ? { handler_id: newTeam.staff_id } : {}),
              ...(newTeam.leader_id ? { leader_id: newTeam.leader_id } : {}),
            }
          : {
              team_id: selectedExistingTeamId,
              member_ids: selectedParticipants,
            };

      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        notify(
          teamAssignmentMode === "new"
            ? t("pmMisc.workspace.teamInitialized")
            : t("pmMisc.workspace.teamMembersAdded"),
        );
        setShowTeamModal(false);
        setNewTeam({
          name: "",
          group_name: "",
          handler_name: "",
          member_ids: [],
          leader_id: "",
          staff_id: "",
        });
        setSelectedExistingTeamId("");
        fetchProgramData(true);
        setSelectedParticipants([]);
        setActiveTab("teams");
        setActiveSubTab("groups");
      } else
        notify(
          t(data.error || t("pmMisc.workspace.operationFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.operationFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const changeParticipantTeam = async (participantId, newTeamId) => {
    if (!participantId || !newTeamId) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: newTeamId,
          member_ids: [participantId],
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.participantMoved"));
        fetchProgramData(true);
      } else {
        notify(
          t(data.error || t("pmMisc.workspace.moveParticipantFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.moveParticipantFailed"),
          "error",
        );
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Reassign the team's facilitator (handler) — PM control.
  const changeTeamHandler = async (teamId, handlerId) => {
    if (!teamId) return;
    const staff = oversightCandidates.find(
      (member) => String(member.cid) === String(handlerId || ""),
    );
    const handlerName = handlerId ? staff?.name || "" : "";
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_handler",
          team_id: teamId,
          handler_id: handlerId || null,
          handler_name: handlerName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.facilitatorUpdated"));
        setShowFacilitatorSelect(false);
        setFacilitatorDraftId("");
        setSelectedTeam((prev) =>
          prev
            ? {
                ...prev,
                handler_id: handlerId || null,
                handler_name: handlerName,
              }
            : prev,
        );
        fetchProgramData(true);
      } else {
        notify(
          t(
            data.error || t("pmMisc.workspace.facilitatorUpdateFailed") || "",
          ) ||
            data.error ||
            t("pmMisc.workspace.facilitatorUpdateFailed"),
          "error",
        );
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove a participant from the current team (left unassigned afterwards).
  const removeParticipantFromTeam = async (participantId) => {
    if (!selectedTeam || !participantId) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_member",
          team_id: selectedTeam.id,
          member_id: participantId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.memberRemoved"));
        fetchProgramData(true);
      } else {
        notify(
          t(data.error || t("pmMisc.workspace.removeMemberFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.removeMemberFailed"),
          "error",
        );
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk-add participants to the current selection by pasted email list
  // (comma / semicolon / newline separated). Unmatched emails are reported.
  const addEmailsToSelection = () => {
    const emails = emailInput
      .split(/[,;\n]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) return;

    const emailSet = new Set(emails);
    const matched = new Set();
    const matchedEmails = new Set();
    participants.forEach((participant) => {
      if (
        participant.email &&
        emailSet.has(String(participant.email).trim().toLowerCase())
      ) {
        matched.add(participant.id);
        matchedEmails.add(String(participant.email).trim().toLowerCase());
      }
    });
    const notFound = emails.filter((email) => !matchedEmails.has(email));

    setSelectedParticipants((prev) =>
      Array.from(new Set([...prev, ...matched])),
    );
    setEmailInput("");

    if (notFound.length > 0) {
      notify(
        t("pmMisc.workspace.emailsPartialResult", {
          added: matched.size,
          missing: notFound.slice(0, 8).join(", "),
        }),
        "error",
      );
    } else {
      notify(t("pmMisc.workspace.emailsAddedCount", { count: matched.size }));
    }
  };

  const deleteTeam = (teamId) => {
    setConfirmTarget({
      id: teamId,
      message: t("pmMisc.workspace.confirmDecommissionGroup"),
      onConfirm: () => performDeleteTeam(teamId),
    });
  };

  const performDeleteTeam = async (teamId) => {
    try {
      const response = await fetch("/api/pm/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId }),
      });
      if ((await response.json()).success) {
        notify(t("pmMisc.workspace.groupDecommissioned"));
        fetchProgramData(true);
      }
    } catch {
      notify(t("pmMisc.workspace.removeGroupFailed"), "error");
    }
  };

  const handleDeployTeam = () => {
    setNewTeam({
      name: "",
      handler_name: "",
      member_ids: selectedParticipants,
    });
    setEmailInput("");
    setShowTeamModal(true);
  };

  const handleToggleParticipant = (isSelected, participant) => {
    if (isSelected)
      setSelectedParticipants(
        selectedParticipants.filter((id) => id !== participant.id),
      );
    else setSelectedParticipants([...selectedParticipants, participant.id]);
  };

  const handleChangeParticipantTeam = (event, participant) => {
    const newTeamId = event.target.value;
    if (newTeamId && newTeamId !== (participant.v2_team_id || "")) {
      changeParticipantTeam(participant.id, newTeamId);
    }
  };

  const handleOpenTeamDetails = (team) => {
    setSelectedTeam(team);
    setShowTeamDetails(true);
  };

  const handleChangeNewTeamStaff = (event) => {
    const staff = oversightCandidates.find(
      (member) => String(member.cid) === event.target.value,
    );
    setNewTeam((prev) => ({
      ...prev,
      staff_id: event.target.value,
      handler_name: staff?.name || "",
    }));
  };

  const handleCloseTeamDetails = () => {
    setShowTeamDetails(false);
    setSelectedTeam(null);
    setEditingScoreFor(null);
    setScoreDraft("");
  };

  return {
    deployTeam,
    changeParticipantTeam,
    changeTeamHandler,
    removeParticipantFromTeam,
    addEmailsToSelection,
    deleteTeam,
    handleDeployTeam,
    handleToggleParticipant,
    handleChangeParticipantTeam,
    handleOpenTeamDetails,
    handleChangeNewTeamStaff,
    handleCloseTeamDetails,
  };
}
