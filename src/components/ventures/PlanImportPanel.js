"use client";

import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  Flag,
  HelpCircle,
  Loader2,
  Package,
  Play,
  Save,
  Sparkles,
  Trash2,
  Upload,
  UserX,
} from "lucide-react";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useApi } from "@/lib/hooks/useApi";
import { planSheetKind, MAX_PLAN_UPLOAD_BYTES } from "@/lib/venturePlanSheetRules";

const PRIORITIES = ["high", "medium", "low"];
const clone = (value) => JSON.parse(JSON.stringify(value));
const isEmpty = (value) => !String(value ?? "").trim();

/**
 * PlanImportPanel — the programme import, on the Journey surface.
 *
 * A tracker is an INPUT, never the source of truth. Phase 1 reads it and asks
 * the analyst for a proposal; Phase 2 lets a human correct that proposal and
 * keeps it as a DRAFT. Nothing here creates a journey, milestone, task or
 * deliverable — the panel says so on screen, because a screen that looks
 * finished is worse than one that admits what it has not done.
 *
 * The format and size rules come from lib/venturePlanSheetRules, the same ones
 * the route applies, so the form cannot offer a file the server would refuse.
 */
export default function PlanImportPanel({ ventureId }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();

  const { data: draft, loading, refresh: refreshDraft } = useApi(
    ventureId ? `/api/ventures/${ventureId}/plan-import` : null,
    { defaultValue: null, transform: (payload) => (payload?.success ? payload.draft : null) },
  );

  const discard = async () => {
    if (!draft?.id) return;
    if (!(await confirm({ message: t("venture.planImport.discardConfirm"), tone: "danger" }))) return;
    try {
      await fetch(`/api/ventures/${ventureId}/plan-import`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, action: "discard" }),
      });
    } finally {
      refreshDraft();
    }
  };

  return (
    <div className="card mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.planImport.title")}
          {draft && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
              {t("venture.planImport.draftBadge")}
            </span>
          )}
        </h3>
        {draft && (
          <button
            type="button"
            onClick={discard}
            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            {t("venture.planImport.discard")}
          </button>
        )}
      </div>

      {loading && !draft ? (
        <div className="text-center py-6">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
        </div>
      ) : draft ? (
        // `key` so a replaced draft remounts with its own working copy rather
        // than editing the draft that is no longer there.
        <PlanReview key={draft.id} ventureId={ventureId} draft={draft} onSaved={refreshDraft} />
      ) : (
        <PlanUpload ventureId={ventureId} onUploaded={refreshDraft} />
      )}
    </div>
  );
}

/** The reading itself: choose a tracker, optionally describe the business. */
function PlanUpload({ ventureId, onUploaded }) {
  const { t } = useI18n();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = (chosen) => {
    setError(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    // The same rules the route applies — a file refused here would be refused there.
    if (!planSheetKind({ name: chosen.name, mime: chosen.type })) {
      setFile(null);
      setError(t("venture.planImport.badType"));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (chosen.size > MAX_PLAN_UPLOAD_BYTES) {
      setFile(null);
      setError(t("venture.planImport.tooLarge"));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(chosen);
  };

  const analyse = async () => {
    if (!file) {
      setError(t("venture.planImport.noFile"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (context.trim()) formData.append("context", context.trim());

      const res = await fetch(`/api/ventures/${ventureId}/plan-import`, { method: "POST", body: formData });
      const payload = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setError(t("venture.planImport.notAllowed"));
        return;
      }
      if (!res.ok || !payload.success) {
        setError(payload.error || t("venture.planImport.failed"));
        return;
      }
      if (fileInput.current) fileInput.current.value = "";
      setFile(null);
      setContext("");
      await onUploaded();
    } catch (_) {
      setError(t("venture.planImport.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-400">{t("venture.planImport.intro")}</p>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.planImport.file")}</label>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,.tsv,.txt"
          onChange={(event) => pick(event.target.files?.[0] || null)}
          className="w-full text-[11px] text-slate-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-[var(--brand-orange)] file:text-black"
        />
        <p className="text-[9px] text-slate-500">{t("venture.planImport.fileHint")}</p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.planImport.context")}</label>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          rows={2}
          placeholder={t("venture.planImport.contextPlaceholder")}
          className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={analyse}
          disabled={busy || !file}
          className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {t(busy ? "venture.planImport.analysing" : "venture.planImport.analyse")}
        </button>
      </div>
    </div>
  );
}

/**
 * The review: the proposal as the analyst left it, made correctable.
 *
 * The working copy is local until Save, so a half-finished correction is never
 * silently written over the stored draft. Stats and the unmatched-owner list are
 * shown from the STORED row (`draft.*`) rather than recomputed here — the server
 * recomputes them on save, and one definition of "how much is in this" is the
 * whole reason the screen can be trusted.
 */
function PlanReview({ ventureId, draft, onSaved }) {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();
  const [proposal, setProposal] = useState(() => clone(draft.proposal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [contactOptions, setContactOptions] = useState([]);
  const [instruction, setInstruction] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [applying, setApplying] = useState(false);
  // Which external name the reviewer is resolving, and the address they typed.
  //
  // ONE field. The reviewer previously had to CHOOSE between "select a member"
  // and "add a person" before they had any way of knowing which applied — a
  // question the interface should answer, not ask. The email answers it: an
  // address is unique, a name is not, so the address decides.
  const [resolving, setResolving] = useState(null); // { name, email }
  const [lookup, setLookup] = useState({ email: "", state: "idle", contact: null });
  const [inviting, setInviting] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  // The address being checked, and whether it is even a question worth asking.
  const typedEmail = String(resolving?.email || "").trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail);

  /**
   * Ask the server whether the typed address is already a member.
   *
   * The ANSWER decides what the row offers — nothing here infers it. A typed
   * address is never assumed to be new, and never assumed to exist.
   *
   * Nothing is written to state before the answer arrives: an in-flight check is
   * DERIVED below (`lookup.email` does not match the typed address yet), which
   * also means a stale answer for an address the reviewer has since changed is
   * ignored rather than shown.
   */
  useEffect(() => {
    if (!emailValid) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/people?email=${encodeURIComponent(typedEmail)}`);
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        setLookup({
          email: typedEmail,
          state: !payload.success ? "error" : payload.found ? "member" : "new",
          contact: payload.contact || null,
        });
      } catch (_) {
        if (!cancelled) setLookup({ email: typedEmail, state: "error", contact: null });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [typedEmail, emailValid]);

  /** Display-only counts for the confirmation text. The SERVER computes the
   *  real numbers on apply — this exists so the reviewer is told what they are
   *  about to create, in the words of the plan they are looking at. */
  const countProposal = (value) => {
    const counts = { journeys: 0, milestones: 0, tasks: 0, deliverables: 0 };
    for (const journey of value.journeys || []) {
      counts.journeys += 1;
      for (const milestone of journey.milestones || []) {
        counts.milestones += 1;
        for (const task of milestone.tasks || []) {
          counts.tasks += 1;
          counts.deliverables += (task.deliverables || []).length;
        }
      }
    }
    return counts;
  };

  /** Resolve a typed owner against the contact matches currently on offer. */
  const matchContact = (value) => {
    const clean = String(value || "").trim().toLowerCase();
    if (!clean) return null;
    return (
      contactOptions.find(
        (contact) =>
          String(contact.name || "").toLowerCase() === clean ||
          String(contact.email || "").toLowerCase() === clean,
      ) || null
    );
  };

  const searchContacts = (value) => {
    clearTimeout(searchTimer.current);
    const query = String(value || "").trim();
    if (query.length < 2) {
      setContactOptions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
        const payload = await res.json().catch(() => ({}));
        setContactOptions(payload.success ? payload.contacts || [] : []);
      } catch (_) {
        setContactOptions([]);
      }
    }, 300);
  };

  const patchJourney = (ji, patch) =>
    setProposal((prev) => ({
      ...prev,
      journeys: prev.journeys.map((journey, index) => (index === ji ? { ...journey, ...patch } : journey)),
    }));

  const patchMilestone = (ji, mi, patch) =>
    setProposal((prev) => ({
      ...prev,
      journeys: prev.journeys.map((journey, index) =>
        index !== ji
          ? journey
          : {
              ...journey,
              milestones: journey.milestones.map((milestone, mIndex) =>
                mIndex === mi ? { ...milestone, ...patch } : milestone,
              ),
            },
      ),
    }));

  const patchTask = (ji, mi, ti, patch) =>
    setProposal((prev) => ({
      ...prev,
      journeys: prev.journeys.map((journey, index) =>
        index !== ji
          ? journey
          : {
              ...journey,
              milestones: journey.milestones.map((milestone, mIndex) =>
                mIndex !== mi
                  ? milestone
                  : {
                      ...milestone,
                      tasks: milestone.tasks.map((task, tIndex) =>
                        tIndex === ti ? { ...task, ...patch } : task,
                      ),
                    },
              ),
            },
      ),
    }));

  const ask = async () => {
    const text = instruction.trim();
    if (!text) return;
    setAsking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/plan-import`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, instruction: text, proposal }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) {
        setError(payload.error || t("venture.planImport.correctFailed"));
        return;
      }
      // A SUGGESTION, not a change: nothing is stored and nothing is replaced
      // until the reviewer keeps it.
      setSuggestion({
        proposal: payload.proposal,
        changes: payload.changes || [],
        notes: payload.notes || null,
      });
    } catch (_) {
      setError(t("venture.planImport.correctFailed"));
    } finally {
      setAsking(false);
    }
  };

  const keepSuggestion = () => {
    if (!suggestion) return;
    setProposal(clone(suggestion.proposal));
    setSuggestion(null);
    setInstruction("");
    setNotice(t("venture.planImport.changesKept"));
  };

  const apply = async () => {
    const counts = countProposal(proposal);
    const ok = await confirm({
      message: t("venture.planImport.applyConfirm"),
      hint: t("venture.planImport.applyConfirmCounts", counts),
      tone: "danger",
    });
    if (!ok) return;

    setApplying(true);
    setError(null);
    setNotice(null);
    try {
      // The working copy travels WITH the apply, so what gets built is what was
      // on screen — and it is saved first, so the stored draft matches too.
      const res = await fetch(`/api/ventures/${ventureId}/plan-import`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, action: "apply", proposal }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) {
        setError(payload.error || t("venture.planImport.applyFailed"));
        return;
      }
      await alert({
        message: t("venture.planImport.applied", payload.applied || {}),
        hint: (payload.warnings || []).join("\n") || undefined,
      });
      await onSaved();
    } catch (_) {
      setError(t("venture.planImport.applyFailed"));
    } finally {
      setApplying(false);
    }
  };

  const removeMilestone = async (ji, mi) => {
    const milestone = proposal.journeys?.[ji]?.milestones?.[mi];
    if (!milestone) return;
    // Removing a milestone removes its tasks — the count is stated BEFORE the
    // confirmation, so the cost of the action is visible while it can still be
    // refused.
    const ok = await confirm({
      message: t("venture.planImport.removeMilestoneConfirm", {
        name: milestone.name,
        n: (milestone.tasks || []).length,
      }),
      tone: "danger",
    });
    if (!ok) return;
    setProposal((prev) => ({
      ...prev,
      journeys: prev.journeys.map((journey, index) =>
        index !== ji
          ? journey
          : { ...journey, milestones: journey.milestones.filter((_, mIndex) => mIndex !== mi) },
      ),
    }));
  };

  /**
   * Point every assignment standing on a name at a real ImpactOS person.
   *
   * The NAME IS KEPT — it is the record of what the tracker said, and clearing it
   * would erase where the assignment came from. Only the identity is filled in.
   * One decision covers every row carrying that name.
   */
  const applyContactToName = (name, contactId) => {
    const key = String(name || "").trim().toLowerCase();
    let touched = 0;
    const journeys = (proposal.journeys || []).map((journey) => ({
      ...journey,
      milestones: (journey.milestones || []).map((milestone) => ({
        ...milestone,
        tasks: (milestone.tasks || []).map((task) => {
          if (!task.owner_cid && String(task.owner_name || "").trim().toLowerCase() === key) {
            touched += 1;
            return { ...task, owner_cid: contactId };
          }
          return task;
        }),
      })),
    }));
    setProposal((prev) => ({ ...prev, journeys }));
    return touched;
  };

  /** Link this name to a member the platform ALREADY has. No person is created,
   *  and nothing but the identity in this working copy changes. */
  const linkExisting = (entry, contact) => {
    const touched = applyContactToName(entry.name, contact.cid);
    setNotice(t("venture.planImport.assignedToMember", { name: contact.name || entry.name, n: touched }));
    setResolving(null);
  };

  /** Add a real ImpactOS person and invite them — Name + Email, by email.
   *  This is the ONLY path that creates an account; importing a name never did. */
  const addAndInvite = async (name) => {
    setInviting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: resolving?.email || "" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) {
        setError(payload.error || t("venture.planImport.addPersonFailed"));
        return;
      }
      const touched = applyContactToName(name, payload.cid);
      setNotice(
        payload.existing
          ? t("venture.planImport.personAlreadyExists", { name })
          : payload.invited
            ? t("venture.planImport.personInvited", { name, n: touched })
            : t("venture.planImport.personAddedNotInvited", { name }),
      );
      setResolving(null);
    } catch (_) {
      setError(t("venture.planImport.addPersonFailed"));
    } finally {
      setInviting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/plan-import`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, proposal }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) {
        setError(payload.error || t("venture.planImport.notSaved"));
        return;
      }
      setNotice(t("venture.planImport.saved"));
      await onSaved();
    } catch (_) {
      setError(t("venture.planImport.notSaved"));
    } finally {
      setSaving(false);
    }
  };

  const stats = draft.stats || {};
  const unplaced = proposal.unplaced || [];
  const alreadyCovered = proposal.already_covered || [];

  // The names the plan is tracking with no platform identity — derived from the
  // WORKING COPY, so resolving one updates this list immediately rather than
  // waiting for a save.
  const externalPeople = (() => {
    const found = new Map();
    for (const journey of proposal.journeys || []) {
      for (const milestone of journey.milestones || []) {
        for (const task of milestone.tasks || []) {
          const name = String(task.owner_name || "").trim();
          if (!name || task.owner_cid) continue;
          const key = name.toLowerCase();
          found.set(key, { name, count: (found.get(key)?.count || 0) + 1 });
        }
      }
    }
    return [...found.values()].sort((left, right) => left.name.localeCompare(right.name));
  })();

  const inputClass =
    "w-full px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-[11px] text-[var(--text-primary)]";

  const showValue = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));

  const ownerField = (task, onChange) => (
    <span className="inline-flex items-center gap-1">
      <input
        list="plan-import-owner-options"
        value={task.owner_name || ""}
        onChange={(event) => {
          const value = event.target.value;
          searchContacts(value);
          const contact = matchContact(value);
          // A name that matches a contact carries its cid; anything typed stays
          // as written and is reported as unresolved rather than guessed at.
          onChange({ owner_name: value || null, owner_cid: contact ? contact.cid : null });
        }}
        placeholder={t("venture.planImport.ownerPlaceholder")}
        className={`${inputClass} w-32`}
      />
      {!isEmpty(task.owner_name) && !task.owner_cid && (
        <span title={t("venture.planImport.ownerUnknown")} className="text-amber-400 shrink-0">
          <UserX className="w-3 h-3" />
        </span>
      )}
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <span className="text-[11px] font-bold text-amber-300">{t("venture.planImport.nothingCreated")}</span>
      </div>

      <p className="text-[10px] text-slate-400">{t("venture.planImport.reviewIntro")}</p>

      {/* The analyst had to infer the task references, and references are what
          dependencies point at — so this is said plainly, once. */}
      {draft.proposal?.refs_derived && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span className="text-[11px] font-bold text-amber-300">{t("venture.planImport.refsDerived")}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-widest">
        <span className="px-2 py-1 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)]">
          {t("venture.planImport.statJourneys", { n: stats.journeys || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
          {t("venture.planImport.statMilestones", { n: stats.milestones || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
          {t("venture.planImport.statTasks", { n: stats.tasks || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
          {t("venture.planImport.statDeliverables", { n: stats.deliverables || 0 })}
        </span>
        <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-400 normal-case tracking-normal">
          {t("venture.planImport.sheetsRead", {
            n: (draft.sheets || []).length,
            names: (draft.sheets || []).map((sheet) => sheet.name).join(", "),
          })}
        </span>
      </div>

      {alreadyCovered.length > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-sky-400 mb-1.5">
            {t("venture.planImport.alreadyCovered", { n: alreadyCovered.length })}
          </p>
          <ul className="space-y-0.5 mb-1.5">
            {alreadyCovered.map((item, index) => (
              <li key={index} className="text-[10px] text-[var(--text-secondary)]">
                <span className="text-[var(--text-primary)]">{item.sheet_item}</span> → {item.existing}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-400">{t("venture.planImport.alreadyCoveredHint")}</p>
        </div>
      )}

      {(proposal.journeys || []).length === 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] p-3">
          <p className="text-[11px] font-bold text-[var(--text-primary)]">{t("venture.planImport.nothingNew")}</p>
        </div>
      )}

      {(proposal.journeys || []).map((journey, ji) => (
        <div key={`${journey.name}-${ji}`} className="rounded-xl border border-[var(--border-primary)] p-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-[var(--brand-orange)]" />
                {t("venture.planImport.journeyName")}
              </span>
              <input
                value={journey.name || ""}
                onChange={(event) => patchJourney(ji, { name: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {t("venture.planImport.objective")}
              </span>
              <textarea
                rows={2}
                value={journey.objective || ""}
                onChange={(event) => patchJourney(ji, { objective: event.target.value || null })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {t("venture.planImport.start")}
              </span>
              <input
                type="date"
                value={journey.start_date || ""}
                onChange={(event) => patchJourney(ji, { start_date: event.target.value || null })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {t("venture.planImport.target")}
              </span>
              <input
                type="date"
                value={journey.target_date || ""}
                onChange={(event) =>
                  patchJourney(ji, { target_date: event.target.value || null, dates_derived: null })
                }
                className={inputClass}
              />
            </label>
            {journey.dates_derived && (
              <p className="text-[9px] text-sky-400 sm:col-span-2">{t("venture.planImport.suggestedDates")}</p>
            )}
          </div>

          <div className="space-y-2 pl-4">
            {(journey.milestones || []).map((milestone, mi) => (
              <div key={`${milestone.name}-${mi}`} className="rounded-lg border border-divider/60 p-2.5 space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeMilestone(ji, mi)}
                    className="text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-lg flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t("venture.planImport.removeMilestone")}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Flag className="w-3 h-3 text-sky-400" />
                      {t("venture.planImport.name")}
                      {milestone.ref && <span className="text-slate-500 normal-case">({milestone.ref})</span>}
                    </span>
                    <input
                      value={milestone.name || ""}
                      onChange={(event) => patchMilestone(ji, mi, { name: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {t("venture.planImport.target")}
                    </span>
                    <input
                      type="date"
                      value={milestone.target_date || ""}
                      onChange={(event) =>
                        patchMilestone(ji, mi, { target_date: event.target.value || null, dates_derived: null })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {t("venture.planImport.objective")}
                    </span>
                    <input
                      value={milestone.objective || ""}
                      onChange={(event) => patchMilestone(ji, mi, { objective: event.target.value || null })}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  {(milestone.tasks || []).map((task, ti) => (
                    <div key={`${task.title}-${ti}`} className="rounded-lg border border-divider/50 p-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {task.ref && <span className="text-[8px] font-black text-slate-500">{task.ref}</span>}
                        <input
                          value={task.title || ""}
                          onChange={(event) => patchTask(ji, mi, ti, { title: event.target.value })}
                          className={`${inputClass} flex-1 min-w-[180px]`}
                        />
                        <select
                          value={task.priority || ""}
                          onChange={(event) => patchTask(ji, mi, ti, { priority: event.target.value || null })}
                          className={`${inputClass} w-24`}
                        >
                          <option value="">{t("venture.planImport.priority")}</option>
                          {PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                              {t(`venture.planImport.priorities.${priority}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                          {t("venture.planImport.owner")}
                          {ownerField(task, (patch) => patchTask(ji, mi, ti, patch))}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {t("venture.planImport.start")}
                          <input
                            type="date"
                            value={task.start_date || ""}
                            onChange={(event) => patchTask(ji, mi, ti, { start_date: event.target.value || null })}
                            className={`${inputClass} w-36`}
                          />
                        </span>
                        <span className="flex items-center gap-1.5">
                          {t("venture.planImport.due")}
                          <input
                            type="date"
                            value={task.due_date || ""}
                            onChange={(event) => patchTask(ji, mi, ti, { due_date: event.target.value || null })}
                            className={`${inputClass} w-36`}
                          />
                        </span>
                        {(task.depends_on || []).length > 0 && (
                          <span className="uppercase tracking-widest text-[8px]">
                            {t("venture.planImport.dependsOn", { refs: task.depends_on.join(", ") })}
                          </span>
                        )}
                      </div>
                      {/* What the tracker carried beyond the task itself. Shown
                          because it is ABOUT to be folded into the task's labels
                          and description — nothing is stored invisibly. */}
                      {(task.support || task.phase || task.definition_of_done) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-500">
                          {task.support && (
                            <span>
                              {t("venture.planImport.supportLabel")}: {task.support}
                            </span>
                          )}
                          {task.phase && (
                            <span>
                              {t("venture.planImport.phaseLabel")}: {task.phase}
                            </span>
                          )}
                          {task.definition_of_done && (
                            <span className="truncate max-w-md">
                              {t("venture.planImport.dodLabel")}: {task.definition_of_done}
                            </span>
                          )}
                        </div>
                      )}
                      {(task.deliverables || []).length > 0 && (
                        <div className="space-y-1">
                          {(task.deliverables || []).map((deliverable, di) => (
                            <div key={`${deliverable.title}-${di}`} className="flex items-center gap-1.5">
                              <Package className="w-3 h-3 text-slate-500 shrink-0" />
                              <input
                                value={deliverable.title || ""}
                                onChange={(event) =>
                                  patchTask(ji, mi, ti, {
                                    deliverables: task.deliverables.map((item, index) =>
                                      index === di ? { ...item, title: event.target.value } : item,
                                    ),
                                  })
                                }
                                className={`${inputClass} flex-1 max-w-md`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* §6 — EXTERNAL ASSIGNMENTS ARE NOT AN ERROR. The plan is complete without
          these people ever becoming members; adding them is an option, not a
          repair. Derived from the WORKING COPY, so resolving a name updates this
          list on the spot. */}
      {externalPeople.length > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" />
            {t("venture.planImport.externalDetected", { n: externalPeople.length })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{t("venture.planImport.externalDetectedHint")}</p>

          <ul className="mt-2 space-y-2">
            {externalPeople.map((entry) => {
              const isOpen = resolving?.name === entry.name;
              // Derived, never stored: an address with no answer yet is simply
              // "still checking", so there is no window in which a row shows a
              // verdict it has not actually received.
              const state = !isOpen || !emailValid ? "idle" : lookup.email === typedEmail ? lookup.state : "searching";
              return (
                <li key={entry.name} className="rounded-lg border border-[var(--border-primary)] p-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{entry.name}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                      {t("venture.planImport.externalBadge")}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {t("venture.planImport.externalAssignments", { n: entry.count })}
                    </span>
                  </div>

                  {/* ONE field. The address decides which of the two things this
                      row offers — the reviewer does not have to know first. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      value={isOpen ? resolving.email || "" : ""}
                      onChange={(event) => setResolving({ name: entry.name, email: event.target.value })}
                      placeholder={t("venture.planImport.emailLookupPlaceholder")}
                      className={`${inputClass} flex-1 min-w-[200px]`}
                    />

                    {state === "searching" && (
                      <span className="text-[9px] text-slate-400 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t("venture.planImport.checkingEmail")}
                      </span>
                    )}
                    {state === "member" && (
                      <span className="text-[9px] font-bold text-emerald-400">
                        {t("venture.planImport.emailIsMember", { name: lookup.contact?.name || "" })}
                      </span>
                    )}
                    {state === "new" && (
                      <span className="text-[9px] font-bold text-amber-400">
                        {t("venture.planImport.emailNotMember")}
                      </span>
                    )}
                    {state === "error" && (
                      <span className="text-[9px] font-bold text-rose-400">
                        {t("venture.planImport.lookupFailed")}
                      </span>
                    )}

                    {state === "member" && (
                      <button
                        type="button"
                        onClick={() => linkExisting(entry, lookup.contact)}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[var(--brand-orange)] text-black"
                      >
                        {t("venture.planImport.linkMember")}
                      </button>
                    )}
                    {state === "new" && (
                      <button
                        type="button"
                        disabled={inviting}
                        onClick={() => addAndInvite(entry.name)}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {inviting && <Loader2 className="w-3 h-3 animate-spin" />}
                        {t("venture.planImport.invitePerson")}
                      </button>
                    )}
                  </div>

                  {isOpen && <p className="text-[10px] text-slate-400">{t("venture.planImport.emailDecidesHint")}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
            {t("venture.planImport.unplaced")}
          </p>
          <ul className="space-y-1">
            {unplaced.map((item, index) => (
              <li key={`${item.location}-${index}`} className="text-[10px] text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-primary)]">{item.location}</span> — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(draft.warnings || []).length > 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
            {t("venture.planImport.warnings")}
          </p>
          <ul className="space-y-1">
            {(draft.warnings || []).map((warning, index) => (
              <li key={index} className="text-[10px] text-[var(--text-secondary)] flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The correction chat. Saying "MS02 starts too early" is faster than
          hunting the field, and the analyst returns the WHOLE plan with only
          that changed — listed, so nothing moves behind the reviewer's back. */}
      <div className="rounded-xl border border-[var(--border-primary)] p-3 space-y-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.planImport.correctTitle")}
        </p>
        <p className="text-[10px] text-slate-400">{t("venture.planImport.correctHint")}</p>
        <textarea
          rows={2}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t("venture.planImport.correctPlaceholder")}
          className={inputClass}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={ask}
            disabled={asking || !instruction.trim()}
            className="px-3 py-1.5 rounded-lg border border-brand-orange/40 text-[var(--brand-orange)] text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
          >
            {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {t(asking ? "venture.planImport.correcting" : "venture.planImport.correct")}
          </button>
        </div>

        {suggestion && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 space-y-2">
            {suggestion.notes && <p className="text-[11px] text-[var(--text-primary)]">{suggestion.notes}</p>}
            {suggestion.changes.length === 0 ? (
              <p className="text-[10px] text-slate-400">{t("venture.planImport.noChanges")}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {t("venture.planImport.changesCount", { n: suggestion.changes.length })}
                </p>
                <ul className="space-y-0.5 max-h-56 overflow-y-auto">
                  {suggestion.changes.map((change, index) => (
                    <li key={index} className="text-[10px] text-[var(--text-secondary)]">
                      <span className="font-bold text-[var(--text-primary)]">
                        {change.target || change.scope}
                      </span>{" "}
                      <span className="text-slate-500">{change.field}</span>: {showValue(change.from)} →{" "}
                      {showValue(change.to)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 text-[9px] font-black uppercase tracking-widest"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={keepSuggestion}
                disabled={suggestion.changes.length === 0}
                className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {t("venture.planImport.keepChanges")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500">{t("venture.planImport.nextStep")}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying || saving}
            className="px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          >
            {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {t(applying ? "venture.planImport.applying" : "venture.planImport.apply")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || applying}
            className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {t("venture.planImport.saveReview")}
          </button>
        </div>
      </div>

      {/* One shared suggestion list: every owner field searches through it. */}
      <datalist id="plan-import-owner-options">
        {contactOptions.map((contact) => (
          <option key={contact.cid} value={contact.name || contact.email}>
            {contact.email}
          </option>
        ))}
      </datalist>
    </div>
  );
}
