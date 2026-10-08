"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { useFormBuilder } from "@/components/platform/forms/hooks/useFormBuilder";
import PlatformFormsView from "@/components/platform/forms/PlatformFormsView";

const FORMS_URL = "/api/platform/forms";
const COLLECTIONS_URL = "/api/platform/collections";

const pickForms = (response) => (response?.success ? response.forms || [] : []);
const pickCollections = (response) => (response?.success ? response.collections || [] : []);

export const dynamic = "force-dynamic";

/**
 * PLATFORM FORMS — Visual Form Builder
 */

export default function PlatformForms() {
  const { data: forms, loading, refresh: refreshForms } = useApi(
    FORMS_URL,
    { defaultValue: [], transform: pickForms },
  );
  const { data: collections } = useApi(COLLECTIONS_URL, {
    defaultValue: [],
    transform: pickCollections,
  });

  const ctx = useFormBuilder({ refreshForms, forms, collections, loading });

  return <PlatformFormsView ctx={ctx} />;
}