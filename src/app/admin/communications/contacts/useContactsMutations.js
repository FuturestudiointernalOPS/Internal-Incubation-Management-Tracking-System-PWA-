/**
 * Contacts-screen mutations: the fetch flows that toggle, invite, save,
 * archive, restore and delete contacts and groups, and that copy a join link.
 *
 * Extracted verbatim from useContactsState so that hook stays within the line
 * guardrail. The handler names, payloads, URLs and behaviour are unchanged; the
 * hook's returned shape is identical.
 */

export function createContactsMutations({
  t,
  confirm,
  refreshAll,
  setIsProcessing,
  setNotification,
  setCopiedGroup,
  form,
  contactPrograms,
  setShowManualModal,
  showGroupModal,
  setShowGroupModal,
  newGroupName,
  newGroupType,
  newGroupProgramId,
  showInviteModal,
  setShowInviteModal,
  inviteForm,
  setInviteForm,
  setConfirmTarget,
}) {
  const toggleStatus = async (cid, currentStatus, _currentGroup) => {
    const newStatus =
      currentStatus === "active" || currentStatus === "approved"
        ? "inactive"
        : "active";
    const payload = { cid, status: newStatus };
    // Role is auto-derived by the API from group membership
    try {
      await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      refreshAll();
    } catch (error) {
      console.error(error);
    }
  };

  const handleResendActivation = async (contact) => {
    if (!(await confirm({ message: t("crm.contacts.confirmResendActivation") }))) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: contact.email }),
      });
      const payload = await response.json();
      if (payload.success) {
        setNotification({ type: "success", text: t("crm.contacts.activationSent") || "Activation email sent" });
        refreshAll();
      } else {
        setNotification({ type: "error", text: payload.error || "Failed to send email" });
      }
    } catch {
      setNotification({ type: "error", text: "Error sending email" });
    }
    setIsProcessing(false);
  };

  const handleInviteContact = async (contact) => {
    if (!(await confirm({ message: t("crm.contacts.confirmInvite") }))) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          name: contact.name,
          role: contact.role || "member",
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        // The invitation exists either way; only say it was SENT when the
        // sender actually sent it.
        setNotification(
          payload.email_sent === false
            ? { type: "error", text: t("crm.contacts.inviteEmailFailed", { error: payload.email_error || t("crm.contacts.inviteFailed") }) }
            : { type: "success", text: t("crm.contacts.invitationSent") || "Invitation sent" },
        );
        refreshAll();
      } else {
        setNotification({ type: "error", text: payload.error || "Failed to send invitation" });
      }
    } catch {
      setNotification({ type: "error", text: "Error sending invitation" });
    }
    setIsProcessing(false);
  };

  const handleSaveContact = async () => {
    setIsProcessing(true);
    try {
      const payload = { ...form, program_ids: contactPrograms };
      // Remove role if empty to let API auto-detect
      if (!payload.role) delete payload.role;
      const method = form.cid ? "PUT" : "POST";
      // Manual creation by super admin is implicit approval — set active
      if (method === "POST") payload.status = "active";
      const response = await fetch("/api/contacts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        setNotification({ type: "success", message: t("crm.contacts.saved") });
        setShowManualModal(false);
        refreshAll();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsProcessing(true);
    try {
      const isEdit = showGroupModal && typeof showGroupModal === "object";
      const response = await fetch("/api/families", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? showGroupModal.id : undefined,
          name: newGroupName.trim(),
          type: newGroupType,
          program_id: newGroupProgramId || null,
        }),
      });
      if ((await response.json()).success) {
        setNotification({ type: "success", message: t("crm.contacts.saved") });
        setShowGroupModal(null);
        refreshAll();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleInvite = async () => {
    if (!showInviteModal || !inviteForm.email.trim()) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
          role: inviteForm.role,
          group_id: showInviteModal.name,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        setNotification(
          payload.email_sent === false
            ? { type: "error", message: t("crm.contacts.inviteEmailFailed", { error: payload.email_error || t("crm.contacts.inviteFailed") }) }
            : { type: "success", message: t("crm.contacts.inviteSent") },
        );
        setShowInviteModal(null);
        setInviteForm({ name: "", email: "", phone: "", role: "member" });
        refreshAll();
      } else {
        setNotification({ type: "error", message: payload.error || t("crm.contacts.inviteFailed") });
      }
    } catch (_) {
      setNotification({ type: "error", message: t("crm.contacts.inviteFailed") });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleArchive = async (contact) => {
    setIsProcessing(true);
    try {
      // The who and the when are the server's to record: the body carries the
      // intent only (see PUT /api/contacts).
      const response = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: contact.cid, archived: true }),
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.archivedToast", { name: contact.name }) },
          }),
        );
        refreshAll();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((payload.error || t("crm.contacts.archiveFailed")) || "") || (payload.error || t("crm.contacts.archiveFailed")),
            },
          }),
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (contact) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: contact.cid, archived: false }),
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.restoredToast", { name: contact.name }) },
          }),
        );
        refreshAll();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((payload.error || t("crm.contacts.restoreFailed")) || "") || (payload.error || t("crm.contacts.restoreFailed")),
            },
          }),
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSoftDelete = (contact) => {
    setConfirmTarget({
      id: contact.cid,
      message: t("crm.contacts.deleteConfirm", { name: contact.name }),
      onConfirm: () => performSoftDelete(contact),
    });
  };

  const performSoftDelete = async (contact) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/contacts?cid=${encodeURIComponent(contact.cid)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.contacts.permanentlyDeletedToast", { name: contact.name }) },
          }),
        );
        refreshAll();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((payload.error || t("crm.contacts.deleteFailed")) || "") || (payload.error || t("crm.contacts.deleteFailed")),
            },
          }),
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.contacts.networkError") },
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const copyJoinLink = async (groupName) => {
    let link = `${window.location.origin}/register-staff?group=${encodeURIComponent(groupName)}`;
    try {
      const groupsResponse = await fetch(`/api/groups?search=${encodeURIComponent(groupName)}`);
      const groupsData = await groupsResponse.json();
      if (groupsData.success && groupsData.groups && groupsData.groups.length > 0) {
        const group = groupsData.groups[0];
        const registrationId = group.registration_id || group.id;
        const formRunsResponse = await fetch(`/api/platform/form-runs?group_id=${encodeURIComponent(registrationId)}`);
        const formRunsData = await formRunsResponse.json();
        if (formRunsData.success && formRunsData.runs && formRunsData.runs.length > 0) {
          link = `${window.location.origin}/s/${formRunsData.runs[0].public_slug}`;
        }
      }
    } catch (_) {}
    navigator.clipboard.writeText(link);
    setCopiedGroup(groupName);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  const handlePivotToEntity = async (contact) => {
    setIsProcessing(true);
    try {
      const entityName = `${contact.name} Entity`;
      await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entityName,
          type: "company",
          program_id: null,
        }),
      });
      await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: contact.cid, group_name: entityName }),
      });
      setNotification({ type: "success", message: t("crm.contacts.done") });
      refreshAll();
    } catch (error) {
      console.error("Pivot Error:", error);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return {
    toggleStatus,
    handleResendActivation,
    handleInviteContact,
    handleSaveContact,
    handleSaveGroup,
    handleInvite,
    handleArchive,
    handleRestore,
    handleSoftDelete,
    copyJoinLink,
    handlePivotToEntity,
  };
}
