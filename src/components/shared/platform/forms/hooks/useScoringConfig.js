"use client";

import { useState, useCallback } from "react";

export function useScoringConfig({ editingForm }) {
  const [showScoring, setShowScoring] = useState(false);
  const [scoringConfig, setScoringConfig] = useState(null);

  const defaultScoringConfig = {
    enabled: false,
    max_per_question: 0,
    sections: {},
    rankings: [{ min: 0, max: 59, label: "Needs Work" }, { min: 60, max: 79, label: "Good" }, { min: 80, max: 100, label: "Excellent" }],
  };

  const loadScoringConfig = useCallback(() => {
    if (!editingForm) return;
    const formSettings = editingForm.settings || {};
    setScoringConfig(formSettings.scoring && formSettings.scoring.enabled
      ? { ...formSettings.scoring }
      : { ...defaultScoringConfig }
    );
  }, [editingForm]);

  const updateScoringConfig = useCallback((updates) => {
    setScoringConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetScoringConfig = useCallback(() => {
    setScoringConfig({ ...defaultScoringConfig });
  }, []);

  return {
    showScoring,
    setShowScoring,
    scoringConfig,
    setScoringConfig,
    loadScoringConfig,
    updateScoringConfig,
    resetScoringConfig,
  };
}