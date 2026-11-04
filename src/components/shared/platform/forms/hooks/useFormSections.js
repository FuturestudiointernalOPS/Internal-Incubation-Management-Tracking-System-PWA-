"use client";

import { useState, useCallback } from "react";

export function useFormSections() {
  const [sections, setSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);

  const addSection = useCallback((genTempId) => {
    const tempId = genTempId();
    setSections((previousSections) => {
      const nextSections = [
        ...previousSections,
        { id: tempId, title: "New Section", description: "", sort_order: previousSections.length },
      ];
      setActiveSectionId(tempId);
      return nextSections;
    });
    return tempId;
  }, []);

  const updateSection = useCallback((sectionIndex, updates) => {
    setSections((previousSections) => previousSections.map((section, index) => (index === sectionIndex ? { ...section, ...updates } : section)));
  }, []);

  const removeSection = useCallback((sectionIndex, sections) => {
    const removedSection = sections[sectionIndex];
    setSections((previousSections) => previousSections.filter((_, index) => index !== sectionIndex));
    if (removedSection?.id) {
      return removedSection.id;
    }
    return null;
  }, []);

  const moveSection = useCallback((sectionIndex, direction, sections) => {
    const target = sectionIndex + direction;
    if (target < 0 || target >= sections.length) return;
    const nextSections = [...sections];
    [nextSections[sectionIndex], nextSections[target]] = [nextSections[target], nextSections[sectionIndex]];
    setSections(nextSections.map((item, index) => ({ ...item, sort_order: index })));
  }, []);

  const loadSections = useCallback((loadedSections, genTempId) => {
    const sectionsWithStringIds = (loadedSections || []).map(section => ({ ...section, id: String(section.id) }));
    if (sectionsWithStringIds.length === 0) {
      const defaultSection = { id: genTempId(), title: "Section 1", description: "", sort_order: 0 };
      sectionsWithStringIds.push(defaultSection);
      setActiveSectionId(defaultSection.id);
    } else {
      setActiveSectionId(sectionsWithStringIds[sectionsWithStringIds.length - 1].id);
    }
    setSections(sectionsWithStringIds);
  }, []);

  const createDefaultSection = useCallback((genTempId) => {
    const defaultSecId = genTempId();
    setSections([{ id: defaultSecId, title: "Section 1", description: "", sort_order: 0 }]);
    setActiveSectionId(defaultSecId);
    return defaultSecId;
  }, []);

  const refreshSections = useCallback((freshData, genTempId) => {
    setSections((freshData.sections || []).map(section => ({ ...section, id: String(section.id) })));
  }, []);

  return {
    sections,
    setSections,
    activeSectionId,
    setActiveSectionId,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    loadSections,
    createDefaultSection,
    refreshSections,
  };
}