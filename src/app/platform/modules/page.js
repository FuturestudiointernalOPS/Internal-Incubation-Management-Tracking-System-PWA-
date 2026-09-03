"use client";

import React, { useState, useEffect } from "react";
import { getRegisteredModules } from "@/lib/platform/registry";
import { useI18n } from "@/lib/i18n";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  BarChart3,
  GitBranch,
  Settings,
  Blocks,
} from "lucide-react";

const ICON_MAP = {
  LayoutDashboard: Blocks,
  FolderKanban,
  FileText,
  BarChart3,
  GitBranch,
  Settings,
};

export default function ModulesPage() {
  const { t } = useI18n();
  const [modules, setModules] = useState([]);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setModules(getRegisteredModules(u.role || "super_admin"));
  }, []);

  return (
    <div className="p-6 space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
          {t("platformMisc.modules.title")}
        </h1>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          {t("platformMisc.modules.subtitle")}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = ICON_MAP[mod.icon] || Blocks;
          return (
            <div
              key={mod.id}
              className={`p-5 rounded-2xl bg-secondary border transition-all ${
                mod.future
                  ? "border-dashed border-[var(--border-primary)] opacity-60"
                  : "border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  mod.future
                    ? "bg-amber-500/10"
                    : "bg-[var(--brand-orange)]/10"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    mod.future ? "text-amber-500" : "text-[var(--brand-orange)]"
                  }`}
                />
              </div>
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                {mod.name}
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                {mod.description}
              </p>
              {mod.future && (
                <span className="inline-block mt-3 px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wide">
                  {t("platformMisc.modules.comingSoon")}
                </span>
              )}
              {!mod.future && mod.href && (
                <a
                  href={mod.href}
                  className="inline-block mt-3 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline"
                >
                  {t("platformMisc.modules.open")}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
