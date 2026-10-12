"use client";

import React from "react";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

/**
 * DECISION GATES — the three questions the engine asks, drawn as three cards.
 *
 * Adopted from the prototype: the permission model is three filters in order
 * (eligibility → capability → scope). Showing them as cards, each with its own
 * verdict, is what makes "why is this allowed / refused" legible instead of a
 * wall of text.
 *
 * Purely presentational: it renders the verdicts it is handed and decides
 * nothing. A gate the caller did not evaluate (scope, here) must be shown as
 * neutral, never as a green "allowed", or the screen would claim something the
 * engine never said.
 *
 * gates: [{ key, titleKey, labelKey, tone: "open" | "closed" | "neutral", detail }]
 */

const TONES = {
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  closed: "border-red-500/40 bg-red-500/10 text-red-400",
  neutral: "border-[var(--border-primary)] bg-secondary/40 text-[var(--text-secondary)]",
};

function iconFor(tone) {
  if (tone === "closed") return XCircle;
  if (tone === "open") return CheckCircle2;
  return MinusCircle;
}

export default function DecisionGates({ t, gates = [] }) {
  if (gates.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {gates.map((gate, index) => {
        const Icon = iconFor(gate.tone);
        return (
          <div
            key={gate.key}
            role="group"
            aria-label={t(gate.titleKey)}
            className={`rounded-xl border px-3 py-2.5 space-y-1 ${TONES[gate.tone] || TONES.neutral}`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
              {index + 1} · {t(gate.titleKey)}
            </p>
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t(gate.labelKey)}
            </p>
            {gate.detail && <p className="text-[10px] opacity-80">{gate.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}
