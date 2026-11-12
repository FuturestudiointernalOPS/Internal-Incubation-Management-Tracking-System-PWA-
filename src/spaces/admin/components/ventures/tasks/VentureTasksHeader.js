"use client";

import { ArrowLeft, CheckCircle2, Columns, List, Plus } from "lucide-react";

export default function VentureTasksHeader({
  router,
  id,
  venture,
  totalTasks,
  doneTasks,
  view,
  setView,
  search,
  setSearch,
  openCreateTask,
}) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <button onClick={() => router.push(`/admin/ventures/${id}`)}
          className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
          <ArrowLeft className="w-3 h-3" /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-[var(--brand-orange)]" /> Tasks
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""} · {totalTasks} tasks · {doneTasks} done</p>
      </div>
      <div className="flex items-center gap-3">
        {/* View toggle */}
        <div className="flex bg-tertiary rounded-xl border border-[var(--border-primary)] p-0.5">
          <button onClick={() => setView("kanban")} className={`p-2 rounded-lg transition-all ${view === "kanban" ? "bg-brand-orange/10 text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}>
            <Columns className="w-4 h-4" />
          </button>
          <button onClick={() => setView("list")} className={`p-2 rounded-lg transition-all ${view === "list" ? "bg-brand-orange/10 text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." className="w-40 bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] placeholder:text-slate-600" />
        </div>
        <button onClick={openCreateTask}
          className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>
    </div>
  );
}
