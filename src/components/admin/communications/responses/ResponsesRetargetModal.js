"use client";

import React from "react";
import { Rocket, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ResponsesRetargetModal({
  filteredCount,
  name,
  onNameChange,
  submitting,
  onClose,
  onSubmit,
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80"
      />
      <div className="relative w-full max-w-md ios-card !p-8 shadow-2xl bg-[#080810] border border-white/10 m-4 text-left">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="mb-8">
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
            {t("crm.responses.followUp")}
          </h3>
          <p className="text-sm text-slate-400 font-bold">
            {t("crm.responses.newCampaignForPrefix")}{" "}
            <span className="text-white font-black">
              {filteredCount}
            </span>{" "}
            {t("crm.responses.newCampaignForSuffix")}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              {t("crm.responses.campaignName")}
            </label>
            <input
              required
              autoFocus
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t("crm.responses.campaignNamePlaceholder")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-[#FF6600]/80/50 focus:bg-white/10 transition-colors font-bold"
            />
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-prime !py-4 shadow-[#FF6600]/20 text-sm disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Rocket className="w-4 h-4" />
                  <span>{t("crm.responses.startFollowUpList")}</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
