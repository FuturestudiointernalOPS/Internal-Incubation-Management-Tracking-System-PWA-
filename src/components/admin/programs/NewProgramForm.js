"use client";

import React, { useState } from "react";
import { ArrowLeft, Zap, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import NotificationToast from "./new-form/NotificationToast";
import TemplateSelector from "./new-form/TemplateSelector";
import ProgramFieldsSection from "./new-form/ProgramFieldsSection";
import ConceptNoteSection from "./new-form/ConceptNoteSection";
import KnowledgeBankSection from "./new-form/KnowledgeBankSection";
import ContactGroupSection from "./new-form/ContactGroupSection";
import PersonnelSection from "./new-form/PersonnelSection";
import KpiSection from "./new-form/KpiSection";
import { useProgramAssets } from "./new-form/useProgramAssets";
import { NOTIFICATION_TIMEOUT_MS } from "./new-form/constants";
import {
  uploadProgramFiles,
  ProgramFileUploadError,
  createFamily,
  createKnowledgeBase,
  registerProgramType,
  applyProgramTemplate,
  saveProgram,
} from "./new-form/programFormApi";

/**
 * IMPACTOS MISSION DEPLOYMENT — STRATEGIC CONFIGURATION
 * Handles program initialization, personnel assignment, and resource linking.
 * Integrated with v2_knowledge_bank and Personnel Registry.
 */

export default function NewProgramForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);

  // DATA REPOSITORY
  const [knowledgeNodes, setKnowledgeNodes] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // FORM STATE
  const [program, setProgram] = useState({
    start_date: "",
    end_date: "",
    duration_weeks: 4,
    materials: [],
    assigned_segments: [],
    name: "",
    description: "",
    concept_note: "",
    vision: "",
    objectives: "",
    program_type: "incubation",
    visibility: "private",
    language: "en",
    assigned_pm_id: "",
    expected_outcomes: "",
    success_metrics: "",
  });

  // Date validation
  const [dateError, setDateError] = useState("");

  // Today's date (YYYY-MM-DD) to prevent picking a past start date
  const todayStr = (() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
  })();

  const validateDates = (start, end) => {
    if (!start || !end) {
      setDateError(t("adminMisc.newProgram.dateErrorRequired"));
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(start) < today) {
      setDateError(t("adminMisc.newProgram.dateErrorPast"));
      return false;
    }
    if (new Date(end) < new Date(start)) {
      setDateError(t("adminMisc.newProgram.dateErrorOrder"));
      return false;
    }
    if (new Date(end).getTime() === new Date(start).getTime()) {
      setDateError(t("adminMisc.newProgram.dateErrorSameDay"));
      return false;
    }
    setDateError("");
    return true;
  };

  // INLINE CREATION STATES
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    type: "individual",
  });
  const [createdGroup, setCreatedGroup] = useState(null);

  const [isCreatingKB, setIsCreatingKB] = useState(false);
  const [newKB, setNewKB] = useState({ title: "", description: "", files: [] });
  const [, setCreatedKB] = useState(null);
  const [kpisList, setKpisList] = useState([]);
  const [kpiInput, setKpiInput] = useState({ title: "", target_value: 100 });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const [segments, setSegments] = useState([]);
  const [customProgramTypes, setCustomProgramTypes] = useState([]);
  const [newTypeInput, setNewTypeInput] = useState("");
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);

  const [selectedAssistants, setSelectedAssistants] = useState([]);

  const toggleAssistant = (cid) => {
    setSelectedAssistants((prev) => {
      const next = prev.includes(cid)
        ? prev.filter((id) => id !== cid)
        : [...prev, cid];
      setProgram((previous) => ({
        ...previous,
        assigned_assistant_id: JSON.stringify(next),
      }));
      return next;
    });
  };

  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), NOTIFICATION_TIMEOUT_MS);
  };

  const { loadingAssets } = useProgramAssets({
    t,
    notify,
    setKnowledgeNodes,
    setStaffList,
    setSegments,
    setTemplates,
    setCustomProgramTypes,
  });

  const handleFileUpload = async (event, type = "program") => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls = await uploadProgramFiles(files);

      if (type === "kb") {
        setNewKB((prev) => ({
          ...prev,
          files: [...prev.files, ...uploadedUrls],
        }));
      } else {
        setProgram((prev) => ({
          ...prev,
          materials: [...prev.materials, ...uploadedUrls],
        }));
      }
      notify("success", t("adminMisc.newProgram.attached"));
    } catch (error) {
      if (error instanceof ProgramFileUploadError) {
        notify(
          "error",
          t("adminMisc.newProgram.uploadFailedFor", {
            name: error.fileName,
            error: t(error.rawError || "") || error.rawError,
          }),
        );
      } else {
        notify("error", t(error.message || "") || error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateGroupInline = async () => {
    if (!newGroup.name) return notify("error", t("adminMisc.newProgram.groupNameRequired"));
    setIsDeploying(true);
    try {
      const payload = await createFamily(newGroup);
      if (payload.success) {
        setCreatedGroup(payload.group);
        setProgram((previous) => ({ ...previous, assigned_segments: [payload.group.id] }));
        setSegments((prev) => [...prev, payload.group]);
        setIsCreatingGroup(false);
        // Only auto-save program if PM is already selected
        if (program.assigned_pm_id) {
          notify("success", t("adminMisc.newProgram.groupCreatedAutoSaving"));
          setTimeout(() => handleDeploy({ preventDefault: () => {} }, payload.group.id), 300);
        } else {
          notify("success", t("adminMisc.newProgram.groupCreatedFillIn"));
        }
      } else {
        notify("error", t("adminMisc.newProgram.groupCreateFailed"));
      }
    } catch (error) {
      notify("error", t(error.message || "") || error.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCreateKBInline = async () => {
    if (!newKB.title)
      return notify("error", t("adminMisc.newProgram.kbTitleRequired"));
    setIsDeploying(true);
    try {
      const payload = await createKnowledgeBase(newKB);
      if (payload.success) {
        setCreatedKB({ id: payload.id, ...newKB });
        setProgram((previous) => ({ ...previous, note_id: payload.id }));
        setKnowledgeNodes((prev) => [
          ...prev,
          { id: payload.id, title: newKB.title },
        ]);
        setIsCreatingKB(false);
        notify("success", t("adminMisc.newProgram.created"));
      } else {
        notify("error", t("adminMisc.newProgram.kbCreateFailed"));
      }
    } catch (error) {
      notify("error", t(error.message || "") || error.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const removeMaterial = (index) => {
    setProgram((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, materialIndex) => materialIndex !== index),
    }));
  };

  const handleAddProgramType = async () => {
    if (!newTypeInput.trim()) return;
    const typeKey = newTypeInput.trim().toLowerCase().replace(/\s+/g, '_');
    await registerProgramType(typeKey);
    setCustomProgramTypes([...customProgramTypes, typeKey]);
    setProgram({ ...program, program_type: typeKey });
    setNewTypeInput("");
    setShowNewTypeInput(false);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    setApplyingTemplate(true);
    try {
      const template = templates.find(
        (templateOption) => templateOption.id === selectedTemplate,
      );
      const payload = await applyProgramTemplate({
        templateId: selectedTemplate,
        name: program.name || template?.name || "New Program",
      });
      if (payload.success) {
        notify("success", t("adminMisc.newProgram.programCreatedFromTemplate"));
        setTimeout(() => router.push("/admin/programs"), 1500);
      } else {
        notify("error", t((payload.error || t("adminMisc.newProgram.failed")) || "") || (payload.error || t("adminMisc.newProgram.failed")));
      }
    } catch (error) {
      notify("error", t(error.message || "") || error.message);
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleDeploy = async (event, existingGroupId) => {
    event.preventDefault();
    if (!program.name || !program.assigned_pm_id) {
      notify(
        "error",
        t("adminMisc.newProgram.criticalParametersMissing"),
      );
      return;
    }

    // Calculate duration_weeks from dates for backward compatibility. Kept in a
    // local because the POST body below reads it, and writing it back into
    // `program` would mutate state React owns.
    let durationWeeks = program.duration_weeks;
    if (program.start_date && program.end_date) {
      if (!validateDates(program.start_date, program.end_date)) {
        return;
      }
      const start = new Date(program.start_date);
      const end = new Date(program.end_date);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      durationWeeks = Math.max(1, Math.ceil(diffDays / 7));
    }

    setIsDeploying(true);
    try {
      // Create contact group first if a group name was provided
      let groupId = existingGroupId || program.assigned_segments?.[0];
      let assignedSegments = program.assigned_segments;
      if (!groupId && newGroup.name?.trim()) {
        const groupPayload = await createFamily({
          name: newGroup.name.trim(),
          type: newGroup.type || "individual",
          description: newGroup.description || null,
          program_id: null,
        });
        if (groupPayload.success) {
          groupId = groupPayload.group?.id || groupPayload.id;
          assignedSegments = [groupId];
        }
      }

      const payload = await saveProgram({
        name: program.name,
        description: program.description || null,
        concept_note:
          program.conceptNoteType === "link"
            ? program.conceptNoteLink
            : program.description || null,
        vision: program.vision || null,
        objectives: program.objectives || null,
        expected_outcomes: program.expected_outcomes || null,
        success_metrics: program.success_metrics || null,
        program_type: program.program_type || "incubation",
        visibility: program.visibility || "private",
        language: program.language || "en",
        start_date: program.start_date,
        end_date: program.end_date,
        duration_weeks: durationWeeks,
        assigned_pm_id: program.assigned_pm_id,
        assigned_assistant_id: program.assigned_assistant_id || null,
        note_id: program.note_id || null,
        materials: program.materials,
        assigned_segments: existingGroupId ? [existingGroupId] : assignedSegments,
        kpis: kpisList,
      });

      if (payload.success) {
        notify("success", t("adminMisc.newProgram.created"));
        setTimeout(() => router.push("/admin/programs"), 1500);
      } else {
        throw new Error(t((payload.error || t("adminMisc.newProgram.failedToSaveProgram")) || "") || (payload.error || t("adminMisc.newProgram.failedToSaveProgram")));
      }
    } catch (error) {
      notify("error", t(error.message || "") || error.message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <>
      {/* NOTIFICATION TOAST */}
      <NotificationToast
        notification={notification}
        onClose={() => setNotification(null)}
      />

      <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in text-left">
        {/* HEADER */}
        <header className="space-y-4 border-b border-[var(--border-primary)] pb-10">
          <button
            onClick={() => router.push("/admin/programs")}
            className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
            {t("adminMisc.newProgram.programList")}
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("adminMisc.newProgram.administration")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("adminMisc.newProgram.title")}
            </h1>
          </div>
        </header>

        <form onSubmit={handleDeploy} className="space-y-10">
          {/* Template Selector */}
          {templates.length > 0 && (
            <TemplateSelector
              t={t}
              templates={templates}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              applyingTemplate={applyingTemplate}
              onApply={handleApplyTemplate}
            />
          )}

          <ProgramFieldsSection
            t={t}
            program={program}
            setProgram={setProgram}
            todayStr={todayStr}
            dateError={dateError}
            validateDates={validateDates}
            customProgramTypes={customProgramTypes}
            showNewTypeInput={showNewTypeInput}
            setShowNewTypeInput={setShowNewTypeInput}
            newTypeInput={newTypeInput}
            setNewTypeInput={setNewTypeInput}
            onAddProgramType={handleAddProgramType}
          />

          <ConceptNoteSection t={t} program={program} setProgram={setProgram} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <KnowledgeBankSection
              t={t}
              program={program}
              setProgram={setProgram}
              knowledgeNodes={knowledgeNodes}
              isCreatingKB={isCreatingKB}
              setIsCreatingKB={setIsCreatingKB}
              newKB={newKB}
              setNewKB={setNewKB}
              handleFileUpload={handleFileUpload}
              handleCreateKBInline={handleCreateKBInline}
              isUploading={isUploading}
              removeMaterial={removeMaterial}
            />

            <ContactGroupSection
              t={t}
              program={program}
              setProgram={setProgram}
              isCreatingGroup={isCreatingGroup}
              setIsCreatingGroup={setIsCreatingGroup}
              newGroup={newGroup}
              setNewGroup={setNewGroup}
              handleCreateGroupInline={handleCreateGroupInline}
              segments={segments}
              createdGroup={createdGroup}
              notify={notify}
            />

            <PersonnelSection
              t={t}
              program={program}
              setProgram={setProgram}
              staffList={staffList}
              selectedAssistants={selectedAssistants}
              toggleAssistant={toggleAssistant}
            />
          </div>

          <KpiSection
            t={t}
            kpisList={kpisList}
            setKpisList={setKpisList}
            kpiInput={kpiInput}
            setKpiInput={setKpiInput}
          />

          <button
            type="submit"
            disabled={isDeploying || loadingAssets}
            className="btn btn-primary w-full py-6 text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-orange-500/20"
          >
            {isDeploying ? (
              <div className="flex items-center justify-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>{t("adminMisc.newProgram.savingProgram")}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Zap className="w-5 h-5" />
                <span>{t("adminMisc.newProgram.saveProgram")}</span>
              </div>
            )}
          </button>
        </form>
      </div>
    </>
  );
}
