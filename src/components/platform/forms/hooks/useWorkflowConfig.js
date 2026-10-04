"use client";

import { useState, useCallback } from "react";
import { DEFAULT_AUTOMATION } from "@/components/platform/forms/constants";

export function useWorkflowConfig({ editingForm }) {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [automationConfig, setAutomationConfig] = useState(null);

  const loadWorkflowConfig = useCallback(() => {
    if (!editingForm) return;
    const formSettings = editingForm.settings || {};
    setWorkflowConfig(formSettings.workflow || null);
    setAutomationConfig(formSettings.automation || { ...DEFAULT_AUTOMATION });
  }, [editingForm]);

  const updateWorkflowConfig = useCallback((updates) => {
    setWorkflowConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateAutomationConfig = useCallback((updates) => {
    setAutomationConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  return {
    showWorkflow,
    setShowWorkflow,
    workflowConfig,
    setWorkflowConfig,
    automationConfig,
    setAutomationConfig,
    loadWorkflowConfig,
    updateWorkflowConfig,
    updateAutomationConfig,
  };
}