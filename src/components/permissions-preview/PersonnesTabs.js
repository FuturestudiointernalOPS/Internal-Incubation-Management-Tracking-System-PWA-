"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { notify } from "@/lib/notify";
import { LEVELS } from "./constants";
import { Btn, Field, INPUT_CLASS, NoteBox, SidePanel } from "./ui";
import { usePerm } from "./store";

/** Groupes · Administrateurs · Par contexte, sur données réelles. */
export default function PersonnesSubTabs({ sub }) {
  if (sub === "groupes") return <GroupsTable />;
  if (sub === "admins") return <Admins />;
  if (sub === "contexte") return <ContextTable />;
  return null;
}

// ─── Groupes ────────────────────────────────────────────────────────────────
function GroupsTable() {
  const { groupDefaults, eligibilityGroups, moduleIndex } = usePerm();
  const names = Array.from(new Set([...(eligibilityGroups || []), ...groupDefaults.map((row) => row.group_name)])).sort();

  const levelFor = (group, module, capability) =>
    Number(groupDefaults.find((row) => row.group_name === group && row.module === module && row.capability === capability)?.access_level ?? 0);

  const modulesWithCaps = Object.values(moduleIndex);

  return (
    <div className="space-y-4">
      <NoteBox>
        Un groupe ajoute des capacités à toutes les personnes qui en font partie. Elles s'ajoutent à ce que la personne
        détient déjà par son profil, sans jamais le remplacer.
      </NoteBox>
      {names.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">Aucun groupe configuré dans cette base.</p>
      ) : (
        <div className="space-y-3">
          {names.map((name) => {
            const configured = modulesWithCaps
              .map((mod) => ({ mod, caps: mod.caps.filter((cap) => levelFor(name, mod.key, cap) > 0) }))
              .filter((entry) => entry.caps.length > 0);
            return (
              <section key={name} className="space-y-2 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]">{name}</h3>
                {configured.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)]">Aucune capacité configurée pour ce groupe.</p>
                ) : (
                  configured.map(({ mod, caps }) => (
                    <div key={mod.key} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[7rem] text-[10px] font-black uppercase tracking-wide text-[var(--text-secondary)]">{mod.label}</span>
                      {caps.map((cap) => {
                        const level = levelFor(name, mod.key, cap);
                        return (
                          <span key={cap} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                            {cap} · {LEVELS[level].label}
                          </span>
                        );
                      })}
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Administrateurs ────────────────────────────────────────────────────────
function Admins() {
  const { people, actions } = usePerm();
  const [modal, setModal] = useState(null); // { action, person }
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const supers = people.filter((person) => person.isSuperAdmin);
  const candidates = people.filter((person) => !person.isSuperAdmin);
  const valid = reason.trim() && confirmText.trim().toUpperCase() === "CONFIRMER";

  const submit = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      const data = await actions.superAdmin(modal.person.id, modal.action === "promote_super_admin" ? "promote_super_admin" : "remove_super_admin");
      if (data?.success) notify("success", `Fait — ${modal.person.name} mis à jour. Consigné au journal.`);
      else notify("error", data?.error || "L'action a échoué.");
    } catch (error) {
      notify("error", error.message || "L'action a échoué.");
    } finally {
      setBusy(false);
      setModal(null);
      setReason("");
      setConfirmText("");
    }
  };

  return (
    <div className="space-y-4">
      <NoteBox tone="warning">
        Un super administrateur contourne l'éligibilité et détient tous les droits par défaut. Le promouvoir ou le
        retirer est l'action la plus sensible du centre : motif obligatoire et saisie de CONFIRMER.
      </NoteBox>

      <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Super administrateurs</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {supers.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-3 text-xs text-[var(--text-tertiary)]">Aucun super administrateur.</td></tr>
            ) : supers.map((person) => (
              <tr key={person.id} className="border-b border-[var(--border-primary)]/60">
                <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{person.name} <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{person.email}</span></td>
                <td className="px-4 py-3 text-right">
                  <Btn variant="danger" icon={UserMinus} onClick={() => setModal({ action: "remove_super_admin", person })}>Retirer le statut…</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select id="promote-target" className={INPUT_CLASS} defaultValue="" aria-label="Personne à promouvoir">
          <option value="" disabled>Choisir une personne…</option>
          {candidates.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
        <Btn
          variant="primary"
          icon={UserPlus}
          onClick={() => {
            const select = document.getElementById("promote-target");
            const person = candidates.find((candidate) => candidate.id === select?.value);
            if (person) setModal({ action: "promote_super_admin", person });
          }}
        >
          Promouvoir…
        </Btn>
      </div>

      <SidePanel open={Boolean(modal)} title={modal?.action === "remove_super_admin" ? "Retirer le statut de super administrateur" : "Promouvoir super administrateur"} onClose={() => setModal(null)}>
        {modal && (
          <>
            <NoteBox tone="danger">{modal.person.name} · {modal.person.email}</NoteBox>
            <Field label="Motif (obligatoire)">
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className={`${INPUT_CLASS} w-full`} />
            </Field>
            <Field label="Tapez CONFIRMER">
              <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="CONFIRMER" className={`${INPUT_CLASS} w-full`} />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setModal(null)}>Annuler</Btn>
              <Btn variant="danger" disabled={!valid || busy} onClick={submit}>Confirmer</Btn>
            </div>
          </>
        )}
      </SidePanel>
    </div>
  );
}

// ─── Par contexte ───────────────────────────────────────────────────────────
function ContextTable() {
  const { contextRoles } = usePerm();
  const [context, setContext] = useState("");
  const contexts = Array.from(new Set(contextRoles.map((row) => row.context)));
  const activeContext = context || contexts[0] || "";
  const rows = contextRoles.filter((row) => row.context === activeContext);

  return (
    <div className="space-y-4">
      <NoteBox>
        Les rôles contextuels : être mentor de ce programme, fondateur de cette venture. Le nombre de détenteurs est lu
        sur les attributions réelles.
      </NoteBox>
      <select value={activeContext} onChange={(event) => setContext(event.target.value)} className={INPUT_CLASS} aria-label="Choisir un contexte">
        {contexts.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Fonction</th>
              <th className="px-4 py-3">Profil reçu</th>
              <th className="px-4 py-3 text-center">Détenteurs</th>
              <th className="px-4 py-3 text-center">Actif</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-3 text-xs text-[var(--text-tertiary)]">Aucun rôle pour ce contexte.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.role} className="border-b border-[var(--border-primary)]/60">
                <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{row.role}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                  {row.profileName || row.profileKey || <span className="text-amber-400">⚠ sans profil</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs tabular-nums text-[var(--text-secondary)]">{row.holders ?? "—"}</td>
                <td className="px-4 py-3 text-center text-xs font-bold">{row.active ? <span className="text-emerald-400">Actif</span> : <span className="text-[var(--text-tertiary)]">Inactif</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
