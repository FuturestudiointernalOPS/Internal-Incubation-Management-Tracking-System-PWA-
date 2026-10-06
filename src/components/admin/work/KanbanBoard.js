import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import KanbanTaskCard from "@/components/admin/work/KanbanTaskCard";

export default function KanbanBoard({
  columns,
  dragOverCol,
  onDragOver,
  onDragLeave,
  onDrop,
  expandedPrograms,
  expandedProjects,
  onToggleProgram,
  onToggleProject,
  isSuperAdmin,
  deletingTaskId,
  onDeleteTask,
  onDragStart,
  onDragEnd,
}) {
  const { t } = useI18n();
  const renderTaskCard = (task) => (
    <KanbanTaskCard
      key={task.id}
      task={task}
      isSuperAdmin={isSuperAdmin}
      deletingTaskId={deletingTaskId}
      onDelete={onDeleteTask}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    />
  );
  return (
    <div className="flex gap-4 overflow-x-auto pb-6 min-h-[70vh]">
      {columns.map((col) => (
        <div
          key={col.id}
          className={`flex-shrink-0 w-80 rounded-xl border flex flex-col transition-colors ${
            dragOverCol === col.id
              ? "border-brand-orange/40 bg-brand-orange/5"
              : "border-[var(--border-primary)] bg-tertiary/30"
          }`}
          onDragOver={(event) => onDragOver(event, col.id)}
          onDragLeave={onDragLeave}
          onDrop={(event) => onDrop(event, col.id)}
        >
          {/* Column Header */}
          <div
            className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] ${col.bg} rounded-t-xl`}
          >
            <div className="flex items-center gap-2">
              <col.icon className={`w-4 h-4 ${col.color}`} />
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${col.color}`}
              >
                {t(`adminMisc.work.column.${col.id}`)}
              </span>
            </div>
            <span className={`text-[10px] font-black ${col.color}`}>
              {col.total}
            </span>
          </div>

          {/* Column Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Programs with projects */}
            {col.programTree.map(({ program, projects: projs }) => {
              const isExpanded = expandedPrograms[program.id] !== false;
              return (
                <div key={program.id} className="space-y-1">
                  <button
                    onClick={() => onToggleProgram(program.id)}
                    className="flex items-center gap-1.5 w-full text-left text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wide hover:text-[var(--brand-orange)] transition-colors py-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 shrink-0" />
                    )}
                    <FolderOpen className="w-3 h-3 text-indigo-400" />
                    {program.name ||
                      program.title ||
                      t("adminMisc.work.programFallback", { id: program.id })}
                  </button>

                  {isExpanded && (
                    <div className="ml-3 pl-2 border-l-2 border-indigo-500/20 space-y-2">
                      {Object.values(projs).map(({ project, tasks }) => {
                        const pExpanded =
                          expandedProjects[project.id] !== false;
                        return (
                          <div key={project.id} className="space-y-1">
                            <button
                              onClick={() => onToggleProject(project.id)}
                              className="flex items-center gap-1 w-full text-left text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide hover:text-[var(--text-primary)] transition-colors py-0.5"
                            >
                              {pExpanded ? (
                                <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                              ) : (
                                <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                              )}
                              <Briefcase className="w-2.5 h-2.5 text-emerald-400" />
                              {project.name}{" "}
                              <span className="text-[10px] font-medium text-[var(--text-secondary)] normal-case ml-1">
                                ({tasks.length})
                              </span>
                            </button>
                            {pExpanded && (
                              <div className="space-y-1.5">
                                {tasks.map(renderTaskCard)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Projects without a program */}
            {col.noProgTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 py-1">
                  <div className="flex-1 h-px bg-slate-600/30" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.work.noProgram")}
                  </span>
                  <div className="flex-1 h-px bg-slate-600/30" />
                </div>
                {col.noProgTasks.reduce((groups, { project, task }) => {
                  const key = project.id;
                  if (!groups[key]) groups[key] = { project, tasks: [] };
                  groups[key].tasks.push(task);
                  return groups;
                }, {}) &&
                  Object.values(
                    col.noProgTasks.reduce((groups, { project, task }) => {
                      const key = project.id;
                      if (!groups[key])
                        groups[key] = { project, tasks: [] };
                      groups[key].tasks.push(task);
                      return groups;
                    }, {}),
                  ).map(({ project, tasks }) => (
                    <div key={project.id} className="space-y-1">
                      <button
                        onClick={() => onToggleProject(project.id)}
                        className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide hover:text-[var(--text-primary)] transition-colors py-0.5"
                      >
                        {expandedProjects[project.id] !== false ? (
                          <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                        ) : (
                          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <Briefcase className="w-2.5 h-2.5 text-emerald-400" />
                        {project.name} ({tasks.length})
                      </button>
                      {expandedProjects[project.id] !== false && (
                        <div className="ml-2 pl-2 border-l-2 border-slate-500/20 space-y-1.5">
                          {tasks.map(renderTaskCard)}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Uncategorized tasks (no project) */}
            {col.noProjectTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 py-1">
                  <div className="flex-1 h-px bg-slate-600/30" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.work.uncategorized")}
                  </span>
                  <div className="flex-1 h-px bg-slate-600/30" />
                </div>
                <div className="space-y-1">
                  {col.noProjectTasks.map(renderTaskCard)}
                </div>
              </div>
            )}

            {/* Empty state */}
            {col.total === 0 && (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                {t("adminMisc.work.noItems")}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
