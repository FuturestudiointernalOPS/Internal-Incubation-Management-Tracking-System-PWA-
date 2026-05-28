<>            <div className="space-y-8 animate-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {/* STRATEGIC MATERIALS (PDFs) — MOVED TO TOP FOR VISIBILITY */}
                  <div className="space-y-6 mb-8">
                    <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      Assigned Materials
                    </h3>
                    <div className="card space-y-4">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                        Assigned Assets & Curriculum PDFs
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {(() => {
                          let materials = [];
                          const raw = program?.materials;
                          const kbAssets = program?.knowledge_assets || [];

                          if (raw) {
                            if (Array.isArray(raw))
                              materials = raw.filter(
                                (i) => i && i !== "[]" && i !== "",
                              );
                            else if (typeof raw === "string") {
                              if (raw.startsWith("[") || raw.startsWith("{")) {
                                try {
                                  let parsed = JSON.parse(raw);
                                  if (typeof parsed === "string")
                                    parsed = JSON.parse(parsed);
                                  materials = Array.isArray(parsed)
                                    ? parsed.filter(
                                        (i) => i && i !== "[]" && i !== "",
                                      )
                                    : [parsed];
                                } catch (e) {
                                  materials = raw === "[]" ? [] : [raw];
                                }
                              } else {
                                materials =
                                  raw === "" || raw === "[]" ? [] : [raw];
                              }
                            }
                          }

                          // Merge with Knowledge Base Assets with safe mapping
                          const allMaterials = [
                            ...materials.map((m) => {
                              let item = m;
                              // Handle stringified JSON inside array items
                              if (typeof item === "string") {
                                try {
                                  let p = JSON.parse(item);
                                  if (typeof p === "string") p = JSON.parse(p);
                                  if (Array.isArray(p)) item = p[0];
                                  else item = p;
                                } catch (e) {}
                              }
                              if (Array.isArray(item)) item = item[0];
                              if (item && typeof item === "object") {
                                return {
                                  name:
                                    item.name ||
                                    item.NAME ||
                                    item.title ||
                                    item.TITLE ||
                                    "Program Document",
                                  url:
                                    item.url ||
                                    item.URL ||
                                    item.path ||
                                    item.PATH ||
                                    "",
                                  source: "curriculum",
                                };
                              }
                              if (typeof m === "string" && m.trim())
                                return {
                                  url: m,
                                  name: m.split("/").pop(),
                                  source: "curriculum",
                                };
                              return null;
                            }),
                            ...kbAssets.map((a) => {
                              if (typeof a === "object" && a !== null)
                                return { ...a, source: "knowledge" };
                              if (typeof a === "string" && a.trim())
                                return {
                                  url: a,
                                  name: a.split("/").pop(),
                                  source: "knowledge",
                                };
                              return null;
                            }),
                          ].filter(
                            (item) =>
                              item && (item.name || item.url || item.path),
                          );

                          if (allMaterials.length === 0) {
                            return (
                              <p className="text-xs italic text-[var(--text-secondary)] opacity-40 p-4 border border-dashed border-[var(--border-primary)] rounded-xl text-center">
                                No assigned materials have been anchored to this
                                program yet.
                              </p>
                            );
                          }

                          return allMaterials.map((file, idx) => {
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
                                    : "Program Document")
                                : typeof file === "string"
                                  ? file.split("/").pop()
                                  : "Program Document";
                            const name = rawName
                              .replace(/\.[^.]+$/, "") // strip extension (.pdf, .docx…)
                              .replace(/[_\-]+/g, " ") // underscores/hyphens → spaces
                              .replace(/\s+/g, " ") // collapse extra spaces
                              .trim()
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case
                            const isKB = file.source === "knowledge";

                            // Items without valid URL will still show name, OPEN will use in-app viewer

                            return (
                              <div
                                key={idx}
                                className={`w-full flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border transition-all group text-left ${isKB ? "border-emerald-500/30 hover:border-emerald-500" : "border-[var(--border-primary)] hover:border-blue-500/50"}`}
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
                                        ? "Knowledge Asset"
                                        : "Program Material"}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActivePDF({ url: url || "#", name });
                                  }}
                                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isKB ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20"}`}
                                >
                                  OPEN
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
                    Program Identity
                  </h3>
                  <div className="card space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Program Name
                      </label>
                      <input
                        ref={configNameRef}
                        type="text"
                        defaultValue={program?.name}
                        disabled={user.role === "program_manager"}
                        className={`w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold ${user.role === "program_manager" ? "opacity-50 cursor-not-allowed" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Concept Note
                      </label>
                      <textarea
                        ref={configDescRef}
                        rows="4"
                        defaultValue={program?.description}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          Duration (Weeks)
                        </label>
                        <input
                          ref={configWeeksRef}
                          type="number"
                          defaultValue={program?.duration_weeks}
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          Operational Status
                        </label>
                        <select
                          ref={configStatusRef}
                          defaultValue={program?.status}
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                        >
                          <option value="active">ACTIVE</option>
                          <option value="archived">ARCHIVED</option>
                          <option value="draft">DRAFT</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white" /> Project
                          Start Date
                        </label>
                        <input
                          ref={configStartRef}
                          type="date"
                          defaultValue={
                            program?.start_date
                              ? new Date(program.start_date)
                                  .toISOString()
                                  .split("T")[0]
                              : ""
                          }
                          className="w-full bg-[var(--bg-primary)] border border-emerald-500/30 rounded-lg px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white" /> Project
                          Finish Date
                        </label>
                        <input
                          ref={configEndRef}
                          type="date"
                          defaultValue={
                            program?.end_date
                              ? new Date(program.end_date)
                                  .toISOString()
                                  .split("T")[0]
                              : ""
                          }
                          className="w-full bg-[var(--bg-primary)] border border-rose-500/30 rounded-lg px-4 py-3 text-sm focus:border-rose-500 outline-none transition-all font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                        PROGRAM MANAGER
                      </label>
                      <div className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--brand-orange)] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4" />
                          <span className="uppercase">
                            {program?.pm_name || "Not Assigned"}
                          </span>
                        </div>
                        <Shield className="w-4 h-4 opacity-30" />
                      </div>
                    </div>
                    <button
                      onClick={saveConfig}
                      disabled={isSaving}
                      className="btn btn-primary w-full py-4 mt-4 gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Synchronize Global Settings"}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-500" />
                    Strategic KPIs
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
                          {program.knowledge_assets?.map((asset, idx) => (
                            <button
                              key={idx}
                              onClick={() =>
                                setActivePDF({
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
                    <div className="space-y-2">
                      {kpis.map((kpi) => (
                        <div
                          key={kpi.id}
                          className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
                        >
                          <span className="font-bold text-sm uppercase tracking-tight">
                            {kpi.title}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-[var(--brand-orange)]">
                              {kpi.target_value}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
</>