/**
 * The dashboard payload reader shared by the two staff dashboards.
 *
 * A successful response IS the payload; anything else is "no data" rather than
 * an object whose fields happen to be missing. Kept here, in the shared layer,
 * because both the staff dashboard and the programme-manager dashboard read it
 * — neither context owns the other.
 */
export const pickDashboard = (payload) => (payload?.success ? payload : null);
