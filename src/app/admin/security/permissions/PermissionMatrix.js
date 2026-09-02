"use client";

import React from "react";
import { ChevronDown, ChevronRight, X, Plus, Trash2, CheckCircle2 } from "lucide-react";

export default function PermissionMatrix({
  loadingPerms,
  MODULE_CATEGORIES,
  modules,
  expandedModules,
  setExpandedModules,
  LEVELS_ORDER,
  ACCESS_COLORS,
  ACCESS_LABELS,
  ACCESS_SHORT,
  getEffectiveLevel,
  getOrigin,
  handleQuickAction
}) {
  if (loadingPerms) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
          style={{
            borderColor: "rgba(255,102,0,0.1)",
            borderTopColor: "var(--brand-orange)",
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {MODULE_CATEGORIES.map((category) => (
        <div key={category.label} className="space-y-3">
          <h3 className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] opacity-50 pl-1">
            {category.label}
          </h3>
          {category.modules.map((modKey) => {
            const mod = modules[modKey];
            if (!mod) return null;
            const caps = mod.capabilities || [];
            const isExpanded = expandedModules[modKey] !== false;

            return (
              <div
                key={modKey}
                className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
              >
                {/* Module header */}
                <button
                  onClick={() =>
                    setExpandedModules((prev) => ({
                      ...prev,
                      [modKey]: !prev[modKey],
                    }))
                  }
                  className="w-full flex items-center justify-between px-5 py-4 bg-tertiary/30 hover:bg-tertiary/50 transition-all border-b border-[var(--border-primary)]"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    )}
                    <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">
                      {mod.name}
                    </span>
                  </div>
                  <span className="text-[8px] font-bold text-slate-500">
                    {caps.length} capabilities
                  </span>
                </button>

                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border-primary)]">
                          <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest w-40">
                            Capability
                          </th>
                          {LEVELS_ORDER.map((level) => (
                            <th
                              key={level}
                              className="px-3 py-3 text-center text-[8px] font-black uppercase tracking-widest whitespace-nowrap"
                              style={{
                                color:
                                  level === 0
                                    ? "var(--text-secondary)"
                                    : ACCESS_COLORS[level],
                              }}
                            >
                              {ACCESS_LABELS[level]}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-center text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest w-24">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {caps.map((cap) => {
                          const effectiveLevel = getEffectiveLevel(modKey, cap);
                          const origin = getOrigin(modKey, cap);

                          return (
                            <tr
                              key={cap}
                              className="group border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
                            >
                              {/* Capability name */}
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  {origin === "granted" && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                      title="Individual grant"
                                    />
                                  )}
                                  {origin === "restricted" && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-red-400 shrink-0"
                                      title="Restricted"
                                    />
                                  )}
                                  {origin === "inherited" && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-slate-400 shrink-0"
                                      title="Inherited from role/group"
                                    />
                                  )}
                                  <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                                    {cap.replace(/_/g, " ")}
                                  </span>
                                </div>
                              </td>

                              {/* Access level radio cells */}
                              {LEVELS_ORDER.map((level) => {
                                const isActive = effectiveLevel === level;
                                const isClickable = level !== effectiveLevel;
                                return (
                                  <td
                                    key={level}
                                    className={`px-3 py-3 text-center ${isClickable ? "cursor-pointer" : ""}`}
                                    onClick={() => {
                                      if (origin === "restricted") {
                                        handleQuickAction("unrestrict", modKey, cap);
                                      } else if (level === 0 && effectiveLevel > 0) {
                                        handleQuickAction("restrict", modKey, cap, 0);
                                      } else if (level > 0) {
                                        handleQuickAction("grant", modKey, cap, level);
                                      }
                                    }}
                                  >
                                    {origin === "restricted" && level === 0 ? (
                                      <div
                                        className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto cursor-pointer hover:bg-red-500/30 transition-all"
                                        title="Restricted — click to unrestrict"
                                      >
                                        <X className="w-3 h-3 text-red-400" />
                                      </div>
                                    ) : isActive && origin === "granted" ? (
                                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto">
                                        <span className="text-[8px] font-black text-emerald-400">
                                          {ACCESS_SHORT[level]}
                                        </span>
                                      </div>
                                    ) : isActive && origin === "inherited" ? (
                                      <div className="w-6 h-6 rounded-lg bg-slate-500/20 border border-slate-500/40 flex items-center justify-center mx-auto">
                                        <span className="text-[8px] font-black text-slate-400">
                                          {ACCESS_SHORT[level]}
                                        </span>
                                      </div>
                                    ) : isActive ? (
                                      <div
                                        className="w-6 h-6 rounded-lg border-2 flex items-center justify-center mx-auto"
                                        style={{
                                          borderColor: ACCESS_COLORS[level],
                                          background: `${ACCESS_COLORS[level]}15`,
                                        }}
                                      >
                                        <span
                                          className="text-[8px] font-black"
                                          style={{
                                            color: ACCESS_COLORS[level],
                                          }}
                                        >
                                          {ACCESS_SHORT[level]}
                                        </span>
                                      </div>
                                    ) : level === 0 ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleQuickAction("restrict", modKey, cap, 0);
                                        }}
                                        className="w-6 h-6 rounded-lg border border-dashed border-slate-600/30 flex items-center justify-center mx-auto hover:border-red-400/40 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100 hover:opacity-100"
                                        title="Restrict"
                                      >
                                        <X className="w-2.5 h-2.5 text-slate-600" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleQuickAction("grant", modKey, cap, level);
                                        }}
                                        className="w-6 h-6 rounded-lg border border-dashed border-slate-600/30 flex items-center justify-center mx-auto hover:border-emerald-400/40 hover:bg-emerald-500/5 transition-all opacity-0 group-hover:opacity-100 hover:opacity-100"
                                        title={`Set to ${ACCESS_LABELS[level]}`}
                                      >
                                        <Plus className="w-2.5 h-2.5 text-slate-600" />
                                      </button>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Actions column */}
                              <td className="px-3 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {origin === "granted" && (
                                    <button
                                      onClick={() => handleQuickAction("revoke", modKey, cap)}
                                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                                      title="Revoke grant"
                                    >
                                      <Trash2 className="w-3 h-3 text-red-400" />
                                    </button>
                                  )}
                                  {origin === "restricted" && (
                                    <button
                                      onClick={() => handleQuickAction("unrestrict", modKey, cap)}
                                      className="p-1.5 rounded-lg hover:bg-emerald-500/10 transition-all"
                                      title="Remove restriction"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
