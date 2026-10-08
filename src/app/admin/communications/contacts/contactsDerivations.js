import { PAGE_SIZE } from "./contactsConstants";

/**
 * Pure derivations of the contacts screen: the row filter, the sidebar segment
 * counts and the pagination. Kept out of the state hook so they are plain
 * functions — the same inputs always give the same rows.
 */

/**
 * Rows matching the current search / group / team / status filters.
 * "Archived" is filtered server-side, so it passes every row through here.
 */
export function filterContacts(contacts, { search, selectedGroup, selectedTeamTab, statusFilter }) {
  return contacts.filter((contact) => {
    const lowerSearch = search.toLowerCase();
    const matchesSearch =
      (contact.name || "").toLowerCase().includes(lowerSearch) ||
      (contact.email || "").toLowerCase().includes(lowerSearch);
    const matchesGroup =
      selectedGroup === "All Contacts" ||
      contact.group_name?.toUpperCase() === selectedGroup.toUpperCase();

    // Nested Sub-team Filter
    const matchesTeam =
      selectedTeamTab === "All Teams" || contact.v2_team_id === selectedTeamTab;

    let matchesStatus = true;
    if (statusFilter === "Active")
      matchesStatus = contact.status === "active";
    else if (statusFilter === "Approved")
      matchesStatus = contact.status === "approved";
    else if (statusFilter === "Pending")
      matchesStatus = contact.status === "pending";
    else if (statusFilter === "Inactive")
      matchesStatus = contact.status === "inactive";
    else if (statusFilter === "All")
      matchesStatus = true;
    // "Archived" is filtered server-side

    return (
      matchesSearch &&
      matchesGroup &&
      matchesTeam &&
      matchesStatus
    );
  });
}

/**
 * How many contacts belong to each segment (used for the sidebar badges;
 * "All Contacts" shows the total in the current view). Pending contacts are
 * left out.
 */
export function buildSegmentCounts(contacts) {
  const segmentCounts = {};
  for (const contact of contacts) {
    if (contact.status === "pending") continue;
    const key = String(contact.group_name || "UNASSIGNED").toUpperCase();
    segmentCounts[key] = (segmentCounts[key] || 0) + 1;
  }
  return segmentCounts;
}

/** The page window of the filtered rows, clamped to the last page. */
export function paginateContacts(filtered, currentPage) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return { totalPages, safePage, paginated };
}
