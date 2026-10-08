/**
 * DELIVERABLE SUBMISSIONS — the read-shaping helpers.
 *
 * Pure functions that turn submission rows into the shape the UI consumes.
 *
 * See docs/LAYER_SPLIT.md.
 */

/** The UI shape of a submission row (deliverable / participant / group blocks). */
export function formatSubmissionRows(rows) {
  return rows.map((row) => ({
    ...row,
    v2_deliverables: {
      title: row.deliverable_title,
      week_number: row.deliverable_week,
      due_date: row.deliverable_due_date,
    },
    v2_participants: row.participant_name ? { name: row.participant_name } : null,
    v2_groups: row.group_name ? { name: row.group_name } : null,
  }));
}

/** Group submissions into deliverable buckets, each with its version history. */
export function groupSubmissionVersions(submissions) {
  const grouped = {};
  for (const submission of submissions) {
    const groupId =
      submission.deliverable_id || submission.document_id || `doc-${submission.id}`;
    const key = `${submission.program_id}-${groupId}`;
    if (!grouped[key]) {
      grouped[key] = {
        deliverable_id: submission.deliverable_id,
        program_id: submission.program_id,
        deliverable_title: submission.deliverable_title,
        deliverable_week: submission.deliverable_week,
        deliverable_due_date: submission.deliverable_due_date,
        latest: submission,
        versions: [],
      };
    }
    grouped[key].versions.push(submission);
    // Sort versions by version_number
    grouped[key].versions.sort(
      (first, second) => (second.version_number || 0) - (first.version_number || 0),
    );
  }
  return Object.values(grouped);
}
