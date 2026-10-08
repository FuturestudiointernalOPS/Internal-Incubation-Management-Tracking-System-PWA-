"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useState } from "react";
import { Check, Lock, RefreshCw, Trash2, X } from "lucide-react";
import { CONTEXT_ROLES, ELIGIBILITY, FEATURES, LEVELS, PROFILES, profileUses } from "./data";
import { Btn, NoteBox, SidePanel, Tabs } from "./ui";

/**
 * PROFILS — « que reçoit une fonction par défaut ? »
 *
 * Un profil EST son jeu de capacités. La matrice le montre d'un coup d'œil :
 * un clic fait monter un niveau, un cadenas signale une capacité que l'identité
 * n'a pas le droit de recevoir.
 */

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
  const [caps, setCaps] = useState(() => Object.fromEntries(PROFILES.map((profile) => [profile.key, JSON.parse(JSON.stringify(profile.capabilities))])));
  const [toDelete, setToDelete] = useState(null);
  const profiles = PROFILES;

  const cycle = (profileKey, moduleKey, cap) => {
    setCaps((prev) => {
      const next = { ...prev, [profileKey]: { ...(prev[profileKey] || {}) } };
      const current = next[profileKey][moduleKey]?.[cap] ?? 0;
      const value = current >= 5 ? 0 : current + 1;
      next[profileKey][moduleKey] = { ...(next[profileKey][moduleKey] || {}) };
      if (value === 0) delete next[profileKey][moduleKey][cap];
      else next[profileKey][moduleKey][cap] = value;
      // La lecture est impliquée par toute écriture.
      if (cap !== "view" && value > 0 && !next[profileKey][moduleKey].view) next[profileKey][moduleKey].view = 1;
      if (Object.keys(next[profileKey][moduleKey]).length === 0) delete next[profileKey][moduleKey];
      return next;
    });
  };

  const eligible = (profile, featureKey) => ELIGIBILITY[profile.label]?.[featureKey] === "E";

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
              <th className="min-w-[16rem] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Capacité</th>
              {profiles.map((profile) => (
                <th key={profile.key} className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {profile.label}
                  {!profile.active && <span className="ml-1 text-[9px] text-[var(--text-tertiary)]">(inactif)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feature) => (
              <React.Fragment key={feature.key}>
                <tr className="bg-[var(--surface-2)]">
                  <td colSpan={profiles.length + 1} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                    {feature.label}
                  </td>
                </tr>
                {feature.modules.flatMap((module) =>
                  module.caps.map((cap) => (
                    <tr key={`${module.key}-${cap}`} className="border-b border-[var(--border-primary)]/60">
                      <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">{module.label} ▸ <span className="font-bold text-[var(--text-primary)]">{cap}</span></td>
                      {profiles.map((profile) => {
                        const level = caps[profile.key]?.[module.key]?.[cap] ?? 0;
                        const locked = !eligible(profile, feature.key);
                        return (
                          <td key={profile.key} className="px-3 py-2 text-center">
                            <button
                              onClick={() => !locked && cycle(profile.key, module.key, cap)}
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
                <th className="px-4 py-3 text-center">Usages</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const count = Object.values(caps[profile.key] || {}).reduce((total, group) => total + Object.keys(group).length, 0);
                return (
                  <tr key={profile.key} className="border-b border-[var(--border-primary)]/60">
                    <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{profile.label} <span className="ml-1 font-mono text-[10px] text-[var(--text-tertiary)]">{profile.key}</span></td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{profile.context}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{profile.allowedRoles.join(", ")}</td>
                    <td className="px-4 py-3 text-center">{profile.active ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <X className="mx-auto h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden="true" />}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold tabular-nums text-[var(--text-primary)]">{count}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold tabular-nums text-[var(--text-secondary)]">{profile.usages}</td>
                    <td className="px-4 py-3 text-right">
                      <Btn size="sm" variant="danger" icon={Trash2} onClick={() => setToDelete(profile)}>Supprimer</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <SidePanel open={Boolean(toDelete)} title="Suppression refusée" onClose={() => setToDelete(null)}>
        {toDelete && toDelete.usages > 0 ? (
          <>
            <NoteBox tone="danger">
              « {toDelete.label} » est encore utilisé. Le supprimer laisserait des personnes et des rôles sans profil.
            </NoteBox>
            <ul className="space-y-1.5">
              {profileUses(toDelete.key).map((use) => (
                <li key={`${use.kind}-${use.label}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-primary)] px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">{use.kind}</span>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{use.label}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-[var(--text-tertiary)]">Retirez d'abord ces usages, puis réessayez.</p>
          </>
        ) : (
          <NoteBox>Ce profil n'est utilisé nulle part. Sa suppression est sûre.</NoteBox>
        )}
      </SidePanel>
    </div>
  );
}

// ─── Rôles contextuels ──────────────────────────────────────────────────────
function ContextRolesTab() {
  const [rows, setRows] = useState(CONTEXT_ROLES);
  const [rederive, setRederive] = useState(null);

  return (
    <div className="space-y-4">
      <NoteBox>
        Relie une fonction dans un contexte à un profil : c'est ce qui transforme un lien (« être mentor de ce
        programme ») en droits.
      </NoteBox>

      <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Contexte</th>
              <th className="px-4 py-3">Fonction</th>
              <th className="px-4 py-3">Profil</th>
              <th className="px-4 py-3 text-center">Actif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.context}-${row.role}`} className="border-b border-[var(--border-primary)]/60">
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{row.context}</td>
                <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{row.role}</td>
                <td className="px-4 py-3">
                  <select
                    value={row.profile}
                    onChange={(event) => setRows((prev) => prev.map((candidate, i) => (i === index ? { ...candidate, profile: event.target.value } : candidate)))}
                    className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  >
                    {["—", ...PROFILES.map((profile) => profile.label)].map((value) => <option key={value}>{value}</option>)}
                  </select>
                  {row.profile === "—" && <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-400">⚠ sans profil</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(event) => setRows((prev) => prev.map((candidate, i) => (i === index ? { ...candidate, active: event.target.checked } : candidate)))}
                    className="accent-[var(--brand-orange)]"
                  />
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
          <Btn icon={RefreshCw} onClick={() => setRederive({ phase: "preview" })}>Prévisualiser…</Btn>
        </div>
        {rederive?.phase === "preview" && (
          <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">Aperçu : 3 personnes évaluées · 1 droit appliqué · 0 retiré</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Programme Alpha : 1 changement · Venture Z : à jour</p>
            <div className="flex justify-end gap-2">
              <Btn size="sm" variant="ghost" onClick={() => setRederive(null)}>Annuler</Btn>
              <Btn size="sm" variant="primary" onClick={() => setRederive({ phase: "done" })}>Exécuter</Btn>
            </div>
          </div>
        )}
        {rederive?.phase === "done" && (
          <NoteBox tone="warning">Terminé (simulé) : 1 changement appliqué. Aucune donnée réelle n'est modifiée.</NoteBox>
        )}
      </section>
    </div>
  );
}
