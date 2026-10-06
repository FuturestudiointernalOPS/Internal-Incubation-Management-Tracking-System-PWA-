"use client";

import { useState, useCallback } from "react";
import { FIELD_TYPES, FIELD_TYPE_KEYS } from "@/components/platform/forms/constants";

export function useFormFields({ t }) {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  const addField = useCallback((fieldType, sectionId, activeSectionId, sections, genTempId) => {
    const typeInfo = FIELD_TYPES.find((fieldTypeOption) => fieldTypeOption.value === fieldType) || FIELD_TYPES[0];
    const tempId = genTempId();
    const targetSectionId = sectionId || activeSectionId || (sections.length > 0 ? sections[sections.length - 1].id : null);
    setFields((previousFields) => {
      const newField = {
        id: null,
        _tmpId: tempId,
        section_id: targetSectionId,
        field_type: fieldType,
        label: t("platformMisc.forms." + (FIELD_TYPE_KEYS[fieldType] || "")) || typeInfo.label,
        placeholder: "",
        help_text: "",
        required: false,
        options: fieldType === "rating"
          ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }]
          : ["select", "radio", "checkbox", "multiselect"].includes(fieldType)
            ? [{ label: t("platformMisc.forms.optionDefault", { n: 1 }), value: "option-1" }]
            : fieldType === "rating"
            ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }]
            : null,
        sort_order: previousFields.length,
      };
      setSelectedFieldId(tempId);
      return [...previousFields, newField];
    });
  }, [t]);

  const updateField = useCallback((tempId, updates) => {
    setFields((previousFields) => previousFields.map((field) => (field._tmpId === tempId ? { ...field, ...updates } : field)));
  }, []);

  const removeField = useCallback((tempId) => {
    setFields((previousFields) => previousFields.filter((field) => field._tmpId !== tempId));
    if (selectedFieldId === tempId) setSelectedFieldId(null);
  }, [selectedFieldId]);

  const moveField = useCallback((tempId, direction) => {
    setFields((previousFields) => {
      const currentIndex = previousFields.findIndex((field) => field._tmpId === tempId);
      if (currentIndex === -1) return previousFields;
      const nextFields = [...previousFields];
      const target = currentIndex + direction;
      if (target < 0 || target >= nextFields.length) return previousFields;
      [nextFields[currentIndex], nextFields[target]] = [nextFields[target], nextFields[currentIndex]];
      return nextFields.map((field, index) => ({ ...field, sort_order: index }));
    });
  }, []);

  const addOption = useCallback((tempId) => {
    setFields((previousFields) => previousFields.map((field) => {
      if (field._tmpId !== tempId || !field.options) return field;
      return { ...field, options: [...field.options, { label: t("platformMisc.forms.optionDefault", { n: field.options.length + 1 }), value: `option-${field.options.length + 1}` }] };
    }));
  }, [t]);

  const updateOption = useCallback((tempId, optionIndex, key, value) => {
    setFields((previousFields) => previousFields.map((field) => {
      if (field._tmpId !== tempId || !field.options) return field;
      const nextOptions = [...field.options];
      nextOptions[optionIndex] = { ...nextOptions[optionIndex], [key]: value };
      return { ...field, options: nextOptions };
    }));
  }, []);

  const removeOption = useCallback((tempId, optionIndex) => {
    setFields((previousFields) => previousFields.map((field) => {
      if (field._tmpId !== tempId || !field.options) return field;
      return { ...field, options: field.options.filter((_, index) => index !== optionIndex) };
    }));
  }, []);

  const loadFields = useCallback((loadedFields, genTempId, removedSectionId) => {
    let fieldsWithTempIds = (loadedFields || []).map(field => ({ ...field, _tmpId: genTempId(), section_id: field.section_id ? String(field.section_id) : null }));
    if (removedSectionId) {
      fieldsWithTempIds = fieldsWithTempIds.map(field => field.section_id === removedSectionId ? { ...field, section_id: null } : field);
    }
    setFields(fieldsWithTempIds);
  }, []);

  const refreshFields = useCallback((freshData, genTempId) => {
    setFields((freshData.fields || []).map(field => ({ ...field, _tmpId: genTempId(), section_id: field.section_id ? String(field.section_id) : null })));
  }, []);

  const clearFields = useCallback(() => {
    setFields([]);
    setSelectedFieldId(null);
  }, []);

  return {
    fields,
    setFields,
    selectedFieldId,
    setSelectedFieldId,
    addField,
    updateField,
    removeField,
    moveField,
    addOption,
    updateOption,
    removeOption,
    loadFields,
    refreshFields,
    clearFields,
  };
}