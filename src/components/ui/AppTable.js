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
            {columns.map((column, columnIndex) => (
              <th
                key={column.key || columnIndex}
                className="p-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--surface-2)",
                  textAlign: column.align || "left",
                }}
              >
                {column.label || column.key}
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
              onMouseEnter={(event) =>
                (event.currentTarget.style.background = "var(--surface-2)")
              }
              onMouseLeave={(event) =>
                (event.currentTarget.style.background = "transparent")
              }
            >
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key || columnIndex}
                  className="p-4 text-sm align-middle"
                  style={{
                    color: "var(--text-primary)",
                    textAlign: column.align || "left",
                  }}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
