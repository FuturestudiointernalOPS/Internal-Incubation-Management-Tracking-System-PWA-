"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useMemo, useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { CONTEXT_GROUPS, LEVELS, PEOPLE, PERSON_BY_ID } from "./data";
import { Btn, Field, INPUT_CLASS, NoteBox, SidePanel } from "./ui";

/**
 * Les trois registres people-wide : Groupes, Administrateurs, Par contexte.
 */

export default function PersonnesSubTabs({ sub, onOpenPerson }) {
  if (sub === "groupes") return <GroupsTable />;
  if (sub === "admins") return <Admins />;
  if (sub === "contexte") return <ContextTable onOpenPerson={onOpenPerson} />;
  return null;
}

// ─── Groupes ────────────────────────────────────────────────────────────────
function GroupsTable() {
  const groups = useMemo(() => {
    const map = new Map();
    for (const person of PEOPLE) map.set(person.group, (map.get(person.group) ?? 0) + 1);
    return Array.from(map.entries());
  }, []);
  const rollup = { "Équipe studio": { finance: 1, ventures: 1 }, Mentorat: {}, "Cohorte A": {}, "Venture Z": {} };

  return (
    <div className="space-y-4">
      <NoteBox>
        Un groupe ajoute des capacités à toutes les personnes qui en font partie. Elles s'ajoutent à ce que la personne
        détient déjà par son profil, sans jamais le remplacer.
      </NoteBox>
      <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Groupe</th>
              <th className="px-4 py-3 text-center">Membres</th>
              <th className="px-4 py-3">Capacités du groupe</th>
              <th className="px-4 py-3">Plafonds</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([name, count]) => {
              const caps = rollup[name] ?? {};
              const entries = Object.entries(caps);
              return (
                <tr key={name} className="border-b border-[var(--border-primary)]/60">
                  <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{name}</td>
                  <td className="px-4 py-3 text-center text-xs tabular-nums text-[var(--text-secondary)]">{count}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {entries.length === 0
                      ? <span className="text-[var(--text-tertiary)]">Aucune capacité configurée</span>
                      : entries.map(([mod, lvl]) => `${mod} (${LEVELS[lvl].label})`).join(" · ")}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-[var(--text-tertiary)]">hérités du rôle/profil</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Administrateurs ────────────────────────────────────────────────────────
function Admins() {
  const [promote, setPromote] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const supers = PEOPLE.filter((person) => person.isSuperAdmin);
  const candidates = PEOPLE.filter((person) => !person.isSuperAdmin);

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
            {supers.map((person) => (
              <tr key={person.id} className="border-b border-[var(--border-primary)]/60">
                <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">
                  {person.name} <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{person.email}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Btn variant="danger" icon={UserMinus} onClick={() => setRemoveOpen(true)}>Retirer le statut…</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Btn variant="primary" icon={UserPlus} onClick={() => setPromote(true)}>Promouvoir…</Btn>

      <SidePanel open={promote} title="Promouvoir super administrateur" onClose={() => setPromote(false)}>
        <Field label="Personne">
          <select className={`${INPUT_CLASS} w-full`}>
            {candidates.map((person) => <option key={person.id}>{person.name}</option>)}
          </select>
        </Field>
        <CriticalBlock reason={reason} setReason={setReason} confirmText={confirmText} setConfirmText={setConfirmText} onConfirm={() => setPromote(false)} />
      </SidePanel>

      <SidePanel open={removeOpen} title="Retirer le statut de super administrateur" onClose={() => setRemoveOpen(false)}>
        <NoteBox tone="danger">Cette personne perdra le contournement et tous ses droits par défaut.</NoteBox>
        <CriticalBlock reason={reason} setReason={setReason} confirmText={confirmText} setConfirmText={setConfirmText} onConfirm={() => setRemoveOpen(false)} />
      </SidePanel>
    </div>
  );
}

function CriticalBlock({ reason, setReason, confirmText, setConfirmText, onConfirm }) {
  const valid = reason.trim() && confirmText.trim().toUpperCase() === "CONFIRMER";
  return (
    <>
      <Field label="Motif (obligatoire)">
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className={`${INPUT_CLASS} w-full`} />
      </Field>
      <Field label="Tapez CONFIRMER">
        <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="CONFIRMER" className={`${INPUT_CLASS} w-full`} />
      </Field>
      <div className="flex justify-end">
        <Btn variant="danger" disabled={!valid} onClick={onConfirm}>Confirmer</Btn>
      </div>
    </>
  );
}

// ─── Par contexte ───────────────────────────────────────────────────────────
function ContextTable({ onOpenPerson }) {
  const [groupKey, setGroupKey] = useState(CONTEXT_GROUPS[0].key);
  const group = CONTEXT_GROUPS.find((candidate) => candidate.key === groupKey);
  return (
    <div className="space-y-4">
      <select value={groupKey} onChange={(event) => setGroupKey(event.target.value)} className={INPUT_CLASS} aria-label="Choisir un contexte">
        {CONTEXT_GROUPS.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.kind} · {candidate.name}</option>)}
      </select>
      <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Personne</th>
              <th className="px-4 py-3">Fonction</th>
              <th className="px-4 py-3">Profil reçu</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {group.holders.map((holder) => {
              const person = PERSON_BY_ID[holder.personId];
              const expiring = holder.status.startsWith("Expire");
              return (
                <tr key={holder.personId} onClick={() => onOpenPerson(holder.personId)} className="cursor-pointer border-b border-[var(--border-primary)]/60 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{person.name}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{holder.functionName}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{holder.profile}</td>
                  <td className={`px-4 py-3 text-xs font-bold ${expiring ? "text-amber-400" : "text-emerald-400"}`}>{holder.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
