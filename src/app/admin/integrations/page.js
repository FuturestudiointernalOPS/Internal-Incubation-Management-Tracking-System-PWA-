"use client";

import { useI18n } from "@/lib/i18n";
import { Plug, Key, Webhook, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useIntegrationsState } from "@/components/admin/integrations/useIntegrationsState";
import ApiKeysTab from "@/components/admin/integrations/ApiKeysTab";
import WebhooksTab from "@/components/admin/integrations/WebhooksTab";
import AddApiKeyModal from "@/components/admin/integrations/AddApiKeyModal";
import AddWebhookModal from "@/components/admin/integrations/AddWebhookModal";
import ConfirmDialog from "@/components/admin/integrations/ConfirmDialog";

const tabs = [
  { id: "api_keys", label: "adminMisc.integrations.apiKeys", icon: Key },
  { id: "webhooks", label: "adminMisc.integrations.webhooks", icon: Webhook },
];

export default function IntegrationsPage() {
  const { t } = useI18n();

  const state = useIntegrationsState();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Plug className="text-[var(--brand-orange)]" size={24} />
            {t("adminMisc.integrations.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t("adminMisc.integrations.subtitle")}</p>
        </div>
        <button onClick={state.refresh} className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl hover:bg-[var(--surface-2)] transition-colors text-sm">
          <RefreshCw size={14} /> {t("adminMisc.integrations.refresh")}
        </button>
      </div>

      <div className="flex gap-1 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => state.setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                state.activeTab === tab.id
                  ? "bg-[var(--brand-orange)] text-black"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <Icon size={16} /> {t(tab.label)}
            </button>
          );
        })}
      </div>

      {state.loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={32} /></div>
      ) : state.error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={40} />
          <p className="text-red-400">{state.error}</p>
        </div>
      ) : (
        <>
          {state.activeTab === "api_keys" && (
            <ApiKeysTab
              apiKeys={state.apiKeys}
              newKeyResult={state.newKeyResult}
              onAddKey={() => state.setShowAddKey(true)}
              onCreateKey={state.handleCreateApiKey}
              onRevokeKey={state.handleRevokeKey}
              onDismissKeyResult={() => state.setNewKeyResult(null)}
              onCopyKey={state.copyToClipboard}
              refresh={state.refresh}
              t={t}
            />
          )}

          {state.activeTab === "webhooks" && (
            <WebhooksTab
              webhooks={state.webhooks}
              selectedWebhook={state.selectedWebhook}
              webhookLogs={state.webhookLogs}
              logsLoading={state.logsLoading}
              onAddWebhook={() => state.setShowAddWebhook(true)}
              onCreateWebhook={state.handleCreateWebhook}
              onDeleteWebhook={state.handleDeleteWebhook}
              onSelectWebhook={state.setSelectedWebhook}
              onLoadLogs={state.loadWebhookLogs}
              onCloseLogs={() => state.setSelectedWebhook(null)}
              t={t}
            />
          )}
        </>
      )}

      <AddApiKeyModal
        isOpen={state.showAddKey}
        onClose={() => state.setShowAddKey(false)}
        onSubmit={state.handleCreateApiKey}
        isSubmitting={false}
        form={state.newKey}
        setForm={state.setNewKey}
        t={t}
      />

      <AddWebhookModal
        isOpen={state.showAddWebhook}
        onClose={() => state.setShowAddWebhook(false)}
        onSubmit={state.handleCreateWebhook}
        isSubmitting={false}
        form={state.newWebhook}
        setForm={state.setNewWebhook}
        t={t}
      />

      <ConfirmDialog
        isOpen={!!state.confirmAction}
        onClose={() => state.setConfirmAction(null)}
        onConfirm={() => {
          if (state.confirmAction?.type === "revoke_key") state.handleRevokeKey(state.confirmAction.keyId);
          else if (state.confirmAction?.type === "delete_webhook") state.handleDeleteWebhook(state.confirmAction.id);
          state.setConfirmAction(null);
        }}
        isConfirming={false}
        action={state.confirmAction}
        t={t}
      />
    </div>
  );
}