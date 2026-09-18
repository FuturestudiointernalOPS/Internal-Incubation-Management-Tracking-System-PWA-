/**
 * PARTICIPANT BATCHES — one chunk size, and the walk that uses it.
 *
 * Bulk participant work (enrolling a programme's people into its required
 * courses, adding or removing several people at once) used to be issued ONE
 * STATEMENT PER PERSON PER COURSE, in series. On a programme of a few hundred
 * people that is hundreds of round trips inside a single request, which is how
 * a size that looks reasonable on screen turns into a request that never
 * finishes.
 *
 * The work is therefore grouped: one statement writes a whole chunk, and the
 * chunks are applied in ORDER - a queue rather than a flood, so the connection
 * pool is not asked for more than it has and a failure stops at a known point.
 *
 * 30 is the size of one chunk. It is a compromise, and worth stating:
 *   - one chunk must stay a SMALL statement. 30 rows is 30-120 bound values,
 *     far from any statement-size or parameter limit, and the answer comes back
 *     once instead of thirty times;
 *   - and it must not ask the pool for more than it has. Ten connections serve
 *     the whole application (see src/lib/db.js), so a chunk is deliberately a
 *     fraction of that, not a multiple.
 *
 * Because a chunk is one statement, 30 is also the unit in which the work
 * either lands or does not: a failure is reported for the chunk's people, not
 * silently for some of them.
 */
export const PARTICIPANT_BATCH_SIZE = 30;

/**
 * Split a list into chunks of at most `size`, keeping the original order.
 *
 * @param {Array} items
 * @param {number} [size]
 * @returns {Array<Array>}
 */
export function participantBatches(items, size = PARTICIPANT_BATCH_SIZE) {
  const list = Array.isArray(items) ? items : [];
  const step = size > 0 ? size : PARTICIPANT_BATCH_SIZE;
  const out = [];
  for (let i = 0; i < list.length; i += step) {
    out.push(list.slice(i, i + step));
  }
  return out;
}
