"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useMemo, useState } from "react";
import { ShieldQuestion } from "lucide-react";
import { LEVELS, GRANT_KEYS, buildGates, effectiveOf, sourceOf } from "./constants";
import { Btn, Field, GateThree, INPUT_CLASS, NoteBox, SidePanel } from "./ui";
import { usePerm } from "./store";

/**
 * VÉRIFICATEUR D'ACCÈS — données réelles. Choisir une personne, une action et
 * un niveau, voir si le moteur autoriserait, et quelles portes décident.
 */
export default function Checker({ open, onClose }) {
  const { people, features, moduleToFeature } = usePerm();
  const modules = useMemo(() => features.flatMap((feature) => feature.modules), [features]);

  const [personId, setPersonId] = useState("");
  const [moduleKey, setModuleKey] = useState("");
  const [capability, setCapability] = useState("");
  const [required, setRequired] = useState(3);
  const [record, setRecord] = useState("");
  const [result, setResult] = useState(null);

  const effectivePersonId = personId || people[0]?.id || "";
  const effectiveModuleKey = moduleKey || modules[0]?.key || "";
  const moduleCaps = modules.find((mod) => mod.key === effectiveModuleKey)?.caps || [];
  const effectiveCapability = moduleCaps.includes(capability) ? capability : moduleCaps[0] || "";

  const run = () => {
    const person = people.find((candidate) => candidate.id === effectivePersonId);
    if (!person) return;
    const feature = moduleToFeature[effectiveModuleKey];
    const eligible = person.isSuperAdmin || person.eligibility?.[feature] === true;
    const level = effectivePersonId ? effectiveOf(person.sources, effectiveModuleKey, effectiveCapability) : 0;
    const restricted = sourceOf(person.sources, effectiveModuleKey, effectiveCapability) === "Restriction";
    setResult({
      allowed: eligible && !restricted && level >= required,
      gates: buildGates({ isSuperAdmin: person.isSuperAdmin, eligible, level: person.isSuperAdmin ? 5 : level, restricted, required }),
    });
  };

  return (
    <SidePanel open={open} title="Vérifier un accès" onClose={onClose}>
      <NoteBox>
        Choisissez une personne, une action et un niveau, puis voyez si le moteur l'autoriserait — et laquelle des trois
        portes décide. Lecture seule : rien n'est accordé ici.
      </NoteBox>

      <Field label="Personne">
        <select value={effectivePersonId} onChange={(event) => { setPersonId(event.target.value); setResult(null); }} className={`${INPUT_CLASS} w-full`}>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Action (sous-section)">
          <select value={effectiveModuleKey} onChange={(event) => { setModuleKey(event.target.value); setCapability(""); setResult(null); }} className={`${INPUT_CLASS} w-full`}>
            {modules.map((mod) => <option key={mod.key} value={mod.key}>{mod.label}</option>)}
          </select>
        </Field>
        <Field label="Droit">
          <select value={effectiveCapability} onChange={(event) => { setCapability(event.target.value); setResult(null); }} className={`${INPUT_CLASS} w-full`}>
            {moduleCaps.map((cap) => <option key={cap} value={cap}>{cap}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Niveau requis">
          <select value={required} onChange={(event) => { setRequired(Number(event.target.value)); setResult(null); }} className={`${INPUT_CLASS} w-full`}>
            {GRANT_KEYS.map((value) => <option key={value} value={value}>{value} · {LEVELS[value].label}</option>)}
          </select>
        </Field>
        <Field label="Enregistrement (optionnel)">
          <input value={record} onChange={(event) => setRecord(event.target.value)} placeholder="ex. Programme Alpha" className={`${INPUT_CLASS} w-full`} />
        </Field>
      </div>

      <Btn variant="primary" icon={ShieldQuestion} onClick={run} className="w-full justify-center">Vérifier</Btn>

      {result && (
        <div className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${result.allowed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
            {result.allowed ? "Autorisé" : "Refusé"}
          </span>
          <GateThree gates={result.gates} />
          <p className="text-[10px] text-[var(--text-tertiary)]">
            La portée n'est pas évaluée ici : elle se vérifie sur un enregistrement réel, dans le banc de test des Règles.
          </p>
        </div>
      )}
    </SidePanel>
  );
}
