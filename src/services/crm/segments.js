import { getCrmLeads } from "@/models/crm/leads";
import { getCrmOpportunities } from "@/models/crm/opportunities";
import { evaluateConditions } from "@/services/crm/automationEngine";

/** The stored conditions as a list, whatever the driver handed back for jsonb. */
export function segmentConditions(segment) {
  const conditions = segment?.conditions;
  if (Array.isArray(conditions)) return conditions;
  if (typeof conditions === "string") {
    try {
      const parsed = JSON.parse(conditions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * The records a segment currently contains.
 *
 * A segment is a saved filter, not a list: its members are whichever leads or
 * opportunities match ALL of its conditions right now (the same evaluation the
 * automation engine applies). A segment without conditions contains every
 * record of its entity type.
 */
export async function resolveSegmentMembers(segment) {
  const result =
    segment.entity_type === "opportunity"
      ? await getCrmOpportunities()
      : await getCrmLeads();
  const conditions = segmentConditions(segment);
  return (result.rows || []).filter((record) => evaluateConditions(conditions, record));
}
