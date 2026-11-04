/**
 * Facilitator actions: the reassignment picker inside the team-details modal.
 */

export function facilitatorActions({
  selectedTeam,
  setFacilitatorDraftId,
  setShowFacilitatorSelect,
}) {
  const handleCancelFacilitatorSelect = () => {
    setShowFacilitatorSelect(false);
    setFacilitatorDraftId("");
  };

  const handleOpenFacilitatorSelect = () => {
    setFacilitatorDraftId(selectedTeam.handler_id || "");
    setShowFacilitatorSelect(true);
  };

  return {
    handleCancelFacilitatorSelect,
    handleOpenFacilitatorSelect,
  };
}
