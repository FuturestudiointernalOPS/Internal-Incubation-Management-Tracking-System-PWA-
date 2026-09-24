"use client";

import { useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, Settings, ToggleLeft, Shield,
  Activity, Server,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickSettings = (payload) => (payload?.success ? payload.settings : null);
const pickFeatures = (payload) => (payload?.success ? payload.features || [] : []);
const pickRoles = (payload) => (payload?.success ? payload.roles || [] : []);
const pickSystemInfo = (payload) => (payload?.success ? payload : null);
const pickLogs = (payload) => (payload?.success ? payload.logs || [] : []);

export default function VentureAdminPage() {
  const [activeTab, setActiveTab] = useState("settings");
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);

  // Five reads of the same endpoint, each filtered by its query parameter. Their
  // loaders' work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect. The feature toggle writes
  // through the feature read's own setter, exactly as it did before.
  const { data: settings, loading: settingsLoading } = useApi(
    "/api/admin/ventures?type=settings",
    { transform: pickSettings },
  );
  const {
    data: features,
    loading: featuresLoading,
    setData: setFeatures,
  } = useApi("/api/admin/ventures?type=features", {
    defaultValue: [],
    transform: pickFeatures,
  });
  const { data: roles, loading: rolesLoading } = useApi(
    "/api/admin/ventures?type=roles",
    { defaultValue: [], transform: pickRoles },
  );
  const { data: systemInfo, loading: systemInfoLoading } = useApi(
    "/api/admin/ventures?type=system",
    { transform: pickSystemInfo },
  );
  const { data: logs, loading: logsLoading } = useApi("/api/admin/ventures?type=logs", {
    defaultValue: [],
    transform: pickLogs,
  });
  const loading = settingsLoading || featuresLoading || rolesLoading || systemInfoLoading || logsLoading;

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const updateSetting = async (key, value) => {
    setSaving((previous) => ({ ...previous, [key]: true }));
    await fetch("/api/admin/ventures", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_setting", setting_key: key, setting_value: value }),
    });
    setSaving((previous) => ({ ...previous, [key]: false }));
    notify("Setting updated");
  };

  const toggleFeature = async (flagKey, isEnabled) => {
    setSaving((previous) => ({ ...previous, [flagKey]: true }));
    await fetch("/api/admin/ventures", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_feature", flag_key: flagKey, is_enabled: !isEnabled }),
    });
    setFeatures((prev) => prev.map((feature) => feature.flag_key === flagKey ? { ...feature, is_enabled: !isEnabled } : feature));
    setSaving((previous) => ({ ...previous, [flagKey]: false }));
    notify(`Feature ${!isEnabled ? "enabled" : "disabled"}`);
  };

  const renderInput = (key, config) => {
    if (config.type === "boolean") {
      return (
        <button onClick={() => updateSetting(key, config.value ? "false" : "true")}
          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${config.value ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/10 text-slate-500"}`}>
          {config.value ? "Enabled" : "Disabled"}
        </button>
      );
    }
    if (config.type === "integer") {
      return (
        <div className="flex gap-2">
          <input type="number" defaultValue={config.value}
            onBlur={(event) => updateSetting(key, event.target.value)}
            className="w-24 bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none" />
          {saving[key] && <Loader2 className="w-3 h-3 animate-spin mt-1.5" />}
        </div>
      );
    }
    return (
      <div className="flex gap-2">
        <input type="text" defaultValue={config.value}
          onBlur={(event) => updateSetting(key, event.target.value)}
          className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none" />
        {saving[key] && <Loader2 className="w-3 h-3 animate-spin mt-1.5" />}
      </div>
    );
  };

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  const categoryLabels = { general: "General", branding: "Branding", organization: "Organization", localization: "Localization", storage: "Storage", authentication: "Authentication" };

  return (
    <>
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${toast.type==="error"?"bg-rose-600":"bg-emerald-600"} text-white`}>
            {toast.type==="error"?<AlertCircle className="w-3.5 h-3.5"/>:<CheckCircle2 className="w-3.5 h-3.5"/>}{toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center"><Settings className="w-6 h-6 text-[var(--brand-orange)]" /></div>
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">Venture OS Administration</h1>
            <p className="text-xs text-slate-500">System configuration, feature flags, and role management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
          {[
            { id: "settings", label: "Settings", icon: Settings },
            { id: "features", label: "Features", icon: ToggleLeft },
            { id: "roles", label: "Roles", icon: Shield },
            { id: "system", label: "System", icon: Server },
            { id: "logs", label: "Activity Logs", icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${activeTab===tab.id?"border-[var(--brand-orange)] text-[var(--brand-orange)]":"border-transparent text-slate-500"}`}>
                <Icon className="w-3 h-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Settings */}
        {activeTab === "settings" && settings && (
          <div className="space-y-6">
            {Object.entries(settings).map(([category, items]) => (
              <div key={category} className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{categoryLabels[category] || category}</h3>
                <div className="space-y-3">
                  {Object.entries(items).map(([key, config]) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <div>
                        <p className="text-[10px] font-bold text-[var(--text-primary)]">{key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())}</p>
                        {config.description && <p className="text-[8px] text-slate-500">{config.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">{renderInput(key, config)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feature Flags */}
        {activeTab === "features" && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Feature Flags</h3>
            <div className="space-y-2">
              {features.map((feature) => (
                <div key={feature.id} className="flex items-center justify-between p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">{feature.flag_name}</p>
                    <p className="text-[8px] text-slate-500">{feature.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${feature.is_enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-500"}`}>{feature.is_enabled ? "ON" : "OFF"}</span>
                    <button onClick={() => toggleFeature(feature.flag_key, feature.is_enabled)} disabled={saving[feature.flag_key]}
                      className={`w-10 h-5 rounded-full transition-all relative ${feature.is_enabled ? "bg-emerald-500" : "bg-slate-600"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${feature.is_enabled ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roles */}
        {activeTab === "roles" && (
          <div className="space-y-4">
            {roles.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No custom roles defined</p>}
            {roles.map((role) => (
              <div key={role.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{role.name}</p>
                    <p className="text-[9px] text-slate-500">{role.description || "—"}</p>
                  </div>
                  <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${role.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-500"} ${role.is_system_role ? "bg-blue-500/10 text-blue-400" : ""}`}>
                    {role.is_system_role ? "System" : role.is_active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(role.permissions || {}).map(([module, perms]) => (
                    <span key={module} className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">
                      {module}: {Array.isArray(perms) ? perms.join(", ") : typeof perms === "object" ? Object.entries(perms).filter(([,v]) => v).map(([k]) => k).join(", ") : perms}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* System */}
        {activeTab === "system" && systemInfo && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Database", value: systemInfo.database_version?.split(",")[0] },
              { label: "Platform Version", value: systemInfo.platform_version },
              { label: "Environment", value: systemInfo.node_env },
              { label: "Total Users", value: systemInfo.total_users },
              { label: "Total Ventures", value: systemInfo.total_ventures },
              { label: "Active Sessions", value: systemInfo.active_sessions },
              { label: "Admin Actions (24h)", value: systemInfo.admin_actions_24h },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                <p className="text-sm font-black text-[var(--text-primary)] mt-1 truncate">{item.value || "—"}</p>
              </div>
            ))}
          </div>
        )}

        {/* Activity Logs */}
        {activeTab === "logs" && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Recent Admin Activity</h3>
            {logs.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No activity yet</p> : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                    <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)]">{log.action?.replace(/_/g, " ")}</p>
                      <p className="text-[8px] text-slate-500">{log.admin_name || log.admin_cid} · {log.entity_type} · {log.entity_id}</p>
                    </div>
                    <span className="text-[8px] text-slate-500 shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
