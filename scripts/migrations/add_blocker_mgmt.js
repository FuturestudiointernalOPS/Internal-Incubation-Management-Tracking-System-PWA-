const fs = require('fs');
const path = require('path');
let content = fs.readFileSync(path.join(process.cwd(), 'src/app/staff/op-report/page.js'), 'utf8');

// Add Manage blocker button in retro expanded task table
content = content.replace(
  `<td className="px-3 py-2.5">{ab.length > 0 ? <span className="text-[9px] text-rose-400 font-medium">{ab.length} active</span> : <span className="text-[9px] text-slate-600">0</span>}</td>`,
  `<td className="px-3 py-2.5"><div className="flex items-center gap-1.5">{ab.length > 0 ? <span className="text-[9px] text-rose-400 font-medium">{ab.length} active</span> : <span className="text-[9px] text-slate-600">0</span>}<button onClick={() => setBlockerModal({type:'api',taskId:task.id})} className="text-[9px] text-[var(--brand-orange)] hover:underline ml-1">Manage</button></div></td>`
);

// Update blocker modal to handle API tasks (type: 'api', taskId: N)
// First: update the title to show the task name from API tasks
content = content.replace(
  `{taskRows[blockerModal]?.name || "Untitled"}`,
  `{blockerModal.type === 'api' ? tasks.find(t => t.id === blockerModal.taskId)?.title || 'Task' : taskRows[blockerModal]?.name || 'Untitled'}`
);

// Second: update blocker list to show API task blockers
content = content.replace(
  `{(taskRows[blockerModal]?.blockers || []).length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-4">
                  No blockers declared yet.
                </p>
              )}
              {(taskRows[blockerModal]?.blockers || []).map((b) => (`,
  `{const currentBlockers = blockerModal.type === 'api' ? (tasks.find(t => t.id === blockerModal.taskId)?.blockers || []) : (taskRows[blockerModal]?.blockers || []);}
              {currentBlockers.length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-4">
                  No blockers declared yet.
                </p>
              )}
              {currentBlockers.map((b) => (`
);

// Third: update resolveBlocker call to use API
content = content.replace(
  `onClick={() => resolveBlocker(blockerModal, b.id)}`,
  `onClick={async () => { if (blockerModal.type === 'api') { await fetch('/api/blockers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, user_id: user?.cid || user?.id, status: 'resolved', resolved_by: user?.cid || user?.id }) }); fetchTasks(); } else { resolveBlocker(blockerModal, b.id); } }}`
);

// Fourth: update add blocker to use API
content = content.replace(
  `addBlockerToRow(blockerModal, newBlockerDesc.trim())`,
  `blockerModal.type === 'api' ? (async () => { await fetch('/api/blockers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: blockerModal.taskId, user_id: user?.cid || user?.id, user_name: user?.name || '', title: newBlockerDesc.trim() }) }); setNewBlockerDesc(''); fetchTasks(); })() : addBlockerToRow(blockerModal, newBlockerDesc.trim())`
);

fs.writeFileSync(path.join(process.cwd(), 'src/app/staff/op-report/page.js'), content, 'utf8');
console.log('Done');
