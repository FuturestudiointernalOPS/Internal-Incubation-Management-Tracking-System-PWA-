/**
 * The status legend drawn under the calendar grid: one entry per task status,
 * plus any the caller adds through `extra` ([{ key, label, color }]) — a
 * connected Google Calendar, for instance.
 */
export default function CalendarLegend({ statuses, colors, labelFor, extra = [] }) {
  return (
    <div className="x-leg">
      {statuses.map((value) => (
        <span key={value}>
          <i style={{ background: colors[value] }} />
          {labelFor(value)}
        </span>
      ))}
      {extra.map((entry) => (
        <span key={entry.key}>
          <i style={{ background: entry.color }} />
          {entry.label}
        </span>
      ))}
    </div>
  );
}
