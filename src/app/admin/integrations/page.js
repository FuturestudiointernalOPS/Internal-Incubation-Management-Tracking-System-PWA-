"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Plug,
  Key,
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  XCircle,
  AlertCircle,
  Copy,
  Zap,
  X,
} from "lucide-react";
import { useApiMulti } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on the list below, so it is built once
// at module scope: rebuilt each render it would be a new identity and would put
// the four requests back on the wire on every render. The same goes for the
// transformations, which is why they are made here rather than written inline.

/** A list from a `success` payload, empty when the read was refused. */
const pickList = (field) => (payload) => (payload?.success ? payload[field] || [] : []);

const INTEGRATION_ENDPOINTS = [
  {
    key: "integrations",
    url: "/api/integrations",
    transform: pickList("integrations"),
  },
  {
    key: "providers",
    url: "/api/integrations?type=providers",
    transform: pickList("providers"),
  },
  { key: "keys", url: "/api/api-keys", transform: pickList("keys") },
  { key: "webhooks", url: "/api/webhooks", transform: pickList("webhooks") },
];

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

function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function IntegrationsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("integrations");

  // The module's four lists, read through the shared hook: it owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the page keeps no
  // copy of its own and reads its data during render.
  const { data, loading, error, refresh } = useApiMulti(INTEGRATION_ENDPOINTS);
  const integrations = data.integrations ?? [];
  const providers = data.providers ?? [];
  const apiKeys = data.keys ?? [];
  const webhooks = data.webhooks ?? [];

  const [showAddIntegration, setShowAddIntegration] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ provider: "", label: "" });

  const [showAddKey, setShowAddKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", description: "", scopes: [], expires_at: "" });
  const [newKeyResult, setNewKeyResult] = useState(null);

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

  const handleAddIntegration = async () => {
    if (!newIntegration.provider) return;
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIntegration),
      });
      const data = await response.json();
      if (data.success) {
        setShowAddIntegration(false);
        setNewIntegration({ provider: "", label: "" });
        refresh();
      }
    } catch (error) {
      console.error("Add integration error:", error);
    }
  };

  const handleRemoveIntegration = async (id) => {
    try {
      const response = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setConfirmAction(null);
        refresh();
      }
    } catch (error) {
      console.error("Remove integration error:", error);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKey.name || newKey.scopes.length === 0) return;
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });
      const data = await response.json();
      if (data.success) {
        setNewKeyResult(data);
        setShowAddKey(false);
        setNewKey({ name: "", description: "", scopes: [], expires_at: "" });
        refresh();
      }
    } catch (error) {
      console.error("Create API key error:", error);
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setConfirmAction(null);
        refresh();
      }
    } catch (error) {
      console.error("Revoke key error:", error);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) return;
    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });
      const data = await response.json();
      if (data.success) {
        setShowAddWebhook(false);
        setNewWebhook({ name: "", url: "", events: [], secret: "" });
        refresh();
      }
    } catch (error) {
      console.error("Create webhook error:", error);
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setConfirmAction(null);
        refresh();
        if (selectedWebhook?.id === id) setSelectedWebhook(null);
      }
    } catch (error) {
      console.error("Delete webhook error:", error);
    }
  };

  const loadWebhookLogs = async (webhookId) => {
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/webhooks/${webhookId}`);
      const data = await response.json();
      if (data.success) setWebhookLogs(data.logs || []);
    } catch (error) {
      console.error("Load logs error:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Plug className="text-[var(--brand-orange)]" size={24} />
              {t("adminMisc.integrations.title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t("adminMisc.integrations.subtitle")}</p>
          </div>
          <button onClick={() => refresh()} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl hover:bg-[var(--surface-2)] transition-colors text-sm">
            <RefreshCw size={14} /> {t("adminMisc.integrations.refresh")}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[var(--brand-orange)] text-black"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
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
                  <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.connectedIntegrations")}</h2>
                  <button
                    onClick={() => setShowAddIntegration(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Plus size={14} /> {t("adminMisc.integrations.addIntegration")}
                  </button>
                </div>

                {integrations.length === 0 ? (
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
                    <Plug className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
                    <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.integrations.noIntegrations")}</p>
                    <p className="text-sm text-[var(--text-tertiary)] mt-2">{t("adminMisc.integrations.noIntegrationsHint")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {integrations.map((integ) => (
                      <div key={integ.id} className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{PROVIDER_ICONS[integ.provider] || "🔌"}</span>
                            <div>
                              <p className="font-medium">{integ.label || t(PROVIDER_NAME_KEYS[integ.provider] || "") || integ.provider_name || integ.provider}</p>
                              <p className="text-xs text-[var(--text-secondary)]">{integ.provider}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                            integ.status === "connected" ? "bg-emerald-500/10 text-emerald-400" :
                            integ.status === "error" ? "bg-red-500/10 text-red-400" :
                            "bg-gray-500/10 text-[var(--text-secondary)]"
                          }`}>
                            {t(STATUS_KEYS[integ.status] || "") || integ.status || t(STATUS_KEYS.disconnected)}
                          </span>
                        </div>
                        {integ.last_sync_at && (
                          <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.integrations.lastSync", { date: formatDate(integ.last_sync_at) })}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setConfirmAction({ type: "remove_integration", id: integ.id, name: integ.label || t(PROVIDER_NAME_KEYS[integ.provider] || "") || integ.provider })}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
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
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{t("adminMisc.integrations.availableProviders")}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {providers.map((provider) => (
                        <div key={provider.id} className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4 text-center hover:border-[var(--text-tertiary)] transition-colors cursor-pointer" onClick={() => { setNewIntegration({ provider: provider.provider_key, label: provider.name }); setShowAddIntegration(true); }}>
                          <span className="text-3xl block mb-2">{PROVIDER_ICONS[provider.provider_key] || "🔌"}</span>
                          <p className="text-xs font-medium">{t(PROVIDER_NAME_KEYS[provider.provider_key] || "") || provider.name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t(PROVIDER_DESC_KEYS[provider.provider_key] || "") || provider.description?.substring(0, 40)}</p>
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
                  <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.apiKeys")}</h2>
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
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{t("adminMisc.integrations.copyKeyWarning")}</p>
                    <div className="flex items-center gap-2 bg-[var(--bg-primary)] rounded-lg p-3">
                      <code className="text-sm text-emerald-300 flex-1 break-all">{newKeyResult.secret}</code>
                      <button onClick={() => copyToClipboard(newKeyResult.secret)} className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg">
                        <Copy size={14} className="text-[var(--text-secondary)]" />
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">{t("adminMisc.integrations.keyId", { id: newKeyResult.key_id })}</p>
                  </div>
                )}

                {apiKeys.length === 0 ? (
                  <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
                    <Key className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
                    <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.integrations.noApiKeys")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Key size={16} className="text-[var(--brand-orange)]" />
                              <p className="font-medium">{key.name}</p>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${key.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                {key.is_active ? t("adminMisc.integrations.active") : t("adminMisc.integrations.revoked")}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-[var(--text-secondary)]">{key.key_id}</p>
                            {key.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{key.description}</p>}
                          </div>
                          {key.is_active && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setConfirmAction({ type: "revoke_key", keyId: key.key_id, name: key.name })}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                                title={t("adminMisc.integrations.revokeKey")}
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 text-xs text-[var(--text-secondary)]">
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
                  <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.webhooks")}</h2>
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
                      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
                        <Webhook className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
                        <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.integrations.noWebhooks")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {webhooks.map((webhook) => (
                          <div
                            key={webhook.id}
                            className={`bg-[var(--surface-1)] border rounded-xl p-4 cursor-pointer transition-colors ${
                              selectedWebhook?.id === webhook.id ? "border-[var(--brand-orange)]" : "border-[var(--border-primary)] hover:border-[var(--text-tertiary)]"
                            }`}
                            onClick={() => { setSelectedWebhook(webhook); loadWebhookLogs(webhook.id); }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <Zap size={16} className={webhook.is_active ? "text-emerald-400" : "text-[var(--text-secondary)]"} />
                                <div>
                                  <p className="font-medium">{webhook.name}</p>
                                  <p className="text-xs text-[var(--text-secondary)] font-mono truncate max-w-[300px]">{webhook.url}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {webhook.last_status && (
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                    webhook.last_status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                  }`}>
                                    {webhook.last_status}
                                  </span>
                                )}
                                <button
                                  onClick={(event) => { event.stopPropagation(); setConfirmAction({ type: "delete_webhook", id: webhook.id, name: webhook.name }); }}
                                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(typeof webhook.events === "string" ? JSON.parse(webhook.events) : webhook.events || []).map((webhookEvent) => (
                                <span key={webhookEvent} className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{webhookEvent}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delivery Logs Panel */}
                  {selectedWebhook && (
                    <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold">{t("adminMisc.integrations.deliveryLogs")}</h3>
                        <button onClick={() => setSelectedWebhook(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                          <X size={14} />
                        </button>
                      </div>
                      {logsLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={20} /></div>
                      ) : webhookLogs.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm text-center py-8">{t("adminMisc.integrations.noDeliveries")}</p>
                      ) : (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {webhookLogs.map((log) => (
                            <div key={log.id} className="bg-[var(--bg-primary)] rounded-lg p-3 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[var(--text-secondary)]">{log.event_type}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  log.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                }`}>{log.status}</span>
                              </div>
                              <p className="text-[var(--text-secondary)]">{t("adminMisc.integrations.deliveryMeta", { status: log.response_status || "N/A", duration: log.duration_ms })}</p>
                              {log.error_message && <p className="text-red-400 mt-1">{log.error_message.substring(0, 100)}</p>}
                              <p className="text-[var(--text-tertiary)] mt-1">{formatDate(log.created_at)}</p>
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
            <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-md m-4" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.addIntegration")}</h2>
                <button onClick={() => setShowAddIntegration(false)} className="p-2 hover:bg-[var(--surface-2)] rounded-lg"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.provider")}</label>
                  <select value={newIntegration.provider} onChange={(event) => setNewIntegration((previous) => ({ ...previous, provider: event.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]">
                    <option value="">{t("adminMisc.integrations.selectProvider")}</option>
                    {providers.map((provider) => (
                      <option key={provider.provider_key} value={provider.provider_key}>{t(PROVIDER_NAME_KEYS[provider.provider_key] || "") || provider.name} ({provider.provider_key})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.labelOptional")}</label>
                  <input type="text" value={newIntegration.label} onChange={(event) => setNewIntegration((previous) => ({ ...previous, label: event.target.value }))}
                    placeholder={t("adminMisc.integrations.labelPlaceholder")}
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
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
            <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-lg m-4" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.generateApiKey")}</h2>
                <button onClick={() => setShowAddKey(false)} className="p-2 hover:bg-[var(--surface-2)] rounded-lg"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.nameRequired")}</label>
                  <input type="text" value={newKey.name} onChange={(event) => setNewKey((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder={t("adminMisc.integrations.apiKeyNamePlaceholder")}
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.description")}</label>
                  <textarea value={newKey.description} onChange={(event) => setNewKey((previous) => ({ ...previous, description: event.target.value }))}
                    placeholder={t("adminMisc.integrations.descriptionPlaceholder")}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.scopesRequired")}</label>
                  <div className="flex flex-wrap gap-2">
                    {API_SCOPES.map((scope) => (
                      <button key={scope} onClick={() => setNewKey((previous) => ({
                        ...previous, scopes: previous.scopes.includes(scope) ? previous.scopes.filter((existingScope) => existingScope !== scope) : [...previous.scopes, scope],
                      }))}
                        className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border transition-colors ${
                          newKey.scopes.includes(scope)
                            ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                            : "bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]"
                        }`}>
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.expiresAtOptional")}</label>
                  <input type="datetime-local" value={newKey.expires_at} onChange={(event) => setNewKey((previous) => ({ ...previous, expires_at: event.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]" />
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
            <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-lg m-4" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.createWebhook")}</h2>
                <button onClick={() => setShowAddWebhook(false)} className="p-2 hover:bg-[var(--surface-2)] rounded-lg"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.nameRequired")}</label>
                  <input type="text" value={newWebhook.name} onChange={(event) => setNewWebhook((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder={t("adminMisc.integrations.webhookNamePlaceholder")}
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.callbackUrlRequired")}</label>
                  <input type="url" value={newWebhook.url} onChange={(event) => setNewWebhook((previous) => ({ ...previous, url: event.target.value }))}
                    placeholder="https://hooks.example.com/notify"
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.secretOptional")}</label>
                  <input type="text" value={newWebhook.secret} onChange={(event) => setNewWebhook((previous) => ({ ...previous, secret: event.target.value }))}
                    placeholder="webhook_secret_123"
                    className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.eventsRequired")}</label>
                  <div className="flex flex-wrap gap-2">
                    {WEBHOOK_EVENT_OPTIONS.map((webhookEvent) => (
                      <button key={webhookEvent} onClick={() => setNewWebhook((previous) => ({
                        ...previous, events: previous.events.includes(webhookEvent) ? previous.events.filter((existingEvent) => existingEvent !== webhookEvent) : [...previous.events, webhookEvent],
                      }))}
                        className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border transition-colors ${
                          newWebhook.events.includes(webhookEvent)
                            ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                            : "bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]"
                        }`}>
                        {webhookEvent}
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
            <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-md m-4" onClick={(event) => event.stopPropagation()}>
              <div className="p-6">
                {confirmAction.type === "remove_integration" && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><Trash2 size={24} className="text-red-400" /></div>
                      <div><h3 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.removeIntegration")}</h3><p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.integrations.disconnectConfirm", { name: confirmAction.name })}</p></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm hover:bg-[var(--surface-2)]">{t("adminMisc.integrations.cancel")}</button>
                      <button onClick={() => handleRemoveIntegration(confirmAction.id)} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">{t("adminMisc.integrations.remove")}</button>
                    </div>
                  </>
                )}
                {confirmAction.type === "revoke_key" && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><Key size={24} className="text-red-400" /></div>
                      <div><h3 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.revokeApiKey")}</h3><p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.integrations.revokeConfirm", { name: confirmAction.name })}</p></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm hover:bg-[var(--surface-2)]">{t("adminMisc.integrations.cancel")}</button>
                      <button onClick={() => handleRevokeKey(confirmAction.keyId)} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">{t("adminMisc.integrations.revoke")}</button>
                    </div>
                  </>
                )}
                {confirmAction.type === "delete_webhook" && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><Webhook size={24} className="text-red-400" /></div>
                      <div><h3 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.deleteWebhook")}</h3><p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.integrations.deleteConfirm", { name: confirmAction.name })}</p></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm hover:bg-[var(--surface-2)]">{t("adminMisc.integrations.cancel")}</button>
                      <button onClick={() => handleDeleteWebhook(confirmAction.id)} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">{t("adminMisc.integrations.delete")}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
