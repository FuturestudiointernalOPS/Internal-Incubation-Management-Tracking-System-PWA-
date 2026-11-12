/**
 * Pure shapes for the workspace's two cached reads.
 *
 * Module scope on purpose - each read keys on its address, never on these.
 */

// Shapes the assigned registration-form read: the active Form Run becomes the
// public link shown in the header, or null when there is none to show.
export function pickRegForm(payload) {
  const run = (payload?.success ? payload.runs || [] : []).find(
    (entry) => entry.status === "active" && entry.public_slug,
  );
  return run
    ? {
        link: `${window.location.origin}/s/${run.public_slug}`,
        name: run.form_name || run.name || "Form",
      }
    : null;
}

// Shapes the facilitator-reviews read: the list, or empty when the server
// refused - the screen shows its empty state for that, as its first load did.
export function pickReviews(payload) {
  return payload?.success ? payload.reviews || [] : [];
}
