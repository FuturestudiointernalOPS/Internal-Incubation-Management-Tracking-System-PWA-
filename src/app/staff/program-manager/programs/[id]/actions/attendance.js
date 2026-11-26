/**
 * Attendance actions: opening the marks modal for a session and the delta-only
 * save — only the marks the manager actually changed are sent.
 */

export function attendanceActions({
  t,
  notify,
  id,
  participants,
  attendanceDate,
  attendanceRecords,
  attendanceLoaded,
  selectedSessionForAttendance,
  setShowAttendanceModal,
  setSelectedSessionForAttendance,

  setAttendanceRecords,
  setAttendanceLoaded,
  setIsSaving,
}) {
  const handleOpenAttendanceModal = (session) => {
    setSelectedSessionForAttendance(session);
    setShowAttendanceModal(true);
  };

  const handleSaveAttendance = async () => {
    if (!selectedSessionForAttendance || !attendanceDate) return;
    setIsSaving(true);
    try {
      // Delta-only save: send only participants whose mark
      // changed since the modal opened (empty = explicit
      // clear). Marks the PM did not touch — including those
      // recorded by a facilitator for their team — are left
      // exactly as they are.
      const records = participants
        .map((participant) => {
          const participantId =
            participant.user_id || participant.cid || participant.id;
          return {
            session_id: selectedSessionForAttendance.id,
            program_id: id,
            participant_id: participantId,
            status: attendanceRecords[participantId] || "",
            date: attendanceDate,
          };
        })
        .filter(
          (record) =>
            record.participant_id &&
            record.status !== (attendanceLoaded[record.participant_id] || ""),
        );
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(
          t(data.error || "Unknown error") || data.error || "Unknown error",
        );
      notify(
        t("pmMisc.workspace.attendanceRecorded", { count: data.upserted }),
      );
      setShowAttendanceModal(false);
      setAttendanceRecords({});
      setAttendanceLoaded({});
    } catch (error) {
      notify(
        (error && error.message) || t("pmMisc.workspace.attendanceSaveFailed"),
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return {
    handleOpenAttendanceModal,
    handleSaveAttendance,
  };
}
