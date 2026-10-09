"use client";

import { useState, useCallback } from "react";
import { useApiMulti } from "@/lib/hooks/useApi";

const INTEGRATION_ENDPOINTS = [
  { key: "keys", url: "/api/api-keys", transform: (p) => p?.success ? p.keys || [] : [] },
  { key: "webhooks", url: "/api/webhooks", transform: (p) => p?.success ? p.webhooks || [] : [] },
];

export function useIntegrationsState() {
  const [activeTab, setActiveTab] = useState("api_keys");

  const [showAddKey, setShowAddKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", description: "", scopes: [], expires_at: "" });
  const [newKeyResult, setNewKeyResult] = useState(null);

  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: "", url: "", events: [], secret: "" });
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);

  // The module-scope list above is a stable identity, so the read is keyed on the
  // addresses and a fresh array can never re-issue it.
  const { data, loading, error, refresh } = useApiMulti(INTEGRATION_ENDPOINTS);

  const apiKeys = data.keys ?? [];
  const webhooks = data.webhooks ?? [];

  const refreshAll = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleCreateApiKey = useCallback(async () => {
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
  }, [newKey, refresh]);

  const handleRevokeKey = useCallback(async (keyId) => {
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        refresh();
      }
    } catch (error) {
      console.error("Revoke key error:", error);
    }
  }, [refresh]);

  const handleCreateWebhook = useCallback(async () => {
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
  }, [newWebhook, refresh]);

  const handleDeleteWebhook = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        refresh();
      }
    } catch (error) {
      console.error("Delete webhook error:", error);
    }
  }, [refresh]);

  const loadWebhookLogs = useCallback(async (webhookId) => {
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
  }, []);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  return {
    activeTab,
    setActiveTab,
    showAddKey,
    setShowAddKey,
    newKey,
    setNewKey,
    newKeyResult,
    setNewKeyResult,
    showAddWebhook,
    setShowAddWebhook,
    newWebhook,
    setNewWebhook,
    selectedWebhook,
    setSelectedWebhook,
    webhookLogs,
    setWebhookLogs,
    logsLoading,
    setLogsLoading,
    confirmAction,
    setConfirmAction,
    apiKeys,
    webhooks,
    loading,
    error,
    refresh: refreshAll,
    handleCreateApiKey,
    handleRevokeKey,
    handleCreateWebhook,
    handleDeleteWebhook,
    loadWebhookLogs,
    copyToClipboard,
  };
}
