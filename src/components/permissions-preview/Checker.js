"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useState } from "react";
import { ShieldQuestion } from "lucide-react";
import {
  ALL_MODULES,
  GRANT_KEYS,
  LEVELS,
  MODULE_BY_KEY,
  PEOPLE,
  PERSON_BY_ID,
  effectiveOf,
  eligibleOf,
  gatesFor,
  sourceOf,
} from "./data";
import { Btn, Field, GateThree, INPUT_CLASS, NoteBox, SidePanel } from "./ui";

/**
 * VÉRIFICATEUR D'ACCÈS (panneau latéral).
 *
 * Choisir une personne, une action et un enregistrement, puis voir si le moteur
 * l'autoriserait — et laquelle des trois portes décide. Lecture seule.
 */
export default function Checker({ open, onClose }) {
  const [personId, setPersonId] = useState("awa");
  const [moduleKey, setModuleKey] = useState("programmes");
  const [capability, setCapability] = useState("view");
  const [required, setRequired] = useState(3);
  const [record, setRecord] = useState("");
  const [result, setResult] = useState(null);

  const capList = MODULE_BY_KEY[moduleKey]?.caps ?? [];

  const run = () => {
    const person = PERSON_BY_ID[personId];
    const level = person.isSuperAdmin ? 5 : effectiveOf(person.sources, moduleKey, capability);
    const eligible = eligibleOf(person, MODULE_BY_KEY[moduleKey]?.feature);
    const restricted = sourceOf(person.sources, moduleKey, capability) === "Restriction";
    setResult({
      allowed: eligible && !restricted && level >= required,
      gates: gatesFor(person, moduleKey, capability, required),
    });
  };

  return (
    <SidePanel open={open} title="Vérifier un accès" onClose={onClose}>
      <NoteBox>
        Choisissez une personne, une action et un enregistrement, puis voyez si le moteur l'autoriserait — et laquelle
        des trois portes décide. Lecture seule : rien n'est accordé ici.
      </NoteBox>

      <Field label="Personne">
        <select value={personId} onChange={(event) => setPersonId(event.target.value)} className={`${INPUT_CLASS} w-full`}>
          {PEOPLE.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Action (sous-section)">
          <select
            value={moduleKey}
            onChange={(event) => { setModuleKey(event.target.value); setCapability(MODULE_BY_KEY[event.target.value].caps[0]); }}
            className={`${INPUT_CLASS} w-full`}
          >
            {ALL_MODULES.map((mod) => <option key={mod.key} value={mod.key}>{mod.label}</option>)}
          </select>
        </Field>
        <Field label="Droit">
          <select value={capability} onChange={(event) => setCapability(event.target.value)} className={`${INPUT_CLASS} w-full`}>
            {capList.map((cap) => <option key={cap} value={cap}>{cap}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Niveau requis">
          <select value={required} onChange={(event) => setRequired(Number(event.target.value))} className={`${INPUT_CLASS} w-full`}>
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
          {record && (
            <p className="text-[10px] text-[var(--text-tertiary)]">
              Portée non évaluée ici : la décision sur « {record} » est rendue par le moteur, jamais devinée par l'écran.
            </p>
          )}
        </div>
      )}
    </SidePanel>
  );
}
