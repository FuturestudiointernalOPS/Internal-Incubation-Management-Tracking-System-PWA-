"use client";

import { useI18n } from "@/lib/i18n";
import { Plug } from "lucide-react";
import { formatDate } from "@/components/admin/dashboard-page/constants";

const PROVIDER_ICONS = {
  google_calendar: "📅",
  google_drive: "📁",
  microsoft_outlook: "📧",
  slack: "💬",
  zoom: "🎥",
  microsoft_teams: "👥",
};

const PROVIDER_NAME_KEYS = {
  google_calendar: "adminMisc.integrations.providerNames.google_calendar",
  google_drive: "adminMisc.integrations.providerNames.google_drive",
  microsoft_outlook: "adminMisc.integrations.providerNames.microsoft_outlook",
  slack: "adminMisc.integrations.providerNames.slack",
  zoom: "adminMisc.integrations.providerNames.zoom",
  microsoft_teams: "adminMisc.integrations.providerNames.microsoft_teams",
};

const STATUS_KEYS = {
  connected: "adminMisc.integrations.statusValues.connected",
  error: "adminMisc.integrations.statusValues.error",
  disconnected: "adminMisc.integrations.statusValues.disconnected",
};

export default function IntegrationsTab({
  integrations,
  providers,
  onAddIntegration,
  onRemoveIntegration,
  refresh,
  t,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.connectedIntegrations")}</h2>
        <button
          onClick={onAddIntegration}
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
                  onClick={() => onRemoveIntegration(integ.id, integ.label || t(PROVIDER_NAME_KEYS[integ.provider] || "") || integ.provider)}
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
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{t("adminMisc.integrations.availableProviders")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {providers.map((provider) => (
            <div key={provider.id} className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4 text-center hover:border-[var(--text-tertiary)] transition-colors cursor-pointer" onClick={() => { /* handled by parent */ }}>
              <span className="text-3xl block mb-2">{PROVIDER_ICONS[provider.provider_key] || "🔌"}</span>
              <p className="text-xs font-medium">{provider.name}</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">{provider.description?.substring(0, 40)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}