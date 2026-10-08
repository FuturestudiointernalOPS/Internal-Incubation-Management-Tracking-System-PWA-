"use client";

import React, { useState } from "react";
import { CheckCircle2, Info, MinusCircle, X, XCircle } from "lucide-react";
import { LEVELS } from "./data";

/**
 * Composants partagés du Centre de permissions.
 *
 * Un seul vocabulaire visuel pour toute la vue : la pastille de niveau, le badge
 * de source, les trois portes et le badge de risque se retrouvent partout à
 * l'identique. Aucune couleur n'est codée en dur — tout passe par les jetons de
 * thème du projet, donc le clair et le sombre suivent automatiquement.
 */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60";

// ─── Infobulle de glossaire ─────────────────────────────────────────────────
export function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`text-[var(--text-tertiary)] hover:text-[var(--brand-orange)] ${FOCUS} rounded-full`}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] p-2.5 text-[11px] leading-relaxed font-medium text-[var(--text-secondary)] shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Encart d'explication ───────────────────────────────────────────────────
export function NoteBox({ children, tone = "brand" }) {
  const accent =
    tone === "warning"
      ? "border-l-amber-400"
      : tone === "danger"
        ? "border-l-red-400"
        : "border-l-[var(--brand-orange)]";
  return (
    <div className={`rounded-lg border border-[var(--border-primary)] border-l-[3px] ${accent} bg-[var(--surface-2)] px-4 py-3`}>
      <div className="text-xs font-medium leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </div>
  );
}

// ─── Pastille de niveau ─────────────────────────────────────────────────────
const LEVEL_TONE = {
  1: "bg-blue-500/15 border-blue-500/40 text-blue-400",
  2: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
  3: "bg-amber-500/15 border-amber-500/40 text-amber-400",
  4: "bg-red-500/15 border-red-500/40 text-red-400",
  5: "bg-brand-orange/15 border-brand-orange/40 text-[var(--brand-orange)]",
};

export function LevelChip({ level, capLabel }) {
  const meta = LEVELS[level] ?? LEVELS[0];
  const idle = level <= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        idle ? "border-dashed border-[var(--border-primary)] text-[var(--text-tertiary)]" : LEVEL_TONE[level]
      }`}
      title={capLabel ? `${capLabel} — ${meta.label}` : meta.label}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded bg-black/10 dark:bg-white/10">
        {meta.short}
      </span>
      {meta.label}
    </span>
  );
}

// ─── Badge de source ────────────────────────────────────────────────────────
const SOURCE_TONE = {
  Profil: "border-brand-orange/30 bg-brand-orange/10 text-[var(--brand-orange)]",
  Groupe: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  Direct: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Restriction: "border-red-500/30 bg-red-500/10 text-red-400",
};

export function SourceBadge({ source }) {
  if (!source) return <span className="text-[10px] text-[var(--text-tertiary)]">—</span>;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SOURCE_TONE[source] ?? ""}`}>
      {source}
    </span>
  );
}

// ─── Badge de risque ────────────────────────────────────────────────────────
const RISK_TONE = {
  normal: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  "élevé": "border-amber-500/30 bg-amber-500/10 text-amber-400",
  critique: "border-red-500/30 bg-red-500/10 text-red-400",
};

export function RiskBadge({ risk }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${RISK_TONE[risk] ?? RISK_TONE.normal}`}>
      {risk}
    </span>
  );
}

// ─── Les trois portes ───────────────────────────────────────────────────────
const GATE_TONE = {
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  closed: "border-red-500/40 bg-red-500/10 text-red-400",
  neutral: "border-[var(--border-primary)] bg-[var(--surface-2)] text-[var(--text-secondary)]",
};

function GateIcon({ tone }) {
  if (tone === "closed") return <XCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (tone === "open") return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  return <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function GateThree({ gates }) {
  const titles = { eligibility: "Éligibilité", capability: "Capacité", scope: "Portée" };
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {gates.map((gate, index) => (
        <div key={gate.key} className={`space-y-1 rounded-xl border px-3 py-2.5 ${GATE_TONE[gate.tone] ?? GATE_TONE.neutral}`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
            {index + 1} · {titles[gate.key]}
          </p>
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <GateIcon tone={gate.tone} />
            {gate.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Carte de chiffre ───────────────────────────────────────────────────────
export function Kpi({ label, value, tone = "neutral", hint }) {
  const tones = {
    neutral: "text-[var(--text-primary)]",
    brand: "text-[var(--brand-orange)]",
    warning: "text-amber-400",
    success: "text-emerald-400",
    danger: "text-red-400",
  };
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  );
}

// ─── Panneau latéral ────────────────────────────────────────────────────────
export function SidePanel({ open, title, onClose, children, width = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex justify-end bg-black/50" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex h-full w-full ${width} flex-col bg-[var(--surface-1)] border-l border-[var(--border-primary)] shadow-2xl`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] px-5 py-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className={`rounded-lg p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] ${FOCUS}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

// ─── Onglets soulignés ──────────────────────────────────────────────────────
export function Tabs({ items, value, onChange }) {
  return (
    <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-[var(--border-primary)]">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${FOCUS} ${
              active ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {item.label}
            {item.count > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-400">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Bouton ─────────────────────────────────────────────────────────────────
export function Btn({ children, variant = "secondary", size = "md", icon: Icon, ...rest }) {
  const variants = {
    primary: "border-transparent bg-[var(--brand-orange)] text-black hover:opacity-90",
    secondary: "border-[var(--border-primary)] bg-[var(--surface-1)] text-[var(--text-primary)] hover:border-brand-orange/40 hover:text-[var(--brand-orange)]",
    danger: "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
    ghost: "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-[10px]", md: "px-3 py-2 text-[10px]" };
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-black uppercase tracking-widest transition-all disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${FOCUS}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

// ─── État vide explicite ────────────────────────────────────────────────────
export function EmptyLine({ children }) {
  return <p className="text-xs font-medium text-[var(--text-tertiary)]">{children}</p>;
}

// ─── Champ étiqueté (formulaire partagé) ────────────────────────────────────
export const INPUT_CLASS =
  "rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60";

export function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
