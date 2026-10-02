"use client";

export function ContactsPagination({
  t,
  loading,
  totalPages,
  safePage,
  setCurrentPage,
}) {
  if (loading || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
        {t("crm.contacts.pageOf", { page: safePage, total: totalPages })}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
          disabled={safePage === 1}
          className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {t("common.previous")}
        </button>

        {/* Page number pills */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter((pageNumber) => pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - safePage) <= 2)
            .reduce((accumulator, pageNumber, index, pages) => {
              if (index > 0 && pageNumber - pages[index - 1] > 1) accumulator.push("...");
              accumulator.push(pageNumber);
              return accumulator;
            }, [])
            .map((pageNumber, index) =>
              pageNumber === "..." ? (
                <span key={`ellipsis-${index}`} className="px-1 text-[10px] text-[var(--text-secondary)]">{pageNumber}</span>
              ) : (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                    pageNumber === safePage
                      ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20"
                      : "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                  }`}
                >
                  {pageNumber}
                </button>
              )
            )}
        </div>

        <button
          onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
          disabled={safePage === totalPages}
          className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {t("common.next")}
        </button>
      </div>
    </div>
  );
}
