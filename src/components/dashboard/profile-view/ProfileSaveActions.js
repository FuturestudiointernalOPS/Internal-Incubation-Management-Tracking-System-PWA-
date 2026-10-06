"use client";

import { AlertCircle, CheckCircle2, Save } from "lucide-react";

// The save banner and the save button at the bottom of the profile form.

export default function ProfileSaveActions({ t, saveMessage, saving, onSave }) {
  return (
    <div className="space-y-3">
      {saveMessage && (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold ${
            saveMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-rose-500/10 text-rose-400"
          }`}
        >
          {saveMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {saveMessage.text}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30"
        >
          <Save className="w-3.5 h-3.5" />{" "}
          {saving ? t("adminMisc.profile.saving") : t("adminMisc.profile.saveChanges")}
        </button>
      </div>
    </div>
  );
}
