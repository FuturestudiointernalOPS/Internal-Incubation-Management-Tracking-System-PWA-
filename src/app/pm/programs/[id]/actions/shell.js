/**
 * Shell actions: the tab selection (and the submissions-seen broadcast), copying
 * the assigned registration-form link, opening a document in the built-in PDF
 * viewer, and the shared confirmation dialog.
 */

export function shellActions({
  t,
  router,
  regForm,
  confirmTarget,
  setActiveTab,
  setSubmissionsSeen,
  setConfirmTarget,
  setActivePDF,
}) {
  const handleSelectTab = (tab) => {
    if (tab.href) router.push(tab.href);
    else {
      if (tab.id === "submissions") {
        setSubmissionsSeen(true);
        // Tell the global sidebar badge to clear too.
        window.dispatchEvent(new CustomEvent("pm:submissions-seen"));
      }
      setActiveTab(tab.id);
    }
  };

  const handleCopyRegFormLink = () => {
    navigator.clipboard.writeText(regForm.link);
    window.dispatchEvent(
      new CustomEvent("impactos:notify", {
        detail: {
          type: "success",
          message: t("pmMisc.workspace.registrationLinkCopied"),
        },
      }),
    );
  };

  const handleConfirmAction = () => {
    confirmTarget.onConfirm();
    setConfirmTarget(null);
  };

  const handleOpenPdfViewer = (event, url) => {
    event.preventDefault();
    event.stopPropagation();
    setActivePDF({ url: url || "#", name });
  };

  return {
    handleSelectTab,
    handleCopyRegFormLink,
    handleConfirmAction,
    handleOpenPdfViewer,
  };
}
