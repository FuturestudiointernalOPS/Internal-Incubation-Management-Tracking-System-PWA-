'use client';

import { useState, use, useCallback } from 'react';
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import ProgramDetailView from "@/components/admin/programs/ProgramDetailView";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickFullState = (payload) => (payload?.success ? payload : null);
const pickList = (field) => (payload) => (payload?.success ? payload[field] || [] : []);

// Called once, here: `pickList` is a factory, so calling it at the call site would
// hand the read a new identity on every render and re-issue its request.
const pickReports = pickList("reports");
const pickFollowups = pickList("followups");
const pickAttendance = pickList("attendance");

/**
 * The programme's public registration link, when it has one.
 *
 * The address is built HERE, inside the read, rather than during a render: it is
 * made of the browser's own origin, and a render also happens on the server,
 * where no origin exists. A transformation runs in the browser, after the answer.
 *
 * The rule is the one the loader had, not the one its comment described: when the
 * programme has an id, only the programme's own runs are consulted - there is no
 * fallback to a group's run.
 */
const pickRegistrationLink = (payload) => {
  const run = (payload?.success ? payload.runs || [] : []).find(
    (formRun) => formRun.status === "active" && formRun.public_slug,
  );
  if (!run) return null;
  return {
    link: `${window.location.origin}/s/${run.public_slug}`,
    name: run.form_name || run.name || "Form",
  };
};

export default function ProgramDetail({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const _router = useRouter();
  const { t } = useI18n();

  const [selectedSession, setSelectedSession] = useState(null);
  const [newFollowup, setNewFollowup] = useState({ week: null, session_id: null, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingKpi, setIsEditingKpi] = useState(null);
  const [kpiForm, setKpiForm] = useState({ title: '', target_value: '' });
  // Snapshot the clock once per render — reading it mid-render is impure.
  const [nowMs] = useState(() => Date.now());

  // The programme and everything hanging off it, through the shared hook: it owns
  // the cache, the cache-first paint and the discarding of a stale answer, so the
  // page keeps no copy of its own and reads its data during render.
  const {
    data: fullState,
    loading: fullStateLoading,
    refresh: refreshFullState,
  } = useApi(id ? `/api/pm/full-state?id=${id}` : null, {
    defaultValue: null,
    transform: pickFullState,
    deps: [id],
  });
  const program = fullState?.program || null;
  const sessions = fullState?.sessions ?? EMPTY_LIST;
  const requirements = fullState?.documents ?? EMPTY_LIST;
  const kpis = fullState?.kpis ?? EMPTY_LIST;
  const participants = fullState?.participants ?? EMPTY_LIST;
  const submissions = fullState?.submissions ?? EMPTY_LIST;

  const { data: reports, loading: reportsLoading, refresh: refreshReports } = useApi(
    id ? `/api/pm/reports?program_id=${id}` : null,
    { defaultValue: EMPTY_LIST, transform: pickReports, deps: [id] },
  );
  const {
    data: followups,
    loading: followupsLoading,
    refresh: refreshFollowups,
  } = useApi(id ? `/api/followups?program_id=${id}` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickFollowups,
    deps: [id],
  });
  const {
    data: attendance,
    loading: attendanceLoading,
    refresh: refreshAttendance,
  } = useApi(id ? `/api/attendance?program_id=${id}` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickAttendance,
    deps: [id],
  });

  const isLoadingData =
    fullStateLoading || reportsLoading || followupsLoading || attendanceLoading;

  // Every action below re-reads what it changed.
  const reload = useCallback(() => {
    refreshFullState();
    refreshReports();
    refreshFollowups();
    refreshAttendance();
  }, [refreshFullState, refreshReports, refreshFollowups, refreshAttendance]);

  // The public registration link. The programme's own runs are consulted when the
  // programme is known; a programme without an id falls back to the run assigned
  // to its first group, which is what the loader did.
  const registrationSourceId = program?.id || program?.assigned_segments?.[0] || null;
  const registrationQuery = program?.id
    ? `program_id=${encodeURIComponent(String(program.id))}`
    : `group_id=${encodeURIComponent(String(registrationSourceId))}`;
  const { data: regForm } = useApi(
    registrationSourceId ? `/api/platform/form-runs?${registrationQuery}` : null,
    { defaultValue: null, transform: pickRegistrationLink, deps: [registrationSourceId] },
  );

  const handleAddFollowup = async (weekNumber, sessionId = null) => {
    if (!newFollowup.comment.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: id,
          week_number: weekNumber,
          session_id: sessionId,
          comment: newFollowup.comment
        })
      });
      if ((await response.json()).success) {
        setNewFollowup({ week: null, session_id: null, comment: '' });
        reload();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKpiAction = async (action, kpiId = null) => {
    setIsSubmitting(true);
    try {
      let response;
      if (action === 'create') {
        response = await fetch('/api/kpis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_id: id, ...kpiForm })
        });
      } else if (action === 'update') {
        response = await fetch('/api/kpis', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kpiId, ...kpiForm })
        });
      } else if (action === 'delete') {
        response = await fetch('/api/kpis', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kpiId })
        });
      }
      
      if (response && (await response.json()).success) {
        setKpiForm({ title: '', target_value: '' });
        setIsEditingKpi(null);
        reload();
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: action === 'create' ? t("adminMisc.programDetail.kpiCreated") : action === 'update' ? t("adminMisc.programDetail.kpiUpdated") : t("adminMisc.programDetail.kpiDeleted") } }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const ctx = {
    isLoadingData,
    attendance,
    followups,
    handleAddFollowup,
    handleKpiAction,
    isEditingKpi,
    isSubmitting,
    kpiForm,
    kpis,
    newFollowup,
    nowMs,
    participants,
    program,
    regForm,
    reports,
    requirements,
    selectedSession,
    sessions,
    setIsEditingKpi,
    setKpiForm,
    setNewFollowup,
    setSelectedSession,
    submissions,
    t,
  };

  return <ProgramDetailView ctx={ctx} />;
}
