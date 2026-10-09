"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, UserCog } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { defer } from "./effectUtils";
import buildEditableModules from "@/components/permissions/permission-center/shared/buildEditableModules";
import ProfileCatalogue from "@/components/permissions/profiles-view/ProfileCatalogue";
import ProfileCreateForm from "@/components/permissions/profiles-view/ProfileCreateForm";
import ProfileCapabilityEditor from "@/components/permissions/profiles-view/ProfileCapabilityEditor";

/**
 * PHASE A → profiles takeover (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * The SINGLE Templates screen. A profile is the contextual function someone
 * occupies (Participant, Founder, Facilitator…) AND — since the takeover — the
 * capability set it grants. This screen:
 *   • lists the catalogue (label, context, allowed baseline roles, active, notes);
 *   • creates a profile from a free key + label + context;
 *   • deletes a profile the server still finds in use (refused, with the reason);
 *   • edits one profile's capabilities on a level matrix.
 *
 * Profiles are DYNAMIC: the catalogue comes from the API, the key is a free
 * identifier and the capabilities live in the database — nothing is hardcoded.
 *
 * Every state value and every write stay here; the three markup islands live in
 * `profiles-view/` and read this screen through `ctx`.
 */

/** The baseline roles the toggle UI offers (super_admin is a valid value). */
const BASELINE_ROLES = ["super_admin", "staff", "member"];

const rowKey = (row) => row.key;

export default function ProfilesView() {
  const { t } = useI18n();
  const { confirm } = useDialogs();

  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Creation form.
  const [createOpen, setCreateOpen] = useState(false);
  const [newProfile, setNewProfile] = useState({ key: "", label: "", context: "", allowed_roles: [] });
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Capability editor (one profile at a time).
  const [selectedKey, setSelectedKey] = useState("");
  const [draftCaps, setDraftCaps] = useState({});
  const [savedCaps, setSavedCaps] = useState({});
  const [capsLoading, setCapsLoading] = useState(false);

  const apply = useCallback((json) => {
    setData(json);
    const next = {};
    for (const row of json.profiles || []) {
      next[rowKey(row)] = {
        allowed_roles: Array.isArray(row.allowed_roles) ? [...row.allowed_roles] : [],
        is_active: Number(row.is_active) === 1 || row.is_active === true,
        notes: row.notes || "",
      };
    }
    setDrafts(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/engineering/permissions/profiles");
      const json = await res.json();
      if (json.success) apply(json);
      else setErr(json.error || t("engineering.permissions.profilesLoadFailed"));
    } catch {
      setErr(t("engineering.permissions.profilesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apply, t]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  const availableModules = useMemo(() => buildEditableModules(data?.modules || {}), [data]);

  const openProfile = useCallback(async (key) => {
    if (!key) return;
    setSelectedKey(key);
    setCapsLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/engineering/permissions/profiles?key=${encodeURIComponent(key)}`);
      const json = await res.json();
      if (json.success) {
        const caps = json.profile?.capabilities || {};
        setSavedCaps(caps);
        setDraftCaps(JSON.parse(JSON.stringify(caps)));
      } else {
        setErr(json.error || t("engineering.permissions.profilesLoadFailed"));
      }
    } catch {
      setErr(t("engineering.permissions.profilesLoadFailed"));
    } finally {
      setCapsLoading(false);
    }
  }, [t]);

  const closeCaps = () => {
    setSelectedKey("");
    setDraftCaps({});
    setSavedCaps({});
  };

  /**
   * "Default for" — which baseline roles receive this profile automatically.
   * A role can only default to ONE profile, so choosing this one for a role
   * replaces whatever that role pointed at.
   */
  const setRoleDefault = async (role, profileKey) => {
    setErr("");
    setMsg("");
    setBusyKey(`role:${role}`);
    try {
      const res = await fetch("/api/engineering/permissions/profile-role-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_name: role, profile_key: profileKey }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(
          json.error === "errors.ineligibleTemplateCaps"
            ? t("engineering.permissions.profilesCapsIneligible", { role })
            : json.error || t("engineering.permissions.roleDefaultFailed"),
        );
      }
      setMsg(t("engineering.permissions.roleDefaultSaved", { role }));
      await load();
    } catch (error) {
      setErr(error.message || t("engineering.permissions.roleDefaultFailed"));
    } finally {
      setBusyKey("");
    }
  };

  // ── Catalogue edits (roles / active / notes) ────────────────────────────────

  const toggleRole = (row, role) => {
    setDrafts((prev) => {
      const draft = prev[rowKey(row)] || { allowed_roles: [] };
      const has = (draft.allowed_roles || []).includes(role);
      const allowed_roles = has
        ? draft.allowed_roles.filter((item) => item !== role)
        : [...(draft.allowed_roles || []), role];
      return { ...prev, [rowKey(row)]: { ...draft, allowed_roles } };
    });
    setMsg("");
  };

  const setField = (row, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [rowKey(row)]: { ...prev[rowKey(row)], [field]: value },
    }));
    setMsg("");
  };

  const isDirty = (row) => {
    const draft = drafts[rowKey(row)];
    if (!draft) return false;
    const current = Array.isArray(row.allowed_roles) ? row.allowed_roles : [];
    const draftRoles = draft.allowed_roles || [];
    const sameRoles =
      draftRoles.length === current.length &&
      draftRoles.every((role) => current.includes(role));
    return (
      !sameRoles ||
      draft.is_active !== (Number(row.is_active) === 1 || row.is_active === true) ||
      draft.notes !== (row.notes || "")
    );
  };

  const save = async (row) => {
    const draft = drafts[rowKey(row)];
    if (!draft) return;
    const key = rowKey(row);
    setBusyKey(key);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/engineering/permissions/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: row.key,
          allowed_roles: draft.allowed_roles || [],
          is_active: draft.is_active,
          notes: draft.notes,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "save failed");
      setMsg(t("engineering.permissions.profilesSaved"));
      await load();
    } catch (error) {
      setErr(error.message || t("engineering.permissions.profilesSaveFailed"));
    } finally {
      setBusyKey("");
    }
  };

  // ── Capabilities ────────────────────────────────────────────────────────────

  const setLevel = (module, capability, level) => {
    setDraftCaps((prev) => {
      const next = { ...prev, [module]: { ...(prev[module] || {}) } };
      if (level <= 0) delete next[module][capability];
      else next[module][capability] = level;
      // View is the base capability (the server normalizes this too, but the
      // screen must not show a write without its implied read).
      if (capability !== "view" && level > 0 && !next[module].view) next[module].view = 1;
      if (Object.keys(next[module]).length === 0) delete next[module];
      return next;
    });
    setMsg("");
  };

  const saveCaps = async () => {
    if (!selectedKey) return;
    const row = (data?.profiles || []).find((p) => p.key === selectedKey);
    if (!row) return;
    const draft = drafts[selectedKey];
    setBusyKey(selectedKey);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/engineering/permissions/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selectedKey,
          allowed_roles: draft?.allowed_roles ?? row.allowed_roles ?? [],
          is_active: draft?.is_active ?? (Number(row.is_active) === 1),
          notes: draft?.notes ?? row.notes ?? "",
          capabilities: draftCaps,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error === "errors.ineligibleTemplateCaps") {
          throw new Error(t("engineering.permissions.profilesCapsIneligible", { role: json.role || "" }));
        }
        throw new Error(json.error || "save failed");
      }
      setMsg(t("engineering.permissions.profilesCapsSaved"));
      await load();
      await openProfile(selectedKey);
    } catch (error) {
      setErr(error.message || t("engineering.permissions.profilesSaveFailed"));
    } finally {
      setBusyKey("");
    }
  };

  // ── Create / delete ─────────────────────────────────────────────────────────

  const toggleNewRole = (role) => {
    setNewProfile((prev) => {
      const has = prev.allowed_roles.includes(role);
      return {
        ...prev,
        allowed_roles: has
          ? prev.allowed_roles.filter((item) => item !== role)
          : [...prev.allowed_roles, role],
      };
    });
  };

  const openCreate = () => {
    setCreateOpen(true);
    setCreateErr("");
    setNewProfile({ key: "", label: "", context: data?.contexts?.[0] || "", allowed_roles: ["member"] });
  };
  const closeCreate = () => setCreateOpen(false);

  const submitCreate = async () => {
    setCreateBusy(true);
    setCreateErr("");
    const createdKey = newProfile.key;
    try {
      const res = await fetch("/api/engineering/permissions/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || t("engineering.permissions.profileCreateFailed"));
      setMsg(t("engineering.permissions.profileCreated", { label: newProfile.label }));
      setCreateOpen(false);
      setNewProfile({ key: "", label: "", context: "", allowed_roles: [] });
      await load();
      await openProfile(createdKey);
    } catch (error) {
      setCreateErr(error.message || t("engineering.permissions.profileCreateFailed"));
    } finally {
      setCreateBusy(false);
    }
  };

  const deleteBlockedMessage = (json) => {
    if (json?.error === "profile_in_use_role_default") {
      return t("engineering.permissions.profileDeleteBlockedRoleDefault", {
        roles: (json.roles || []).join(", "),
      });
    }
    if (json?.error === "profile_in_use_assignments") {
      return t("engineering.permissions.profileDeleteBlockedAssignments", { count: json.assignedCount ?? 0 });
    }
    if (json?.error === "profile_in_use_context") {
      return t("engineering.permissions.profileDeleteBlockedContext", { count: json.contextCount ?? 0 });
    }
    return json?.error || t("engineering.permissions.profileDeleteFailed");
  };

  const removeProfile = async (row) => {
    const label = row.label || row.key;
    const accepted = await confirm({
      title: t("engineering.permissions.profilesDeleteTitle"),
      message: t("engineering.permissions.profilesDeleteConfirm", { label }),
      tone: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    setErr("");
    setMsg("");
    try {
      const res = await fetch(
        `/api/engineering/permissions/profiles?key=${encodeURIComponent(row.key)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!json.success) throw new Error(deleteBlockedMessage(json));
      setMsg(t("engineering.permissions.profileDeleted", { label }));
      if (selectedKey === row.key) closeCaps();
      await load();
    } catch (error) {
      setErr(error.message || t("engineering.permissions.profileDeleteFailed"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  const profiles = data?.profiles || [];
  const contexts = data?.contexts || [];
  const capsDirty = selectedKey && JSON.stringify(draftCaps) !== JSON.stringify(savedCaps);

  const ctx = {
    t,
    profiles,
    contexts,
    drafts,
    busyKey,
    isDirty,
    profileLabel: (row) => row.label || (row.label_key ? t(row.label_key) : String(row.key).replace(/_/g, " ")),
    baselineRoles: BASELINE_ROLES,
    roleDefaults: data?.role_defaults || {},
    setRoleDefault,
    toggleRole,
    setField,
    save,
    removeProfile,
    openProfile,
    selectedKey,
    availableModules,
    draftCaps,
    capsLoading,
    capsDirty,
    setLevel,
    saveCaps,
    closeCaps,
    createOpen,
    newProfile,
    setNewProfile,
    createBusy,
    createErr,
    toggleNewRole,
    submitCreate,
    closeCreate,
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4 space-y-1.5">
        <p className="text-xs font-bold text-[var(--text-primary)] leading-relaxed">
          {t("engineering.permissions.profilesHint")}
        </p>
        <p className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          <UserCog className="w-3 h-3 text-[var(--brand-orange)]" />
          {t("engineering.permissions.profilesStatusPill")}
        </p>
      </div>

      {err && (
        <p className="flex items-center gap-2 text-xs font-bold text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" /> {err}
        </p>
      )}
      {message && (
        <p className="flex items-center gap-2 text-xs font-bold text-green-500">
          <CheckCircle2 className="w-3.5 h-3.5" /> {message}
        </p>
      )}

      {!createOpen && (
        <button
          onClick={openCreate}
          className="self-start px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
        >
          {t("engineering.permissions.profilesCreateToggle")}
        </button>
      )}
      <ProfileCreateForm ctx={ctx} />

      <ProfileCatalogue ctx={ctx} />

      <ProfileCapabilityEditor ctx={ctx} />

      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t("engineering.permissions.profilesReasonPlaceholder")}
        className="w-full max-w-xl rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:border-[var(--brand-orange)]"
      />
    </div>
  );
}
