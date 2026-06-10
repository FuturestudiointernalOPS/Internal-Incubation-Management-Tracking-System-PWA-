"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * AppPagination — Reusable pagination component
 *
 * @param {object} props
 * @param {number} props.currentPage - 1-based current page
 * @param {number} props.totalPages - Total number of pages
 * @param {(page: number) => void} props.onPageChange
 * @param {number} [props.siblingCount=1] - Number of siblings around current page
 * @param {string} [props.className='']
 * @param {boolean} [props.compact=false] - Show compact version (no page numbers)
 *
 * @example
 *   <AppPagination
 *     currentPage={reportsPage}
 *     totalPages={Math.ceil(filteredReports.length / PAGE_SIZE)}
 *     onPageChange={setReportsPage}
 *   />
 */
export default function AppPagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className = "",
  compact = false,
}) {
  const pages = useMemo(() => {
    if (totalPages <= 1) return [];

    const totalPageNumbers = siblingCount * 2 + 5; // siblings + first + last + current + 2 dots

    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const showLeftDots = leftSiblingIndex > 2;
    const showRightDots = rightSiblingIndex < totalPages - 1;

    if (!showLeftDots && showRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, "...", totalPages];
    }

    if (showLeftDots && !showRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1,
      );
      return [1, "...", ...rightRange];
    }

    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i,
    );
    return [1, "...", ...middleRange, "...", totalPages];
  }, [currentPage, totalPages, siblingCount]);

  if (totalPages <= 1) return null;

  if (compact) {
    return (
      <div
        className={`flex items-center justify-between ${className}`}
        style={{ color: "var(--text-secondary)" }}
      >
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Page {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <nav
      className={`flex items-center justify-center gap-1 ${className}`}
      aria-label="Pagination"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-2)] transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
      </button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-2 text-[10px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`
              min-w-[2rem] h-8 px-2 rounded-lg text-[10px] font-bold
              transition-all duration-150
              ${
                page === currentPage
                  ? "text-white"
                  : "hover:bg-[var(--surface-2)]"
              }
            `}
            style={{
              background:
                page === currentPage
                  ? "var(--brand-orange)"
                  : "transparent",
              color:
                page === currentPage
                  ? "#fff"
                  : "var(--text-secondary)",
            }}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-2)] transition-colors"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
      </button>
    </nav>
  );
}
