const fs = require('fs');
const path = require('path');
const f = p => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const w = (p, c) => fs.writeFileSync(path.join(process.cwd(), p), c, 'utf8');
let content = f('src/app/staff/op-report/page.js');
const oldRetro = content.indexOf('            ) : (\n              <div className="space-y-6">\n                <div>\n                  <h2 className="text-lg font-bold');
const retroEnd = content.indexOf('      {/* ─── STANDUP CREATION MODAL ─── */}');
const before = content.substring(0, oldRetro);
const after = content.substring(retroEnd);

const newRetro = `            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Friday Retro
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Review completed work by week
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Week</th>
                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</th>
                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Completed</th>
                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.filter(r => r.report_type === "standup" || r.report_type === "retro")
                        .reduce((unique, r) => { const key = r.week_number + "-" + r.year; if (!unique.find(x => x.week_number === r.week_number && x.year === r.year)) unique.push(r); return unique; }, [])
                        .map((report) => {
                          const weekKey = report.week_number + "-" + report.year;
                          const weekTasks = tasks.filter(t => t.created_week === report.week_number && t.created_year === report.year);
                          const completed = weekTasks.filter(t => t.status === "completed").length;
                          const isExpanded = expandedWeek === weekKey;
                          return (
                            <>
                              <tr key={weekKey} className="border-b border-[var(--border-primary)]/50 hover:bg-tertiary/50 transition-colors">
                                <td className="px-4 py-3"><span className="text-[13px] font-semibold text-[var(--text-primary)]">Week {report.week_number}</span><span className="text-[10px] text-slate-500 ml-2">{report.year}</span></td>
                                <td className="px-4 py-3 text-[12px] font-medium text-slate-500">{weekTasks.length} tasks</td>
                                <td className="px-4 py-3"><span className="text-[12px] font-medium text-emerald-400">{completed}/{weekTasks.length}</span></td>
                                <td className="px-4 py-3"><span className={\`text-[10px] font-semibold px-2.5 py-1 rounded-full \${completed === weekTasks.length && weekTasks.length > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}\`}>{completed === weekTasks.length && weekTasks.length > 0 ? "Complete" : "Review"}</span></td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => setExpandedWeek(isExpanded ? null : weekKey)} className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto">
                                    {isExpanded ? "Collapse" : "View"}<ChevronDown className={\`w-3 h-3 transition-transform \${isExpanded ? "rotate-180" : ""}\`} />
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={"t-" + weekKey}>
                                  <td colSpan={5} className="px-0 py-0">
                                    <div className="bg-tertiary/50 border-t border-[var(--border-primary)] p-4">
                                      {weekTasks.length === 0 ? (
                                        <p className="text-[11px] text-slate-500 text-center py-4">No tasks for this week</p>
                                      ) : (
                                        <div className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
                                          <table className="w-full">
                                            <thead>
                                              <tr className="bg-primary border-b border-[var(--border-primary)]">
                                                <th className="w-10 px-3 py-2 text-center text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Done</th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Task</th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Project</th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Due</th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Blockers</th>
                                                <th className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {weekTasks.map(task => { const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending; const ab = (task.blockers || []).filter(b => b.status === "active"); return (
                                                <tr key={task.id} className="border-b border-[var(--border-primary)]/40 hover:bg-primary/50 transition-colors">
                                                  <td className="px-3 py-2.5 text-center"><div className={\`w-4 h-4 rounded-full border-2 mx-auto \${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}\`}>{task.status === "completed" && <CheckCircle2 className="w-3 h-3 text-white" />}</div></td>
                                                  <td className="px-3 py-2.5"><span className={\`text-[11px] font-medium \${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"}\`}>{task.title}</span></td>
                                                  <td className="px-3 py-2.5 text-[10px] text-slate-500">{task.project_id ? (assignedProjects.find(p => String(p.id) === String(task.project_id))?.name || "Project") : task.category || "\u2014"}</td>
                                                  <td className="px-3 py-2.5 text-[10px] text-slate-500">{formatDate(task.end_date)}</td>
                                                  <td className="px-3 py-2.5">{ab.length > 0 ? <span className="text-[9px] text-rose-400 font-medium">{ab.length} active</span> : <span className="text-[9px] text-slate-600">0</span>}</td>
                                                  <td className="px-3 py-2.5"><span className={\`text-[8px] font-semibold px-1.5 py-0.5 rounded-full \${cfg.bg} \${cfg.color}\`}>{cfg.label}</span></td>
                                                </tr>
                                              );})}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      {history.filter(r => r.report_type === "standup" || r.report_type === "retro").length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                          <p className="text-[12px] font-medium text-slate-500">No weekly reports yet</p>
                          <p className="text-[10px] text-slate-600 mt-1">Complete a stand-up to see retro here</p>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── STANDUP CREATION MODAL ─── */}`;

content = before + newRetro + after;
w('src/app/staff/op-report/page.js', content);
console.log('Done');
