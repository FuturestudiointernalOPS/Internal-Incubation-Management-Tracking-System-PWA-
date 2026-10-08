/**
 * CONTACT GROUPS (families) — the create/update use-cases.
 *
 * A contact group lives in the `families` table. Columns were added over time
 * (description, default_role, is_archived), so the writes keep a FAST path and
 * only self-heal the schema — add the missing columns once, then retry once —
 * when the database is one migration behind (the driver says "does not exist").
 *
 * The decisions — the registration-id generation and the self-heal-and-retry
 * rule — live here; every statement is in `@/models/groups`. Nothing here runs
 * SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  createGroup,
  createGroupAfterColumnSelfHeal,
  addFamilyDescriptionColumn,
  addFamilyDefaultRoleColumn,
  addFamilyIsArchivedColumn,
  updateGroup,
  updateGroupAfterColumnSelfHeal,
  addFamilyDescriptionColumnOnUpdate,
  addFamilyDefaultRoleColumnOnUpdate,
  addFamilyIsArchivedColumnOnUpdate,
} from "@/models/groups/contactGroups";

/** Whether an error means a column/table is missing (the self-heal trigger). */
function isMissingSchemaError(error) {
  return /does not exist/i.test(error?.message || "");
}

/**
 * Create one contact group. Returns `{ id, registration_id }`.
 */
export async function createContactGroup({ programId, name, type, description, defaultRole }) {
  // Generate a unique registration_id (matches families route pattern: GRP-XXXX123)
  const registrationId =
    "GRP-" +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    Math.floor(Math.random() * 1000);

  const insertArgs = [programId || null, name, type || "individual", description || null, defaultRole || null, registrationId];

  let result;
  try {
    // Fast path: no extra queries when schema is healthy
    result = await createGroup(insertArgs);
  } catch (insertError) {
    // Self-heal only on failure: add missing columns once, then retry once
    if (!isMissingSchemaError(insertError)) throw insertError;
    await addFamilyDescriptionColumn();
    await addFamilyDefaultRoleColumn();
    await addFamilyIsArchivedColumn();
    result = await createGroupAfterColumnSelfHeal(insertArgs);
  }

  const row = result.rows?.[0];
  return {
    id: row?.id ?? result.lastInsertRowid,
    registration_id: row?.registration_id ?? registrationId,
  };
}

/**
 * Update one contact group. Returns `{ updated: false }` when the request names
 * no updatable field.
 */
export async function updateContactGroup({ id, name, type, description, isArchived, defaultRole }) {
  const updates = [];
  const args = [];

  if (name !== undefined) { updates.push("name = ?"); args.push(name); }
  if (type !== undefined) { updates.push("type = ?"); args.push(type); }
  if (description !== undefined) { updates.push("description = ?"); args.push(description); }
  if (isArchived !== undefined) { updates.push("is_archived = ?"); args.push(isArchived ? 1 : 0); }
  if (defaultRole !== undefined) { updates.push("default_role = ?"); args.push(defaultRole || null); }

  if (updates.length === 0) return { updated: false };

  args.push(id);

  try {
    // Fast path: no extra queries when schema is healthy
    await updateGroup(updates, args);
  } catch (updateError) {
    // Self-heal only on failure: add missing columns once, then retry once
    if (!isMissingSchemaError(updateError)) throw updateError;
    await addFamilyDescriptionColumnOnUpdate();
    await addFamilyDefaultRoleColumnOnUpdate();
    await addFamilyIsArchivedColumnOnUpdate();
    await updateGroupAfterColumnSelfHeal(updates, args);
  }

  return { updated: true };
}
