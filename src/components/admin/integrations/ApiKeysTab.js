"use client";

import { useI18n } from "@/lib/i18n";
import { Key, X, Copy, Trash2, AlertCircle, Plus } from "lucide-react";
import { formatDate } from "@/components/admin/dashboard-page/constants";

export default function ApiKeysTab({
  apiKeys,
  newKeyResult,
  onAddKey,
  onCreateKey,
  onRevokeKey,
  onDismissKeyResult,
  onCopyKey,
  refresh,
  t,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.apiKeys")}</h2>
        <button
          onClick={onAddKey}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> {t("adminMisc.integrations.generateKey")}
        </button>
      </div>

      {newKeyResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-emerald-400">{t("adminMisc.integrations.apiKeyGenerated")}</h3>
            <button onClick={onDismissKeyResult}><X size={14} /></button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-2">{t("adminMisc.integrations.copyKeyWarning")}</p>
          <div className="flex items-center gap-2 bg-[var(--bg-primary)] rounded-lg p-3">
            <code className="text-sm text-emerald-300 flex-1 break-all">{newKeyResult.secret}</code>
            <button onClick={() => onCopyKey(newKeyResult.secret)} className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg">
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
                      {key.is_active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[var(--text-secondary)]">{key.key_id}</p>
                  {key.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{key.description}</p>}
                </div>
                {key.is_active && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => { /* handled by parent */ }}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                      title="Revoke"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-[var(--text-secondary)]">
                {key.scopes && <span>Scopes: {(typeof key.scopes === "string" ? JSON.parse(key.scopes) : key.scopes || []).join(", ")}</span>}
                {key.expires_at && <span>Expires: {formatDate(key.expires_at)}</span>}
                {key.last_used_at && <span>Last used: {formatDate(key.last_used_at)}</span>}
                <span>Rate limit: {key.rate_limit || 100}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}