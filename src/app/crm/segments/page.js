"use client";

import React, { useEffect, useState } from "react";
import { Filter, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ENTITY_LABEL_KEYS = {
  lead: "crm.intelligence.common.lead",
  opportunity: "crm.intelligence.common.opportunity",
};

export default function CrmSegmentsPage() {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();

  const [segments, setSegments] = useState([]);
  const [loading, setLoading]   = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  
  const [form, setForm] = useState({ name: "", description: "", entity_type: "lead" });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/segments");
      const data = await res.json();
      if (data.success) setSegments(data.segments);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", entity_type: "lead" });
    setShowModal(true);
  }

  function openEdit(seg) {
    setEditing(seg);
    setForm({ name: seg.name, description: seg.description || "", entity_type: seg.entity_type });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      await alert({ message: t("crm.intelligence.segments.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/crm/segments/${editing.id}` : "/api/crm/segments", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        await load();
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(seg) {
    const ok = await confirm({
      message: t("crm.intelligence.segments.confirmDelete"),
      tone: "danger"
    });
    if (!ok) return;
    
    await fetch(`/api/crm/segments/${seg.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {t("crm.intelligence.segments.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("crm.intelligence.segments.subtitle")}
          </p>
        </div>
        <AppButton onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          {t("crm.intelligence.segments.createSegment")}
        </AppButton>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : segments.length === 0 ? (
        <AppEmptyState
          message={t("crm.intelligence.segments.noSegments")}
          hint={t("crm.intelligence.segments.noSegmentsHint")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map(seg => (
            <div key={seg.id} className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5 flex flex-col h-full">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 text-[var(--brand-orange)]">
                  <Filter className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{t(ENTITY_LABEL_KEYS[seg.entity_type] ?? seg.entity_type)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(seg)} className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-3)] rounded">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(seg)} className="p-1.5 text-red-500 hover:bg-[var(--surface-3)] rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">{seg.name}</h3>
              <p className="text-sm text-[var(--text-secondary)] flex-1 line-clamp-2">
                {seg.description || t("crm.intelligence.common.noDescription")}
              </p>
              <div className="mt-4 pt-4 border-t border-[var(--border-primary)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>{t("crm.intelligence.common.by", { name: seg.created_by_name || t("crm.intelligence.common.system") })}</span>
                <span>{formatDate(new Date(seg.created_at))}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AppModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t("crm.intelligence.segments.editSegment") : t("crm.intelligence.segments.newSegment")}
        footer={
          <div className="flex gap-3 justify-end">
            <AppButton variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>{t("common.cancel")}</AppButton>
            <AppButton onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
            </AppButton>
          </div>
        }
      >
        <div className="space-y-4">
          <AppInput
            label={t("crm.intelligence.segments.name")}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <AppInput
            label={t("crm.intelligence.segments.description")}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            multiline
            rows={2}
          />
          {!editing && (
            <AppSelect
              label={t("crm.intelligence.segments.entityType")}
              value={form.entity_type}
              onChange={v => setForm(f => ({ ...f, entity_type: v }))}
              options={[
                { value: "lead", label: t("crm.intelligence.common.lead") },
                { value: "opportunity", label: t("crm.intelligence.common.opportunity") }
              ]}
            />
          )}
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            {t("crm.intelligence.segments.conditionBuilderSoon")}
          </p>
        </div>
      </AppModal>
    </div>
  );
}
