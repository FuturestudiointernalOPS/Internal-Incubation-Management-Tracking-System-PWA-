"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useState } from "react";
import { Check, Lock, RefreshCw, Trash2, X } from "lucide-react";
import { notify } from "@/lib/notify";
import { LEVELS } from "./constants";
import { Btn, NoteBox, SidePanel, Tabs } from "./ui";
import { usePerm } from "./store";

/** PROFILS — matrice capacités × profils, catalogue, rôles contextuels, re-dérivation. */
export default function Profils({ sub, onSub }) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Profils</h1>
        <p className="text-sm text-[var(--text-secondary)]">Que reçoit une fonction par défaut ?</p>
      </header>

      <Tabs
        items={[
          { key: "matrice", label: "Capacités" },
          { key: "contextuels", label: "Rôles contextuels" },
        ]}
        value={sub}
        onChange={onSub}
      />

      {sub === "contextuels" ? <ContextRolesTab /> : <CapabilitiesTab />}
    </div>
  );
}

function CapabilitiesTab() {
  const { features, profiles, eligibility, actions } = usePerm();
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState("");
  const [blocked, setBlocked] = useState(null);

  const capsOf = (profile) => drafts[profile.key] ?? profile.capabilities ?? {};

  const cycle = (profile, moduleKey, cap) => {
    setDrafts((prev) => {
      const base = prev[profile.key] ?? JSON.parse(JSON.stringify(profile.capabilities || {}));
      const next = { ...base, [moduleKey]: { ...(base[moduleKey] || {}) } };
      const current = next[moduleKey][cap] ?? 0;
      const value = current >= 5 ? 0 : current + 1;
      if (value === 0) delete next[moduleKey][cap];
      else next[moduleKey][cap] = value;
      if (cap !== "view" && value > 0 && !next[moduleKey].view) next[moduleKey].view = 1;
      if (Object.keys(next[moduleKey]).length === 0) delete next[moduleKey];
      return { ...prev, [profile.key]: next };
    });
  };

  const dirty = (profile) => JSON.stringify(capsOf(profile)) !== JSON.stringify(profile.capabilities || {});

  const save = async (profile) => {
    setBusyKey(profile.key);
    try {
      const data = await actions.saveProfile({
        key: profile.key,
        allowed_roles: profile.allowedRoles,
        is_active: profile.active,
        capabilities: capsOf(profile),
      });
      if (data?.success) {
        notify("success", `Profil « ${profile.label} » enregistré.`);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[profile.key];
          return next;
        });
      } else {
        notify("error", data?.error === "errors.ineligibleTemplateCaps" ? "Capacités hors plafond : corrigez l'éligibilité d'abord." : data?.error || "Enregistrement refusé.");
      }
    } finally {
      setBusyKey("");
    }
  };

  const remove = async (profile) => {
    const data = await actions.deleteProfile(profile.key);
    if (data?.success) {
      notify("success", `Profil « ${profile.label} » supprimé.`);
      setBlocked(null);
    } else if (data?.error === "profile_in_use_role_default") {
      setBlocked({ profile, kind: "Rôle par défaut", detail: (data.roles || []).join(", ") });
    } else if (data?.error === "profile_in_use_assignments") {
      setBlocked({ profile, kind: "Attributions", detail: `${data.assignedCount ?? 0} personne(s)` });
    } else if (data?.error === "profile_in_use_context") {
      setBlocked({ profile, kind: "Contextes", detail: `${data.contextCount ?? 0} contexte(s)` });
    } else {
      notify("error", data?.error || "Suppression refusée.");
    }
  };

  const eligible = (profile, featureKey) => eligibility.profile?.[profile.key]?.[featureKey] === "E";

  return (
    <div className="space-y-5">
      <NoteBox>
        Un clic sur un niveau le fait monter (Aucun → Lire → … → Complet → Aucun). La lecture est impliquée par toute
        écriture. Un cadenas signale une capacité que cette identité n'a pas le droit de recevoir (plafond).
      </NoteBox>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="min-w-[15rem] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Capacité</th>
              {profiles.map((profile) => (
                <th key={profile.key} className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {profile.label}
                  {!profile.active && <span className="ml-1 text-[9px] text-[var(--text-tertiary)]">(inactif)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <React.Fragment key={feature.key}>
                <tr className="bg-[var(--surface-2)]">
                  <td colSpan={profiles.length + 1} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{feature.label}</td>
                </tr>
                {feature.modules.flatMap((mod) =>
                  mod.caps.map((cap) => (
                    <tr key={`${mod.key}-${cap}`} className="border-b border-[var(--border-primary)]/60">
                      <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">{mod.label} ▸ <span className="font-bold text-[var(--text-primary)]">{cap}</span></td>
                      {profiles.map((profile) => {
                        const level = capsOf(profile)?.[mod.key]?.[cap] ?? 0;
                        const locked = !eligible(profile, feature.key);
                        return (
                          <td key={profile.key} className="px-3 py-2 text-center">
                            <button
                              onClick={() => !locked && cycle(profile, mod.key, cap)}
                              disabled={locked}
                              title={locked ? `${profile.label} n'est pas éligible à ${feature.label}` : "Cliquer pour changer le niveau"}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                                locked && level > 0
                                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                                  : level > 0
                                    ? "border-[var(--border-primary)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-brand-orange/40"
                                    : "border-dashed border-[var(--border-primary)] text-[var(--text-tertiary)] hover:border-brand-orange/40"
                              } ${locked ? "cursor-not-allowed" : ""}`}
                            >
                              {LEVELS[level].short}
                              {locked && level > 0 && <Lock className="h-3 w-3" aria-hidden="true" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Catalogue</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                <th className="px-4 py-3">Clé</th>
                <th className="px-4 py-3">Contexte</th>
                <th className="px-4 py-3">Rôles de base</th>
                <th className="px-4 py-3 text-center">Actif</th>
                <th className="px-4 py-3 text-center">Capacités</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-3 text-xs text-[var(--text-tertiary)]">Aucun profil.</td></tr>
              ) : profiles.map((profile) => {
                const count = Object.values(capsOf(profile) || {}).reduce((total, group) => total + Object.keys(group).length, 0);
                return (
                  <tr key={profile.key} className="border-b border-[var(--border-primary)]/60">
                    <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{profile.label} <span className="ml-1 font-mono text-[10px] text-[var(--text-tertiary)]">{profile.key}</span></td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{profile.context}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{(profile.allowedRoles || []).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-center">{profile.active ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <X className="mx-auto h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden="true" />}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold tabular-nums text-[var(--text-primary)]">{count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Btn size="sm" disabled={!dirty(profile) || busyKey === profile.key} onClick={() => save(profile)}>Enregistrer</Btn>
                        <Btn size="sm" variant="danger" icon={Trash2} onClick={() => remove(profile)}>Supprimer</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <SidePanel open={Boolean(blocked)} title="Suppression refusée" onClose={() => setBlocked(null)}>
        {blocked && (
          <>
            <NoteBox tone="danger">« {blocked.profile.label} » est encore utilisé : {blocked.kind} — {blocked.detail}.</NoteBox>
            <p className="text-[10px] text-[var(--text-tertiary)]">Retirez d'abord ces usages, puis réessayez.</p>
          </>
        )}
      </SidePanel>
    </div>
  );
}

// ─── Rôles contextuels ──────────────────────────────────────────────────────
function ContextRolesTab() {
  const { contextRoles, contextRoleProfiles, profiles, actions } = usePerm();
  const [busy, setBusy] = useState("");
  const [report, setReport] = useState(null);

  const profileChoices = (contextRoleProfiles.length > 0 ? contextRoleProfiles : profiles.map((profile) => ({ key: profile.key, label: profile.label })));

  const change = async (row, patch) => {
    setBusy(`${row.context}:${row.role}`);
    const data = await actions.saveContextRole({
      context: row.context,
      role_key: row.role,
      profile_key: patch.profileKey !== undefined ? patch.profileKey : row.profileKey,
      is_active: patch.active !== undefined ? patch.active : row.active,
    });
    if (!data?.success) notify("error", data?.error || "Enregistrement refusé.");
    setBusy("");
  };

  const rederive = async () => {
    setBusy("rederive");
    const data = await actions.rederive();
    setReport(data);
    setBusy("");
  };

  return (
    <div className="space-y-4">
      <NoteBox>
        Relie une fonction dans un contexte à un profil : c'est ce qui transforme un lien (« être mentor de ce
        programme ») en droits. Les modifications sont enregistrées immédiatement.
      </NoteBox>

      <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Contexte</th>
              <th className="px-4 py-3">Fonction</th>
              <th className="px-4 py-3">Profil</th>
              <th className="px-4 py-3 text-center">Détenteurs</th>
              <th className="px-4 py-3 text-center">Actif</th>
            </tr>
          </thead>
          <tbody>
            {contextRoles.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-3 text-xs text-[var(--text-tertiary)]">Aucun rôle contextuel.</td></tr>
            ) : contextRoles.map((row) => (
              <tr key={`${row.context}:${row.role}`} className="border-b border-[var(--border-primary)]/60">
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{row.context}</td>
                <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{row.role}</td>
                <td className="px-4 py-3">
                  <select
                    value={row.profileKey || ""}
                    disabled={busy === `${row.context}:${row.role}`}
                    onChange={(event) => change(row, { profileKey: event.target.value || null })}
                    className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  >
                    <option value="">— sans profil</option>
                    {profileChoices.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}
                  </select>
                  {!row.profileKey && <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-400">⚠ sans profil</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs tabular-nums text-[var(--text-secondary)]">{row.holders ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={row.active} disabled={busy === `${row.context}:${row.role}`} onChange={(event) => change(row, { active: event.target.checked })} className="accent-[var(--brand-orange)]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">Re-dériver les droits depuis les liens contextuels</p>
            <p className="text-[10px] text-[var(--text-secondary)]">Recalcule les attributions et applique les écarts.</p>
          </div>
          <Btn icon={RefreshCw} disabled={busy === "rederive"} onClick={rederive}>Exécuter</Btn>
        </div>
        {report && (
          <NoteBox tone="warning">
            Terminé : {report.evaluated ?? 0} évaluées · {(report.applied || []).length} appliqués · {(report.revoked || []).length} retirés
            {report.changes !== undefined ? ` · ${report.changes} changement(s)` : ""}.
          </NoteBox>
        )}
      </section>
    </div>
  );
}
