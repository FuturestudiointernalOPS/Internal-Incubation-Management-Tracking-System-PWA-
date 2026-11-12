"use client";

import { useState, useCallback } from "react";

export function useTemplateConfig({ editingForm }) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [personalizing, setPersonalizing] = useState(null);

  const loadTemplateConfig = useCallback(() => {
    if (!editingForm) return;
    const formSettings = editingForm.settings || {};
    setTemplateConfig(formSettings.automation?.templates || null);
  }, [editingForm]);

  const updateTemplate = useCallback((templateKey, fieldName, value) => {
    const templateData = templateConfig || {};
    const nextTemplates = JSON.parse(JSON.stringify(templateData));
    if (!nextTemplates[templateKey]) nextTemplates[templateKey] = {};
    nextTemplates[templateKey][fieldName] = value;
    setTemplateConfig(nextTemplates);
  }, [templateConfig]);

  const personalizeTemplate = useCallback(async (templateKey, label, { t, notify }) => {
    if (personalizing) return;
    setPersonalizing(templateKey);
    try {
      const templateData = templateConfig || {};
      const response = await fetch("/api/platform/ai/personalize-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: templateKey,
          form_name: editingForm?.name || "",
          organization: "Future Studio",
          existing_subject: templateData[templateKey]?.subject || "",
          existing_body: templateData[templateKey]?.body || "",
        }),
      });
      const data = await response.json();
      if (data.success) {
        updateTemplate(templateKey, "subject", data.subject);
        updateTemplate(templateKey, "body", data.body);
        notify(t("platformMisc.forms.templatePersonalized", { label }));
      } else {
        notify(data.error || t("platformMisc.forms.templatePersonalizeFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.forms.templatePersonalizeNetworkError"));
    }
    setPersonalizing(null);
  }, [personalizing, templateConfig, editingForm, updateTemplate]);

  return {
    showTemplates,
    setShowTemplates,
    templateConfig,
    setTemplateConfig,
    personalizing,
    loadTemplateConfig,
    updateTemplate,
    personalizeTemplate,
  };
}