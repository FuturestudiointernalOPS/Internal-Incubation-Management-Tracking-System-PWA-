/**
 * LEGACY IDENTITY NORMALIZATION (SERVICE layer).
 *
 * The boot-time hook for the one-time data migration: it delegates to the model
 * (which owns the SQL and the transaction) and logs the outcome. Kept separate
 * so the bootstrap imports a service, and the model stays HTTP-free.
 *
 * The card table is ensured first: a database that has never opened the profile
 * screen may not have `profile_assignments` yet, and the migration must not fail
 * on a table the application itself creates lazily.
 */

import { migrateLegacyIdentities } from "@/models/authorization/legacyIdentityStore";
import { ensureProfileAssignmentsSchema } from "@/models/authorization/profileAssignmentsStore";

export async function normalizeLegacyIdentities() {
  await ensureProfileAssignmentsSchema();

  const result = await migrateLegacyIdentities();

  if (result.updated > 0 || result.cards > 0) {
    console.log("[authz] legacy identities normalized", {
      updated: result.updated,
      cards: result.cards,
      withoutRelationship: result.withoutRelationship,
      skippedFamilies: result.skippedFamilies,
    });
  }

  // A missing optional table is not an error, but a person carrying that label
  // would lose the function it described. Say it out loud, once.
  const labelled = new Set((result.before || []).map((row) => row.source_role));
  const skippedWithPeople = (result.skippedFamilies || []).filter((family) =>
    labelled.has(family),
  );
  if (skippedWithPeople.length > 0) {
    console.warn(
      "[authz] legacy identities: famille(s) ignorée(s), table absente — leur libellé devient membre sans carte",
      skippedWithPeople,
    );
  }

  return result;
}
