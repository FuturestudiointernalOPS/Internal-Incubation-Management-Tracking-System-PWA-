import { BookOpen, Upload, Loader2, FileText, X } from "lucide-react";

/** Knowledge bank link + inline creation + program materials upload. */
export default function KnowledgeBankSection({
  t,
  program,
  setProgram,
  knowledgeNodes,
  isCreatingKB,
  setIsCreatingKB,
  newKB,
  setNewKB,
  handleFileUpload,
  handleCreateKBInline,
  isUploading,
  removeMaterial,
}) {
  return (
    <div className="card space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-5">
        <BookOpen className="w-16 h-16" />
      </div>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
          <BookOpen className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-tight">
          {t("adminMisc.newProgram.selectFromKnowledgeBase")}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
              {t("adminMisc.newProgram.knowledgeNodeLink")}
            </label>
            <button
              type="button"
              onClick={() => setIsCreatingKB(!isCreatingKB)}
              className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline"
            >
              {isCreatingKB
                ? t("adminMisc.newProgram.cancel")
                : t("adminMisc.newProgram.createNewKb")}
            </button>
          </div>

          {!isCreatingKB ? (
            <select
              value={program.note_id}
              onChange={(event) =>
                setProgram({ ...program, note_id: event.target.value })
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] appearance-none cursor-pointer"
            >
              <option value="">{t("adminMisc.newProgram.linkKnowledgeNode")}</option>
              {knowledgeNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title.toUpperCase()}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-4 p-4 bg-primary border border-brand-orange/20 rounded-xl animate-in fade-in zoom-in-95">
              <input
                value={newKB.title}
                onChange={(event) =>
                  setNewKB({ ...newKB, title: event.target.value })
                }
                placeholder={t("adminMisc.newProgram.knowledgeBaseNamePlaceholder")}
                className="w-full bg-transparent border-b border-[var(--border-primary)] py-2 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)]"
              />
              <div className="relative group h-20">
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={(event) => handleFileUpload(event, "kb")}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center h-full border border-dashed border-[var(--border-primary)] rounded-lg group-hover:border-[var(--brand-orange)]">
                  <p className="text-[10px] font-bold uppercase text-white/40">
                    {t("adminMisc.newProgram.uploadDocumentsForKb")}
                  </p>
                </div>
              </div>
              {newKB.files.length > 0 && (
                <div className="text-[10px] font-bold uppercase text-emerald-400">
                  {t("adminMisc.newProgram.documentsAttached", {
                    count: newKB.files.length,
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={handleCreateKBInline}
                className="w-full py-2 bg-brand-orange/10 text-[var(--brand-orange)] text-[10px] font-bold uppercase rounded-lg border border-brand-orange/20"
              >
                {t("adminMisc.newProgram.initializeKnowledgeBase")}
              </button>
            </div>
          )}
        </div>

        <div className="relative group">
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            disabled={isUploading}
          />
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-primary)] rounded-xl group-hover:border-[var(--brand-orange)] transition-all bg-primary/50">
            {isUploading ? (
              <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin mb-2" />
            ) : (
              <Upload className="w-6 h-6 text-[var(--text-secondary)] group-hover:text-[var(--brand-orange)] mb-2 transition-all" />
            )}
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-all">
              {isUploading
                ? t("adminMisc.newProgram.uploadingAssets")
                : t("adminMisc.newProgram.attachProgramMaterials")}
            </p>
          </div>
        </div>

        {program.materials.length > 0 && (
          <div className="space-y-2">
            {program.materials.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-[10px] font-bold text-emerald-100 truncate uppercase">
                    {file.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMaterial(index)}
                  className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
