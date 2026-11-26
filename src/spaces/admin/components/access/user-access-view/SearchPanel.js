import {
  Search,
  User,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export default function UserSearchPanel({
  searchQuery,
  setSearchQuery,
  usersLoading,
  usersError,
  usersStatus,
  refreshUsers,
  paginatedUsers,
  fetchUserSummary,
  totalPages,
  safePage,
  goToPage,
  t,
}) {
  return (
    <>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("adminMisc.access.searchPlaceholder")}
          aria-label={t("adminMisc.access.searchPlaceholder")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-brand-orange/50 text-sm font-bold transition-all"
        />
      </div>

      {usersLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }} />
        </div>
      ) : usersError ? (
        <div className="card p-8 text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-rose-500/40 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">
            {usersStatus === 401 ? t("errors.authRequired") : t("adminMisc.access.loadFailed")}
          </p>
          <button
            onClick={() => refreshUsers()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("common.retry")}
          </button>
        </div>
      ) : paginatedUsers.length === 0 ? (
        <div className="card p-8 text-center max-w-md">
          <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.access.noResults")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-1 max-w-md">
            {paginatedUsers.map((person) => (
              <button
                key={person.cid}
                onClick={() => fetchUserSummary(person)}
                className="w-full ios-card !p-4 border-[var(--border-primary)] hover:border-brand-orange/30 transition-all text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                      {person.name}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {person.email} · {person.role} · {person.status}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 max-w-md pt-2">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("crm.contacts.pageOf", { page: safePage, total: totalPages })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {t("common.previous")}
                </button>
                <button
                  onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
