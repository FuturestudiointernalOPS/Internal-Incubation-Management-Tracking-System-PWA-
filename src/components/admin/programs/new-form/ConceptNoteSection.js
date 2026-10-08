import { FileText, Plus, Upload } from "lucide-react";

/** Concept note: rich text, external link or document upload. */
export default function ConceptNoteSection({ t, program, setProgram }) {
  return (
    <div className="space-y-4">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
        {t("admin.conceptNote")}
      </label>

      {/* Input type selector */}
      <div className="flex gap-2 bg-primary rounded-xl p-1.5 border border-[var(--border-primary)] w-fit">
        {[
          { id: "text", label: t("admin.richText"), icon: FileText },
          { id: "link", label: t("admin.externalLink"), icon: Plus },
          {
            id: "upload",
            label: t("admin.uploadDocument"),
            icon: Upload,
          },
        ].map((inputOption) => (
          <button
            key={inputOption.id}
            type="button"
            onClick={() =>
              setProgram({ ...program, conceptNoteType: inputOption.id })
            }
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              (program.conceptNoteType || "text") === inputOption.id
                ? "bg-[var(--brand-orange)] text-black"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <inputOption.icon className="w-3.5 h-3.5" />
            {inputOption.label}
          </button>
        ))}
      </div>

      {/* Rich Text / Description Input */}
      {(program.conceptNoteType || "text") === "text" && (
        <textarea
          rows={4}
          value={program.description}
          onChange={(event) =>
            setProgram({ ...program, description: event.target.value })
          }
          placeholder={t("adminMisc.newProgram.conceptNotePlaceholder")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
        />
      )}

      {/* External Link Input */}
      {program.conceptNoteType === "link" && (
        <input
          type="url"
          value={program.conceptNoteLink || ""}
          onChange={(event) =>
            setProgram({ ...program, conceptNoteLink: event.target.value })
          }
          placeholder="https://docs.google.com/..."
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      )}

      {/* File Upload Input */}
      {program.conceptNoteType === "upload" && (
        <div className="relative group">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setProgram({
                  ...program,
                  conceptNoteFile: file.name,
                  conceptNoteFileSize: file.size,
                });
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border-primary)] rounded-2xl group-hover:border-[var(--brand-orange)] transition-all bg-primary/50">
            <Upload className="w-8 h-8 text-slate-500 group-hover:text-[var(--brand-orange)] mb-3 transition-all" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-all">
              {program.conceptNoteFile ||
                t("adminMisc.newProgram.clickToUpload")}
            </p>
            {program.conceptNoteFile && (
              <p className="text-[10px] font-medium text-emerald-400 mt-2">
                {t("adminMisc.newProgram.fileSelected", {
                  name: program.conceptNoteFile,
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
