export default function ProgramTabs({
  activeTab,
  onSelectTab,
  pendingSubmissionCount,
  submissionsSeen,
  tabs,
}) {
  return (
    <div className="flex gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelectTab(tab)}
          className={`px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2 whitespace-nowrap shrink-0 ${activeTab === tab.id ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
        >
          {tab.name}
          {tab.id === "submissions" &&
            !submissionsSeen &&
            pendingSubmissionCount > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-[var(--brand-orange)] text-black px-1.5 py-0.5 rounded-full align-middle">
                {pendingSubmissionCount}
              </span>
            )}
        </button>
      ))}
    </div>
  );
}
