"use client";

import { useState, useCallback } from "react";

export function useAdminSections() {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = useCallback((id) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return {
    expandedSections,
    toggleSection,
  };
}