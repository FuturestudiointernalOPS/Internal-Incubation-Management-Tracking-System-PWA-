"use client";

import { useCallback, useEffect, useState } from "react";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import SessionResourcesEditor from "./SessionResourcesEditor";

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
  const [resources, setResources] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchResources = useCallback(async () => {
    setResources(null);
    const params = new URLSearchParams({ program_id: programId });
    if (sessionId) params.set("session_id", sessionId);
    try {
      const res = await fetch(`/api/lms/session-resources?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.loadFailed");
      setResources(data.resources || []);
    } catch (e) {
      notify("error", e.message || "lms.errors.loadFailed");
      setResources([]);
    }
  }, [programId, sessionId]);

  useEffect(() => {
    if (programId) fetchResources();
  }, [programId, fetchResources]);

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
      await fetchResources();
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
