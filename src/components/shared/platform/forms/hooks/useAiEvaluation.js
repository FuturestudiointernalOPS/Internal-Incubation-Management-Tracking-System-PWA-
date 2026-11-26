"use client";

import { useState, useCallback } from "react";

export function useAiEvaluation({ editingForm }) {
  const [showAiEval, setShowAiEval] = useState(false);
  const [aiEvalFramework, setAiEvalFramework] = useState(null);
  const [aiEvalText, setAiEvalText] = useState("");
  const [aiEvalLoading, setAiEvalLoading] = useState(false);

  const loadAiEvalFramework = useCallback(async () => {
    if (!editingForm) { setAiEvalFramework(null); return; }
    try {
      const frameworkResponse = await fetch(`/api/platform/ai/evaluation-config?form_id=${editingForm.id}`);
      const frameworkData = await frameworkResponse.json();
      if (frameworkData.success && frameworkData.framework) setAiEvalFramework(frameworkData.framework);
      else setAiEvalFramework(null);
    } catch (_) { setAiEvalFramework(null); }
  }, [editingForm]);

  return {
    showAiEval,
    setShowAiEval,
    aiEvalFramework,
    setAiEvalFramework,
    aiEvalText,
    setAiEvalText,
    aiEvalLoading,
    setAiEvalLoading,
    loadAiEvalFramework,
  };
}