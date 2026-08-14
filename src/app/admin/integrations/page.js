"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Plug,
  Key,
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Globe,
  Clock,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Activity,
  Settings,
  ChevronRight,
  X,
  Search,
} from "lucide-react";

const PROVIDER_ICONS = {
  google_calendar: "📅",
  google_drive: "📁",
  microsoft_outlook: "📧",
  slack: "💬",
  zoom: "🎥",
  microsoft_teams: "👥",
};

// Lookup maps keyed by provider_key (keep raw DB values as fallback)
const PROVIDER_NAME_KEYS = {
  google_calendar: "adminMisc.integrations.providerNames.google_calendar",
  google_drive: "adminMisc.integrations.providerNames.google_drive",
  microsoft_outlook: "adminMisc.integrations.providerNames.microsoft_outlook",
  slack: "adminMisc.integrations.providerNames.slack",
  zoom: "adminMisc.integrations.providerNames.zoom",
  microsoft_teams: "adminMisc.integrations.providerNames.microsoft_teams",
};

const PROVIDER_DESC_KEYS = {
  google_calendar: "adminMisc.integrations.providerDescriptions.google_calendar",
  google_drive: "adminMisc.integrations.providerDescriptions.google_drive",
  microsoft_outlook: "adminMisc.integrations.providerDescriptions.microsoft_outlook",
  slack: "adminMisc.integrations.providerDescriptions.slack",
  zoom: "adminMisc.integrations.providerDescriptions.zoom",
  microsoft_teams: "adminMisc.integrations.providerDescriptions.microsoft_teams",
};

// Lookup map keyed by integration status value (keep raw value as fallback)
const STATUS_KEYS = {
  connected: "adminMisc.integrations.statusValues.connected",
  error: "adminMisc.integrations.statusValues.error",
  disconnected: "adminMisc.integrations.statusValues.disconnected",
};

const WEBHOOK_EVENT_OPTIONS = [
  "startup.created",
  "project.updated",
  "mentoring.session_completed",
  "investment.match_created",
  "document.uploaded",
  "notification.sent",
  "verification.approved",
];

const API_SCOPES = [
  "ventures:read", "ventures:write",
  "projects:read", "projects:write",
  "founders:read", "founders:write",
  "documents:read", "documents:write",
  "investment:read",
  "webhooks:manage",
  "*",
];

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function IntegrationsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("integrations");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Integrations state
  const [integrations, setIntegrations] = useState([]);
  const [providers, setProviders] = useState([]);
  const [showAddIntegration, setShowAddIntegration] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ provider: "", label: "" });

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", description: "", scopes: [], expires_at: "" });
  const [newKeyResult, setNewKeyResult] = useState(null);
  const [showSecret, setShowSecret] = useState({});

  // Webhooks state
  const [webhooks, setWebhooks] = useState([]);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: "", url: "", events: [], secret: "" });
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState(null);

  const tabs = [
    { id: "integrations", label: t("adminMisc.integrations.tabIntegrations"), icon: Plug },
    { id: "api_keys", label: t("adminMisc.integrations.apiKeys"), icon: Key },
    { id: "webhooks", label: t("adminMisc.integrations.webhooks"), icon: Webhook },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [integRes, providersRes, keysRes, webhooksRes] = await Promise.all([
        fetch("/api/integrations"),
        fetch("/api/integrations?type=providers"),
        fetch("/api/api-keys"),
        fetch("/api/webhooks"),
      ]);
      const [integData, provData, keysData, webData] = await Promise.all([
        integRes.json(), providersRes.json(), keysRes.json(), webhooksRes.json(),
      ]);
      if (integData.success) setIntegrations(integData.integrations || []);
      if (provData.success) setProviders(provData.providers || []);
      if (keysData.success) setApiKeys(keysData.keys || []);
      if (webData.success) setWebhooks(webData.webhooks || []);
    } catch (err) {
      setError(t(err.message || "") || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddIntegration = async () => {
    if (!newIntegration.provider) return;
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIntegration),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddIntegration(false);
        setNewIntegration({ provider: "", label: "" });
        fetchData();
      }
    } catch (err) {
      console.error("Add integration error:", err);
    }
  };

  const handleRemoveIntegration = async (id) => {
    try {
      const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setConfirmAction(null);
        fetchData();
      }
    } catch (err) {
      console.error("Remove integration error:", err);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKey.name || newKey.scopes.length === 0) return;
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });
      const data = await res.json();
      if (data.success) {
        setNewKeyResult(data);
        setShowAddKey(false);
        setNewKey({ name: "", description: "", scopes: [], expires_at: "" });
        fetchData();
      }
    } catch (err) {
      console.error("Create API key error:", err);
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setConfirmAction(null);
        fetchData();
      }
    } catch (err) {
      console.error("Revoke key error:", err);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) return;
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddWebhook(false);
        setNewWebhook({ name: "", url: "", events: [], secret: "" });
        fetchData();
      }
    } catch (err) {
      console.error("Create webhook error:", err);
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setConfirmAction(null);
        fetchData();
        if (selectedWebhook?.id === id) setSelectedWebhook(null);
      }
    } catch (err) {
      console.error("Delete webhook error:", err);
    }
  };

  const loadWebhookLogs = async (webhookId) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`);
      const data = await res.json();
      if (data.success) setWebhookLogs(data.logs || []);
    } catch (err) {
      console.error("Load logs error:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#020617] text-white p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plug className="text-[var(--brand-orange)]" size={24} />
              {t("adminMisc.integrations.title")}
            </h1>
            <p className="text-gray-400 mt-1">{t("adminMisc.integrations.subtitle")}</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl hover:bg-[#1e293b] transition-colors text-sm">
            <RefreshCw size={14} /> {t("adminMisc.integrations.refresh")}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-[#0f172a] border border-gray-800 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[var(--brand-orange)] text-black"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={32} /></div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
            <AlertCircle className="mx-auto mb-3 text-red-400" size={40} />
            <p className="text-red-400">{error}</p>
          </div>
        ) : (
          <>
            {/* ─── INTEGRATIONS TAB ──────────────────────────────────────── */}
            {activeTab === "integrations" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t("adminMisc.integrations.connectedIntegrations")}</h2>
                  <button
                    onClick={() => setShowAddIntegration(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Plus size={14} /> {t("adminMisc.integrations.addIntegration")}
                  </button>
                </div>

                {integrations.length === 0 ? (
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
                    <Plug className="mx-auto mb-3 text-gray-500" size={40} />
                    <p className="text-gray-400">{t("adminMisc.integrations.noIntegrations")}</p>
                    <p className="text-gray-600 text-sm mt-2">{t("adminMisc.integrations.noIntegrationsHint")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {integrations.map((integ) => (
                      <div key={integ.id} className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{PROVIDER_ICONS[integ.provider] || "🔌"}</span>
                            <div>
                              <p className="font-medium">{integ.label || t(PROVIDER_NAME_KEYS[integ.provider] || "") || integ.provider_name || integ.provider}</p>
                              <p className="text-xs text-gray-500">{integ.provider}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full ${
                            integ.status === "connected" ? "bg-emerald-500/10 text-emerald-400" :
                            integ.status === "error" ? "bg-red-500/10 text-red-400" :
                            "bg-gray-500/10 text-gray-400"
                          }`}>
                            {t(STATUS_KEYS[integ.status] || "") || integ.status || t(STATUS_KEYS.disconnected)}
                          </span>
                        </div>
                        {integ.last_sync_at && (
                          <p className="text-xs text-gray-500">{t("adminMisc.integrations.lastSync", { date: formatDate(integ.last_sync_at) })}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setConfirmAction({ type: "remove_integration", id: integ.id, name: integ.label || t(PROVIDER_NAME_KEYS[integ.provider] || "") || integ.provider })}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Available Providers */}
                {providers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">{t("adminMisc.integrations.availableProviders")}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {providers.map((p) => (
                        <div key={p.id} className="bg-[#0f172a] border border-gray-800 rounded-xl p-4 text-center hover:border-gray-700 transition-colors cursor-pointer" onClick={() => { setNewIntegration({ provider: p.provider_key, label: p.name }); setShowAddIntegration(true); }}>
                          <span className="text-3xl block mb-2">{PROVIDER_ICONS[p.provider_key] || "🔌"}</span>
                          <p className="text-xs font-medium">{t(PROVIDER_NAME_KEYS[p.provider_key] || "") || p.name}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{t(PROVIDER_DESC_KEYS[p.provider_key] || "") || p.description?.substring(0, 40)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── API KEYS TAB ──────────────────────────────────────────── */}
            {activeTab === "api_keys" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t("adminMisc.integrations.apiKeys")}</h2>
                  <button
                    onClick={() => setShowAddKey(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Plus size={14} /> {t("adminMisc.integrations.generateKey")}
                  </button>
                </div>

                {newKeyResult && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-emerald-400">{t("adminMisc.integrations.apiKeyGenerated")}</h3>
                      <button onClick={() => setNewKeyResult(null)}><X size={14} /></button>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{t("adminMisc.integrations.copyKeyWarning")}</p>
                    <div className="flex items-center gap-2 bg-[#020617] rounded-lg p-3">
                      <code className="text-sm text-emerald-300 flex-1 break-all">{newKeyResult.secret}</code>
                      <button onClick={() => copyToClipboard(newKeyResult.secret)} className="p-1.5 hover:bg-white/5 rounded-lg">
                        <Copy size={14} className="text-gray-400" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{t("adminMisc.integrations.keyId", { id: newKeyResult.key_id })}</p>
                  </div>
                )}

                {apiKeys.length === 0 ? (
                  <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
                    <Key className="mx-auto mb-3 text-gray-500" size={40} />
                    <p className="text-gray-400">{t("adminMisc.integrations.noApiKeys")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Key size={16} className="text-[var(--brand-orange)]" />
                              <p className="font-medium">{key.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${key.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                {key.is_active ? t("adminMisc.integrations.active") : t("adminMisc.integrations.revoked")}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-gray-500">{key.key_id}</p>
                            {key.description && <p className="text-xs text-gray-400 mt-1">{key.description}</p>}
                          </div>
                          {key.is_active && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setConfirmAction({ type: "revoke_key", keyId: key.key_id, name: key.name })}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                title={t("adminMisc.integrations.revokeKey")}
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                          {key.scopes && <span>{t("adminMisc.integrations.scopes", { value: (typeof key.scopes === "string" ? JSON.parse(key.scopes) : key.scopes || []).join(", ") })}</span>}
                          {key.expires_at && <span>{t("adminMisc.integrations.expires", { date: formatDate(key.expires_at) })}</span>}
                          {key.last_used_at && <span>{t("adminMisc.integrations.lastUsed", { date: formatDate(key.last_used_at) })}</span>}
                          <span>{t("adminMisc.integrations.rateLimit", { value: key.rate_limit || 100 })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── WEBHOOKS TAB ──────────────────────────────────────────── */}
            {activeTab === "webhooks" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t("adminMisc.integrations.webhooks")}</h2>
                  <button
                    onClick={() => setShowAddWebhook(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Plus size={14} /> {t("adminMisc.integrations.createWebhook")}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Webhook List */}
                  <div className={`${selectedWebhook ? "lg:col-span-2" : "lg:col-span-3"}`}>
                    {webhooks.length === 0 ? (
                      <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
                        <Webhook className="mx-auto mb-3 text-gray-500" size={40} />
                        <p className="text-gray-400">{t("adminMisc.integrations.noWebhooks")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {webhooks.map((wh) => (
                          <div
                            key={wh.id}
                            className={`bg-[#0f172a] border rounded-xl p-4 cursor-pointer transition-colors ${
                              selectedWebhook?.id === wh.id ? "border-[var(--brand-orange)]" : "border-gray-800 hover:border-gray-700"
                            }`}
                            onClick={() => { setSelectedWebhook(wh); loadWebhookLogs(wh.id); }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <Zap size={16} className={wh.is_active ? "text-emerald-400" : "text-gray-500"} />
                                <div>
                                  <p className="font-medium">{wh.name}</p>
                                  <p className="text-xs text-gray-500 font-mono truncate max-w-[300px]">{wh.url}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {wh.last_status && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    wh.last_status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                  }`}>
                                    {wh.last_status}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "delete_webhook", id: wh.id, name: wh.name }); }}
                                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(typeof wh.events === "string" ? JSON.parse(wh.events) : wh.events || []).map((evt) => (
                                <span key={evt} className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{evt}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delivery Logs Panel */}
                  {selectedWebhook && (
                    <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold">{t("adminMisc.integrations.deliveryLogs")}</h3>
                        <button onClick={() => setSelectedWebhook(null)} className="text-gray-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                      {logsLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={20} /></div>
                      ) : webhookLogs.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-8">{t("adminMisc.integrations.noDeliveries")}</p>
                      ) : (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {webhookLogs.map((log) => (
                            <div key={log.id} className="bg-[#020617] rounded-lg p-3 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-400">{log.event_type}</span>
                                <span className={`px-1.5 py-0.5 rounded ${
                                  log.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                }`}>{log.status}</span>
                              </div>
                              <p className="text-gray-500">{t("adminMisc.integrations.deliveryMeta", { status: log.response_status || "N/A", duration: log.duration_ms })}</p>
                              {log.error_message && <p className="text-red-400 mt-1">{log.error_message.substring(0, 100)}</p>}
                              <p className="text-gray-600 mt-1">{formatDate(log.created_at)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── MODALS ────────────────────────────────────────────────────── */}

        {/* Add Integration Modal */}
        {showAddIntegration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddIntegration(false)}>
            <div className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-lg font-bold">{t("adminMisc.integrations.addIntegration")}</h2>
                <button onClick={() => setShowAddIntegration(false)} className="p-2 hover:bg-white/5 rounded-lg"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.provider")}</label>
                  <select value={newIntegration.provider} onChange={(e) => setNewIntegration((p) => ({ ...p, provider: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-[var(--brand-orange)]">
                    <option value="">{t("adminMisc.integrations.selectProvider")}</option>
                    {providers.map((p) => (
                      <option key={p.provider_key} value={p.provider_key}>{t(PROVIDER_NAME_KEYS[p.provider_key] || "") || p.name} ({p.provider_key})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.labelOptional")}</label>
                  <input type="text" value={newIntegration.label} onChange={(e) => setNewIntegration((p) => ({ ...p, label: e.target.value }))}
                    placeholder={t("adminMisc.integrations.labelPlaceholder")}
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <button onClick={handleAddIntegration} disabled={!newIntegration.provider}
                  className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {t("adminMisc.integrations.connect")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add API Key Modal */}
        {showAddKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddKey(false)}>
            <div className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-lg font-bold">{t("adminMisc.integrations.generateApiKey")}</h2>
                <button onClick={() => setShowAddKey(false)} className="p-2 hover:bg-white/5 rounded-lg"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.nameRequired")}</label>
                  <input type="text" value={newKey.name} onChange={(e) => setNewKey((k) => ({ ...k, name: e.target.value }))}
                    placeholder={t("adminMisc.integrations.apiKeyNamePlaceholder")}
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.description")}</label>
                  <textarea value={newKey.description} onChange={(e) => setNewKey((k) => ({ ...k, description: e.target.value }))}
                    placeholder={t("adminMisc.integrations.descriptionPlaceholder")}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.scopesRequired")}</label>
                  <div className="flex flex-wrap gap-2">
                    {API_SCOPES.map((scope) => (
                      <button key={scope} onClick={() => setNewKey((k) => ({
                        ...k, scopes: k.scopes.includes(scope) ? k.scopes.filter((s) => s !== scope) : [...k.scopes, scope],
                      }))}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          newKey.scopes.includes(scope)
                            ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                            : "bg-[#020617] border-gray-800 text-gray-400 hover:border-gray-600"
                        }`}>
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.expiresAtOptional")}</label>
                  <input type="datetime-local" value={newKey.expires_at} onChange={(e) => setNewKey((k) => ({ ...k, expires_at: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <button onClick={handleCreateApiKey} disabled={!newKey.name || newKey.scopes.length === 0}
                  className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {t("adminMisc.integrations.generateKey")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Webhook Modal */}
        {showAddWebhook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddWebhook(false)}>
            <div className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-lg font-bold">{t("adminMisc.integrations.createWebhook")}</h2>
                <button onClick={() => setShowAddWebhook(false)} className="p-2 hover:bg-white/5 rounded-lg"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.nameRequired")}</label>
                  <input type="text" value={newWebhook.name} onChange={(e) => setNewWebhook((w) => ({ ...w, name: e.target.value }))}
                    placeholder={t("adminMisc.integrations.webhookNamePlaceholder")}
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.callbackUrlRequired")}</label>
                  <input type="url" value={newWebhook.url} onChange={(e) => setNewWebhook((w) => ({ ...w, url: e.target.value }))}
                    placeholder="https://hooks.example.com/notify"
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.secretOptional")}</label>
                  <input type="text" value={newWebhook.secret} onChange={(e) => setNewWebhook((w) => ({ ...w, secret: e.target.value }))}
                    placeholder="webhook_secret_123"
                    className="w-full px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t("adminMisc.integrations.eventsRequired")}</label>
                  <div className="flex flex-wrap gap-2">
                    {WEBHOOK_EVENT_OPTIONS.map((evt) => (
                      <button key={evt} onClick={() => setNewWebhook((w) => ({
                        ...w, events: w.events.includes(evt) ? w.events.filter((e) => e !== evt) : [...w.events, evt],
                      }))}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          newWebhook.events.includes(evt)
                            ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                            : "bg-[#020617] border-gray-800 text-gray-400 hover:border-gray-600"
                        }`}>
                        {evt}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleCreateWebhook} disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                  className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {t("adminMisc.integrations.createWebhook")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)}>
            <div className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                {confirmAction.type === "remove_integration" && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><Trash2 size={24} className="text-red-400" /></div>
                      <div><h3 className="text-lg font-bold">{t("adminMisc.integrations.removeIntegration")}</h3><p className="text-sm text-gray-400">{t("adminMisc.integrations.disconnectConfirm", { name: confirmAction.name })}</p></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm hover:bg-[#1e293b]">{t("adminMisc.integrations.cancel")}</button>
                      <button onClick={() => handleRemoveIntegration(confirmAction.id)} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">{t("adminMisc.integrations.remove")}</button>
                    </div>
                  </>
                )}
                {confirmAction.type === "revoke_key" && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><Key size={24} className="text-red-400" /></div>
                      <div><h3 className="text-lg font-bold">{t("adminMisc.integrations.revokeApiKey")}</h3><p className="text-sm text-gray-400">{t("adminMisc.integrations.revokeConfirm", { name: confirmAction.name })}</p></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm hover:bg-[#1e293b]">{t("adminMisc.integrations.cancel")}</button>
                      <button onClick={() => handleRevokeKey(confirmAction.keyId)} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">{t("adminMisc.integrations.revoke")}</button>
                    </div>
                  </>
                )}
                {confirmAction.type === "delete_webhook" && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><Webhook size={24} className="text-red-400" /></div>
                      <div><h3 className="text-lg font-bold">{t("adminMisc.integrations.deleteWebhook")}</h3><p className="text-sm text-gray-400">{t("adminMisc.integrations.deleteConfirm", { name: confirmAction.name })}</p></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm hover:bg-[#1e293b]">{t("adminMisc.integrations.cancel")}</button>
                      <button onClick={() => handleDeleteWebhook(confirmAction.id)} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">{t("adminMisc.integrations.delete")}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
