import db from "@/lib/db";

/**
 * Contact groups store — the `families`-table CRUD behind `/api/groups`.
 *
 * Split out of `src/models/groups.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/groups` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET / POST / PUT / DELETE /api/groups (families table) ───────────────────

/** Contact groups (families), filtered by program and/or name search, newest first. */
export async function getGroups(program_id, search) {
  let sql = "SELECT * FROM families";
  let args = [];
  let conditions = [];

  if (program_id) {
    conditions.push("program_id = ?");
    args.push(program_id);
  }
  if (search) {
    conditions.push("LOWER(name) LIKE LOWER(?)");
    args.push(`%${search}%`);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** Insert a contact group (POST fast path). `insertArgs` = controller-built VALUES array. */
export async function createGroup(insertArgs) {
  return db.execute({
    sql: `INSERT INTO families (program_id, name, type, description, default_role, registration_id)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id, registration_id`,
    args: insertArgs,
  });
}

/** Self-heal on insert failure: ensure the description column exists (POST /api/groups). */
export async function addFamilyDescriptionColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS description TEXT");
}

/** Self-heal on insert failure: ensure the default_role column exists (POST /api/groups). */
export async function addFamilyDefaultRoleColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT");
}

/** Self-heal on insert failure: ensure the is_archived column exists (POST /api/groups). */
export async function addFamilyIsArchivedColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0");
}

/**
 * Insert a contact group — retry after the self-heal column adds.
 * Byte-identical query to createGroup; extracted separately so each original
 * inline call site maps 1:1 to a model function.
 */
export async function createGroupAfterColumnSelfHeal(insertArgs) {
  return db.execute({
    sql: `INSERT INTO families (program_id, name, type, description, default_role, registration_id)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id, registration_id`,
    args: insertArgs,
  });
}

/** Update a contact group's mutable fields — dynamic SET built by the controller (PUT fast path). */
export async function updateGroup(updates, args) {
  return db.execute({
    sql: `UPDATE families SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Self-heal on update failure: ensure the description column exists (PUT /api/groups). */
export async function addFamilyDescriptionColumnOnUpdate() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS description TEXT");
}

/** Self-heal on update failure: ensure the default_role column exists (PUT /api/groups). */
export async function addFamilyDefaultRoleColumnOnUpdate() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT");
}

/** Self-heal on update failure: ensure the is_archived column exists (PUT /api/groups). */
export async function addFamilyIsArchivedColumnOnUpdate() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0");
}

/**
 * Update a contact group — retry after the self-heal column adds.
 * Byte-identical query to updateGroup; extracted separately so each original
 * inline call site maps 1:1 to a model function.
 */
export async function updateGroupAfterColumnSelfHeal(updates, args) {
  return db.execute({
    sql: `UPDATE families SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

/**
 * Program owning a group row (V1 /api/groups mutates the `families` table).
 * Read before a scoped write so the record-scope check knows WHICH program the
 * group belongs to — the PUT/DELETE handlers receive only the group id.
 */
export async function getFamilyProgramId(id) {
  return db.execute({
    sql: "SELECT CAST(program_id AS TEXT) AS program_id FROM families WHERE CAST(id AS TEXT) = ?",
    args: [String(id)],
  });
}

/** Delete a contact group (families) by id. */
export async function deleteGroup(id) {
  return db.execute({
    sql: "DELETE FROM families WHERE id = ?",
    args: [id],
  });
}
