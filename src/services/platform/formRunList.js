import { countFormRuns, selectFormRunsPage } from "@/models/formRunListStore";

/**
 * One page of runs AND the total of the same filtered set, in ONE round trip.
 *
 * The total rides along as a window column, so the filtered rows are scanned
 * once instead of twice. A window count is only visible on the rows that come
 * back, so two cases need attention:
 *   - an empty page at offset 0 means the filtered set is genuinely empty → 0,
 *   - an empty page further in means the caller asked past the end → the total
 *     is fetched separately (rare, and only on a page that shows nothing).
 * The helper column is stripped from the rows, so the response shape is
 * unchanged.
 *
 * Layer (see docs/LAYER_SPLIT.md): the total resolution is decided here; the
 * statements live in `@/models/formRunListStore`.
 */
export async function listFormRunsPage({ groupId, programId, formId, status, perPage, offset }) {
  const result = await selectFormRunsPage({ groupId, programId, formId, status, perPage, offset });

  const rows = (result.rows || []).map(({ total_count: _totalCount, ...row }) => row);
  if ((result.rows || []).length > 0) {
    return { rows, total: parseInt(result.rows[0].total_count) || 0 };
  }
  if (offset === 0) return { rows, total: 0 };

  const countRes = await countFormRuns({ groupId, programId, formId, status });
  return { rows, total: parseInt(countRes.rows[0]?.total) || 0 };
}
