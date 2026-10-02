"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import { uploadFile } from "@/lib/storage";
import ProgramsTable from "@/components/admin/programs/ProgramsTable";
import EditProgramModal from "@/components/admin/programs/EditProgramModal";

// ─── Read shapers (module scope: built once, never per render) ──────────────
const pickPrograms = (payload) =>
  payload?.success && Array.isArray(payload.programs) ? payload.programs : [];

const pickTeams = (payload) => {
  const contacts =
    payload?.success && Array.isArray(payload.contacts) ? payload.contacts : [];
  return contacts.filter(
    (c) => c && c.group_name?.toUpperCase() === "FUTURE STUDIO",
  );
};

const pickFamilies = (payload) =>
  payload?.success && Array.isArray(payload.families) ? payload.families : [];

const pickKnowledgeItems = (payload) => {
  if (!payload?.success) return [];
  const items = payload.conceptNotes || payload.knowledgeItems || payload.notes || [];
  return Array.isArray(items) ? items : [];
};

const pickEditingKpis = (payload) => (payload?.success ? payload.kpis || [] : []);

const pickProgramRegLink = (payload) => {
  const run = (payload?.success ? payload.runs || [] : []).find(
    (r) => r.status === "active" && r.public_slug,
  );
  return run
    ? { url: `${typeof window !== "undefined" ? window.location.origin : ""}/s/${run.public_slug}`, name: run.form_name || null }
    : null;
};

// Converts any date value to YYYY-MM-DD without UTC day shifts
const toDateInputValue = (value) => {
  if (!value) return "";
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
};

const EMPTY_GROUP_REG_LINKS = {};

export default function ProgramManagement() {
  const { t } = useI18n();
  const { confirm, prompt } = useDialogs();
  const router = useRouter();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [activeTab, setTab] = useState("all");
  const [editingProgram, setEditingProgram] = useState(null);
  const [programDateError, setProgramDateError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", type: "cohort", default_role: "" });
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const [editKpiInput, setEditKpiInput] = useState({ title: "", target_value: 80 });
  const [isKpiSubmitting, setIsKpiSubmitting] = useState(false);
  const [groupRegLinksBySegment, setGroupRegLinks] = useState({});
  const [facilitatorPool, setFacilitatorPool] = useState([]);
  const [facilitatorSearch, setFacilitatorSearch] = useState("");
  const [facBusy, setFacBusy] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "" });

  const { role: userRole } = useSessionUser();

  // ── Data reads ─────────────────────────────────────────────────────────────
  const { data: programs, loading: programsLoading, refresh: refreshPrograms } = useApi(
    `/api/pm/programs?show_archived=${activeTab === "archived"}&status=${activeTab === "all" ? "all" : activeTab}`,
    { defaultValue: [], transform: pickPrograms },
  );
  const { data: teams, loading: teamsLoading, refresh: refreshTeams } = useApi(
    "/api/contacts/full-state",
    { defaultValue: [], transform: pickTeams },
  );
  const { data: notes, loading: notesLoading, setData: setNotes, refresh: refreshNotes } = useApi(
    "/api/families",
    { defaultValue: [], transform: pickFamilies },
  );
  const { data: knowledgeItems, loading: knowledgeLoading, refresh: refreshKnowledge } = useApi(
    "/api/knowledge",
    { defaultValue: [], transform: pickKnowledgeItems },
  );
  const { data: programRegLink } = useApi(
    editingProgram?.id ? `/api/platform/form-runs?program_id=${encodeURIComponent(editingProgram.id)}` : null,
    { defaultValue: null, transform: pickProgramRegLink },
  );
  const { data: editingKpis, refresh: refreshEditingKpis } = useApi(
    editingProgram?.id ? `/api/v2/kpis?program_id=${editingProgram.id}` : null,
    { defaultValue: [], transform: pickEditingKpis },
  );

  const loading = programsLoading || teamsLoading || notesLoading || knowledgeLoading;

  const reload = () => {
    refreshPrograms();
    refreshTeams();
    refreshNotes();
    refreshKnowledge();
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editingProgram?.id) return;
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((p) => setFacilitatorPool(p.success ? p.contacts || [] : []))
      .catch(() => setFacilitatorPool([]));
  }, [editingProgram?.id]);

  const assignedSegmentKey = (editingProgram?.assigned_segments || []).filter(Boolean).join("|");
  const groupRegLinks = assignedSegmentKey ? groupRegLinksBySegment : EMPTY_GROUP_REG_LINKS;

  useEffect(() => {
    const groupIds = assignedSegmentKey ? assignedSegmentKey.split("|") : [];
    if (groupIds.length === 0) return;
    let cancelled = false;
    Promise.all(
      groupIds.map(async (gid) => {
        try {
          const r = await fetch(`/api/platform/form-runs?group_id=${encodeURIComponent(gid)}`);
          const p = await r.json();
          const run = p.success && p.runs ? p.runs.find((r) => r.status === "active" && r.public_slug) : null;
          return { gid, ok: true, url: run ? `${window.location.origin}/s/${run.public_slug}` : null };
        } catch (_) {
          return { gid, ok: false, url: null };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setGroupRegLinks((prev) => {
        const next = {};
        for (const { gid, ok, url } of results) {
          if (url) next[gid] = url;
          else if (!ok && prev[gid]) next[gid] = prev[gid];
        }
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [assignedSegmentKey]);

  // ── Date validation ────────────────────────────────────────────────────────
  const validateEditDates = (start, end, durationWeeks) => {
    if (!start || !end) return "";
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
    if (e.getTime() < s.getTime()) return t("adminMisc.programs.dateErrorOrder");
    if (e.getTime() === s.getTime()) return t("adminMisc.programs.dateErrorSameDay");
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24));
    const computedWeeks = Math.max(1, Math.ceil(diffDays / 7));
    const inputWeeks = parseInt(durationWeeks, 10);
    if (inputWeeks && inputWeeks !== computedWeeks) {
      return t("adminMisc.programs.dateErrorDurationMismatch", { actual: inputWeeks, expected: computedWeeks });
    }
    return "";
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const notify = (type, message) =>
    window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type, message } }));

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingProgram?.id) return;
    const err = validateEditDates(editingProgram?.start_date, editingProgram?.end_date, editingProgram?.duration_weeks);
    if (err) { setProgramDateError(err); notify("error", err); return; }
    setIsUpdating(true);
    try {
      const r = await fetch("/api/pm/programs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingProgram) });
      const p = await r.json();
      if (p.success) { setEditingProgram(null); setIsCreatingGroup(false); reload(); notify("success", t("adminMisc.programs.saved")); }
      else notify("error", p.error || t("adminMisc.programs.saveFailed"));
    } catch (err) { notify("error", err.message || t("adminMisc.programs.saveFailed")); }
    finally { setIsUpdating(false); }
  };

  const handleArchiveAction = async (id, isArchiving, event, name) => {
    if (!id) return;
    event.stopPropagation();
    const prog = name || "";
    if (isArchiving && !(await confirm({ message: t("adminMisc.programs.confirmArchive", { name: prog }), tone: "danger" }))) return;
    if (!isArchiving && !(await confirm({ message: t("adminMisc.programs.confirmRestore", { name: prog }) }))) return;
    try {
      const r = await fetch("/api/pm/programs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_archived: isArchiving ? 1 : 0 }) });
      const p = await r.json();
      if (p.success) reload(); else notify("error", t("adminMisc.programs.archiveActionFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.archiveActionFailed")); }
  };

  const handlePermanentDelete = async (id, event, name) => {
    if (!id) return;
    event.stopPropagation();
    if (!(await confirm({ message: t("adminMisc.programs.confirmDelete", { name: name || "" }), tone: "danger" }))) return;
    try {
      const r = await fetch("/api/pm/programs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const p = await r.json();
      if (p.success) reload(); else notify("error", t("adminMisc.programs.archiveActionFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.archiveActionFailed")); }
  };

  const handleEditFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editingProgram) return;
    setIsUploading(true);
    try {
      const path = `curriculum/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const result = await uploadFile("knowledge", path, file);
      if (result?.success) {
        const materials = Array.isArray(editingProgram.materials) ? editingProgram.materials : [];
        setEditingProgram({ ...editingProgram, materials: [...materials, { name: file.name, url: result.url, size: file.size, type: file.type, uploadedAt: new Date().toISOString() }] });
      }
    } catch (err) { console.error("Upload failed:", err); }
    finally { setIsUploading(false); }
  };

  const handleCreateConceptNote = async () => {
    if (!newNoteTitle.trim() || !editingProgram?.id) return;
    setCreatingNote(true);
    try {
      const r = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newNoteTitle.trim(), description: "" }) });
      const p = await r.json();
      if (p.success) {
        const id = p.id || p.note?.id;
        if (id) { setEditingProgram({ ...editingProgram, note_id: id }); refreshKnowledge(); notify("success", t("adminMisc.programs.conceptNoteCreatedAndLinked")); }
        setNewNoteTitle(""); setShowCreateNote(false);
      } else notify("error", p.error || t("adminMisc.programs.conceptNoteCreateFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.conceptNoteCreateFailed")); }
    finally { setCreatingNote(false); }
  };

  const handleCreateGroupInline = async () => {
    const groupName = newGroup.name.trim() || (editingProgram?.name || "New Group").trim();
    if (!groupName) return;
    try {
      const r = await fetch("/api/families", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupName, description: newGroup.description, type: "cohort", program_id: editingProgram?.id || null, default_role: newGroup.default_role || null }) });
      const p = await r.json();
      if (p.success) {
        const seg = p.group || p.family || { id: p.id, name: groupName };
        const current = Array.isArray(editingProgram?.assigned_segments) ? editingProgram.assigned_segments : [];
        setEditingProgram({ ...editingProgram, assigned_segments: [...current, String(seg.id)] });
        setNotes((prev) => [...prev, seg]);
        setIsCreatingGroup(false);
        setNewGroup({ name: "", description: "", type: "cohort", default_role: "" });
        notify("success", t("adminMisc.programs.groupCreatedAndAssigned", { name: groupName }));
      } else notify("error", p.error || t("adminMisc.programs.groupCreationFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.groupCreationFailed")); }
  };

  const addFacilitator = async (contact) => {
    if (!editingProgram?.id || !contact?.cid) return;
    setFacBusy(true);
    try {
      const r = await fetch("/api/program-staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ program_id: editingProgram.id, staff_id: contact.cid, role: "facilitator" }) });
      const p = await r.json();
      if (p.success) {
        setEditingProgram({ ...editingProgram, facilitators: [...(editingProgram.facilitators || []), { id: p.id, cid: contact.cid, role: "facilitator", permissions: {}, name: contact.name, email: contact.email }] });
        notify("success", t("adminMisc.programs.facilitatorAdded"));
      } else notify("error", t("adminMisc.programs.addFacilitatorFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.addFacilitatorFailed")); }
    finally { setFacBusy(false); }
  };

  const removeFacilitator = async (facilitator) => {
    if (!facilitator?.id) return;
    try {
      const r = await fetch("/api/program-staff", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: facilitator.id }) });
      const p = await r.json();
      if (p.success) setEditingProgram({ ...editingProgram, facilitators: (editingProgram.facilitators || []).filter((f) => f.id !== facilitator.id) });
      else notify("error", t("adminMisc.programs.facilitatorRemoveFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.facilitatorRemoveFailed")); }
  };

  const toggleFacOverride = async (facilitator, capKey) => {
    const current = facilitator.permissions || {};
    const next = { ...current };
    if (next[capKey]) delete next[capKey]; else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    try {
      const r = await fetch("/api/program-staff", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: facilitator.id, permissions: next }) });
      const p = await r.json();
      if (p.success) setEditingProgram({ ...editingProgram, facilitators: (editingProgram.facilitators || []).map((f) => f.id === facilitator.id ? { ...f, permissions: next } : f) });
      else notify("error", t("adminMisc.programs.facilitatorOverrideFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.facilitatorOverrideFailed")); }
  };

  const toggleFacDefault = (capKey) => {
    const current = editingProgram.facilitator_default_permissions || {};
    const next = { ...current };
    if (next[capKey]) delete next[capKey]; else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    setEditingProgram({ ...editingProgram, facilitator_default_permissions: next });
  };

  const createAndInviteFacilitator = async () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) { notify("error", t("adminMisc.programs.nameAndEmailRequired")); return; }
    setFacBusy(true);
    try {
      const r = await fetch("/api/auth/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteForm.email.trim(), name: inviteForm.name.trim(), role: "facilitator" }) });
      const p = await r.json();
      if (p.success) {
        if (p.cid) await addFacilitator({ cid: p.cid, name: inviteForm.name.trim(), email: inviteForm.email.trim() });
        setInviteForm({ name: "", email: "" });
        notify("success", t("adminMisc.programs.inviteSent"));
      } else notify("error", p.error || t("adminMisc.programs.inviteFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.inviteFailed")); }
    finally { setFacBusy(false); }
  };

  const setLeadFacilitator = async (familyId, cid) => {
    try {
      const r = await fetch("/api/families", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: familyId, lead_facilitator_id: cid || null }) });
      const p = await r.json();
      if (p.success) {
        setNotes((prev) => (prev || []).map((n) => n.id === familyId ? { ...n, lead_facilitator_id: cid || null } : n));
        notify("success", t("adminMisc.programs.leadFacilitatorUpdated"));
      } else notify("error", t("adminMisc.programs.leadFacilitatorUpdateFailed"));
    } catch (_) { notify("error", t("adminMisc.programs.leadFacilitatorUpdateFailed")); }
  };

  const handleAddEditKpi = async () => {
    if (!editKpiInput.title.trim() || !editingProgram?.id) return;
    setIsKpiSubmitting(true);
    try {
      const r = await fetch("/api/v2/kpis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ program_id: editingProgram.id, title: editKpiInput.title, target_value: editKpiInput.target_value }) });
      const p = await r.json();
      if (p.success) { setEditKpiInput({ title: "", target_value: 80 }); refreshEditingKpis(); }
    } catch (err) { console.error(err); }
    finally { setIsKpiSubmitting(false); }
  };

  const handleDeleteEditKpi = async (kpiId) => {
    try {
      const r = await fetch("/api/v2/kpis", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: kpiId }) });
      const p = await r.json();
      if (p.success) refreshEditingKpis();
    } catch (err) { console.error(err); }
  };

  const handleSaveAsTemplate = async () => {
    const name = await prompt({ message: t("adminMisc.programs.templateNamePrompt") });
    if (!name || !editingProgram?.id) return;
    const r = await fetch("/api/pm/programs/templates?action=save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ program_id: editingProgram.id, template_name: name }) });
    const p = await r.json();
    if (p.success) notify("success", t("admin.templateSaved"));
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const safePrograms = Array.isArray(programs) ? programs : [];
  const filtered = safePrograms.filter(
    (p) => p?.name && p.name.toLowerCase().includes((search || "").toLowerCase()),
  );

  return (
    <>
      <ProgramsTable
        programs={filtered}
        loading={loading}
        activeTab={activeTab}
        onTabChange={setTab}
        search={search}
        onSearchChange={setSearch}
        onEditProgram={(formatted) => { setEditingProgram(formatted); setProgramDateError(""); }}
        onArchive={handleArchiveAction}
        onDelete={handlePermanentDelete}
        toDateInputValue={toDateInputValue}
      />

      <EditProgramModal
        editingProgram={editingProgram}
        setEditingProgram={setEditingProgram}
        programDateError={programDateError}
        setProgramDateError={setProgramDateError}
        validateEditDates={validateEditDates}
        isUpdating={isUpdating}
        isUploading={isUploading}
        isCreatingGroup={isCreatingGroup}
        setIsCreatingGroup={setIsCreatingGroup}
        newGroup={newGroup}
        setNewGroup={setNewGroup}
        showCreateNote={showCreateNote}
        setShowCreateNote={setShowCreateNote}
        newNoteTitle={newNoteTitle}
        setNewNoteTitle={setNewNoteTitle}
        creatingNote={creatingNote}
        editKpiInput={editKpiInput}
        setEditKpiInput={setEditKpiInput}
        isKpiSubmitting={isKpiSubmitting}
        facilitatorPool={facilitatorPool}
        facilitatorSearch={facilitatorSearch}
        setFacilitatorSearch={setFacilitatorSearch}
        facBusy={facBusy}
        inviteForm={inviteForm}
        setInviteForm={setInviteForm}
        teams={teams}
        notes={notes}
        setNotes={setNotes}
        knowledgeItems={knowledgeItems}
        editingKpis={editingKpis}
        programRegLink={programRegLink}
        groupRegLinks={groupRegLinks}
        userRole={userRole}
        onSubmit={handleUpdate}
        onAddKpi={handleAddEditKpi}
        onDeleteKpi={handleDeleteEditKpi}
        onAddFacilitator={addFacilitator}
        onRemoveFacilitator={removeFacilitator}
        onToggleFacOverride={toggleFacOverride}
        onToggleFacDefault={toggleFacDefault}
        onCreateFacilitator={createAndInviteFacilitator}
        onSetLeadFacilitator={setLeadFacilitator}
        onFileUpload={handleEditFileUpload}
        onCreateConceptNote={handleCreateConceptNote}
        onCreateGroupInline={handleCreateGroupInline}
        onSaveAsTemplate={handleSaveAsTemplate}
      />
    </>
  );
}
