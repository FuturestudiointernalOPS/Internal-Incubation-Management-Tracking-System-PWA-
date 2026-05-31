import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import Papa from "papaparse";

/**
 * BULK USER UPLOAD
 * POST /api/admin/bulk-upload
 *
 * Body: FormData with 'file' field containing CSV
 *
 * CSV columns: name, email, group_name (optional), role (optional)
 *
 * All users created as status = 'pending'
 * Duplicate emails are updated (ON CONFLICT)
 */
export async function POST(req) {
  try {
    await initDb();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "CSV file is required." },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const { data, errors: parseErrors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
    });

    if (parseErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: "CSV parsing error",
        parseErrors: parseErrors.slice(0, 5),
      }, { status: 400 });
    }

    if (data.length === 0) {
      return NextResponse.json({
        success: false,
        error: "CSV file is empty.",
      }, { status: 400 });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [],
      skipped: 0,
    };

    for (const [index, row] of data.entries()) {
      try {
        const name = (row.name || "").trim();
        const email = (row.email || "").trim().toLowerCase();
        const groupName = (row.group_name || row.group || "").trim().toUpperCase() || "UNASSIGNED";
        const role = (row.role || "participant").trim().toLowerCase();

        if (!name || !email) {
          results.skipped++;
          results.errors.push({ row: index + 1, error: "Name and email are required." });
          continue;
        }

        if (!email.includes("@")) {
          results.skipped++;
          results.errors.push({ row: index + 1, email, error: "Invalid email format." });
          continue;
        }

        // Generate a random initial password (user will set via setup link)
        const randomPass = Math.random().toString(36).substring(2, 10) + "A1!";
        const hashedPassword = await bcrypt.hash(randomPass, 10);
        const cid = "USR-" + Math.random().toString(36).substring(2, 10).toUpperCase();

        // Upsert: create or update
        const existing = await db.execute({
          sql: "SELECT cid FROM contacts WHERE email = ? AND deleted = 0 LIMIT 1",
          args: [email],
        });

        if (existing.rows.length > 0) {
          // Update existing
          await db.execute({
            sql: `UPDATE contacts
                  SET name = ?, group_name = ?, role = ?, status = 'pending', password = ?
                  WHERE email = ?`,
            args: [name, groupName, role, hashedPassword, email],
          });
          results.updated++;
        } else {
          // Create new
          await db.execute({
            sql: `INSERT INTO contacts (cid, name, email, password, role, group_name, status, deleted)
                  VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`,
            args: [cid, name, email, hashedPassword, role, groupName],
          });
          results.created++;
        }
      } catch (rowErr) {
        results.skipped++;
        results.errors.push({ row: index + 1, email: row.email, error: rowErr.message });
      }
    }

    // Create notification for SuperAdmin
    if (results.created > 0 || results.updated > 0) {
      try {
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type)
                VALUES ('sa', ?, ?, 'verification')`,
          args: [
            "BULK USER IMPORT",
            `${results.created} new users created, ${results.updated} updated via CSV upload. ${results.errors.length} errors.`
          ],
        });
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
      { status: 500 }
    );
  }
}
