/**
 * services/ventures/sessionCalendarPush — put a session change on the calendars
 * of the people it concerns.
 *
 * Booking used to sync invited guests only, which left the two people closest to
 * a session waiting for their next sync: the person who booked it and the coach.
 * A session is also edited, rescheduled, cancelled and deleted, and Google has
 * to follow those too — a calendar that keeps a cancelled session is worse than
 * an empty one.
 *
 * The push is the same `syncUser` the manual sync button and the cron use, so
 * nothing here decides what an event looks like: it only makes the change
 * immediate instead of "whenever that person next loads a page".
 *
 * Every push is best-effort by construction. The caller has already decided the
 * session stands; a calendar that cannot be reached (not configured, nobody
 * connected, Google down) must never undo that decision or fail the request.
 * No SQL, no HTTP of its own.
 */

/**
 * Push the current state of the affected sessions to each person's calendar.
 *
 * @param {Array<string|null|undefined>} cids people to sync (duplicates and
 *   blanks are dropped — a booker who is also the coach syncs once)
 * @returns {Promise<{ attempted: number }>} how many people were synced
 */
export async function pushSessionToCalendars(cids) {
  const targets = [
    ...new Set(
      (Array.isArray(cids) ? cids : [])
        .filter(Boolean)
        .map((cid) => String(cid).trim())
        .filter(Boolean),
    ),
  ];
  if (targets.length === 0) return { attempted: 0 };

  let syncUser;
  try {
    // Imported late so a build without the integration never pays for it, and a
    // missing module can never break a booking.
    ({ syncUser } = await import("@/services/integrations/googleCalendar"));
  } catch (_) {
    return { attempted: 0 };
  }

  let attempted = 0;
  for (const cid of targets) {
    try {
      await syncUser(cid);
      attempted += 1;
    } catch (_) {
      // One person's calendar failing is not another's problem.
    }
  }
  return { attempted };
}
