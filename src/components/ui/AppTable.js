"use client";

export default function AppTable({
  columns = [],
  data = [],
  onRowClick,
  loading = false,
  emptyMessage = "No data found.",
  className = "",
}) {
  if (loading) {
    return (
      <div
        className={`table-container ${className}`}
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div className="p-12 flex items-center justify-center">
          <span
            className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
            style={{ color: "var(--brand-orange)" }}
          />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className={`table-container ${className}`}
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div className="p-12 text-center">
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-tertiary)" }}
          >
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`table-container overflow-x-auto ${className}`}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: "var(--border-primary)" }}
          >
            {columns.map((col, i) => (
              <th
                key={col.key || i}
                className="p-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--surface-2)",
                  textAlign: col.align || "left",
                }}
              >
                {col.label || col.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              onClick={() => onRowClick?.(row)}
              className={`border-b transition-colors ${
                onRowClick ? "cursor-pointer" : ""
              }`}
              style={{
                borderColor: "var(--border-primary)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--surface-2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              {columns.map((col, colIndex) => (
                <td
                  key={col.key || colIndex}
                  className="p-4 text-sm align-middle"
                  style={{
                    color: "var(--text-primary)",
                    textAlign: col.align || "left",
                  }}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
