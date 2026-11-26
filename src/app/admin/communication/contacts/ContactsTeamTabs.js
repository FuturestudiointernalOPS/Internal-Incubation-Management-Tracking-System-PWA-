"use client";

export function ContactsTeamTabs({
  t,
  selectedGroup,
  statusFilter,
  selectedTeamTab,
  setSelectedTeamTab,
  teams,
}) {
  if (selectedGroup === "All Contacts" || statusFilter === "Archived") return null;

  return (
    <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
      <button
        onClick={() => setSelectedTeamTab("All Teams")}
        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedTeamTab === "All Teams" ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
      >
        {t("crm.contacts.allTeams")}
      </button>
      {teams
        .filter(
          (team) =>
            team.group_name?.toUpperCase() ===
            selectedGroup.toUpperCase(),
        )
        .map((team) => (
          <button
            key={team.id}
            onClick={() => setSelectedTeamTab(team.id)}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedTeamTab === team.id ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
          >
            {team.name}
          </button>
        ))}
    </div>
  );
}
