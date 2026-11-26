/**
 * Participant-score actions: the inline marks a program manager can type in the
 * team-details modal, and the keyboard/close wiring around it.
 */

export function scoreActions({
  t,
  notify,
  id,
  scoreDraft,
  setEditingScoreFor,
  setScoreDraft,
  setIsSaving,
  fetchProgramData,
}) {
  const updateParticipantScores = async (participantId, score) => {
    const numericScore = parseInt(score, 10);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      notify(t("pmMisc.workspace.invalidScore"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          program_id: id,
          score: numericScore,
        }),
      });
      if ((await response.json()).success) {
        notify(t("pmMisc.workspace.scoresSynced", { score: numericScore }));
        setEditingScoreFor(null);
        setScoreDraft("");
        fetchProgramData(true);
      } else {
        notify(t("pmMisc.workspace.syncFailed"), "error");
      }
    } catch {
      notify(t("pmMisc.workspace.syncFailed"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleParticipantScoreKeyDown = (event, participantId) => {
    if (event.key === "Enter") {
      updateParticipantScores(participantId, scoreDraft);
    }
  };

  const handleCancelScoreEdit = () => {
    setEditingScoreFor(null);
    setScoreDraft("");
  };

  const handleEditParticipantScore = (participantId, avgScore) => {
    setEditingScoreFor(participantId);
    setScoreDraft(String(avgScore || ""));
  };

  return {
    updateParticipantScores,
    handleParticipantScoreKeyDown,
    handleCancelScoreEdit,
    handleEditParticipantScore,
  };
}
