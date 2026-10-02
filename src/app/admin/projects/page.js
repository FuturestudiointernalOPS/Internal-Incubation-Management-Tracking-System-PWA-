"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import {
  EMPTY_LIST,
  pickActiveStaff,
  pickAnalytics,
  pickProjects,
} from "@/components/admin/projects/list/constants";
import ProjectsHeader from "@/components/admin/projects/list/ProjectsHeader";
import AnalyticsRow from "@/components/admin/projects/list/AnalyticsRow";
import ProjectsFilters from "@/components/admin/projects/list/ProjectsFilters";
import ProjectsTable from "@/components/admin/projects/list/ProjectsTable";
import ProjectEditorModal from "@/components/admin/projects/list/ProjectEditorModal";
import CreateProjectModal from "@/components/admin/projects/list/CreateProjectModal";

/**
 * SUPER ADMIN PROJECTS DASHBOARD
 *
 * Full visibility into all projects with task/blocker aggregation.
 * Shows: project progress, task completion rate, blocker count, timeline health.
 */

export default function AdminProjects() {
  const router = useRouter();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showMemberModal, setShowMemberModal] = useState(null);
  const [projectMembers, setProjectMembers] = useState({});
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    leads: [],
    conceptNoteUrl: "",
    conceptNoteUrlInput: "",
    start_date: "",
    end_date: "",
  });
  const [conceptNoteFile, setConceptNoteFile] = useState(null);
  const [uploadingConcept, setUploadingConcept] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);

  // Who is signed in, from the shell's session cache: no request of its own, and
  // no dependence on the browser's stored copy.
  const { role: userRole } = useSessionUser();
  const canCreate = userRole === "super_admin";

  // The sidebar's "Create Project" link arrives as a query parameter, so the
  // dialog is open because the ADDRESS says so rather than because an effect
  // copied the address into state. Closing it tidies the address, which is a
  // navigation and not a state write.
  //
  // One accepted difference: arriving from the link and then refreshing keeps the
  // dialog open, where the old code stripped the parameter on arrival so a refresh
  // did not reopen it. The address now describes what is on screen.
  const searchParams = useSearchParams();
  const wantsCreate = searchParams.get("action") === "create";
  const [manualCreate, setManualCreate] = useState(false);
  const showCreateModal = manualCreate || wantsCreate;
  const openCreate = () => setManualCreate(true);
  const closeCreate = () => {
    setManualCreate(false);
    if (wantsCreate) router.replace("/admin/projects");
  };

  // The projects and the optional analytics summary, through the shared hook: it
  // owns the cache, the cache-first paint and the discarding of a stale answer, so
  // the page keeps no copy of its own and reads its data during render.
  const {
    data: projects,
    loading,
    refresh: refreshProjects,
  } = useApi(
    `/api/admin/projects${filterStatus === "Archived" ? "?include_archived=true" : ""}`,
    { defaultValue: EMPTY_LIST, transform: pickProjects, deps: [filterStatus] },
  );
  const { data: analytics } = useApi("/api/admin/analytics", {
    defaultValue: null,
    transform: pickAnalytics,
  });

  // The staff list is read while the create dialog is open, which is what the old
  // code expressed by fetching it from the button that opens it.
  const { data: allStaff } = useApi(showCreateModal ? "/api/contacts" : null, {
    defaultValue: EMPTY_LIST,
    transform: pickActiveStaff,
    deps: [showCreateModal],
  });

  const [editProject, setEditProject] = useState({
    id: null,
    name: "",
    type: "",
    description: "",
    status: "Active",
    priority: "medium",
    leads: [],
    conceptNoteUrl: "",
    start_date: "",
    end_date: "",
  });
  const [editConceptFile, setEditConceptFile] = useState(null);
  const [uploadingEditConcept, setUploadingEditConcept] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (toast) setTimeout(() => setToast(null), 3000);
  }, [toast]);

  const fetchMembers = useCallback(async (projectId) => {
    try {
      const response = await fetch(`/api/projects/members?project_id=${projectId}`);
      const data = await response.json();
      if (data.success)
        setProjectMembers((prev) => ({
          ...prev,
          [projectId]: data.members || [],
        }));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleSaveProject = async () => {
    if (!editProject.name.trim() || !editProject.id) return;
    setSavingEdit(true);
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editProject.id,
          name: editProject.name.trim(),
          description: editProject.description || null,
          concept_note_url: editProject.conceptNoteUrl || null,
          status: editProject.status,
          start_date: editProject.start_date || null,
          end_date: editProject.end_date || null,
          priority: editProject.priority || "medium",
          assigned_pm_ids: editProject.leads,
        }),
      });
      refreshProjects();
    } catch (error) {
      console.error(error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleArchiveProject = async (project) => {
    setActionLoading(true);
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, status: "Archived" }),
      });
      refreshProjects();
    } catch (error) {
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnarchiveProject = async (project) => {
    setActionLoading(true);
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, status: "Active" }),
      });
      refreshProjects();
    } catch (error) {
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const quickStatus = async (project, newStatus, _confirmMsg) => {
    setActionLoading(true);
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, status: newStatus }),
      });
      refreshProjects();
    } catch (error) {
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProject.name.trim(),
          description: newProject.description || null,
          concept_note_url:
            newProject.conceptNoteUrl || newProject.conceptNoteUrlInput || null,
          assigned_pm_ids: newProject.leads,
          start_date: newProject.start_date || null,
          end_date: newProject.end_date || null,
          status: "Active",
        }),
      });
      const data = await response.json();
      if (data.success && data.project_id) {
        // Add selected members
        for (const memberId of selectedMembers) {
          try {
            await fetch("/api/projects/members", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_id: data.project_id,
                user_cid: memberId,
                role: "member",
              }),
            });
          } catch {}
        }
        closeCreate();
        setNewProject({
          name: "",
          description: "",
          leads: [],
          conceptNoteUrl: "",
          conceptNoteUrlInput: "",
        });
        setConceptNoteFile(null);
        setSelectedMembers([]);
        refreshProjects();
        setToast({
          type: "success",
          msg: t("adminMisc.projectsList.projectCreatedToast", {
            name: newProject.name.trim(),
          }),
        });
      } else {
        setToast({
          type: "error",
          msg: t((data.error || t("adminMisc.projectsList.createFailed")) || "") || (data.error || t("adminMisc.projectsList.createFailed")),
        });
      }
    } catch {
      setToast({
        type: "error",
        msg: t("adminMisc.projectsList.networkError"),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveMember = async (projectId, userCid) => {
    try {
      await fetch(
        `/api/projects/members?project_id=${projectId}&user_cid=${userCid}`,
        { method: "DELETE" },
      );
      fetchMembers(projectId);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddMember = async (projectId, userCid) => {
    try {
      await fetch("/api/projects/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          user_cid: userCid,
          role: "member",
        }),
      });
      fetchMembers(projectId);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = project.name
        ?.toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        filterStatus === "all" || project.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, filterStatus]);

  // The header's back button leaves for the dashboard of the role that is
  // stored on this device; the reading and the role map are the page's, not the
  // button's.
  const goToDashboard = () => {
    const saved = localStorage.getItem("user");
    let role = "super_admin";
    if (saved) {
      try {
        role = JSON.parse(saved).role || "super_admin";
      } catch {}
    }
    const destMap = {
      super_admin: "/admin",
      staff: "/staff",
      program_manager: "/pm",
      participant: "/participant",
    };
    router.push(destMap[role] || "/admin");
  };

  const openEditor = (project) => {
    setShowMemberModal(project.id);
    setEditProject({
      id: project.id,
      name: project.name || "",
      description: project.meta?.description || "",
      status: project.status || "Active",
      priority: project.priority || "medium",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      leads:
        project.meta?.assigned_pm_ids ||
        (project.assigned_pm_id ? [project.assigned_pm_id] : []),
      conceptNoteUrl: project.meta?.concept_note_url || "",
    });
    fetchMembers(project.id);
  };

  const handleArchiveToggle = (project) => {
    if (project.status === "Archived") {
      handleUnarchiveProject(project);
    } else {
      handleArchiveProject(project);
    }
  };

  const updateEditField = (patch) =>
    setEditProject((previous) => ({ ...previous, ...patch }));

  const toggleEditLead = (staffId, checked) =>
    setEditProject((previous) => ({
      ...previous,
      leads: checked
        ? [...previous.leads, staffId]
        : previous.leads.filter((id) => id !== staffId),
    }));

  const handleUploadEditConcept = async () => {
    setUploadingEditConcept(true);
    try {
      const { uploadFile } = await import("@/lib/storage");
      const uploadResult = await uploadFile(
        "project-files",
        `concepts/${Date.now()}-${editConceptFile.name}`,
        editConceptFile,
      );
      if (uploadResult.success)
        updateEditField({ conceptNoteUrl: uploadResult.url });
    } catch (error) {
      console.error(error);
    } finally {
      setUploadingEditConcept(false);
      setEditConceptFile(null);
    }
  };

  const handleAddCollaboratorFromSelect = () => {
    const selectElement = document.getElementById("add-collab-select");
    if (selectElement?.value) {
      handleAddMember(showMemberModal, selectElement.value);
      selectElement.value = "";
    }
  };

  const updateNewField = (patch) =>
    setNewProject((previous) => ({ ...previous, ...patch }));

  const toggleNewLead = (staffId, checked) =>
    setNewProject((previous) => ({
      ...previous,
      leads: checked
        ? [...previous.leads, staffId]
        : previous.leads.filter((id) => id !== staffId),
    }));

  const toggleSelectedMember = (staffId, isSelected) =>
    setSelectedMembers((prev) =>
      isSelected
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId],
    );

  const handleUploadConcept = async () => {
    if (!conceptNoteFile) return;
    setUploadingConcept(true);
    try {
      const { uploadFile } = await import("@/lib/storage");
      const uploadResult = await uploadFile(
        "project-files",
        `concepts/${Date.now()}-${conceptNoteFile.name}`,
        conceptNoteFile,
      );
      if (uploadResult.success) {
        updateNewField({ conceptNoteUrl: uploadResult.url });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploadingConcept(false);
      setConceptNoteFile(null);
    }
  };

  return (
    <>
      <div className="space-y-8 pb-20 text-left">
        {/* HEADER */}
        {/* Toast notification */}
        {toast && (
          <div
            className={`fixed top-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest animate-in ${toast.type === "success" ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"}`}
          >
            {toast.msg}
          </div>
        )}

        <ProjectsHeader
          projectCount={projects.length}
          canCreate={canCreate}
          onBack={goToDashboard}
          onCreate={openCreate}
          onRefresh={refreshProjects}
        />

        {/* ANALYTICS ROW */}
        {analytics && <AnalyticsRow analytics={analytics} />}

        {/* FILTERS */}
        <ProjectsFilters
          search={search}
          setSearch={setSearch}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
        />

        {/* PROJECTS TABLE */}
        <ProjectsTable
          loading={loading}
          filteredProjects={filteredProjects}
          onOpen={(project) => router.push(`/admin/projects/${project.id}`)}
          actionLoading={actionLoading}
          onQuickStatus={quickStatus}
          onEdit={openEditor}
          onArchiveToggle={handleArchiveToggle}
        />
      </div>

      {/* PROJECT EDITOR + COLLABORATORS MODAL */}
      {showMemberModal && (
        <ProjectEditorModal
          projectId={showMemberModal}
          editProject={editProject}
          onFieldChange={updateEditField}
          onToggleLead={toggleEditLead}
          allStaff={allStaff}
          editConceptFile={editConceptFile}
          onConceptFileChange={setEditConceptFile}
          uploadingEditConcept={uploadingEditConcept}
          onUploadConcept={handleUploadEditConcept}
          savingEdit={savingEdit}
          onSave={handleSaveProject}
          onClose={() => setShowMemberModal(null)}
          projectMembers={projectMembers}
          onRemoveMember={(userCid) =>
            handleRemoveMember(showMemberModal, userCid)
          }
          onAddCollaborator={handleAddCollaboratorFromSelect}
        />
      )}

      {/* CREATE PROJECT MODAL */}
      {showCreateModal && canCreate && (
        <CreateProjectModal
          newProject={newProject}
          onFieldChange={updateNewField}
          onToggleLead={toggleNewLead}
          conceptNoteFile={conceptNoteFile}
          onConceptFileChange={setConceptNoteFile}
          uploadingConcept={uploadingConcept}
          onUploadConcept={handleUploadConcept}
          allStaff={allStaff}
          selectedMembers={selectedMembers}
          onToggleMember={toggleSelectedMember}
          creating={creating}
          onClose={closeCreate}
          onCreate={handleCreateProject}
        />
      )}
    </>
  );
}
