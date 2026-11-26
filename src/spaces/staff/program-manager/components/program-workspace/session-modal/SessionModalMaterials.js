"use client";

import { useI18n } from "@/lib/i18n";
import { FileText, Paperclip, Plus } from "lucide-react";

export default function SessionModalMaterials({
  t,
  newSessionMaterial,
  onNewSessionMaterial,
  onNewSessionMaterialChange,
  onNewSessionMaterialExternalLinkChange,
  onSessionMaterialFile,
  onAttachSessionMaterial,
  newSession,
  onNewSession,
}) {
  return (
    <div className="space-y-2">
      <label
        className="text-[10px] font-black uppercase tracking-widest"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("pmMisc.workspace.extraCourseMaterials")}
      </label>
      {/* Material type selector */}
      <div className="flex gap-1 bg-primary rounded-lg p-1 border border-[var(--border-primary)] w-fit">
        {[
          {
            id: "text",
            label: t("pmMisc.workspace.materialTypeText"),
            icon: FileText,
          },
          {
            id: "link",
            label: t("pmMisc.workspace.materialTypeLink"),
            icon: Plus,
          },
          {
            id: "upload",
            label: t("pmMisc.workspace.materialTypeFile"),
            icon: Paperclip,
          },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() =>
              onNewSessionMaterial({
                type: opt.id,
                content: "",
                name: "",
              })
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
              newSessionMaterial.type === opt.id
                ? "bg-[var(--brand-orange)] text-black"
                : "text-slate-500 hover:text-white"
            }`}
          >
            <opt.icon className="w-3 h-3" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Material input */}
      <div className="flex gap-2">
        {newSessionMaterial.type === "text" && (
          <input
            value={newSessionMaterial.content}
            onChange={(event) =>
              onNewSessionMaterialChange((prev) => ({
                ...prev,
                content: event.target.value,
                name: "Text Note",
              }))
            }
            placeholder={t("pmMisc.workspace.textNotePlaceholder")}
            className="flex-1 rounded-lg px-4 py-3 text-sm outline-none font-bold"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        )}
        {newSessionMaterial.type === "link" && (
          <input
            type="url"
            value={newSessionMaterial.content}
            onChange={(event) =>
              onNewSessionMaterialExternalLinkChange((prev) => ({
                ...prev,
                content: event.target.value,
                name:
                  event.target.value.split("/").pop() || "External Link",
              }))
            }
            placeholder="https://..."
            className="flex-1 rounded-lg px-4 py-3 text-sm outline-none font-bold"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        )}
        {newSessionMaterial.type === "upload" && (
          <div className="flex-1 relative group">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={onSessionMaterialFile}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed text-sm font-bold"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border-primary)",
                color: "var(--text-secondary)",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05a.81.81 0 0 1-.13 1.04l-7.07 7.06a.81.81 0 0 1-1.12.09l-3.54-6.51a.81.81 0 0 1 .24-1.15L19.03 2.5a.81.81 0 0 1 1 0l3.76 3.75a.81.81 0 0 1-.07 1.13z"></path><path d="M22 19h-5c-.55 0-1-.45-1-1v-3.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5v3.5c0 .55-.45 1-1 1z"></path></svg>
              {newSessionMaterial.content || t("pmMisc.workspace.clickToAttach")}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onAttachSessionMaterial}
          className="px-4 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
        >
          {t("pmMisc.workspace.add")}
        </button>
      </div>

      {/* Added materials list */}
      {(newSession.extra_materials || []).length > 0 && (
        <div className="space-y-1.5 mt-2">
          {(newSession.extra_materials || []).map((material, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded-lg"
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                {material.type === "link" && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="13" x2="19" y2="14"></line><line x1="18" y1="11" x2="19" y2="10"></line><circle cx="18" cy="9" r="2"></circle><path d="M22 9V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 1.89-1.39"></path></svg>
                )}
                {material.type === "upload" && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#FF6600] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05a.81.81 0 0 1-.13 1.04l-7.07 7.06a.81.81 0 0 1-1.12.09l-3.54-6.51a.81.81 0 0 1 .24-1.15L19.03 2.5a.81.81 0 0 1 1 0l3.76 3.75a.81.81 0 0 1-.07 1.13z"></path><path d="M22 19h-5c-.55 0-1-.45-1-1v-3.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5v3.5c0 .55-.45 1-1 1z"></path></svg>
                )}
                <span className="text-[10px] font-bold truncate text-[var(--text-primary)]">
                  {material.name || material.content}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onNewSession((prev) => ({
                    ...prev,
                    extra_materials: (prev.extra_materials || []).filter(
                      (_, materialIndex) => materialIndex !== index,
                    ),
                  }))
                }
                className="text-rose-500 hover:scale-110 transition-all shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}