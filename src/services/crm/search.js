import { can } from "@/services/authorization/context";
import { searchCrmOrganizations } from "@/models/crm/organizations";
import {
  searchCrmPeople,
  searchCrmLeads,
  searchCrmOpportunities,
} from "@/models/crm/search";

/**
 * CRM — global search (DECISION layer).
 *
 * Four objects, five results each: people, organizations, leads and
 * opportunities. A short query returns nothing (no accidental full-table read).
 *
 * People are a distinct domain: their results are only included when the caller
 * holds `contacts.view`, the same right the person record requires. The rest of
 * the CRM follows `crm.view`, which the route enforces.
 */

export const CRM_SEARCH_MIN_LENGTH = 2;
export const CRM_SEARCH_GROUP_LIMIT = 5;

const emptyGroups = () => ({
  people: [],
  organizations: [],
  leads: [],
  opportunities: [],
});

export async function searchCrm(session, rawQuery) {
  const query = String(rawQuery ?? "").trim();

  if (query.length < CRM_SEARCH_MIN_LENGTH) {
    return { query, canSeePeople: false, groups: emptyGroups() };
  }

  const canSeePeople = await can(session, "contacts", "view");

  const [people, organizations, leads, opportunities] = await Promise.all([
    canSeePeople ? searchCrmPeople(query, CRM_SEARCH_GROUP_LIMIT) : Promise.resolve({ rows: [] }),
    searchCrmOrganizations(query, CRM_SEARCH_GROUP_LIMIT),
    searchCrmLeads(query, CRM_SEARCH_GROUP_LIMIT),
    searchCrmOpportunities(query, CRM_SEARCH_GROUP_LIMIT),
  ]);

  return {
    query,
    canSeePeople,
    groups: {
      people: people.rows ?? [],
      organizations: organizations.rows ?? [],
      leads: leads.rows ?? [],
      opportunities: opportunities.rows ?? [],
    },
  };
}
