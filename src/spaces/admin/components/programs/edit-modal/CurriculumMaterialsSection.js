"use client";

import { FileText, Trash2, Upload, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Curriculum materials list and PDF upload control. */
export default function CurriculumMaterialsSection({
  editingProgram,
  setEditingProgram,
  isUploading,
  onFileUpload,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
        {t?.("admin.curriculumMaterials") || "Curriculum Materials (PDF)"}
      </label>
      <div className="grid grid-cols-1 gap-2">
        {(() => {
          let materials = [];
          try {
            const raw = Array.isArray(editingProgram.materials)
              ? editingProgram.materials
              : typeof editingProgram.materials === "string"
                ? JSON.parse(editingProgram.materials || "[]")
                : [];
            materials = Array.isArray(raw) ? raw : [];
          } catch (err) {
            console.error("Materials parse failure:", err);
          }
          if (materials.length === 0)
            return (
              <p className="text-[10px] font-medium opacity-40 ml-2">
                {t?.("admin.noProgramPdfs") ||
                  "No program-specific PDFs uploaded."}
              </p>
            );
          return materials.map(
            (file, idx) =>
              file && (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-tertiary border border-[var(--border-primary)] rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase truncate max-w-[200px]">
                      {file.name || t("adminMisc.programs.untitledPdf")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = materials.filter((_, i) => i !== idx);
                      setEditingProgram({
                        ...editingProgram,
                        materials: remaining,
                      });
                    }}
                    className="text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
          );
        })()}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          disabled={isUploading}
          onClick={() => document.getElementById("curriculum-upload")?.click()}
          className="btn btn-secondary px-6 py-3 flex items-center gap-2 border-dashed"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="text-[10px] uppercase font-bold">
            {isUploading
              ? t?.("common.saving") || "Syncing..."
              : t?.("admin.uploadPdf") || "Upload Additional PDF"}
          </span>
        </button>
        <input
          id="curriculum-upload"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onFileUpload}
        />
      </div>
    </div>
  );
}
