"use client";

import { useEffect, useState } from "react";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import SectionResourcesEditor from "./SectionResourcesEditor";

// ─── Read shapers (module scope: built once, never per render) ───────────

// The hook keys its internal work on the address alone, so the default and the
// shaper are made once here rather than on every render.
const EMPTY_SECTION_RESOURCES = { resources: null, failure: null };

/**
 * The section's material, together with the reason it is missing. A refusal
 * carries the server's own i18n key, which is what the toast already showed.
 */
const pickSectionResources = (d) =>
  d?.success
    ? { resources: d.resources || [], failure: null }
    : { resources: [], failure: d?.error || "lms.errors.loadFailed" };

/**
 * SECTION RESOURCES — panel of the course editor.
 *
 * Material (documents + videos) attached to one COURSE SECTION. It loads the
 * section's resources and persists every change immediately. The form itself
 * (and the list) comes from SectionResourcesEditor, which is controlled.
 *
 * Authorization: mutations require `lms.edit` server-side; `canEdit` only
 * controls visibility.
 */
export default function SectionResourcesPanel({ courseId, sectionId, canEdit = false }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  // The read goes through the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer, so the panel keeps no copy of
  // its own. Its address is built from the scope this panel edits.
  const { data, error: readError, refresh } = useApi(
    sectionId ? `/api/lms/section-resources?section_id=${encodeURIComponent(sectionId)}` : null,
    {
      defaultValue: EMPTY_SECTION_RESOURCES,
      transform: pickSectionResources,
      deps: [sectionId],
    },
  );

  // The payload's own refusal, or a request that never got an answer. Either
  // way there is nothing to list, so the placeholder must not stand - which is
  // what `null` means here.
  const failure = data.failure || readError || null;
  const resources = data.resources === null && failure ? [] : data.resources;

  // The loader raised one error toast per failed read; that is the only job
  // this effect has.
  useEffect(() => {
    if (failure) notify("error", failure);
  }, [failure]);

  /** Every write shares the same scope + error contract for the editor. */
  const write = async ({ url, method, body }) => {
    setSaving(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      await refresh();
      return true;
    } catch (e) {
      // Rethrown so the editor keeps the form open: nothing the author typed is lost.
      notify("error", e.message || "lms.errors.saveFailed");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const create = async (values) => {
    await write({
      url: "/api/lms/section-resources",
      method: "POST",
      body: { ...values, section_id: sectionId },
    });
    notify("success", "lms.sessionResources.created");
  };

  const update = async (resource, values) => {
    await write({
      url: `/api/lms/section-resources/${resource.id}`,
      method: "PUT",
      body: values,
    });
    notify("success", "lms.sessionResources.updated");
  };

  const remove = async (resource) => {
    await write({
      url: `/api/lms/section-resources/${resource.id}`,
      method: "DELETE",
    });
    notify("success", "lms.sessionResources.deleted");
  };

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border-primary)" }}>
      <SectionResourcesEditor
        title={t("lms.sessionResources.title")}
        accent="var(--brand-blue)"
        resources={resources || []}
        loading={resources === null}
        canEdit={canEdit}
        busy={saving}
        courseId={courseId}
        sectionId={sectionId}
        onCreate={create}
        onUpdate={update}
        onDelete={remove}
      />
    </div>
  );
}
