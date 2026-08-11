"use client";

import React, { useState, useEffect } from "react";
import { getRegisteredModules } from "@/lib/platform/registry";
import { listServices } from "@/lib/platform/services";
import { Eye, EyeOff, ToggleLeft, ToggleRight } from "lucide-react";

/**
 * PLATFORM SETTINGS
 * Governance and configuration for the Platform.
 * Administrators can enable/disable modules, manage visibility, and view system status.
 */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PlatformSettings() {
  const [modules, setModules] = useState([]);
  const [services, setServices] = useState([]);
  const [activeTab, setActiveTab] = useState("modules");

  useEffect(() => {
    setModules(getRegisteredModules("super_admin"));
    setServices(listServices());
  }, []);

  return (
    <div className="p-6 space-y-6 animate-in">
      <div>
        <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
          Platform Settings
        </h1>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          Manage platform modules, services, and governance configuration.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-primary)]">
        {[
          { id: "modules", label: "Modules" },
          { id: "services", label: "Services" },
          { id: "registry", label: "Registry" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all border-b-2",
              activeTab === tab.id
                ? "border-[var(--brand-orange)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Modules tab */}
      {activeTab === "modules" && (
        <div className="space-y-3">
          <p className="text-[10px] text-[var(--text-secondary)] font-bold">
            {modules.length} registered modules
          </p>
          <div className="grid grid-cols-1 gap-3">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-black text-[var(--text-primary)] uppercase tracking-tight">
                      {mod.name}
                    </p>
                    {mod.future && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[7px] font-black uppercase">
                        Future
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                    {mod.description}
                  </p>
                  <p className="text-[8px] text-[var(--text-secondary)] mt-1 opacity-50">
                    ID: {mod.id} · Order: {mod.order} · Permissions:{" "}
                    {mod.permissions?.join(", ") || "none"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[8px] font-black uppercase",
                      mod.enabled ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {mod.enabled ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {mod.enabled ? "Enabled" : "Disabled"}
                  </span>
                  {mod.visible ? (
                    <Eye className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services tab */}
      {activeTab === "services" && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
          <table className="w-full text-left">
            <thead className="bg-tertiary">
              <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Singleton</th>
                <th className="px-4 py-3">Optional</th>
                <th className="px-4 py-3">Methods</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {services.map((svc) => (
                <tr
                  key={svc.id}
                  className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50 transition-colors"
                >
                  <td className="px-4 py-3">{svc.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[9px] font-black uppercase",
                        svc.loaded ? "text-emerald-500" : "text-amber-500",
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          svc.loaded ? "bg-emerald-500" : "bg-amber-500",
                        )}
                      />
                      {svc.loaded ? "Ready" : "Pending"}
                    </span>
                  </td>
                  <td className="text-[10px] text-[var(--text-secondary)]">
                    {svc.singleton ? "Yes" : "No"}
                  </td>
                  <td className="text-[10px] text-[var(--text-secondary)]">
                    {svc.optional ? "Yes" : "No"}
                  </td>
                  <td className="text-[10px] text-[var(--text-secondary)]">
                    {svc.methods?.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registry tab */}
      {activeTab === "registry" && (
        <div className="p-6 rounded-2xl bg-secondary border border-[var(--border-primary)] space-y-4">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            Module Registration API
          </h3>
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            To register a new Platform module, add an entry to the{" "}
            <code className="text-[var(--brand-orange)]">REGISTERED_MODULES</code>{" "}
            array in <code className="text-[var(--brand-orange)]">src/lib/platform/registry.js</code>.
          </p>
          <pre className="p-4 rounded-xl bg-primary text-[9px] font-mono text-[var(--text-secondary)] overflow-x-auto">
{`{
  id: "module-id",
  name: "Module Name",
  description: "What this module does",
  icon: "IconName",       // lucide-react icon
  href: "/platform/page",
  enabled: true,
  visible: true,
  permissions: ["super_admin"],
  order: 5,
  future: false,          // true = show as "Coming Soon"
}`}
          </pre>
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed mt-4">
            <strong className="text-[var(--text-primary)]">Service Registration:</strong>{" "}
            Services are registered in{" "}
            <code className="text-[var(--brand-orange)]">src/lib/platform/services.js</code>.
            Each service defines its module path, methods, and whether it is optional.
          </p>
        </div>
      )}
    </div>
  );
}
