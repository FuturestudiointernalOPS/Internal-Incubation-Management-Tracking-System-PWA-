import ProjectEditorModal from "@/components/admin/projects/list/ProjectEditorModal";
import CreateProjectModal from "@/components/admin/projects/list/CreateProjectModal";

export default function ProjectsModals({
  showMemberModal,
  showCreateModal,
  canCreate,
  editProject,
  onEditFieldChange,
  onToggleEditLead,
  allStaff,
  editConceptFile,
  onEditConceptFileChange,
  uploadingEditConcept,
  onUploadEditConcept,
  savingEdit,
  onSaveProject,
  onCloseEditor,
  projectMembers,
  onRemoveMember,
  onAddCollaborator,
  newProject,
  onNewFieldChange,
  onToggleNewLead,
  conceptNoteFile,
  onNewConceptFileChange,
  uploadingConcept,
  onUploadConcept,
  selectedMembers,
  onToggleMember,
  creating,
  onCloseCreate,
  onCreateProject,
}) {
  return (
    <>
      {/* PROJECT EDITOR + COLLABORATORS MODAL */}
      {showMemberModal && (
        <ProjectEditorModal
          projectId={showMemberModal}
          editProject={editProject}
          onFieldChange={onEditFieldChange}
          onToggleLead={onToggleEditLead}
          allStaff={allStaff}
          editConceptFile={editConceptFile}
          onConceptFileChange={onEditConceptFileChange}
          uploadingEditConcept={uploadingEditConcept}
          onUploadConcept={onUploadEditConcept}
          savingEdit={savingEdit}
          onSave={onSaveProject}
          onClose={onCloseEditor}
          projectMembers={projectMembers}
          onRemoveMember={(userCid) => onRemoveMember(showMemberModal, userCid)}
          onAddCollaborator={onAddCollaborator}
        />
      )}

      {/* CREATE PROJECT MODAL */}
      {showCreateModal && canCreate && (
        <CreateProjectModal
          newProject={newProject}
          onFieldChange={onNewFieldChange}
          onToggleLead={onToggleNewLead}
          conceptNoteFile={conceptNoteFile}
          onConceptFileChange={onNewConceptFileChange}
          uploadingConcept={uploadingConcept}
          onUploadConcept={onUploadConcept}
          allStaff={allStaff}
          selectedMembers={selectedMembers}
          onToggleMember={onToggleMember}
          creating={creating}
          onClose={onCloseCreate}
          onCreate={onCreateProject}
        />
      )}
    </>
  );
}
