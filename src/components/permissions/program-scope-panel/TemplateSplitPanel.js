"use client";

import Link from "next/link";
import { Scissors, AlertTriangle, ExternalLink } from "lucide-react";
import AppBadge from "@/components/ui/AppBadge";
import AppEmptyState from "@/components/ui/AppEmptyState";
import ProgramPortfolioDefaultAction from "../ProgramPortfolioDefaultAction";
import { PERMISSION_BASE } from "../permissionNav";
import { whyLabel } from "./labels";

/**
 * 3. The template split.
 *
 * The seeded template bundles programme management with unrelated powers, so
 * the rule cannot be narrowed inside it. `removals` names exactly what a
 * trimmed portfolio template would stop granting; the trimmed template is
 * already created and stays inert until the role default is repointed. The
 * repoint itself is a click, not a migration, and it lives in its own block
 * (./ProgramPortfolioDefaultAction): it reads what would be removed before it
 * writes, and states what it removed after it wrote.
 */
export default function TemplateSplitPanel({ t, removals, templates, onRefresh }) {
  return (
    <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
        <Scissors className="h-3 w-3 text-[var(--brand-orange)]" />
        {t("engineering.permissions.programScopeSplitTitle")}
      </p>
      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeSplitBody")}
      </p>

      {removals.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.programScopeRemovalsEmpty")}
        </p>
      ) : (
        <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {t("engineering.permissions.programScopeRemovalsTitle")}
          </p>
          {removals.map((removal) => (
            <div
              key={`${removal.profileId}:${removal.module}.${removal.capability}`}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-[11px] font-bold text-[var(--text-primary)]">
                {removal.module}.{removal.capability}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">
                {whyLabel(t, removal)}
              </span>
              {removal.profile && (
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {removal.profile}
                </span>
              )}
              <span className="text-[10px] font-bold text-amber-400">
                {t(
                  "engineering.permissions.programScopeRemovalHolders",
                  { n: removal.holders ?? 0 },
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeTemplatesTitle")}
      </p>
      {templates.length === 0 ? (
        <AppEmptyState
          size="sm"
          icon={Scissors}
          title={t("engineering.permissions.programScopeTemplatesEmpty")}
        />
      ) : (
        <div className="space-y-1.5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2"
            >
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {tpl.name}
              </span>
              <AppBadge variant={tpl.isActive ? "success" : "default"}>
                {tpl.isActive
                  ? t("engineering.permissions.programScopeTemplateActive")
                  : t(
                      "engineering.permissions.programScopeTemplateInactive",
                    )}
              </AppBadge>
              <span className="text-[10px] text-[var(--text-secondary)]">
                {t(
                  "engineering.permissions.programScopeTemplateCaps",
                  { n: (tpl.capabilities || []).length },
                )}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">
                {t(
                  "engineering.permissions.programScopeTemplateHolders",
                  { n: tpl.holders ?? 0 },
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.programScopeRepointTitle")}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.programScopeRepointBody")}
        </p>
        <Link
          href={`${PERMISSION_BASE}/profiles`}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          <ExternalLink className="h-3 w-3" />
          {t("engineering.permissions.programScopeRepointLink")}
        </Link>
      </div>

      {/* The deliberate click at the end of the walkthrough above. */}
      <ProgramPortfolioDefaultAction onRefresh={onRefresh} />
    </div>
  );
}
