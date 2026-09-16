"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Video,
  FileText,
  Trash2,
  Pencil,
  Star,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";

/**
 * SESSION RESOURCES (Phase 8 — Program Manager experience)
 *
 * The material a Program session depends on: videos and documents, each with an
 * optional "recommended" flag and note. Rendered inside one session card of the
 * Program curriculum (Phase 3 — Resources), right above Phase 4 (Learning/LMS).
 *
 * The resources belong to the session (`session_id`) and are stored as rows in
 * `lms_session_resources` — never as opaque JSON — so the participant surface
 * and any reporting can read them without parsing.
 *
 * Authorization: mutations require `lms.assign` server-side; `canEdit` only
 * controls visibility.
 */

const EMPTY_FORM = {
  id: null,
  kind: "document",
  title: "",
  url: "",
  description: "",
  is_recommended: false,
  recommendation_note: "",
};

// Inputs follow the shared surface/border variables (no hardcoded colours).
const inputClassName = "w-full px-3 py-2 rounded-lg outline-none border text-xs";
const inputStyle = {
  background: "var(--surface-2)",
  borderColor: "var(--border-primary)",
  color: "var(--text-primary)",
};

export default function SessionResourcesSection({
  programId,
  sessionId,
  weekNumber,
  canEdit = false,
}) {
  const { t } = useI18n();
  const [resources, setResources] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
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

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (resource) => {
    setForm({
      id: resource.id,
      kind: resource.kind,
      title: resource.title || "",
      url: resource.url || "",
      description: resource.description || "",
      is_recommended: !!resource.is_recommended,
      recommendation_note: resource.recommendation_note || "",
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const isEdit = !!form.id;
      const res = await fetch(
        isEdit
          ? `/api/lms/session-resources/${form.id}`
          : "/api/lms/session-resources",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program_id: programId,
            session_id: sessionId || null,
            week_number: weekNumber ?? null,
            kind: form.kind,
            title: form.title,
            url: form.url,
            description: form.description,
            is_recommended: form.is_recommended,
            recommendation_note: form.is_recommended
              ? form.recommendation_note
              : null,
          }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify(
        "success",
        isEdit
          ? "lms.sessionResources.updated"
          : "lms.sessionResources.created",
      );
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchResources();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (resource) => {
    if (!window.confirm(t("lms.sessionResources.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/lms/session-resources/${resource.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.sessionResources.deleted");
      fetchResources();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    }
  };

  const recommended = (resources || []).filter((r) => r.is_recommended);

  return (
    <div className="space-y-4">
      {/* PHASE 3: RESOURCES (THE SUPPORT) */}
      <div className="flex items-center justify-between pb-3 border-b border-blue-500/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-black text-blue-500 border border-blue-500/20 shadow-sm">
            3
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
            {t("lms.sessionResources.title")}
          </span>
          {recommended.length > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
              {t("lms.sessionResources.recommendedCount", { n: recommended.length })}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="text-[9px] font-black text-blue-500 uppercase hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> {t("lms.sessionResources.add")}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {resources === null ? (
          <div className="flex justify-center py-6">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : resources.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-2xl opacity-40">
            <FileText className="w-6 h-6 mb-1.5" />
            <p
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("lms.sessionResources.empty")}
            </p>
          </div>
        ) : (
          resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-primary"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  {resource.kind === "video" ? (
                    <Video className="w-4 h-4 text-blue-500" />
                  ) : (
                    <FileText className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-black uppercase tracking-tight truncate hover:underline flex items-center gap-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {resource.title}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                    {resource.is_recommended && (
                      <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" />
                        {t("lms.sessionResources.recommended")}
                      </span>
                    )}
                    <span
                      className="text-[8px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {t(`lms.sessionResources.kind.${resource.kind}`)}
                    </span>
                  </div>
                  {resource.description && (
                    <p
                      className="text-[10px] mt-1 line-clamp-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {resource.description}
                    </p>
                  )}
                  {resource.is_recommended && resource.recommendation_note && (
                    <p className="text-[10px] mt-1 italic flex items-start gap-1 text-amber-500">
                      <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{resource.recommendation_note}</span>
                    </p>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(resource)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: "var(--text-tertiary)" }}
                    title={t("lms.sessionResources.edit")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => remove(resource)}
                    className="p-1.5 rounded-lg text-rose-500/40 hover:text-rose-500 transition-all"
                    title={t("lms.sessionResources.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AppModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={
          form.id
            ? t("lms.sessionResources.editTitle")
            : t("lms.sessionResources.addTitle")
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {["document", "video"].map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setForm((f) => ({ ...f, kind }))}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest"
                style={{
                  borderColor:
                    form.kind === kind ? "var(--brand-blue)" : "var(--border-primary)",
                  background:
                    form.kind === kind ? "rgba(0,102,255,0.08)" : "transparent",
                  color:
                    form.kind === kind ? "var(--brand-blue)" : "var(--text-secondary)",
                }}
              >
                {kind === "video" ? (
                  <Video className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                {t(`lms.sessionResources.kind.${kind}`)}
              </button>
            ))}
          </div>

          <Field label={t("lms.sessionResources.fieldTitle")}>
            <input
              className={inputClassName}
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t("lms.sessionResources.fieldTitlePlaceholder")}
            />
          </Field>

          <Field label={t("lms.sessionResources.fieldUrl")}>
            <input
              className={inputClassName}
              style={inputStyle}
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder={t("lms.sessionResources.fieldUrlPlaceholder")}
            />
          </Field>

          <Field label={t("lms.sessionResources.fieldDescription")}>
            <textarea
              className={inputClassName}
              style={inputStyle}
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={t("lms.sessionResources.fieldDescriptionPlaceholder")}
            />
          </Field>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_recommended}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_recommended: e.target.checked }))
              }
              className="mt-0.5"
            />
            <span>
              <span
                className="text-[10px] font-black uppercase tracking-widest block"
                style={{ color: "var(--text-primary)" }}
              >
                {t("lms.sessionResources.markRecommended")}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.sessionResources.markRecommendedHint")}
              </span>
            </span>
          </label>

          {form.is_recommended && (
            <Field label={t("lms.sessionResources.fieldNote")}>
              <textarea
                className={inputClassName}
                style={inputStyle}
                rows={2}
                value={form.recommendation_note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recommendation_note: e.target.value }))
                }
                placeholder={t("lms.sessionResources.fieldNotePlaceholder")}
              />
            </Field>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <AppButton variant="secondary" onClick={() => setShowForm(false)}>
              {t("common.cancel")}
            </AppButton>
            <AppButton
              variant="primary"
              loading={saving}
              disabled={!form.title.trim() || !form.url.trim()}
              onClick={save}
            >
              {t("common.save")}
            </AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label
        className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
