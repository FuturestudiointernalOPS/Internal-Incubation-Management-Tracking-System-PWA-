import AnalyticsRow from "@/spaces/admin/components/projects/list/AnalyticsRow";
import ProjectsFilters from "@/spaces/admin/components/projects/list/ProjectsFilters";
import ProjectsHeader from "@/spaces/admin/components/projects/list/ProjectsHeader";
import ProjectsTable from "@/spaces/admin/components/projects/list/ProjectsTable";

export default function ProjectsContent({
  toast,
  projectCount,
  canCreate,
  onBack,
  onCreate,
  onRefresh,
  analytics,
  search,
  setSearch,
  filterStatus,
  setFilterStatus,
  loading,
  filteredProjects,
  onOpen,
  actionLoading,
  onQuickStatus,
  onEdit,
  onArchiveToggle,
}) {
  return (
    <div className="space-y-8 pb-20 text-left">
      {/* HEADER */}
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest animate-in ${toast.type === "success" ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      <ProjectsHeader
        projectCount={projectCount}
        canCreate={canCreate}
        onBack={onBack}
        onCreate={onCreate}
        onRefresh={onRefresh}
      />

      {/* ANALYTICS ROW */}
      {analytics && <AnalyticsRow analytics={analytics} />}

      {/* FILTERS */}
      <ProjectsFilters
        search={search}
        setSearch={setSearch}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
      />

      {/* PROJECTS TABLE */}
      <ProjectsTable
        loading={loading}
        filteredProjects={filteredProjects}
        onOpen={onOpen}
        actionLoading={actionLoading}
        onQuickStatus={onQuickStatus}
        onEdit={onEdit}
        onArchiveToggle={onArchiveToggle}
      />
    </div>
  );
}
