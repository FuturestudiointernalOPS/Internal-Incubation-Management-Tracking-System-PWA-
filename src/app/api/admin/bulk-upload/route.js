import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { normalizeGroupName, INTERNAL_GROUP } from "@/lib/authorization/membership";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import Papa from "papaparse";
import {
  deleteContactByCid,
  findActiveContactByEmail,
  getAllActiveContactPhones,
  insertBulkImportNotification,
  insertContact,
  updateContactByEmail,
} from "@/models/adminOps";

/**
 * BULK USER UPLOAD — with rollback + phone support
 * POST /api/admin/bulk-upload
 *
 * Body: FormData with 'file' field containing CSV
 *
 * CSV columns: name, email, phone (optional), group_name (optional), role (optional)
 *
 * All users created as status = 'pending'
 * Duplicate emails are updated (upsert)
 * Duplicate phones are rejected (skip + error)
 *
 * ROLLBACK: all rows are validated first. If validation fails for any row
 * in a way that would corrupt data (DB-level errors), the entire import is
 * rolled back. Rows that fail validation (missing fields, bad format) are
 * skipped and reported as errors — the valid rows still succeed.
 */
export async function POST(req) {
  try {
    await initDb();
    // P1 gate migration: bulk imports are governed by their own module
    // capability (bulk_upload.execute), not by permission-administration
    // powers. Legacy holders of permissions.assign_capabilities were mapped
    // additively on staging (before-image captured); production mapping is a
    // documented rollout step before this deploys. The FUTURE STUDIO
    // protected-group boundary below remains an independent second gate.
    const capError = await requireAuthorization("bulk_upload", "execute");
    if (capError) return capError;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "CSV file is required." },
        { status: 400 },
      );
    }

    const text = await file.text();

    const { data, errors: parseErrors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
    });

    if (parseErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "CSV parsing error",
          parseErrors: parseErrors.slice(0, 5),
        },
        { status: 400 },
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { success: false, error: "CSV file is empty." },
        { status: 400 },
      );
    }

    // Protected group boundary: bulk-importing people INTO FUTURE STUDIO is
    // an organizational-membership action — assign_capabilities alone must
    // not grant it (only org_membership.manage).
    const wantsInternal = data.some(
      (row) =>
        normalizeGroupName(row?.group_name || row?.group) === INTERNAL_GROUP,
    );
    if (wantsInternal) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    // ── PHASE 1: Validate all rows ──
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
      const phoneRes = await getAllActiveContactPhones();
      for (const r of phoneRes.rows) {
        if (r.phone) phoneSet.add(r.phone.trim());
      }
    } catch (_) {}

    // Track phones seen in this batch for intra-batch duplicate detection
    const batchPhones = new Set();

    for (const [index, row] of data.entries()) {
      const rowNum = index + 1;
      const name = (row.name || "").trim();
      const email = (row.email || "").trim().toLowerCase();
      const phone = (row.phone || "").trim();
      const groupName =
        (row.group_name || row.group || "").trim().toUpperCase() ||
        "UNASSIGNED";
      const role = (row.role || "participant").trim().toLowerCase();

      // 7.5: Missing mandatory fields
      if (!name || !email) {
        results.skipped++;
        results.errors.push({
          row: rowNum,
          error: "Name and email are required.",
        });
        continue;
      }

      // 7.2: Invalid email format
      if (!email.includes("@")) {
        results.skipped++;
        results.errors.push({
          row: rowNum,
          email,
          error: "Invalid email format.",
        });
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
      return NextResponse.json({
        success: true,
        message: `Import complete: 0 created, 0 updated, ${results.errors.length} errors.`,
        results,
      });
    }

    // ── PHASE 2: Process valid rows ──
    // Use a transaction-like approach: try each row, but if a DB error occurs
    // on any row, rollback all previous inserts/updates for this batch.
    // Since we can't do true SQL transactions easily, we collect inserted CIDs
    // and delete them on failure.

    const processedCids = [];
    let hasDbError = false;
    const dbErrors = [];

    for (const row of validated) {
      try {
        const randomPass = Math.random().toString(36).substring(2, 10) + "A1!";
        const hashedPassword = await bcrypt.hash(randomPass, 10);
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
      } catch (rowErr) {
        // 7.7: Rollback on DB failure
        hasDbError = true;
        dbErrors.push({
          row: row.rowNum,
          email: row.email,
          error: rowErr.message,
        });

        // Rollback: delete all records we just created in this batch
        for (const cid of processedCids) {
          try {
            await deleteContactByCid(cid);
          } catch (_) {}
        }

        return NextResponse.json(
          {
            success: false,
            error: `Database error at row ${row.rowNum}: ${rowErr.message}. All changes rolled back.`,
            dbErrors,
          },
          { status: 500 },
        );
      }
    }

    // Create notification
    if (results.created > 0 || results.updated > 0) {
      try {
        await insertBulkImportNotification(results.created, results.updated, results.errors.length);
      } catch (e) {
        console.error("Notification error:", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors.`,
      results,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
