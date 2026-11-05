"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Phone, Mail, Users, FileText, Repeat, SquareCheck,
  ChevronDown, ChevronUp, Plus, Clock, Pencil, AlertTriangle,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppTextarea from "@/components/ui/AppTextarea";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import { isOverdue, toDateInputValue } from "@/components/crm/nextActionState";

const ACTIVITY_ICONS = {
  call:       <Phone className="w-4 h-4" />,
  email:      <Mail className="w-4 h-4" />,
  meeting:    <Users className="w-4 h-4" />,
  note:       <FileText className="w-4 h-4" />,
  follow_up:  <Repeat className="w-4 h-4" />,
  task:       <SquareCheck className="w-4 h-4" />,
  other:      <Clock className="w-4 h-4" />,
};

const ACTIVITY_TYPE_OPTIONS = [
  { value: "call",      label: "crm.activities.types.call" },
  { value: "meeting",   label: "crm.activities.types.meeting" },
  { value: "email",     label: "crm.activities.types.email" },
  { value: "note",      label: "crm.activities.types.note" },
  { value: "follow_up", label: "crm.activities.types.follow_up" },
  { value: "task",      label: "crm.activities.types.task" },
  { value: "other",     label: "crm.activities.types.other" },
];

const OUTCOME_OPTIONS = [
  { value: "",           label: "crm.activities.outcomes.none" },
  { value: "positive",   label: "crm.activities.outcomes.positive" },
  { value: "neutral",    label: "crm.activities.outcomes.neutral" },
  { value: "negative",   label: "crm.activities.outcomes.negative" },
  { value: "no_response",label: "crm.activities.outcomes.no_response" },
  { value: "rescheduled",label: "crm.activities.outcomes.rescheduled" },
  { value: "completed",  label: "crm.activities.outcomes.completed" },
];

// Task rows carry native task statuses in the shared `outcome` column — those
// live in the status.* namespace, not in the CRM outcome vocabulary.
const TASK_STATUS_KEY = {
  pending:     "status.pending",
  in_progress: "status.inProgress",
  completed:   "status.completed",
  blocked:     "status.blocked",
  archived:    "status.archived",
};

function activityOutcomeLabel(activity, t) {
  if (activity.activity_type === "task") {
    const key = TASK_STATUS_KEY[activity.outcome];
    return key ? t(key) : activity.outcome;
  }
  return t(`crm.activities.outcomes.${activity.outcome}`);
}

/** Open task or meeting — the fallback source of the next action. */
function isOpenCommitment(activity) {
  if (!activity.activity_date) return false;
  if (activity.activity_type === "task") {
    return !["completed", "cancelled", "archived"].includes(activity.outcome);
  }
  if (activity.activity_type === "meeting") {
    return !["completed", "cancelled"].includes(activity.outcome);
  }
  return false;
}

const EMPTY_FORM = {
  type: "note",
  title: "",
  description: "",
  outcome: "",
  activity_date: new Date().toISOString().slice(0, 10),
};

/**
 * CrmActivityPanel
 *
 * The relationship's execution stream plus its next action.
 * Accepts: leadId | opportunityId | contactCid | organizationId
 *
 * NEXT ACTION — two sources, one display:
 *   1. the record's own next action (label + due date), set by its OWNER —
 *      `record` / `canSetNextAction` / `onNextActionSaved`;
 *   2. when that field is empty, the earliest open task or meeting already
 *      recorded in the activity stream.
 * Overdue is computed on whichever source is shown, and shown here so it can
 * also be rendered in the lists and on the dashboard.
 *
 * HISTORY IS APPEND-ONLY (product decision, Lot 1): an activity is never edited
 * or deleted after it is recorded. A correction is a new entry.
 */
export default function CrmActivityPanel({
  leadId,
  opportunityId,
  contactCid,
  organizationId,
  record = null,
  canSetNextAction = false,
  onNextActionSaved,
}) {
  const { t } = useI18n();
  const { alert } = useDialogs();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [showAll, setShowAll]       = useState(false);

  // The record's own next action. A local override (after a save) is scoped to
  // the record it belongs to, so a different record can never inherit it.
  const [localAction, setLocalAction] = useState({ recordId: null, value: null });
  const recordAction =
    localAction.recordId === record?.id
      ? localAction.value
      : record?.next_action
        ? { label: record.next_action, due: record.next_action_due }
        : null;
  const [showNextModal, setShowNextModal] = useState(false);
  const [nextForm, setNextForm] = useState({ label: "", due: "" });
  const [savingNext, setSavingNext] = useState(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (leadId)        params.set("lead_id", leadId);
    if (opportunityId) params.set("opportunity_id", opportunityId);
    if (contactCid)    params.set("contact_cid", contactCid);
    if (organizationId) params.set("organization_id", organizationId);
    return params.toString();
  }, [leadId, opportunityId, contactCid, organizationId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/crm/activities?${buildQuery()}`);
      const data = await res.json();
      setActivities(data.activities ?? []);
    } catch {
      // silently degrade — panel is non-critical
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  // The fallback: the earliest open commitment, INCLUDING overdue ones, so a
  // missed task is surfaced rather than hidden behind the next future one.
  const derived = activities
    .filter(isOpenCommitment)
    .sort((a, b) => new Date(a.activity_date) - new Date(b.activity_date))[0] ?? null;

  const nextAction = recordAction
    ? {
        label: recordAction.label,
        due: recordAction.due,
        owner: record?.owner_name ?? null,
        fromRecord: true,
      }
    : derived
      ? {
          label: derived.title,
          due: derived.activity_date,
          owner: derived.owner_name ?? null,
          type: derived.activity_type,
          fromRecord: false,
        }
      : null;

  const nextActionTarget = leadId
    ? `/api/crm/leads/${leadId}`
    : opportunityId
      ? `/api/crm/opportunities/${opportunityId}`
      : null;

  const canEditNextAction = Boolean(canSetNextAction && nextActionTarget);

  function openActivity() {
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openNextAction() {
    setNextForm({
      label: recordAction?.label ?? "",
      due: toDateInputValue(recordAction?.due),
    });
    setShowNextModal(true);
  }

  async function sendNextAction(payload) {
    if (!nextActionTarget) return null;
    setSavingNext(true);
    try {
      const res = await fetch(nextActionTarget, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        await alert({ message: t(data.error || "errors.somethingWrong") });
        return null;
      }
      const updated = data.lead ?? data.opportunity ?? null;
      const saved = updated?.next_action
        ? { label: updated.next_action, due: updated.next_action_due }
        : null;
      setLocalAction({ recordId: record?.id ?? null, value: saved });
      onNextActionSaved?.(updated);
      return updated;
    } catch {
      await alert({ message: t("errors.somethingWrong") });
      return null;
    } finally {
      setSavingNext(false);
    }
  }

  async function saveNextAction() {
    const label = nextForm.label.trim();
    if (label && !nextForm.due) {
      await alert({ message: t("crm.activities.nextActionDateRequired") });
      return;
    }
    const updated = await sendNextAction(
      label
        ? { next_action: label, next_action_due: nextForm.due }
        : { next_action: null, next_action_due: null },
    );
    if (updated) setShowNextModal(false);
  }

  async function clearNextAction() {
    const updated = await sendNextAction({ next_action: null, next_action_due: null });
    if (updated) setShowNextModal(false);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      await alert({ message: t("crm.activities.titleRequired") });
      return;
    }
    setSaving(true);
    try {
      let res;
      if (form.type === "task") {
        // Route to the appropriate task creation sub-endpoint
        const taskUrl = leadId
          ? `/api/crm/leads/${leadId}/tasks`
          : `/api/crm/opportunities/${opportunityId}/tasks`;
        res = await fetch(taskUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       form.title,
            description: form.description,
            end_date:    form.activity_date || null,
          }),
        });
      } else {
        res = await fetch("/api/crm/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type:          form.type,
            title:         form.title,
            description:   form.description,
            outcome:       form.outcome,
            activity_date: form.activity_date || null,
            lead_id:       leadId,
            opportunity_id: opportunityId,
            contact_cid:   contactCid,
            organization_id: organizationId,
          }),
        });
      }
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

  const displayed = showAll ? activities : activities.slice(0, 5);

  // Tasks are created through the native task system and need a lead or
  // opportunity context endpoint — contact/organization-only panels cannot
  // create tasks, so the option is hidden for them.
  const canCreateTask = Boolean(leadId || opportunityId);
  const typeOptions = ACTIVITY_TYPE_OPTIONS.filter(
    (option) => option.value !== "task" || canCreateTask
  );
  const overdue = nextAction ? isOverdue(nextAction.due) : false;

  return (
    <div className="space-y-6">
      {/* ── NEXT ACTION ── */}
      <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {t("crm.activities.nextAction")}
          </h2>
          {canEditNextAction && (
            <button
              onClick={openNextAction}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {nextAction ? t("crm.activities.editNextAction") : t("crm.activities.setNextAction")}
            </button>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-6 w-48" />
        ) : nextAction ? (
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 ${overdue ? "text-red-500" : "text-[var(--brand-orange)]"}`}>
              {ACTIVITY_ICONS[nextAction.type] ?? <Clock className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{nextAction.label}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {nextAction.due ? formatDate(new Date(nextAction.due)) : "—"}{" "}
                {nextAction.owner ? `· ${nextAction.owner}` : ""}
                {!nextAction.fromRecord ? ` · ${t("crm.activities.nextActionDerived")}` : ""}
              </p>
              {overdue && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                  <AlertTriangle className="w-3 h-3" />
                  {t("crm.activities.nextActionOverdue")}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[var(--text-secondary)] italic">
              {t("crm.activities.noNextAction")}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t("crm.activities.nextActionHint")}
            </p>
          </div>
        )}
      </div>

      {/* ── ACTIVITY LIST ── */}
      <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {t("crm.activities.title")}
          </h2>
          <AppButton size="sm" icon={Plus} onClick={openActivity}>
            {t("crm.activities.addActivity")}
          </AppButton>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : activities.length === 0 ? (
          <AppEmptyState
            size="sm"
            title={t("crm.activities.noActivities")}
            description={t("crm.activities.noActivitiesHint")}
          />
        ) : (
          <>
            <ol className="space-y-3">
              {displayed.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 shrink-0 text-[var(--text-secondary)]">
                    {ACTIVITY_ICONS[a.activity_type] ?? ACTIVITY_ICONS.other}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{a.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      <span className="capitalize">{t(`crm.activities.types.${a.activity_type}`) || a.activity_type}</span>
                      {a.activity_date ? ` · ${formatDate(new Date(a.activity_date))}` : ""}
                      {a.owner_name ? ` · ${a.owner_name}` : ""}
                      {a.outcome ? ` · ${activityOutcomeLabel(a, t)}` : ""}
                    </p>
                    {a.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {a.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {activities.length > 5 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="mt-4 text-xs text-[var(--text-secondary)] flex items-center gap-1 hover:text-[var(--text-primary)]"
              >
                {showAll ? (
                  <><ChevronUp className="w-3.5 h-3.5" /> {t("common.showLess")}</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5" /> {t("crm.activities.showAll", { count: activities.length })}</>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── NEXT ACTION MODAL ── */}
      <AppModal
        isOpen={showNextModal}
        onClose={() => setShowNextModal(false)}
        title={t("crm.activities.editNextAction")}
      >
        <div className="space-y-4">
          <AppInput
            label={t("crm.activities.nextActionLabel")}
            value={nextForm.label}
            onChange={e => setNextForm(f => ({ ...f, label: e.target.value }))}
            placeholder={t("crm.activities.nextActionPlaceholder")}
          />
          <AppInput
            label={t("crm.activities.nextActionDateLabel")}
            type="date"
            value={nextForm.due}
            onChange={e => setNextForm(f => ({ ...f, due: e.target.value }))}
          />
          <div className="flex justify-between gap-3 pt-2">
            <AppButton
              variant="ghost"
              onClick={clearNextAction}
              disabled={savingNext || !recordAction}
            >
              {t("crm.activities.nextActionClear")}
            </AppButton>
            <div className="flex gap-3">
              <AppButton variant="ghost" onClick={() => setShowNextModal(false)} disabled={savingNext}>
                {t("common.cancel")}
              </AppButton>
              <AppButton onClick={saveNextAction} loading={savingNext}>
                {t("common.save")}
              </AppButton>
            </div>
          </div>
        </div>
      </AppModal>

      {/* ── ADD ACTIVITY MODAL ── */}
      <AppModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={t("crm.activities.addActivity")}
      >
        <div className="space-y-4">
          <AppSelect
            label={t("crm.activities.typeLabel")}
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            options={typeOptions.map(o => ({
              value: o.value,
              label: t(o.label),
            }))}
          />

          <AppInput
            label={t("crm.activities.titleLabel")}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t("crm.activities.titlePlaceholder")}
          />

          <AppInput
            label={t("crm.activities.dateLabel")}
            type="date"
            value={form.activity_date}
            onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))}
          />

          {form.type !== "task" && (
            <AppSelect
              label={t("crm.activities.outcomeLabel")}
              value={form.outcome}
              onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
              options={OUTCOME_OPTIONS.map(o => ({
                value: o.value,
                label: t(o.label),
              }))}
            />
          )}

          <AppTextarea
            label={t("crm.activities.descriptionLabel")}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder={t("crm.activities.descriptionPlaceholder")}
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-2">
            <AppButton variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>
              {t("common.cancel")}
            </AppButton>
            <AppButton onClick={handleSave} loading={saving}>
              {t("common.save")}
            </AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
