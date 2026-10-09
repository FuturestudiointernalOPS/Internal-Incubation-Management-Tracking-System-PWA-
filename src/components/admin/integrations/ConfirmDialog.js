"use client";

import { useI18n } from "@/lib/i18n";
import { X, Plus, Zap, Webhook, Key, Trash2, AlertCircle } from "lucide-react";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  action,
  t,
}) {
  if (!isOpen || !action) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-md m-4" onClick={(event) => event.stopPropagation()}>
        <div className="p-6">
          {action.type === "revoke_key" && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-500/10 rounded-xl"><Key size={24} className="text-red-400" /></div>
                <div><h3 className="text-lg font-black tracking-tight">Revoke API Key</h3><p className="text-sm text-[var(--text-secondary)]">Are you sure you want to revoke the API key &quot;{action.name}&quot;? This will immediately invalidate the key and cannot be undone.</p></div>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm hover:bg-[var(--surface-2)]">Cancel</button>
                <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">Revoke</button>
              </div>
            </>
          )}
          {action.type === "delete_webhook" && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-500/10 rounded-xl"><AlertCircle size={24} className="text-red-400" /></div>
                <div><h3 className="text-lg font-black tracking-tight">Delete Webhook</h3><p className="text-sm text-[var(--text-secondary)]">Are you sure you want to delete the webhook &quot;{action.name}&quot;? This will permanently remove the webhook and its delivery logs.</p></div>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm hover:bg-[var(--surface-2)]">Cancel</button>
                <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-sm font-medium hover:bg-red-600">Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}