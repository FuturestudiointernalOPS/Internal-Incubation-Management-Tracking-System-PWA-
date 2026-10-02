import { useI18n } from "@/lib/i18n";
import {
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  RefreshCw,
  Save,
  Shield,
  User,
  Zap,
} from "lucide-react";

export default function ConfigTab({
  configDescRef,
  configEndRef,
  configGradingRef,
  configNameRef,
  configStartRef,
  configStatusRef,
  configWeeksRef,
  isSaving,
  kpis,
  onActivePDF,
  onOpenPdfViewer,
  onRecalculateKpis,
  onSaveConfig,
  program,
  user,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-8 animate-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* STRATEGIC MATERIALS (PDFs) — MOVED TO TOP FOR VISIBILITY */}
          <div className="space-y-6 mb-8">
            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              {t("pmMisc.workspace.configAssignedMaterials")}
            </h3>
            <div className="card space-y-4">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                {t("pmMisc.workspace.configAssignedAssets")}
              </p>
              <div className="grid grid-cols-1 gap-3">
                {(() => {
                  let materials = [];
                  const rawMaterials = program?.materials;
                  const knowledgeAssets = program?.knowledge_assets || [];

                  if (rawMaterials) {
                    if (Array.isArray(rawMaterials))
                      materials = rawMaterials.filter(
                        (entry) => entry && entry !== "[]" && entry !== "",
                      );
                    else if (typeof rawMaterials === "string") {
                      if (
                        rawMaterials.startsWith("[") ||
                        rawMaterials.startsWith("{")
                      ) {
                        try {
                          let parsed = JSON.parse(rawMaterials);
                          if (typeof parsed === "string")
                            parsed = JSON.parse(parsed);
                          materials = Array.isArray(parsed)
                            ? parsed.filter(
                                (entry) =>
                                  entry && entry !== "[]" && entry !== "",
                              )
                            : [parsed];
                        } catch {
                          materials =
                            rawMaterials === "[]" ? [] : [rawMaterials];
                        }
                      } else {
                        materials =
                          rawMaterials === "" || rawMaterials === "[]"
                            ? []
                            : [rawMaterials];
                      }
                    }
                  }

                  // Merge with Knowledge Base Assets with safe mapping
                  const allMaterials = [
                    ...materials.map((material) => {
                      let item = material;
                      // Handle stringified JSON inside array items
                      if (typeof item === "string") {
                        try {
                          let parsed = JSON.parse(item);
                          if (typeof parsed === "string")
                            parsed = JSON.parse(parsed);
                          if (Array.isArray(parsed)) item = parsed[0];
                          else item = parsed;
                        } catch {}
                      }
                      if (Array.isArray(item)) item = item[0];
                      if (item && typeof item === "object") {
                        return {
                          name:
                            item.name ||
                            item.NAME ||
                            item.title ||
                            item.TITLE ||
                            t("pmMisc.workspace.programDocument"),
                          url:
                            item.url ||
                            item.URL ||
                            item.path ||
                            item.PATH ||
                            "",
                          source: "curriculum",
                        };
                      }
                      if (typeof material === "string" && material.trim())
                        return {
                          url: material,
                          name: material.split("/").pop(),
                          source: "curriculum",
                        };
                      return null;
                    }),
                    ...knowledgeAssets.map((asset) => {
                      if (typeof asset === "object" && asset !== null)
                        return { ...asset, source: "knowledge" };
                      if (typeof asset === "string" && asset.trim())
                        return {
                          url: asset,
                          name: asset.split("/").pop(),
                          source: "knowledge",
                        };
                      return null;
                    }),
                  ].filter(
                    (item) => item && (item.name || item.url || item.path),
                  );

                  if (allMaterials.length === 0) {
                    return (
                      <p className="text-xs italic text-[var(--text-secondary)] opacity-40 p-4 border border-dashed border-[var(--border-primary)] rounded-xl text-center">
                        {t("pmMisc.workspace.noMaterialsAnchored")}
                      </p>
                    );
                  }

                  return allMaterials.map((file, index) => {
                    const url =
                      typeof file === "object"
                        ? file.url || file.URL || file.path || ""
                        : typeof file === "string"
                          ? file
                          : "";
                    const rawName =
                      typeof file === "object"
                        ? file.name ||
                          file.NAME ||
                          file.title ||
                          file.TITLE ||
                          (typeof (file.url || file.URL) === "string"
                            ? (file.url || file.URL).split("/").pop()
                            : t("pmMisc.workspace.programDocument"))
                        : typeof file === "string"
                          ? file.split("/").pop()
                          : t("pmMisc.workspace.programDocument");
                    const name = rawName
                      .replace(/\.[^.]+$/, "") // strip extension (.pdf, .docx…)
                      .replace(/[_-]+/g, " ") // underscores/hyphens → spaces
                      .replace(/\s+/g, " ") // collapse extra spaces
                      .trim()
                      .toLowerCase()
                      .replace(/\b\w/g, (char) => char.toUpperCase()); // Title Case
                    const isKB = file.source === "knowledge";

                    // Items without valid URL will still show name, OPEN will use in-app viewer

                    return (
                      <div
                        key={index}
                        className={`w-full flex items-center justify-between p-4 bg-tertiary rounded-xl border transition-all group text-left ${isKB ? "border-emerald-500/30 hover:border-emerald-500" : "border-[var(--border-primary)] hover:border-blue-500/50"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${isKB ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"}`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[200px] block">
                              {name}
                            </span>
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest ${isKB ? "text-emerald-500" : "text-blue-500"}`}
                            >
                              {isKB
                                ? t("pmMisc.workspace.knowledgeAsset")
                                : t("pmMisc.workspace.programMaterial")}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenPdfViewer(url)}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isKB ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20"}`}
                        >
                          {t("pmMisc.workspace.open")}
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
            {t("pmMisc.workspace.configProgramIdentity")}
          </h3>
          <div className="card space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.programName")}
              </label>
              <input
                ref={configNameRef}
                type="text"
                defaultValue={program?.name}
                disabled={user.role === "program_manager"}
                className={`w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold ${user.role === "program_manager" ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.conceptNote")}
              </label>
              <textarea
                ref={configDescRef}
                rows="4"
                defaultValue={program?.description}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.durationWeeks")}
                </label>
                <input
                  ref={configWeeksRef}
                  type="number"
                  defaultValue={program?.duration_weeks}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.operationalStatus")}
                </label>
                <select
                  ref={configStatusRef}
                  defaultValue={program?.status}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                >
                  <option value="active">
                    {t("pmMisc.workspace.programStatusActive")}
                  </option>
                  <option value="archived">
                    {t("pmMisc.workspace.programStatusArchived")}
                  </option>
                  <option value="draft">
                    {t("pmMisc.workspace.programStatusDraft")}
                  </option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-purple-500 flex items-center gap-2">
                  <Shield className="w-3 h-3 text-white" />{" "}
                  {t("pmMisc.workspace.gradingMode")}
                </label>
                <select
                  ref={configGradingRef}
                  defaultValue={program?.grading_mode || "graded"}
                  className="w-full bg-primary border border-purple-500/30 rounded-lg px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all font-bold"
                >
                  <option value="graded">
                    {t("pmMisc.workspace.gradingGraded")}
                  </option>
                  <option value="review">
                    {t("pmMisc.workspace.gradingReviewOnly")}
                  </option>
                  <option value="followup">
                    {t("pmMisc.workspace.gradingFollowup")}
                  </option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-white" />{" "}
                  {t("pmMisc.workspace.projectStartDate")}
                </label>
                <input
                  ref={configStartRef}
                  type="date"
                  defaultValue={
                    program?.start_date
                      ? new Date(program.start_date).toISOString().split("T")[0]
                      : ""
                  }
                  className="w-full bg-primary border border-emerald-500/30 rounded-lg px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-white" />{" "}
                  {t("pmMisc.workspace.projectFinishDate")}
                </label>
                <input
                  ref={configEndRef}
                  type="date"
                  defaultValue={
                    program?.end_date
                      ? new Date(program.end_date).toISOString().split("T")[0]
                      : ""
                  }
                  className="w-full bg-primary border border-rose-500/30 rounded-lg px-4 py-3 text-sm focus:border-rose-500 outline-none transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-1 mt-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                {t("pmMisc.workspace.programManager")}
              </label>
              <div className="w-full bg-primary/50 border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--brand-orange)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4" />
                  <span className="uppercase">
                    {program?.pm_name || t("pmMisc.workspace.notAssigned")}
                  </span>
                </div>
                <Shield className="w-4 h-4 opacity-30" />
              </div>
            </div>
            <button
              onClick={onSaveConfig}
              disabled={isSaving}
              className="btn btn-primary w-full py-4 mt-4 gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving
                ? t("pmMisc.workspace.saving")
                : t("pmMisc.workspace.syncGlobalSettings")}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" />
            {t("pmMisc.workspace.configStrategicKpis")}
            <button
              onClick={onRecalculateKpis}
              className="ml-auto text-[8px] font-black text-purple-400 uppercase hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-500/10 transition-all"
            >
              <RefreshCw className="w-3 h-3" />{" "}
              {t("pmMisc.workspace.recalculate")}
            </button>
          </h3>
          <div className="card space-y-4">
            {/* READ-ONLY KNOWLEDGE BASE FOR PM */}
            {program?.note_title && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-[11px] font-black uppercase text-white tracking-tight">
                    {program.note_title}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  {program.note_description}
                </p>
                <div className="space-y-2 pt-2 border-t border-emerald-500/10">
                  {program.knowledge_assets?.map((asset, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        onActivePDF({
                          url: asset.url,
                          name: asset.name,
                        })
                      }
                      className="w-full flex items-center justify-between p-2 hover:bg-emerald-500/10 rounded-lg transition-all group"
                    >
                      <span className="text-[9px] font-bold text-slate-300 uppercase truncate">
                        {asset.name}
                      </span>
                      <ExternalLink className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {kpis.map((kpi, kpiIdx) => {
                const kpiProgress = kpi.progress || 0;
                const isMeasurable = kpi.measurable !== false;
                return (
                  <div
                    key={kpi.id}
                    className="card !p-4 hover:border-brand-orange/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.kpi")} {kpiIdx + 1}
                      </span>
                      <span className="text-sm font-black text-[var(--brand-orange)]">
                        {isMeasurable ? `${kpiProgress}%` : "—"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight mb-3 group-hover:text-[var(--brand-orange)] transition-colors">
                      {kpi.title}
                    </p>
                    <div className="w-full h-2 bg-divider/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full transition-all duration-700"
                        style={{ width: `${isMeasurable ? kpiProgress : 0}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {isMeasurable ? (
                        <span className="text-[10px] font-bold text-slate-500">
                          {kpi.linkedDocs} {t("pmMisc.workspace.docsLower")}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600">
                          {t("pmMisc.workspace.nonMeasurable")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {kpis.length === 0 && (
                <div className="col-span-full p-8 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.noKpisConfigured")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
