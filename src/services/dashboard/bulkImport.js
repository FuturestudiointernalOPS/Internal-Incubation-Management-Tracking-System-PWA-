/**
 * Bulk contact import — the CSV import use case (SERVICE layer).
 *
 * The work behind `POST /api/admin/bulk-upload`: the CSV parse, the
 * protected-group detection, the per-row validation (required fields, email
 * shape, phone uniqueness), the role boundary (an importer without the
 * role-assignment capability may only create self-service roles), the upsert,
 * the rollback on a database failure and the completion notification.
 *
 * HTTP-free: it parses with `papaparse`, hashes with `@/server/auth/password`
 * and reads/writes through `@/models/**`. The controller keeps `initDb`, the
 * capability gates and the envelope.
 */

import Papa from "papaparse";
import { hashPassword } from "@/server/auth/password";
import {
  INTERNAL_GROUP,
  normalizeGroupName,
} from "@/models/authorization/membership";
import {
  deleteContactByCid,
  findActiveContactByEmail,
  getAllActiveContactPhones,
  insertBulkImportNotification,
  insertContact,
  updateContactByEmail,
} from "@/models/adminOps";

/** Roles a CSV import may assign without the role-assignment capability. */
const IMPORTABLE_ROLES = new Set([
  "participant",
  "member",
  "applicant",
  "unassigned",
]);

/** Parse the uploaded CSV into rows (headers trimmed, empty lines skipped). */
export function parseContactCsv(text) {
  const { data, errors: parseErrors } = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
  });
  return { rows: data, parseErrors, empty: data.length === 0 };
}

/** Does this batch write anyone INTO the protected internal group? */
export function csvWantsInternalGroup(rows) {
  return rows.some(
    (row) =>
      normalizeGroupName(row?.group_name || row?.group) === INTERNAL_GROUP,
  );
}

/**
 * Validate and import the rows. Returns the same envelope the controller used to
 * build: a 200 with the created/updated/errors counts, or a 500 when a database
 * failure forces a full rollback.
 *
 * @param {{ rows: object[], canAssignRole: boolean }} input
 * @returns {Promise<{status:number, body:object}>}
 */
export async function importContacts({ rows, canAssignRole }) {
  const validated = [];
  const results = {
    created: 0,
    updated: 0,
    errors: [],
    skipped: 0,
  };

  // Pre-fetch all existing phones for duplicate check
  const phoneSet = new Set();
  try {
    const phoneResult = await getAllActiveContactPhones();
    for (const row of phoneResult.rows) {
      if (row.phone) phoneSet.add(row.phone.trim());
    }
  } catch (_) {}

  // Track phones seen in this batch for intra-batch duplicate detection
  const batchPhones = new Set();

  for (const [index, row] of rows.entries()) {
    const rowNum = index + 1;
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();
    const phone = (row.phone || "").trim();
    const groupName =
      (row.group_name || row.group || "").trim().toUpperCase() || "UNASSIGNED";
    const requestedRole = (row.role || "participant").trim().toLowerCase();
    // Role is a server-controlled boundary: an importer who cannot assign
    // roles may only import self-service ones, never staff/super_admin.
    const role =
      canAssignRole || IMPORTABLE_ROLES.has(requestedRole)
        ? requestedRole
        : "participant";

    // 7.5: Missing mandatory fields
    if (!name || !email) {
      results.skipped++;
      results.errors.push({ row: rowNum, error: "Name and email are required." });
      continue;
    }

    // 7.2: Invalid email format
    if (!email.includes("@")) {
      results.skipped++;
      results.errors.push({ row: rowNum, email, error: "Invalid email format." });
      continue;
    }

    // 7.4: Duplicate phone check
    if (phone) {
      if (phoneSet.has(phone) || batchPhones.has(phone)) {
        results.skipped++;
        results.errors.push({
          row: rowNum,
          email,
          phone,
          error: "Duplicate phone number — already exists.",
        });
        continue;
      }
      batchPhones.add(phone);
    }

    validated.push({ rowNum, name, email, phone, groupName, role });
  }

  // If EVERYTHING failed → return early with errors
  if (validated.length === 0) {
    return {
      status: 200,
      body: {
        success: true,
        message: `Import complete: 0 created, 0 updated, ${results.errors.length} errors.`,
        results,
      },
    };
  }

  // ── PHASE 2: Process valid rows ──
  // Transaction-like: if a DB error occurs on any row, delete everything
  // inserted/updated so far in this batch and fail the whole import.
  const processedCids = [];
  const dbErrors = [];

  for (const row of validated) {
    try {
      const randomPass = Math.random().toString(36).substring(2, 10) + "A1!";
      const hashedPassword = await hashPassword(randomPass);
      const cid =
        "USR-" + Math.random().toString(36).substring(2, 10).toUpperCase();

      // Upsert: check existing by email (7.3: duplicate emails → update)
      const existing = await findActiveContactByEmail(row.email);

      if (existing.rows.length > 0) {
        await updateContactByEmail({
          name: row.name,
          phone: row.phone,
          groupName: row.groupName,
          role: row.role,
          password: hashedPassword,
          email: row.email,
        });
        results.updated++;
        processedCids.push(existing.rows[0].cid);
      } else {
        await insertContact({
          cid,
          name: row.name,
          email: row.email,
          phone: row.phone,
          password: hashedPassword,
          role: row.role,
          groupName: row.groupName,
        });
        results.created++;
        processedCids.push(cid);
      }
    } catch (rowError) {
      // 7.7: Rollback on DB failure
      dbErrors.push({
        row: row.rowNum,
        email: row.email,
        error: rowError.message,
      });

      for (const cid of processedCids) {
        try {
          await deleteContactByCid(cid);
        } catch (_) {}
      }

      return {
        status: 500,
        body: {
          success: false,
          error: `Database error at row ${row.rowNum}: ${rowError.message}. All changes rolled back.`,
          dbErrors,
        },
      };
    }
  }

  // Create notification
  if (results.created > 0 || results.updated > 0) {
    try {
      await insertBulkImportNotification(
        results.created,
        results.updated,
        results.errors.length,
      );
    } catch (error) {
      console.error("Notification error:", error.message);
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors.`,
      results,
    },
  };
}
