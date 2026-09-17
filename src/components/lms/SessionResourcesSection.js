"use client";

import { useEffect, useState } from "react";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import SessionResourcesEditor from "./SessionResourcesEditor";

// ─── Read shapers (module scope: built once, never per render) ───────────

// The hook keys its internal work on the address alone, so the default and the
// shaper are made once here rather than on every render.
const EMPTY_SESSION_RESOURCES = { resources: null, failure: null };

/**
 * The session's material, together with the reason it is missing. A refusal
 * carries the server's own i18n key, which is what the toast already showed.
 */
const pickSessionResources = (d) =>
  d?.success
    ? { resources: d.resources || [], failure: null }
    : { resources: [], failure: d?.error || "lms.errors.loadFailed" };

/**
 * SESSION RESOURCES — session card panel (Phase 8)
 *
 * The Phase 3 "Resources" block of a Program session: it loads the session's
 * material and persists every change immediately. The form itself (and the
 * list) comes from SessionResourcesEditor, which the session creation form
 * reuses with buffered state — one form, two persistence strategies.
 *
 * Authorization: mutations require `lms.edit` server-side; `canEdit` only
 * controls visibility.
 */
export default function SessionResourcesSection({
  programId,
  sessionId,
  weekNumber,
  canEdit = false,
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  // The read goes through the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer, so the panel keeps no copy of
  // its own. Its address is built from the scope this panel edits.
  const params = new URLSearchParams({ program_id: programId });
  if (sessionId) params.set("session_id", sessionId);
  const { data, error: readError, refresh } = useApi(
    programId ? `/api/lms/session-resources?${params.toString()}` : null,
    { defaultValue: EMPTY_SESSION_RESOURCES, transform: pickSessionResources },
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
      // Rethrown so the editor keeps the form open: nothing the PM typed is lost.
      notify("error", e.message || "lms.errors.saveFailed");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const scope = (values) => ({
    ...values,
    program_id: programId,
    session_id: sessionId || null,
    week_number: weekNumber ?? null,
  });

  const create = async (values) => {
    await write({
      url: "/api/lms/session-resources",
      method: "POST",
      body: scope(values),
    });
    notify("success", "lms.sessionResources.created");
  };

  const update = async (resource, values) => {
    await write({
      url: `/api/lms/session-resources/${resource.id}`,
      method: "PUT",
      body: values,
    });
    notify("success", "lms.sessionResources.updated");
  };

  const remove = async (resource) => {
    await write({
      url: `/api/lms/session-resources/${resource.id}`,
      method: "DELETE",
    });
    notify("success", "lms.sessionResources.deleted");
  };

  return (
    <div className="space-y-4">
      {/* PHASE 3: RESOURCES (THE SUPPORT) */}
      <div className="pb-3 border-b border-blue-500/20">
        <SessionResourcesEditor
          badge={
            <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-black text-blue-500 border border-blue-500/20 shadow-sm shrink-0">
              3
            </div>
          }
          title={t("lms.sessionResources.title")}
          accent="var(--brand-blue)"
          resources={resources || []}
          loading={resources === null}
          canEdit={canEdit}
          busy={saving}
          programId={programId}
          sessionId={sessionId}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
        />
      </div>
    </div>
  );
}
