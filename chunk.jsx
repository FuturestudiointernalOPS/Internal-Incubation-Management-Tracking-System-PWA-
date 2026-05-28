<>                  .map((session) => (
                                    <div
                                      key={session.id}
                    className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all shadow-xl bg-[var(--bg-secondary)] group mb-4"
                  >
                    {/* STEP 0: THE HEADER (GLOBAL STATE) — click to toggle */}
                    <div
                      onClick={() =>
                        setExpandedSessionId(
                          expandedSessionId === session.id ? null : session.id,
                        )
                      }
                      className="px-6 py-4 bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-inner">
                          <span className="text-[10px] font-black text-[var(--text-secondary)] opacity-50">
                            WK
                          </span>
                          <span className="text-sm font-black text-[var(--brand-orange)] -mt-1">
                            {session.week_number}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">
                            {session.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`w-2 h-2 rounded-full animate-pulse ${
                                session.status === "completed"
                                  ? "bg-emerald-500"
                                  : session.status === "in progress"
                                    ? "bg-indigo-500"
                                    : "bg-amber-500"
                              }`}
                            />
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              State: {session.status}
                            </span>
                            {session.scheduled_date && (
                              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-2">
                                📅{" "}
                                {new Date(
                                  session.scheduled_date,
                                ).toLocaleDateString()}
                              </span>
                            )}
                            {session.notes && (
                              <span
                                className="text-[9px] font-black text-amber-400 uppercase tracking-widest ml-2"
                                title={session.notes}
                              >
                                📌 Notes
                              </span>
                            )}
                          </div>
                          {session.handler_name && (
                            <div className="flex items-center gap-1 mt-1">
                              <Users className="w-3 h-3 text-slate-500" />
                              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                {session.handler_name}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {(() => {
                              try {
                                const ids =
                                  typeof session.kpi_ids === "string"
                                    ? JSON.parse(session.kpi_ids)
                                    : session.kpi_ids || [];
                                return kpis
                                  .filter((k) => ids.includes(k.id))
                                  .map((k) => (
                                    <span
                                      key={k.id}
                                      className="px-2 py-0.5 bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] text-[8px] font-black uppercase tracking-widest rounded-md"
                                    >
                                      {k.title}
                                    </span>
                                  ));
                              } catch (e) {
                                return null;
                              }
                            })()}
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSessionId(session.id);
                            setSelectedSessionForAttendance(session);
                            setShowAttendanceModal(true);
                          }}
                          className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5 transition-all"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase italic tracking-wider">
                            Attendance
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSessionId(session.id);
                            setShowPMReportModal(true);
                          }}
                          className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 transition-all"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase italic tracking-wider">
                            Give Weekly Report
                          </span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            className="p-2 text-rose-500/20 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      className={`p-6 ${expandedSessionId !== session.id ? "hidden" : ""}`}
                    >
                      <div className="space-y-8">
                        {/* PHASE 1: LOGISTICS (THE SETUP) */}
                        <div className="space-y-6">
                          <div className="flex items-center gap-2 pb-3 border-b border-indigo-500/20">
                            <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[9px] font-black text-indigo-500 border border-indigo-500/20 shadow-sm">
                              1
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">
                              Logistics & Deployment
                            </span>
                          </div>

                          <div className="space-y-4 p-5 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)] shadow-sm">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                Assign Staff Member
                              </label>
                              <select
                                value={session.handler_id || ""}
                                onChange={(e) => {
                                  const staff = assignedStaff.find(
                                    (s) => String(s.cid) === e.target.value,
                                  );
                                  updateSessionField(
                                    session.id,
                                    "handler_id",
                                    e.target.value,
                                    staff?.name,
                                  );
                                }}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
                              >
                                <option value="">Select Member...</option>
                                {programTeamMembers.length > 0
                                  ? programTeamMembers.map((s) => (
                                      <option key={s.cid} value={s.cid}>
                                        {s.name} ({s.role})
                                      </option>
                                    ))
                                  : assignedStaff.map((s) => (
                                      <option key={s.cid} value={s.cid}>
                                        {s.name} ({s.role})
                                      </option>
                                    ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-white" />{" "}
                                  Start Date
                                </label>
                                <input
                                  type="date"
                                  value={
                                    session.scheduled_date
                                      ? new Date(session.scheduled_date)
                                          .toISOString()
                                          .split("T")[0]
                                      : ""
                                  }
                                  onChange={(e) =>
                                    updateSessionField(
                                      session.id,
                                      "scheduled_date",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-white" />{" "}
                                  Finish Date
                                </label>
                                <input
                                  type="date"
                                  value={
                                    session.end_date
                                      ? new Date(session.end_date)
                                          .toISOString()
                                          .split("T")[0]
                                      : ""
                                  }
                                  onChange={(e) =>
                                    updateSessionField(
                                      session.id,
                                      "end_date",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>

                            <div className="pt-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                Operational State
                              </label>
                              <select
                                value={session.status}
                                onChange={(e) =>
                                  updateSessionStatus(
                                    session.id,
                                    e.target.value,
                                  )
                                }
                                className={`w-full mt-1 px-4 py-3 rounded-xl border text-[10px] font-black uppercase outline-none transition-all cursor-pointer ${
                                  session.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                    : session.status === "in progress"
                                      ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/30"
                                      : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                }`}
                              >
                                <option value="pending">PENDING</option>
                                <option value="in progress">IN PROGRESS</option>
                                <option value="completed">COMPLETED</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* SEPARATOR */}
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

                        {/* PHASE 2: CURRICULUM (THE CORE) */}
                        <div className="space-y-6">
                          <div className="flex items-center justify-between pb-3 border-b border-[var(--brand-orange)]/20">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[9px] font-black text-[var(--brand-orange)] border border-[var(--brand-orange)]/20 shadow-sm">
                                2
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                                Assessments & Deliverables
                              </span>
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setSelectedSessionId(session.id);
                                  setShowRequirementModal(true);
                                }}
                                className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add Requirement
                              </button>
                            )}
                          </div>

                          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                            {requirements
                              .filter((r) => r.session_id === session.id)
                              .map((req) => (
                                <div
                                  key={req.id}
                                  className="flex items-center justify-between p-4 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all shadow-sm"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-500/5 flex items-center justify-center">
                                      <FileText className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight">
                                        {req.title}
                                      </p>
                                      <p className="text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-0.5 italic">
                                        Requirement:{" "}
                                        {req.allowed_format || "PDF"}
                                      </p>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <button className="text-rose-500/10 hover:text-rose-500 transition-all">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            {requirements.filter(
                              (r) => r.session_id === session.id,
                            ).length === 0 && (
                              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-3xl opacity-30">
                                <Shield className="w-10 h-10 mb-2" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">
                                  No Requirements Set
                                </p>
                              </div>
                            )}
                          </div>
                          <p className="text-[8px] font-bold text-slate-500/50 uppercase tracking-widest italic text-center px-6">
                            These items are formal evidence submitted by
                            participants for final graduation scoring.
                          </p>
                        </div>

                        {/* SEPARATOR */}
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                        {/* PHASE 3: RESOURCES (THE SUPPORT) */}
                        <div className="space-y-6">
                          <div className="flex items-center justify-between pb-3 border-b border-blue-500/20">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-black text-blue-500 border border-blue-500/20 shadow-sm">
                                3
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
                                Weekly Resources
                              </span>
                            </div>
                            {canEdit && (
                              <label className="text-[9px] font-black text-blue-500 uppercase hover:underline cursor-pointer flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Upload
                                <input
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    notify("Syncing material...", "info");
                                    try {
                                      const res = await fetch(
                                        "/api/pm/curriculum",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            action: "anchor_material",
                                            program_id: id,
                                            session_id: session.id,
                                            file_name: file.name,
                                          }),
                                        },
                                      );
                                      if ((await res.json()).success) {
                                        notify("Material anchored.");
                                        fetchProgramData(true);
                                      }
                                    } catch (e) {
                                      notify("Upload failed.", "error");
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          <div className="space-y-3">
                            {/* Institutional Assets */}
                            {(program?.knowledge_assets || []).map(
                              (kb, kIdx) => (
                                <div
                                  key={`kb-${kIdx}`}
                                  className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex flex-col gap-3 group/asset shadow-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <BookOpen className="w-4 h-4 text-emerald-500" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black text-[var(--text-primary)] uppercase truncate leading-none">
                                        {kb.name || "Core Asset"}
                                      </p>
                                      <p className="text-[7px] text-emerald-600 font-black uppercase tracking-widest mt-1">
                                        Institutional Intelligence
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      setActivePDF({
                                        url: kb.url,
                                        name: kb.name,
                                      })
                                    }
                                    className="w-full py-2 bg-emerald-500/10 rounded-lg text-[9px] font-black text-emerald-600 uppercase hover:bg-emerald-500/20 transition-all border border-emerald-500/10"
                                  >
                                    View Asset
                                  </button>
                                </div>
                              ),
                            )}

                            {/* Weekly Specific */}
                            {(() => {
                              let sessionMaterials = [];
                              try {
                                sessionMaterials =
                                  typeof session.materials === "string"
                                    ? JSON.parse(session.materials || "[]")
                                    : session.materials || [];
                              } catch (e) {
                                sessionMaterials = [];
                              }

                              return sessionMaterials.map((mat, mIdx) => (
                                <div
                                  key={`mat-${mIdx}`}
                                  className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex flex-col gap-3 group/asset shadow-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <Zap className="w-4 h-4 text-blue-500" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black text-[var(--text-primary)] uppercase truncate leading-none">
                                        {mat.name}
                                      </p>
                                      <p className="text-[7px] text-blue-600 font-black uppercase tracking-widest mt-1">
                                        Tactical Asset
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button className="flex-1 py-2 bg-blue-500/10 rounded-lg text-[9px] font-black text-blue-600 uppercase hover:bg-blue-500/20 transition-all border border-blue-500/10">
                                      View
                                    </button>
                                    <button className="px-3 py-2 bg-rose-500/5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all border border-rose-500/10">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ));
                            })()}

                            {(!session.materials ||
                              session.materials === "[]" ||
                              (Array.isArray(session.materials) &&
                                session.materials.length === 0)) &&
                              (!program?.knowledge_assets ||
                                program.knowledge_assets.length === 0) && (
                                <div className="py-8 text-center opacity-20 italic space-y-2">
                                  <Clock className="w-6 h-6 mx-auto" />
                                  <p className="text-[9px] font-bold uppercase">
                                    No Materials
                                  </p>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div></>