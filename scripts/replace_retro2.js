const fs = require('fs');
const path = require('path');
const filePath = path.join(process.cwd(), 'src/app/staff/op-report/page.js');
let content = fs.readFileSync(filePath, 'utf8');

const retroStart = `            ) : (
              <div className="space-y-6">`;

const retroEnd = `              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── STANDUP CREATION MODAL ─── */}`;

const newRetro = `            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Friday Retro
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Review this week&#39;s tasks. Uncompleted tasks auto-carry to next week.
                  </p>
                </div>

                {/* Weekly Task Review */}
                <div className="overflow-hidden rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                        <th className="w-12 px-3 py-2.5 text-center text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Done</th>
                        <th className="text-left px-3 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Task</th>
                        <th className="text-left px-3 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Project / Category</th>
                        <th className="text-left px-3 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Due</th>
                        <th className="text-left px-3 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Blockers</th>
                        <th className="text-left px-3 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                        <th className="text-left px-3 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.filter((t) => !["completed","archived"].includes(t.status)).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-40" />
                            <p className="text-[11px] font-medium text-slate-500">All tasks completed</p>
                            <p className="text-[9px] text-slate-600 mt-0.5">No outstanding work for this week</p>
                          </td>
                        </tr>
                      ) : (
                        tasks.filter((t) => !["completed","archived"].includes(t.status)).map((task) => {
                          const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                          const activeBlockers = (task.blockers || []).filter(b => b.status === "active");
                          const isChecked = reconciledTasks[task.id] === true;
                          const reason = taskReasons[task.id] || "";
                          return (
                            <tr key={task.id} className={\`border-b border-[var(--border-primary)]/40 hover:bg-tertiary/30 transition-colors \${isChecked ? "opacity-60" : ""}\`}>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => {
                                    if (activeBlockers.length > 0 && !isChecked) {
                                      alert("Resolve all blockers before completing this task.");
                                      return;
                                    }
                                    setReconciledTasks(prev => ({ ...prev, [task.id]: !isChecked }));
                                  }}
                                  className={\`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all \${isChecked ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-emerald-500/50"}\`}
                                >
                                  {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </button>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={\`text-[11px] font-medium \${isChecked ? "line-through text-slate-500" : "text-[var(--text-primary)]"}\`}>{task.title}</span>
                              </td>
                              <td className="px-3 py-2.5 text-[10px] text-slate-500">
                                {task.project_id ? (assignedProjects.find(p => String(p.id) === String(task.project_id))?.name || "Project") : task.category || "\u2014"}
                              </td>
                              <td className="px-3 py-2.5 text-[10px] text-slate-500">{formatDate(task.end_date)}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  {activeBlockers.length > 0 ? (
                                    <span className="text-[9px] text-rose-400 font-medium">{activeBlockers.length} active</span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600">0</span>
                                  )}
                                  <button
                                    onClick={() => setBlockerModal(task.id)}
                                    className="text-[9px] text-[var(--brand-orange)] hover:underline ml-1"
                                  >
                                    Manage
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                {!isChecked && (
                                  <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setTaskReasons(prev => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Why not completed?"
                                    className="w-full bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[9px] font-medium text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                                  />
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={\`text-[8px] font-semibold px-1.5 py-0.5 rounded-full \${config.bg} \${config.color}\`}>{config.label}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Wins & Achievements */}
                <div>
                  <h3 className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> Wins & Achievements
                  </h3>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      {form.wins.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)] shrink-0" />
                          <span className="flex-1 text-[11px] font-medium text-[var(--text-primary)]">{item}</span>
                          <button onClick={() => setForm(p => ({ ...p, wins: p.wins.filter((_, i) => i !== idx) }))} className="text-rose-500/50 hover:text-rose-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={newWin} onChange={e => setNewWin(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && newWin.trim()) { e.preventDefault(); setForm(p => ({ ...p, wins: [...p.wins, newWin.trim()] })); setNewWin(""); } }}
                        placeholder="Add a key win..." className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[10px] font-medium outline-none focus:border-[var(--brand-orange)] transition-all" />
                      <button onClick={() => { if (newWin.trim()) { setForm(p => ({ ...p, wins: [...p.wins, newWin.trim()] })); setNewWin(""); } }}
                        className="px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-semibold hover:brightness-110 transition-all">Add</button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <h3 className="text-[11px] font-semibold text-slate-500 mb-2">Notes</h3>
                  <textarea value={form.retro_notes} onChange={e => setForm(p => ({ ...p, retro_notes: e.target.value }))}
                    rows={2} placeholder="Any additional thoughts on this week?"
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none font-bold text-[var(--text-primary)] focus:border-slate-500 transition-all resize-none" />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={async () => {
                      const userId = user?.cid || user?.id;
                      const uncompleted = tasks.filter(t => !["completed","archived"].includes(t.status) && !reconciledTasks[t.id]);
                      for (const task of uncompleted) {
                        await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: task.id, status: "carried_over", user_id: userId, user_name: user?.name }) });
                      }
                      const completed = Object.entries(reconciledTasks).filter(([_, v]) => v);
                      for (const [taskId] of completed) {
                        await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: parseInt(taskId), status: "completed", user_id: userId, user_name: user?.name }) });
                      }
                      notify("Retro submitted. Uncompleted tasks carried over.", "success");
                      fetchTasks();
                      setReconciledTasks({});
                      setTaskReasons({});
                    }}
                    disabled={saving}
                    className="px-5 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-semibold hover:brightness-110 transition-all"
                  >
                    Submit Retro
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── STANDUP CREATION MODAL ─── */}`;

const startIdx = content.indexOf(retroStart);
const endIdx = content.indexOf(retroEnd);
if (startIdx === -1 || endIdx === -1) { console.error('Could not find boundaries'); process.exit(1); }

content = content.substring(0, startIdx) + newRetro + content.substring(endIdx + retroEnd.length);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
