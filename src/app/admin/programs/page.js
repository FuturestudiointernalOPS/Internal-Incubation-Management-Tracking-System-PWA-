"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Loader2,
  ChevronRight,
  User,
  Users,
  Edit3,
  Archive,
  RotateCcw,
  Trash2,
  Settings,
  ArrowLeft,
  Signal,
  FileText,
  Upload,
  Target,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { uploadFile } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";

const FACILITATOR_CAPS = [
  { key: "participants.view", labelKey: "capParticipantsView" },
  { key: "participants.manage", labelKey: "capParticipantsManage" },
  { key: "attendance.view", labelKey: "capAttendanceView" },
  { key: "attendance.record", labelKey: "capAttendanceRecord" },
  { key: "assignments.view", labelKey: "capAssignmentsView" },
  { key: "assignments.review", labelKey: "capAssignmentsReview" },
  { key: "assignments.grade", labelKey: "capAssignmentsGrade" },
  { key: "sessions.conduct", labelKey: "capSessionsConduct" },
  { key: "sessions.record", labelKey: "capSessionsRecord" },
  { key: "progress.view", labelKey: "capProgressView" },
  { key: "groups.view", labelKey: "capGroupsView" },
  { key: "groups.manage", labelKey: "capGroupsManage" },
];

// Convert a date value (YYYY-MM-DD or ISO datetime) into a safe
// YYYY-MM-DD value for <input type="date">, without UTC day shifts.
const toDateInputValue = (value) => {
  if (!value) return "";
  const dateString = String(value);
  const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
};

// ─── Read shapers (module scope: built once, never per render) ──────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

// With no assigned group there are no links to show; the empty map is a shape,
// so it is made once rather than on every render.
const EMPTY_GROUP_REG_LINKS = {};

const pickPrograms = (payload) =>
  payload?.success && Array.isArray(payload.programs) ? payload.programs : [];

const pickTeams = (payload) => {
  const contacts =
    payload?.success && Array.isArray(payload.contacts) ? payload.contacts : [];
  return contacts.filter(
    (contact) => contact && contact.group_name?.toUpperCase() === "FUTURE STUDIO",
  );
};

const pickFamilies = (payload) =>
  payload?.success && Array.isArray(payload.families) ? payload.families : [];

const pickKnowledgeItems = (payload) => {
  if (!payload?.success) return [];
  const items =
    payload.conceptNotes || payload.knowledgeItems || payload.notes || [];
  return Array.isArray(items) ? items : [];
};

const pickEditingKpis = (payload) => (payload?.success ? payload.kpis || [] : []);

/**
 * The Form Run assigned directly to a programme (target_type = "program"), which
 * is the canonical participant intake link, distinct from group-level links.
 *
 * The address is built HERE, inside the read, rather than during a render: it is
 * made of the browser's own origin, and a render also happens on the server,
 * where no origin exists. A transformation runs in the browser, after the answer.
 */
const pickProgramRegLink = (payload) => {
  const run = (payload?.success ? payload.runs || [] : []).find(
    (formRun) => formRun.status === "active" && formRun.public_slug,
  );
  if (!run) return null;
  return {
    name: run.form_name || run.name || "Registration Form",
    url: `${window.location.origin}/s/${run.public_slug}`,
  };
};

export default function ProgramManagement() {
  const { t } = useI18n();
  const { confirm, prompt } = useDialogs();
  const [search, setSearch] = useState("");
  const [activeTab, setTab] = useState("all");
  const [editingProgram, setEditingProgram] = useState(null);
  const [programDateError, setProgramDateError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Validate that the edited dates and duration are consistent:
  // end must be strictly after start, and duration (weeks) must match the
  // span between the two dates. Returns an error message or "" when valid.
  const validateEditDates = (start, end, durationWeeks) => {
    if (!start || !end) return ""; // dates are optional when editing
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "";
    if (endDate.getTime() < startDate.getTime()) {
      return t("adminMisc.programs.dateErrorOrder");
    }
    if (endDate.getTime() === startDate.getTime()) {
      return t("adminMisc.programs.dateErrorSameDay");
    }
    const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    const computedWeeks = Math.max(1, Math.ceil(diffDays / 7));
    const inputWeeks = parseInt(durationWeeks, 10);
    if (inputWeeks && inputWeeks !== computedWeeks) {
      return t("adminMisc.programs.dateErrorDurationMismatch", {
        actual: inputWeeks,
        expected: computedWeeks,
      });
    }
    return "";
  };

  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    type: "cohort",
    default_role: "",
  });
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);

  const [editKpiInput, setEditKpiInput] = useState({
    title: "",
    target_value: 80,
  });
  const [isKpiSubmitting, setIsKpiSubmitting] = useState(false);
  const [groupRegLinksBySegment, setGroupRegLinks] = useState({});

  // ── Facilitator management state ──
  const [facilitatorPool, setFacilitatorPool] = useState([]);
  const [facilitatorSearch, setFacilitatorSearch] = useState("");
  const [facBusy, setFacBusy] = useState(false);

  // Who is signed in, from the shell's session cache: it costs no request of its
  // own, and the browser's stored copy no longer has to be read in an effect. It
  // gates the per-group default-role editor below.
  const { role: userRole } = useSessionUser();

  useEffect(() => {
    if (!editingProgram?.id) return;
    fetch(`/api/contacts`)
      .then((response) => response.json())
      .then((payload) =>
        setFacilitatorPool(payload.success ? payload.contacts || [] : []),
      )
      .catch(() => setFacilitatorPool([]));
  }, [editingProgram?.id]);

  const addFacilitator = async (contact) => {
    if (!editingProgram?.id || !contact?.cid) return;
    setFacBusy(true);
    try {
      const response = await fetch("/api/program-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: editingProgram.id,
          staff_id: contact.cid,
          role: "facilitator",
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        setEditingProgram({
          ...editingProgram,
          facilitators: [
            ...(editingProgram.facilitators || []),
            {
              id: payload.id,
              cid: contact.cid,
              role: "facilitator",
              permissions: {},
              name: contact.name,
              email: contact.email,
            },
          ],
        });
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: t("adminMisc.programs.facilitatorAdded"),
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t("adminMisc.programs.addFacilitatorFailed"),
            },
          }),
        );
      }
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.addFacilitatorFailed"),
          },
        }),
      );
    } finally {
      setFacBusy(false);
    }
  };

  const removeFacilitator = async (facilitator) => {
    if (!facilitator?.id) return;
    try {
      const response = await fetch("/api/program-staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: facilitator.id }),
      });
      const payload = await response.json();
      if (payload.success) {
        setEditingProgram({
          ...editingProgram,
          facilitators: (editingProgram.facilitators || []).filter(
            (existing) => existing.id !== facilitator.id,
          ),
        });
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t("adminMisc.programs.facilitatorRemoveFailed"),
            },
          }),
        );
      }
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.facilitatorRemoveFailed"),
          },
        }),
      );
    }
  };

  const toggleFacOverride = async (facilitator, capKey) => {
    const current = facilitator.permissions || {};
    const next = { ...current };
    if (next[capKey]) delete next[capKey];
    else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    try {
      const response = await fetch("/api/program-staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: facilitator.id, permissions: next }),
      });
      const payload = await response.json();
      if (payload.success) {
        setEditingProgram({
          ...editingProgram,
          facilitators: (editingProgram.facilitators || []).map((entry) =>
            entry.id === facilitator.id ? { ...entry, permissions: next } : entry,
          ),
        });
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t("adminMisc.programs.facilitatorOverrideFailed"),
            },
          }),
        );
      }
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.facilitatorOverrideFailed"),
          },
        }),
      );
    }
  };

  const toggleFacDefault = (capKey) => {
    const current = editingProgram.facilitator_default_permissions || {};
    const next = { ...current };
    if (next[capKey]) delete next[capKey];
    else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    setEditingProgram({
      ...editingProgram,
      facilitator_default_permissions: next,
    });
  };

  const [inviteForm, setInviteForm] = useState({ name: "", email: "" });

  const createAndInviteFacilitator = async () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.nameAndEmailRequired"),
          },
        }),
      );
      return;
    }
    setFacBusy(true);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          name: inviteForm.name.trim(),
          role: "facilitator",
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        if (payload.cid) {
          await addFacilitator({
            cid: payload.cid,
            name: inviteForm.name.trim(),
            email: inviteForm.email.trim(),
          });
        }
        setInviteForm({ name: "", email: "" });
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: t("adminMisc.programs.inviteSent"),
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: payload.error || t("adminMisc.programs.inviteFailed"),
            },
          }),
        );
      }
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.inviteFailed"),
          },
        }),
      );
    } finally {
      setFacBusy(false);
    }
  };

  const setLeadFacilitator = async (familyId, cid) => {
    try {
      const response = await fetch("/api/families", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: familyId, lead_facilitator_id: cid || null }),
      });
      const payload = await response.json();
      if (payload.success) {
        setNotes((prev) =>
          (prev || []).map((note) =>
            note.id === familyId
              ? { ...note, lead_facilitator_id: cid || null }
              : note,
          ),
        );
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: t("adminMisc.programs.leadFacilitatorUpdated"),
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t("adminMisc.programs.leadFacilitatorUpdateFailed"),
            },
          }),
        );
      }
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.leadFacilitatorUpdateFailed"),
          },
        }),
      );
    }
  };

  // Pre-fetch form run URLs for assigned groups when the edit modal opens.
  // Keyed on the list of ids rather than on the array identity, so ticking one
  // segment no longer refires one request per assigned group; and the map is
  // rebuilt in a single pass, so a link belonging to a de-selected group can no
  // longer linger and be sent to participants. A failed lookup keeps the link we
  // already had rather than dropping a valid one.
  const assignedSegmentKey = (editingProgram?.assigned_segments || [])
    .filter(Boolean)
    .join("|");
  // The map is keyed on the assigned groups, so with none assigned there is
  // nothing to show. That is a consequence of the assigned list rather than
  // something an effect has to write: the empty map is derived during render.
  const groupRegLinks = assignedSegmentKey
    ? groupRegLinksBySegment
    : EMPTY_GROUP_REG_LINKS;
  useEffect(() => {
    const groupIds = assignedSegmentKey ? assignedSegmentKey.split("|") : [];
    if (groupIds.length === 0) return;
    let cancelled = false;
    Promise.all(
      groupIds.map(async (groupId) => {
        try {
          const response = await fetch(
            `/api/platform/form-runs?group_id=${encodeURIComponent(groupId)}`,
          );
          const payload = await response.json();
          const run =
            payload.success && payload.runs
              ? payload.runs.find((activeRun) => activeRun.status === "active" && activeRun.public_slug)
              : null;
          return {
            gid: groupId,
            ok: true,
            url: run ? `${window.location.origin}/s/${run.public_slug}` : null,
          };
        } catch (_) {
          return { gid: groupId, ok: false, url: null };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setGroupRegLinks((prev) => {
        const next = {};
        for (const { gid: groupId, ok, url } of results) {
          if (url) next[groupId] = url;
          else if (!ok && prev[groupId]) next[groupId] = prev[groupId];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [assignedSegmentKey]);

  // Fetch the Form Run assigned directly to this PROGRAM (target_type = "program").
  // This is the canonical participant intake link, distinct from group-level links.
  // The read has an address only while a programme is being edited, so closing the
  // dialog leaves nothing to read rather than a null to write.
  const { data: programRegLink } = useApi(
    editingProgram?.id
      ? `/api/platform/form-runs?program_id=${encodeURIComponent(editingProgram.id)}`
      : null,
    { defaultValue: null, transform: pickProgramRegLink },
  );

  // The editing programme's KPIs, through the shared hook. The address exists
  // only while a programme is being edited, so no dialog means nothing to read
  // and nothing to show.
  const { data: editingKpis, refresh: refreshEditingKpis } = useApi(
    editingProgram?.id ? `/api/v2/kpis?program_id=${editingProgram.id}` : null,
    { defaultValue: [], transform: pickEditingKpis },
  );

  const handleAddEditKpi = async () => {
    if (!editKpiInput.title.trim() || !editingProgram?.id) return;
    setIsKpiSubmitting(true);
    try {
      const response = await fetch("/api/v2/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: editingProgram.id,
          title: editKpiInput.title,
          target_value: editKpiInput.target_value,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        setEditKpiInput({ title: "", target_value: 80 });
        refreshEditingKpis();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsKpiSubmitting(false);
    }
  };

  const handleDeleteEditKpi = async (kpiId) => {
    try {
      const response = await fetch("/api/v2/kpis", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: kpiId }),
      });
      const payload = await response.json();
      if (payload.success) {
        refreshEditingKpis();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const router = useRouter();

  // ── Reads ─────────────────────────────────────────────────────────────────
  // The shared hook owns the 30 s cache, the cache-first paint and the
  // discarding of a stale answer, so the page keeps no copy of its own. The
  // programme list is addressed on the tab (part of its own address, which is
  // why nothing declares it as a dependency); the other three are plain reads.
  const {
    data: programs,
    loading: programsLoading,
    refresh: refreshPrograms,
  } = useApi(
    `/api/pm/programs?show_archived=${activeTab === "archived"}&status=${activeTab === "all" ? "all" : activeTab}`,
    { defaultValue: [], transform: pickPrograms },
  );

  const {
    data: teams,
    loading: teamsLoading,
    refresh: refreshTeams,
  } = useApi("/api/contacts/full-state", {
    defaultValue: [],
    transform: pickTeams,
  });

  // The groups list is also the one local write of the four: the lead-facilitator
  // control publishes its own answer through this read's setter.
  const {
    data: notes,
    loading: notesLoading,
    setData: setNotes,
    refresh: refreshNotes,
  } = useApi("/api/families", {
    defaultValue: [],
    transform: pickFamilies,
  });

  const {
    data: knowledgeItems,
    loading: knowledgeLoading,
    refresh: refreshKnowledge,
  } = useApi("/api/knowledge", {
    defaultValue: [],
    transform: pickKnowledgeItems,
  });

  // The four are read together, so the table keeps its placeholder until the
  // last of them has answered - which is what the one loader did.
  const loading =
    programsLoading || teamsLoading || notesLoading || knowledgeLoading;

  // Every action below re-reads what it changed.
  const reload = () => {
    refreshPrograms();
    refreshTeams();
    refreshNotes();
    refreshKnowledge();
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingProgram?.id) return;
    const validationError = validateEditDates(
      editingProgram?.start_date,
      editingProgram?.end_date,
      editingProgram?.duration_weeks,
    );
    if (validationError) {
      setProgramDateError(validationError);
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: validationError },
        }),
      );
      return;
    }
    setIsUpdating(true);
    try {
      const response = await fetch("/api/pm/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProgram),
      });
      const payload = await response.json();
      if (payload.success) {
        setEditingProgram(null);
        setIsCreatingGroup(false);
        reload();
        // Fire success notification
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: t("adminMisc.programs.saved"),
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: payload.error || t("adminMisc.programs.saveFailed"),
            },
          }),
        );
      }
    } catch (error) {
      console.error("Update Failure:", error);
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: error.message || t("adminMisc.programs.saveFailed"),
          },
        }),
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleArchiveAction = async (id, isArchiving, event, name) => {
    if (!id) return;
    event.stopPropagation();
    const progName = name || "";
    if (
      isArchiving &&
      !(await confirm({
        message: t("adminMisc.programs.confirmArchive", { name: progName }),
        tone: "danger",
      }))
    )
      return;
    if (
      !isArchiving &&
      !(await confirm({
        message: t("adminMisc.programs.confirmRestore", { name: progName }),
      }))
    )
      return;
    try {
      const response = await fetch("/api/pm/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          is_archived: isArchiving ? 1 : 0,
        }),
      });
      const payload = await response.json();
      if (payload.success) reload();
      else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t("adminMisc.programs.archiveActionFailed"),
            },
          }),
        );
      }
    } catch (error) {
      console.error("Archive Failure:", error);
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.archiveActionFailed"),
          },
        }),
      );
    }
  };

  const handleCreateGroupInline = async () => {
    const groupName =
      newGroup.name.trim() || (editingProgram?.name || "New Group").trim();
    if (!groupName) return;
    try {
      const response = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          description: newGroup.description,
          type: "cohort",
          program_id: editingProgram?.id || null,
          default_role: newGroup.default_role || null,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        const newSegment =
          payload.group || payload.family || { id: payload.id, name: groupName };
        const current = Array.isArray(editingProgram?.assigned_segments)
          ? editingProgram.assigned_segments
          : [];
        setEditingProgram({
          ...editingProgram,
          assigned_segments: [...current, String(newSegment.id)],
        });
        setNotes((prev) => [...prev, newSegment]);
        setIsCreatingGroup(false);
        setNewGroup({
          name: "",
          description: "",
          type: "cohort",
          default_role: "",
        });
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: t("adminMisc.programs.groupCreatedAndAssigned", {
                name: groupName,
              }),
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: payload.error || t("adminMisc.programs.groupCreationFailed"),
            },
          }),
        );
      }
    } catch (error) {
      console.error("Group creation failed:", error);
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.groupCreationFailed"),
          },
        }),
      );
    }
  };

  const handlePermanentDelete = async (id, event, name) => {
    if (!id) return;
    event.stopPropagation();
    if (
      !(await confirm({
        message: t("adminMisc.programs.confirmDelete", { name: name || "" }),
        tone: "danger",
      }))
    )
      return;
    try {
      const response = await fetch("/api/pm/programs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (payload.success) reload();
      else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t("adminMisc.programs.archiveActionFailed"),
            },
          }),
        );
      }
    } catch (error) {
      console.error("Delete Failure:", error);
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.archiveActionFailed"),
          },
        }),
      );
    }
  };

  const handleEditFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editingProgram) return;

    setIsUploading(true);
    try {
      const path = `curriculum/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const result = await uploadFile("knowledge", path, file);

      if (result?.success) {
        const newMaterial = {
          name: file.name,
          url: result.url,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        };

        const currentMaterials = Array.isArray(editingProgram.materials)
          ? editingProgram.materials
          : [];
        setEditingProgram({
          ...editingProgram,
          materials: [...currentMaterials, newMaterial],
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateConceptNote = async () => {
    if (!newNoteTitle.trim() || !editingProgram?.id) return;
    setCreatingNote(true);
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newNoteTitle.trim(), description: "" }),
      });
      const payload = await response.json();
      if (payload.success) {
        const createdId = payload.id || payload.note?.id;
        if (createdId) {
          // Assign the new note to the program
          setEditingProgram({ ...editingProgram, note_id: createdId });
          // Re-read the knowledge items list through the read that holds it.
          refreshKnowledge();
          window.dispatchEvent(
            new CustomEvent("impactos:notify", {
              detail: {
                type: "success",
                message: t("adminMisc.programs.conceptNoteCreatedAndLinked"),
              },
            }),
          );
        }
        setNewNoteTitle("");
        setShowCreateNote(false);
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message:
                payload.error || t("adminMisc.programs.conceptNoteCreateFailed"),
            },
          }),
        );
      }
    } catch (error) {
      console.error("Create concept note failed:", error);
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: t("adminMisc.programs.conceptNoteCreateFailed"),
          },
        }),
      );
    } finally {
      setCreatingNote(false);
    }
  };

  const safePrograms = Array.isArray(programs) ? programs : [];
  const filtered = safePrograms.filter(
    (program) =>
      program?.name &&
      program.name.toLowerCase().includes((search || "").toLowerCase()),
  );

  return (
    <>
      <div className="space-y-10 pb-20 animate-in text-left">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all font-bold text-[10px] uppercase tracking-wide"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              {t("adminMisc.programs.backToDashboard")}
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("adminMisc.programs.administration")}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
                {t("admin.programsList")}
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/standardization")}
              className="btn btn-secondary gap-2"
            >
              <Settings className="w-4 h-4" /> {t("navigation.settings")}
            </button>
            <button
              onClick={() => router.push("/admin/programs/new")}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> {t("admin.newProgram")}
            </button>
          </div>
        </header>

        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-secondary border border-[var(--border-primary)] rounded-xl p-1">
            {[
              { key: "all", label: t("admin.tabAll") },
              { key: "active", label: t("admin.tabActive") },
              { key: "planned", label: t("adminMisc.programs.tabPlanned") },
              { key: "pending", label: t("admin.tabPending") },
              { key: "completed", label: t("admin.tabCompleted") },
              { key: "archived", label: t("admin.tabArchived") },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  activeTab === tab.key
                    ? "bg-[var(--brand-orange)] text-black"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.search")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={10} />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("adminMisc.programs.programDetails")}</th>
                  <th>{t("adminMisc.programs.status")}</th>
                  <th>{t("adminMisc.programs.programManager")}</th>
                  <th>{t("adminMisc.programs.engagement")}</th>
                  <th className="text-right">{t("adminMisc.programs.administration")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((program, index) => (
                  <tr
                    key={program?.id || index}
                    className="group cursor-pointer hover:bg-secondary"
                    onClick={() =>
                      program?.id && router.push(`/admin/programs/${program.id}`)
                    }
                  >
                    <td>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-secondary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                          <Signal className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                            {program?.name ||
                              t("adminMisc.programs.unnamedMission")}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-0.5 line-clamp-1 max-w-xs">
                            {program?.description ||
                              t("adminMisc.programs.noDirective")}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          program?.status === "active"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : program?.status === "in_progress"
                              ? "bg-blue-500/10 text-blue-500"
                              : program?.status === "planned"
                                ? "bg-sky-500/10 text-sky-500"
                                : program?.status === "pending"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : program?.status === "completed"
                                    ? "bg-purple-500/10 text-purple-500"
                                    : program?.status === "archived"
                                      ? "bg-rose-500/10 text-rose-500"
                                      : "bg-slate-500/10 text-[var(--text-secondary)]"
                        }`}
                      >
                        {program?.status === "active"
                          ? t("adminMisc.programs.statusInProgress")
                          : program?.status === "in_progress"
                            ? t("adminMisc.programs.statusInProgress")
                            : program?.status === "planned"
                              ? t("adminMisc.programs.statusPlanned")
                              : program?.status === "pending"
                                ? t("adminMisc.programs.statusPending")
                                : program?.status === "completed"
                                  ? t("adminMisc.programs.statusCompleted")
                                  : program?.status === "archived"
                                    ? t("adminMisc.programs.statusArchived")
                                    : program?.status ||
                                      t("adminMisc.programs.unknown")}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-[var(--brand-orange)]" />
                        <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                          {program?.pm_name || t("admin.unassigned")}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                            {program?.participants_count || 0}{" "}
                            {t("adminMisc.programs.members")}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase mt-0.5">
                            {Math.round(program?.completion_index || 0) || 0}%
                            {t("adminMisc.programs.progress")}
                          </span>
                        </div>
                        <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--brand-orange)]"
                            style={{
                              width: `${program?.completion_index || 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {activeTab === "archived" ? (
                          <>
                            <button
                              onClick={(event) =>
                                handleArchiveAction(
                                  program?.id,
                                  false,
                                  event,
                                  program?.name,
                                )
                              }
                              title={t("adminMisc.programs.restore")}
                              className="p-2 hover:text-emerald-500"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(event) =>
                                handlePermanentDelete(
                                  program?.id,
                                  event,
                                  program?.name,
                                )
                              }
                              title={t("adminMisc.programs.delete")}
                              className="p-2 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/admin/programs/${program?.id}`);
                              }}
                              title={t("adminMisc.programs.launchExecutiveDashboard")}
                              className="p-2 hover:text-[var(--brand-orange)]"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                // Format dates for <input type="date"> (YYYY-MM-DD)
                                const formatted = { ...program };
                                formatted.start_date = toDateInputValue(
                                  program.start_date,
                                );
                                formatted.end_date = toDateInputValue(
                                  program.end_date,
                                );
                                setEditingProgram(formatted);
                                setProgramDateError("");
                              }}
                              title={t("admin.edit")}
                              className="p-2 hover:text-[var(--brand-orange)]"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(
                                  `/admin/programs/${program?.id}/teams`,
                                );
                              }}
                              title={t("adminMisc.programs.manageTeams")}
                              className="p-2 hover:text-[var(--brand-orange)]"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(event) =>
                                handleArchiveAction(
                                  program?.id,
                                  true,
                                  event,
                                  program?.name,
                                )
                              }
                              title={t("adminMisc.programs.archive")}
                              className="p-2 hover:text-orange-500"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingProgram && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div className="card w-full max-w-xl space-y-8 border-brand-orange/30 animate-in text-left my-auto max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center sticky top-0 bg-secondary pb-4 z-10 border-b border-[var(--border-primary)]">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                  {t("adminMisc.programs.editProgramRegistry")}
                </h3>
                <p className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest mt-1">
                  {t("adminMisc.programs.operationalId")}: {editingProgram?.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingProgram(null);
                  setIsCreatingGroup(false);
                }}
                className="p-2 hover:bg-tertiary rounded-lg text-[var(--text-secondary)] transition-all"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t("adminMisc.programs.programName")}
                </label>
                <input
                  type="text"
                  value={editingProgram?.name || ""}
                  onChange={(event) =>
                    setEditingProgram({
                      ...editingProgram,
                      name: event.target.value,
                    })
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] focus:ring-1 focus:ring-[var(--brand-orange)] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t?.("admin.startDate") || "Start Date"}
                  </label>
                  <input
                    type="date"
                    value={editingProgram?.start_date || ""}
                    onChange={(event) => {
                      const startDate = event.target.value;
                      setEditingProgram({ ...editingProgram, start_date: startDate });
                      setProgramDateError(
                        validateEditDates(
                          startDate,
                          editingProgram?.end_date,
                          editingProgram?.duration_weeks,
                        ),
                      );
                    }}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t?.("admin.endDate") || "End Date"}
                  </label>
                  <input
                    type="date"
                    value={editingProgram?.end_date || ""}
                    onChange={(event) => {
                      const endDate = event.target.value;
                      setEditingProgram({ ...editingProgram, end_date: endDate });
                      setProgramDateError(
                        validateEditDates(
                          editingProgram?.start_date,
                          endDate,
                          editingProgram?.duration_weeks,
                        ),
                      );
                    }}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  />
                </div>
              </div>

              {programDateError && (
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1 ml-2">
                  {programDateError}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t?.("admin.visibility") || "Visibility"}
                  </label>
                  <select
                    value={editingProgram?.visibility || "private"}
                    onChange={(event) =>
                      setEditingProgram({
                        ...editingProgram,
                        visibility: event.target.value,
                      })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
                  >
                    <option value="private">{t?.("admin.visibilityOptions.private") || "Private"}</option>
                    <option value="public">{t?.("admin.visibilityOptions.public") || "Public"}</option>
                    <option value="invite_only">{t?.("admin.visibilityOptions.inviteOnly") || "Invite Only"}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t?.("admin.language") || "Language"}
                  </label>
                  <select
                    value={editingProgram?.language || "en"}
                    onChange={(event) =>
                      setEditingProgram({
                        ...editingProgram,
                        language: event.target.value,
                      })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t?.("admin.vision") || "Vision"}
                  </label>
                  <textarea
                    rows={2}
                    value={editingProgram?.vision || ""}
                    onChange={(event) =>
                      setEditingProgram({
                        ...editingProgram,
                        vision: event.target.value,
                      })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t?.("admin.objectives") || "Objectives"}
                  </label>
                  <textarea
                    rows={2}
                    value={editingProgram?.objectives || ""}
                    onChange={(event) =>
                      setEditingProgram({
                        ...editingProgram,
                        objectives: event.target.value,
                      })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
                  />
                </div>
              </div>

              {/* Expected Outcomes & Success Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t("adminMisc.programs.expectedOutcomes")}
                  </label>
                  <textarea
                    rows={2}
                    value={editingProgram?.expected_outcomes || ""}
                    onChange={(event) =>
                      setEditingProgram({
                        ...editingProgram,
                        expected_outcomes: event.target.value,
                      })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t("adminMisc.programs.successMetrics")}
                  </label>
                  <textarea
                    rows={2}
                    value={editingProgram?.success_metrics || ""}
                    onChange={(event) =>
                      setEditingProgram({
                        ...editingProgram,
                        success_metrics: event.target.value,
                      })
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
                  />
                </div>
              </div>

              {/* Registration Link — the Program-assigned Form Run is the canonical intake point */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t("adminMisc.programs.registrationLink")}
                </label>
                {(() => {
                  const formUrl = programRegLink?.url || groupRegLinks[editingProgram?.assigned_segments?.[0]] || null;
                  const formName = programRegLink?.name || null;
                  if (formUrl) {
                    return (
                      <div className="space-y-1.5">
                        {formName && (
                          <p className="text-[10px] font-bold uppercase text-[var(--text-primary)] ml-2 truncate">{formName}</p>
                        )}
                        <div className="flex items-center gap-2 bg-primary/50 rounded-xl px-1 py-1 border border-[var(--border-primary)]">
                        <code
                          className="flex-1 text-[10px] font-mono bg-black/30 px-4 py-3 rounded-xl border border-[var(--border-primary)] truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formUrl}
                        </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(formUrl);
                              window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type: "success", message: t("adminMisc.programs.registrationLinkCopied") } }));
                            }}
                            className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                            title={t("adminMisc.programs.copyRegistrationLink")}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <a
                            href={formUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20"
                            title={t("adminMisc.programs.openForm")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-amber-400">{t("adminMisc.programs.noFormYet")}</p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("adminMisc.programs.noFormYetHint")}</p>
                      <a href="/platform/forms" className="inline-block text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline">
                        {t("adminMisc.programs.goToCrmForms")}
                      </a>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t?.("admin.selectManager") || "PROGRAM MANAGER"}
                </label>
                <select
                  value={editingProgram?.assigned_pm_id || ""}
                  onChange={(event) =>
                    setEditingProgram({
                      ...editingProgram,
                      assigned_pm_id: event.target.value,
                    })
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
                >
                  <option value="">{t?.("admin.unassigned") || "Unassigned"}</option>
                  {(Array.isArray(teams) ? teams : []).map(
                    (member) =>
                      member && (
                        <option key={member.cid || member.id} value={member.cid || member.id}>
                          {member.name?.toUpperCase()}
                        </option>
                      ),
                  )}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t?.("admin.programPersonnel") || "PROGRAM PERSONNEL (STAFF)"}
                </label>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                  {t("adminMisc.programs.staffAssistHint", {
                    manager: t("admin.selectManager"),
                  })}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 bg-primary rounded-2xl border border-[var(--border-primary)]">
                  {(Array.isArray(teams) ? teams : [])
                    .filter(
                      (teamMember) =>
                        teamMember &&
                        (teamMember.cid || teamMember.id) !==
                          editingProgram?.assigned_pm_id,
                    )
                    .map((member) => {
                      if (!member) return null;
                      const memberId = member.cid || member.id;
                      let assistantIds = [];
                      if (
                        typeof editingProgram?.assigned_assistant_id ===
                        "string"
                      ) {
                        try {
                          const parsed = JSON.parse(
                            editingProgram.assigned_assistant_id,
                          );
                          assistantIds = Array.isArray(parsed)
                            ? parsed
                            : editingProgram.assigned_assistant_id
                                .split(",")
                                .filter(Boolean);
                        } catch {
                          assistantIds = editingProgram.assigned_assistant_id
                            .split(",")
                            .filter(Boolean);
                        }
                      } else if (
                        Array.isArray(editingProgram?.assigned_assistant_id)
                      ) {
                        assistantIds = editingProgram.assigned_assistant_id;
                      }

                      const isActive = assistantIds.includes(memberId);

                      return (
                        <button
                          key={memberId}
                          type="button"
                          onClick={() => {
                            let next;
                            if (isActive) {
                              next = assistantIds.filter(
                                (assistantId) => assistantId !== memberId,
                              );
                            } else {
                              next = [...assistantIds, memberId];
                            }
                            setEditingProgram({
                              ...editingProgram,
                              assigned_assistant_id: next.join(","),
                            });
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            isActive
                              ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                              : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold ${isActive ? "text-[var(--brand-orange)] border-brand-orange/30" : ""}`}
                          >
                            {member.name?.charAt(0) || "?"}
                          </div>
                          <span className="text-[10px] font-bold uppercase truncate">
                            {member.name || member.email || member.cid || t("adminMisc.programs.unknown")}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t("adminMisc.programs.knowledgeBaseNote")}
                </label>
                <div className="flex gap-2">
                  <select
                    value={editingProgram?.note_id || ""}
                    onChange={(event) =>
                      setEditingProgram({
                        ...editingProgram,
                        note_id: event.target.value,
                      })
                    }
                    className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
                  >
                    <option value="">{t("adminMisc.programs.noneAssigned")}</option>
                    {(Array.isArray(knowledgeItems)
                      ? knowledgeItems
                      : []
                    ).map(
                      (item) =>
                        item && (
                          <option key={item.id} value={item.id}>
                            {item.title?.toUpperCase() || t("adminMisc.programs.untitledNode")}
                          </option>
                        ),
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCreateNote(!showCreateNote)}
                    className="px-3 py-2 rounded-xl border border-dashed border-[var(--brand-orange)] text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wider hover:bg-brand-orange/10 transition-all whitespace-nowrap"
                  >
                    {t("adminMisc.programs.newNote")}
                  </button>
                </div>
                {showCreateNote && (
                  <div className="mt-3 p-4 bg-primary border border-[var(--border-primary)] rounded-xl space-y-3 animate-in">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                      {t("adminMisc.programs.createNewConceptNote")}
                    </p>
                    <input
                      type="text"
                      value={newNoteTitle}
                      onChange={(event) => setNewNoteTitle(event.target.value)}
                      placeholder={t("adminMisc.programs.conceptNoteTitlePlaceholder")}
                      className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg p-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateConceptNote}
                        disabled={creatingNote || !newNoteTitle.trim()}
                        className="flex-1 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide disabled:opacity-50 transition-all"
                      >
                        {creatingNote ? t("adminMisc.programs.creating") : t("adminMisc.programs.createAndLink")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateNote(false);
                          setNewNoteTitle("");
                        }}
                        className="py-2 px-4 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:bg-tertiary transition-all"
                      >
                        {t("adminMisc.programs.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t("adminMisc.programs.durationWeeks")}
                </label>
                <input
                  type="number"
                  value={editingProgram?.duration_weeks || 4}
                  onChange={(event) => {
                    const durationWeeks = parseInt(event.target.value) || 4;
                    setEditingProgram({ ...editingProgram, duration_weeks: durationWeeks });
                    setProgramDateError(
                      validateEditDates(
                        editingProgram?.start_date,
                        editingProgram?.end_date,
                        durationWeeks,
                      ),
                    );
                  }}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t("admin.programStatus")}
                </label>
                <select
                  value={editingProgram?.status || "active"}
                  onChange={(event) =>
                    setEditingProgram({
                      ...editingProgram,
                      status: event.target.value,
                    })
                  }
                  className={`w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer ${
                    editingProgram?.status === "active"
                      ? "text-emerald-500"
                      : editingProgram?.status === "planned"
                        ? "text-sky-500"
                      : editingProgram?.status === "pending"
                        ? "text-amber-500"
                        : editingProgram?.status === "completed"
                          ? "text-purple-500"
                          : editingProgram?.status === "archived"
                            ? "text-rose-500"
                            : "text-[var(--text-primary)]"
                  }`}
                >
                  <option value="planned" className="text-sky-500">
                    {t("adminMisc.programs.statusPlanned")}
                  </option>
                  <option value="active" className="text-emerald-500">
                    {t("adminMisc.programs.statusInProgress")}
                  </option>
                  <option value="pending" className="text-amber-500">
                    {t("adminMisc.programs.statusPending")}
                  </option>
                  <option value="completed" className="text-purple-500">
                    {t("adminMisc.programs.statusCompleted")}
                  </option>
                  <option value="archived" className="text-rose-500">
                    {t("adminMisc.programs.statusArchived")}
                  </option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t?.("admin.curriculumMaterials") || "Curriculum Materials (PDF)"}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    if (!editingProgram) return null;
                    let materials = [];
                    try {
                      const raw = Array.isArray(editingProgram.materials)
                        ? editingProgram.materials
                        : typeof editingProgram.materials === "string"
                          ? JSON.parse(editingProgram.materials || "[]")
                          : [];
                      materials = Array.isArray(raw) ? raw : [];
                    } catch (error) {
                      console.error("Materials parse failure:", error);
                      materials = [];
                    }

                    if (materials.length === 0)
                      return (
                        <p className="text-[10px] font-medium opacity-40 ml-2">
                          {t?.("admin.noProgramPdfs") || "No program-specific PDFs uploaded."}
                        </p>
                      );

                    return materials.map(
                      (file, index) =>
                        file && (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-tertiary border border-[var(--border-primary)] rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-blue-500" />
                              <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase truncate max-w-[200px]">
                                {file.name || t("adminMisc.programs.untitledPdf")}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const remainingMaterials = materials.filter(
                                  (_, materialIndex) => materialIndex !== index,
                                );
                                setEditingProgram({
                                  ...editingProgram,
                                  materials: remainingMaterials,
                                });
                              }}
                              className="text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ),
                    );
                  })()}
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() =>
                      document.getElementById("curriculum-upload")?.click()
                    }
                    className="btn btn-secondary px-6 py-3 flex items-center gap-2 border-dashed"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span className="text-[10px] uppercase font-bold">
                      {isUploading ? t?.("common.saving") || "Syncing..." : t?.("admin.uploadPdf") || "Upload Additional PDF"}
                    </span>
                  </button>
                  <input
                    id="curriculum-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleEditFileUpload}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t?.("admin.targetGroups") || "TARGET STUDENT GROUPS"}
                </label>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                  {t?.("admin.assignProgramToGroups") || "Assign this program to specific student cohorts or families."}
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-primary rounded-2xl border border-[var(--border-primary)]">
                  {(Array.isArray(notes) ? notes : []).map((family) => {
                    if (!family) return null;
                    const assignedSegments = Array.isArray(
                      editingProgram?.assigned_segments,
                    )
                      ? editingProgram.assigned_segments
                      : [];
                    const isActive = assignedSegments.some(
                      (segmentId) => String(segmentId) === String(family.id),
                    );
                    const canEditRole = userRole === "super_admin";
                    return (
                      <div
                        key={family.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isActive
                            ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                            : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const next = isActive
                              ? assignedSegments.filter(
                                  (segmentId) =>
                                    String(segmentId) !== String(family.id),
                                )
                              : [...assignedSegments, family.id];
                            setEditingProgram({
                              ...editingProgram,
                              assigned_segments: next,
                            });
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                        <Users
                          className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                        />
                        <div className="flex flex-col overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase truncate">
                              {family.name || t("adminMisc.programs.unnamed")}
                            </span>
                            {isActive && family.default_role && !canEditRole && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase shrink-0">
                                {family.default_role}
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <span 
                              className="text-[10px] font-medium text-emerald-400/80 hover:text-emerald-400 truncate mt-0.5"
                              title={t("adminMisc.programs.clickToCopyRegistrationLink")}
                              onClick={async (event) => {
                                event.stopPropagation();
                                const registrationId = family.registration_id || family.id;
                                try {
                                  const formRunsResponse = await fetch(`/api/platform/form-runs?group_id=${encodeURIComponent(registrationId)}`);
                                  const formRunsPayload = await formRunsResponse.json();
                                  const run = (formRunsPayload.success ? formRunsPayload.runs || [] : []).find((formRun) => formRun.status === "active" && formRun.public_slug);
                                  if (run) {
                                    navigator.clipboard.writeText(`${window.location.origin}/s/${run.public_slug}`);
                                    window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type: "success", message: t("admin.copied") } }));
                                  } else {
                                    window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type: "error", message: t("adminMisc.programs.noFormYet") } }));
                                  }
                                } catch (_) {
                                  window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type: "error", message: t("adminMisc.programs.noFormYet") } }));
                                }
                              }}
                            >
                              {t("admin.copyLink")}
                            </span>
                          )}
                        </div>
                        </button>
                        {isActive && family.default_role && canEditRole && (
                          <select
                            value={family.default_role}
                            onChange={async (event) => {
                              const newRole = event.target.value || null;
                              try {
                                const response = await fetch("/api/families", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id: family.id,
                                    default_role: newRole,
                                  }),
                                });
                                const payload = await response.json();
                                if (payload.success) {
                                  const updated = (Array.isArray(notes)
                                    ? notes
                                    : []
                                  ).map((note) =>
                                    String(note.id) === String(family.id)
                                      ? { ...note, default_role: newRole }
                                      : note,
                                  );
                                  setNotes(updated);
                                  window.dispatchEvent(
                                    new CustomEvent("impactos:notify", {
                                      detail: {
                                        type: "success",
                                        message: t(
                                          "adminMisc.programs.roleUpdated",
                                        ),
                                      },
                                    }),
                                  );
                                } else {
                                  window.dispatchEvent(
                                    new CustomEvent("impactos:notify", {
                                      detail: {
                                        type: "error",
                                        message: t(
                                          "adminMisc.programs.roleUpdateFailed",
                                        ),
                                      },
                                    }),
                                  );
                                }
                              } catch (_) {
                                window.dispatchEvent(
                                  new CustomEvent("impactos:notify", {
                                    detail: {
                                      type: "error",
                                      message: t(
                                        "adminMisc.programs.roleUpdateFailed",
                                      ),
                                    },
                                  }),
                                );
                              }
                            }}
                            className="text-[10px] font-bold px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase outline-none border-none cursor-pointer hover:bg-purple-500/30 shrink-0"
                          >
                            <option value={family.default_role}>
                              {family.default_role}
                            </option>
                            <option value="">
                              {t("adminMisc.programs.roleNone")}
                            </option>
                            <option value="participant">
                              {t("adminMisc.programs.roleParticipant")}
                            </option>
                            <option value="staff">
                              {t("adminMisc.programs.roleStaff")}
                            </option>
                            <option value="program_manager">
                              {t("adminMisc.programs.roleProgramManager")}
                            </option>
                            <option value="mentor">
                              {t("adminMisc.programs.roleMentor")}
                            </option>
                            <option value="investor">
                              {t("adminMisc.programs.roleInvestor")}
                            </option>
                            <option value="founder">
                              {t("adminMisc.programs.roleFounder")}
                            </option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingGroup(!isCreatingGroup);
                      if (!isCreatingGroup && editingProgram?.name) {
                        setNewGroup({
                          name: editingProgram.name,
                          description: "",
                          type: "cohort",
                          default_role: "",
                        });
                      }
                    }}
                    className="text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline"
                  >
                    {isCreatingGroup ? t?.("common.cancel") || "Cancel" : t?.("admin.createNewGroup") || "+ Create New Group"}
                  </button>
                </div>

                {/* ═══ PROGRAM FACILITATORS (EXTERNAL PERSONNEL) ═══ */}
                <div className="space-y-3 mt-4 pt-4 border-t border-divider/40">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    {t("adminMisc.programs.programFacilitatorsTitle")}
                  </label>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                    {t("adminMisc.programs.programFacilitatorsHint")}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingProgram({ ...editingProgram, facilitator_scope: "assigned_groups" })}
                      className={`p-3 rounded-xl border text-left transition-all ${editingProgram?.facilitator_scope !== "all" ? "bg-brand-orange/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
                    >
                      <p className={`text-[10px] font-bold uppercase ${editingProgram?.facilitator_scope !== "all" ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}>{t("adminMisc.programs.scopeAssignedGroups")}</p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{t("adminMisc.programs.scopeAssignedGroupsHint")}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProgram({ ...editingProgram, facilitator_scope: "all" })}
                      className={`p-3 rounded-xl border text-left transition-all ${editingProgram?.facilitator_scope === "all" ? "bg-brand-orange/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
                    >
                      <p className={`text-[10px] font-bold uppercase ${editingProgram?.facilitator_scope === "all" ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}>{t("adminMisc.programs.scopeAll")}</p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{t("adminMisc.programs.scopeAllHint")}</p>
                    </button>
                  </div>

                  <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.programs.defaultPermissionsTitle")}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FACILITATOR_CAPS.map((cap) => {
                        const active = !!(editingProgram?.facilitator_default_permissions || {})[cap.key];
                        return (
                          <button
                            key={cap.key}
                            type="button"
                            onClick={() => toggleFacDefault(cap.key)}
                            className={`text-[10px] font-bold uppercase px-1.5 py-1.5 rounded-lg border text-left truncate transition-all ${active ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"}`}
                          >
                            {t(`adminMisc.programs.${cap.labelKey}`)}{active ? " ✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.programs.assignedFacilitatorsTitle")}</p>
                    {(editingProgram?.facilitators || []).length === 0 && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("adminMisc.programs.noFacilitatorsAssigned")}</p>
                    )}
                    {(editingProgram?.facilitators || []).map((facilitator) => (
                      <div key={facilitator.id} className="rounded-xl border border-[var(--border-primary)] p-2.5 space-y-2 bg-secondary">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase truncate">{facilitator.name || facilitator.email || facilitator.cid}</p>
                            <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{facilitator.email && facilitator.email !== facilitator.name ? facilitator.email : ""}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFacilitator(facilitator)}
                            className="text-[10px] font-bold uppercase text-rose-400 hover:underline shrink-0"
                          >
                            {t("adminMisc.programs.remove")}
                          </button>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.programs.individualOverridesTitle")}</p>
                        <div className="grid grid-cols-2 gap-1">
                          {FACILITATOR_CAPS.map((cap) => {
                            const active = !!(facilitator.permissions || {})[cap.key];
                            return (
                              <button
                                key={cap.key}
                                type="button"
                                onClick={() => toggleFacOverride(facilitator, cap.key)}
                                className={`text-[10px] font-bold uppercase px-1.5 py-1 rounded-lg border text-left truncate transition-all ${active ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
                              >
                                {t(`adminMisc.programs.${cap.labelKey}`)}{active ? " ✓" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.programs.addFacilitatorTitle")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={inviteForm.name}
                        onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })}
                        placeholder={t("adminMisc.programs.newFacilitatorNamePlaceholder")}
                        className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                      />
                      <input
                        value={inviteForm.email}
                        onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
                        placeholder={t("adminMisc.programs.newFacilitatorEmailPlaceholder")}
                        className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={facBusy}
                      onClick={createAndInviteFacilitator}
                      className="w-full text-[10px] font-bold uppercase px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
                    >
                      {t("adminMisc.programs.createAndInviteFacilitator")}
                    </button>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {t("adminMisc.programs.createAndInviteHint")}
                    </p>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                      <input
                        value={facilitatorSearch}
                        onChange={(event) => setFacilitatorSearch(event.target.value)}
                        placeholder={t("adminMisc.programs.searchFacilitatorPlaceholder")}
                        className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-9 pr-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {facilitatorPool
                        .filter((contact) => !(editingProgram?.facilitators || []).some((facilitator) => facilitator.cid === contact.cid))
                        .filter((contact) => contact.role !== "participant" && contact.role !== "applicant" && contact.role !== "student")
                        .filter((contact) => !facilitatorSearch || (contact.name || "").toLowerCase().includes(facilitatorSearch.toLowerCase()) || (contact.email || "").toLowerCase().includes(facilitatorSearch.toLowerCase()))
                        .map((contact) => (
                          <button
                            key={contact.cid}
                            type="button"
                            disabled={facBusy}
                            onClick={() => addFacilitator(contact)}
                            className="w-full flex items-center justify-between gap-2 p-2 rounded-lg border border-dashed border-[var(--border-primary)] hover:border-[var(--brand-orange)] text-left transition-all"
                          >
                            <span className="text-[10px] font-bold uppercase truncate">{contact.name || contact.email}</span>
                            <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{contact.email && contact.email !== contact.name ? contact.email : ""}</span>
                            <Plus className="w-3 h-3 shrink-0 text-emerald-400" />
                          </button>
                        ))}
                      {facilitatorPool.length === 0 && (
                        <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                          {t("adminMisc.programs.noContactsInFacilitatorGroup")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.programs.leadFacilitatorPerGroupTitle")}</p>
                    {(editingProgram?.assigned_segments || []).map((segmentId) => {
                      const family = (Array.isArray(notes) ? notes : []).find((note) => String(note.id) === String(segmentId));
                      if (!family) return null;
                      return (
                        <div key={segmentId} className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase truncate">{family.name}</span>
                          <select
                            value={family.lead_facilitator_id || ""}
                            onChange={(event) => setLeadFacilitator(family.id, event.target.value || null)}
                            className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer max-w-[45%]"
                          >
                            <option value="">{t("adminMisc.programs.noneOption")}</option>
                            {(editingProgram?.facilitators || []).map((facilitator) => (
                              <option key={facilitator.cid} value={facilitator.cid}>{facilitator.name}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                    {(editingProgram?.assigned_segments || []).length === 0 && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("adminMisc.programs.assignGroupsForLeadFacilitatorHint")}</p>
                    )}
                  </div>
                </div>

                {isCreatingGroup && (
                  <div className="space-y-3 p-4 bg-primary border border-blue-500/20 rounded-xl animate-in fade-in mt-2">
                    <input
                      value={newGroup.name}
                      onChange={(event) =>
                        setNewGroup({ ...newGroup, name: event.target.value })
                      }
                      placeholder={t("adminMisc.programs.groupNamePlaceholder")}
                      className="w-full bg-transparent border-b border-[var(--border-primary)] py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-blue-400"
                    />
                    <textarea
                      value={newGroup.description}
                      onChange={(event) =>
                        setNewGroup({
                          ...newGroup,
                          description: event.target.value,
                        })
                      }
                      placeholder={t("adminMisc.programs.groupDescriptionPlaceholder")}
                      rows={2}
                      className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-blue-400 resize-none"
                    />
                    <select
                      value={newGroup.default_role || ""}
                      onChange={(event) =>
                        setNewGroup({ ...newGroup, default_role: event.target.value })
                      }
                      className="w-full bg-transparent border border-[var(--border-primary)] p-2 rounded text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-blue-400"
                    >
                      <option value="">{t("adminMisc.programs.defaultRoleOptional")}</option>
                      <option value="participant">{t("adminMisc.programs.roleParticipant")}</option>
                      <option value="staff">{t("adminMisc.programs.roleStaff")}</option>
                      <option value="program_manager">{t("adminMisc.programs.roleProgramManager")}</option>
                      <option value="mentor">{t("adminMisc.programs.roleMentor")}</option>
                      <option value="investor">{t("adminMisc.programs.roleInvestor")}</option>
                      <option value="founder">{t("adminMisc.programs.roleFounder")}</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleCreateGroupInline}
                      className="w-full py-2.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                    >
                      {t?.("common.create") || "Create & Assign Group"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  {t("adminMisc.programs.conceptNote")}
                </label>
                <textarea
                  rows={3}
                  value={editingProgram?.description || ""}
                  onChange={(event) =>
                    setEditingProgram({
                      ...editingProgram,
                      description: event.target.value,
                    })
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
                />
              </div>

              {/* STRATEGIC KPIs EDITOR */}
              <div className="space-y-4 pt-6 border-t border-[var(--border-primary)] text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2 font-sans flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" />{" "}
                    {t("adminMisc.programs.strategicKpisConfiguration")}
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.programs.superAdminOnly")}
                  </span>
                </div>

                <div className="space-y-3">
                  {editingKpis.map((kpi) => (
                    <div
                      key={kpi.id}
                      className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-[var(--border-primary)] rounded-xl group hover:border-brand-orange/30 transition-all"
                    >
                      <div>
                        <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                          {kpi.title}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] mt-1">
                          {t("admin.targetValue")}: {kpi.target_value}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEditKpi(kpi.id)}
                        className="text-[var(--text-secondary)] hover:text-rose-500 transition-colors p-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="p-4 bg-brand-orange/5 border border-brand-orange/10 rounded-xl space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                        {t("adminMisc.programs.defineNewTarget")}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {t("adminMisc.programs.targetDescription")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder={t("adminMisc.programs.kpiTitlePlaceholder", {
                          title: t("admin.kpiTitle"),
                        })}
                        className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
                        value={editKpiInput.title}
                        onChange={(event) =>
                          setEditKpiInput({
                            ...editKpiInput,
                            title: event.target.value,
                          })
                        }
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder={t("adminMisc.programs.targetPercentSample")}
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
                          value={editKpiInput.target_value}
                          onChange={(event) =>
                            setEditKpiInput({
                              ...editKpiInput,
                              target_value: parseInt(event.target.value) || 0,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={handleAddEditKpi}
                          disabled={
                            isKpiSubmitting || !editKpiInput.title.trim()
                          }
                          className="px-4 bg-[var(--brand-orange)] text-black font-bold uppercase text-sm tracking-wide rounded-xl hover:bg-white transition-all disabled:opacity-50"
                        >
                          {t("adminMisc.programs.add")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="btn btn-primary w-full py-5 text-sm font-bold uppercase tracking-wide shadow-xl shadow-orange-500/20"
              >
                {isUpdating ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />{" "}
                    <span>{t("common.saving")}</span>
                  </div>
                ) : (
                  t("adminMisc.programs.save")
                )}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const name = await prompt({
                    message: t("adminMisc.programs.templateNamePrompt"),
                  });
                  if (!name || !editingProgram?.id) return;
                  const response = await fetch(
                    "/api/pm/programs/templates?action=save",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        program_id: editingProgram.id,
                        template_name: name,
                      }),
                    },
                  );
                  const payload = await response.json();
                  if (payload.success) {
                    window.dispatchEvent(
                      new CustomEvent("impactos:notify", {
                        detail: {
                          type: "success",
                          message: t("admin.templateSaved"),
                        },
                      }),
                    );
                  }
                }}
                className="btn btn-secondary w-full py-5 uppercase font-black tracking-[0.2em] mt-3"
              >
                <FileText className="w-4 h-4" /> {t("admin.saveAsTemplate")}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
