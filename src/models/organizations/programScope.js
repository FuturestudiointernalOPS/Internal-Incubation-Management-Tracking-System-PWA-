export const PLATFORM_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

/** Internal readers are always platform-only, including Super Admin callers.
 * Whole-row JSON keeps this predicate compatible before the additive owner
 * column exists. No schema probe, cache, request selector or global fallback.
 * Once ownership is mandatory, replace with an indexed typed-column predicate.
 */
export function platformProgramPredicate(alias = "v2_programs") {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error("Invalid SQL alias");
  return `COALESCE(to_jsonb(${alias})->>'organization_id', '${PLATFORM_ORGANIZATION_ID}') = '${PLATFORM_ORGANIZATION_ID}'`;
}

export function platformProgramRelationPredicate(alias, column = "program_id") {
  if (![alias, column].every((value) => /^[a-z_][a-z0-9_]*$/i.test(value))) throw new Error("Invalid SQL identifier");
  return `EXISTS (SELECT 1 FROM v2_programs wl_program
    WHERE wl_program.id::text = ${alias}.${column}::text AND ${platformProgramPredicate("wl_program")})`;
}
