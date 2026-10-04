"use client";

import { useI18n } from "@/lib/i18n";
import { Webhook, Zap, X, Trash2, Loader2 } from "lucide-react";
import { formatDate } from "@/components/admin/dashboard-page/constants";

const WEBHOOK_EVENT_OPTIONS = [
  "startup.created",
  "project.updated",
  "mentoring.session_completed",
  "investment.match_created",
  "document.uploaded",
  "notification.sent",
  "verification.approved",
];

function getStatusBadgeClass(status) {
  if (status === "success") {
    return "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400";
  }
  return "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400";
}

function getZapClass(active) {
  return active ? "text-emerald-400" : "text-[var(--text-secondary)]";
}

function getEventBadgeClass() {
  return "text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full";
}

export default function WebhooksTab({
  webhooks,
  selectedWebhook,
  webhookLogs,
  logsLoading,
  onAddWebhook,
  onCreateWebhook,
  onDeleteWebhook,
  onSelectWebhook,
  onLoadLogs,
  onCloseLogs,
  onDeleteWebhook,
  t,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight">Webhooks</h2>
        <button
          onClick={onAddWebhook}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Create Webhook
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedWebhook ? "lg:col-span-2" : "lg:col-span-3"}>
          {webhooks.length === 0 ? (
            <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
              <Webhook className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
              <p className="text-sm text-[var(--text-secondary)]">No Webhooks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className={`bg-[var(--surface-1)] border rounded-xl p-4 cursor-pointer transition-colors ${
                    selectedWebhook?.id === webhook.id ? "border-[var(--brand-orange)]" : "border-[var(--border-primary)] hover:border-[var(--text-tertiary)]"
                  }`}
                  onClick={() => { onSelectWebhook(webhook); onLoadLogs(webhook.id); }}
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
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                          {webhook.last_status}
                        </span>
                      )}
                      <button
                        onClick={(event) => { event.stopPropagation(); onDeleteWebhook(webhook.id); }}
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
              <h3 className="text-sm font-bold">Delivery Logs</h3>
              <button onClick={() => { /* onCloseLogs */ }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            {logsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={20} /></div>
            ) : webhookLogs.length === 0 ? (
              <p className="text-[var(--text-secondary)] text-sm text-center py-8">No deliveries</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {webhookLogs.map((log) => (
                  <div key={log.id} className="bg-[var(--bg-primary)] rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--text-secondary)]">{log.event_type}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">{log.status}</span>
                    </div>
                    <p className="text-[var(--text-secondary)]">Status: {log.response_status || "N/A"}, Duration: {log.duration_ms}ms</p>
                    {log.error_message && <p className="text-red-400 mt-1">{log.error_message.substring(0, 100)}</p>}
                    <p className="text-[var(--text-tertiary)] mt-1">{formatDate(log.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
