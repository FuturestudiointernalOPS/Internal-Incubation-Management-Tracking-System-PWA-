import {
  runInTransaction,
  selectCurrentFounders,
  deactivateFounders,
  insertFounder,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema } from "./settings";
import { validateFounder, textOrNull, dateOrNull } from "./rules";

const shape = (row) => ({
  id: row.id,
  contactId: row.contact_id,
  name: row.name,
  gender: row.gender,
  dateOfBirth: row.date_of_birth,
  role: row.role,
  employmentType: row.employment_type,
  effectiveFrom: row.effective_from,
});

export async function listFounders({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectCurrentFounders(ventureUuid);
  return (result.rows || []).map(shape);
}

/**
 * Replace the current founder set. Old rows stay in the table with
 * `is_current = false` — history is never deleted.
 */
export async function replaceFounders({ ventureUuid, ventureCode, actorCid, founders = [] }) {
  await ensureReportingSchema();

  if (!Array.isArray(founders) || founders.length === 0) {
    return { errors: ["venture.reporting.validation.oneFounder"] };
  }
  const errors = [...new Set(founders.flatMap((founder) => validateFounder(founder)))];
  if (errors.length) return { errors };

  await runInTransaction(async (query) => {
    await deactivateFounders(query, ventureUuid);
    for (const founder of founders) {
      await insertFounder(query, {
        ventureUuid,
        ventureCode,
        contactId: textOrNull(founder.contactId),
        name: String(founder.name).trim(),
        gender: textOrNull(founder.gender),
        dateOfBirth: dateOrNull(founder.dateOfBirth),
        role: textOrNull(founder.role),
        employmentType: textOrNull(founder.employmentType),
        actorCid,
      });
    }
  });

  return { founders: await listFounders({ ventureUuid }) };
}
