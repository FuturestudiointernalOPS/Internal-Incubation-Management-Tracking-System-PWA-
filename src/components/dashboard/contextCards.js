/**
 * ONE DASHBOARD — additive context cards (pure).
 *
 * The dashboard is the calendar page; contexts do not get dashboards of their
 * own, they add STAT CARDS to it. A card exists only while the relationship
 * does, shows counts and up to three names, and links to the full page — so no
 * content is duplicated between the dashboard and the detail screens.
 *
 * Sources (all already in use elsewhere):
 *   contexts.program_assignments    → programs this person works in (staff side)
 *   contexts.program_participations → programs this person is enrolled in
 *   assignedVentures                → ventures delegated to this person (/api/ventures/assigned)
 *   contexts.venture_memberships    → ventures held as a member (founder / team)
 *   contexts.learning.enrolled      → LMS enrollment (no count available)
 */

/** Names shown per card, at most — a person with 20 ventures gets a number. */
export const MAX_NAMES_PER_CARD = 3;

const label = (row, ...fields) => {
  for (const f of fields) {
    const v = row?.[f];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
};

/**
 * @returns {{key: string, count: number|null, names: string[], href: string}[]}
 *   Empty when the person holds no context — the dashboard then shows nothing.
 */
export function buildContextCards({ contexts = {}, assignedVentures = [] } = {}) {
  const cards = [];
  const list = (value) => (Array.isArray(value) ? value : []);

  const staffPrograms = list(contexts.program_assignments);
  if (staffPrograms.length > 0) {
    cards.push({
      key: "programsManaged",
      count: staffPrograms.length,
      names: staffPrograms
        .slice(0, MAX_NAMES_PER_CARD)
        .map((p) => label(p, "program_name", "program_id")),
      href: staffPrograms[0]?.href || "/pm/programs",
    });
  }

  const participations = list(contexts.program_participations).filter(
    (p) => !p?.completed,
  );
  if (participations.length > 0) {
    cards.push({
      key: "programsParticipating",
      count: participations.length,
      names: participations
        .slice(0, MAX_NAMES_PER_CARD)
        .map((p) => label(p, "program_name", "program_id")),
      href: "/participant/dashboard",
    });
  }

  const ventures = list(assignedVentures);
  if (ventures.length > 0) {
    cards.push({
      key: "venturesAssigned",
      count: ventures.length,
      names: ventures
        .slice(0, MAX_NAMES_PER_CARD)
        .map((v) => label(v, "company_name", "name", "venture_id")),
      href: "/staff/ventures",
    });
  }

  const memberships = list(contexts.venture_memberships);
  if (memberships.length > 0) {
    cards.push({
      key: "venturesMember",
      count: memberships.length,
      names: memberships
        .slice(0, MAX_NAMES_PER_CARD)
        .map((v) => label(v, "venture_name", "venture_id")),
      href: "/participant/ventures",
    });
  }

  if (contexts.learning?.enrolled) {
    cards.push({
      key: "learning",
      count: null,
      names: [],
      href: contexts.learning.href || "/participant/learning",
    });
  }

  return cards;
}
