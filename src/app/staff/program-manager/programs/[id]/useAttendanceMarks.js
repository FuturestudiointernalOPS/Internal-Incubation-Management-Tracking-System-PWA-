"use client";

import { useEffect } from "react";

/**
 * The attendance marks already recorded for the session whose modal is open.
 *
 * Reading only: it loads what exists and hands it back through the two setters
 * the modal compares against on save (the marks now shown, and the marks as they
 * were loaded). Nothing else on the screen depends on it.
 */
export default function useAttendanceMarks({
  id,
  showAttendanceModal,
  selectedSessionForAttendance,
  attendanceDate,
  setAttendanceRecords,
  setAttendanceLoaded,
}) {
  useEffect(() => {
    if (
      !showAttendanceModal ||
      !selectedSessionForAttendance ||
      !attendanceDate
    )
      return;
    const loadAttendance = async () => {
      try {
        const response = await fetch(
          `/api/attendance?session_id=${selectedSessionForAttendance.id}&program_id=${id}&date=${attendanceDate}`,
        );
        const data = await response.json();
        if (data.success && data.attendance) {
          const records = {};
          data.attendance.forEach((record) => {
            records[record.participant_id] = record.status;
          });
          setAttendanceRecords(records);
          setAttendanceLoaded(records);
        } else {
          setAttendanceRecords({});
          setAttendanceLoaded({});
        }
      } catch (_) {
        setAttendanceRecords({});
        setAttendanceLoaded({});
      }
    };
    loadAttendance();
  }, [
    showAttendanceModal,
    selectedSessionForAttendance,
    id,
    attendanceDate,
    setAttendanceRecords,
    setAttendanceLoaded,
  ]);
}
