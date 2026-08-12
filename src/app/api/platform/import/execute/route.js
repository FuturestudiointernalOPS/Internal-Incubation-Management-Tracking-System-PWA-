import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/platform/import/execute
 * Accepts form_id + run_id + mapping + csv_rows.
 * For each row: resolves CRM contact via existing_crm_id → email → phone →
 * fuzzy name (split, sort tokens, join). Creates contact with
 * ON CONFLICT(email) DO UPDATE. Inserts into platform_form_submissions
 * with data as {field_id: value}.
 * Returns imported/skipped/errors counts.
 */

function sortNameTokens(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

async function resolveContact(dbClient, row, mapping) {
  // 1. Try existing_crm_id
  const crmIdField = Object.keys(mapping).find(
    (k) => mapping[k] === "_crm_id"
  );
  if (crmIdField && row[crmIdField]) {
    const res = await dbClient.execute({
      sql: "SELECT * FROM contacts WHERE crm_id = ? OR custom_fields->>'crm_id' = ? LIMIT 1",
      args: [row[crmIdField], row[crmIdField]],
    });
    if (res.rows.length > 0) return res.rows[0];
  }

  // 2. Try email
  const emailField = Object.keys(mapping).find(
    (k) =>
      mapping[k] === "_email" ||
      (typeof mapping[k] === "string" && mapping[k].toLowerCase().includes("email"))
  );
  if (emailField && row[emailField]) {
    const email = row[emailField].toLowerCase().trim();
    if (email.includes("@")) {
      const res = await dbClient.execute({
        sql: "SELECT * FROM contacts WHERE LOWER(email) = ? LIMIT 1",
        args: [email],
      });
      if (res.rows.length > 0) return res.rows[0];
    }
  }

  // 3. Try phone
  const phoneField = Object.keys(mapping).find(
    (k) =>
      mapping[k] === "_phone" ||
      (typeof mapping[k] === "string" &&
        (mapping[k].toLowerCase().includes("phone") ||
          mapping[k].toLowerCase().includes("telephone")))
  );
  if (phoneField && row[phoneField]) {
    const phone = row[phoneField].replace(/[^\d+]/g, "");
    if (phone.length >= 7) {
      const res = await dbClient.execute({
        sql: "SELECT * FROM contacts WHERE phone = ? LIMIT 1",
        args: [phone],
      });
      if (res.rows.length > 0) return res.rows[0];
    }
  }

  // 4. Fuzzy name match
  const nameField = Object.keys(mapping).find(
    (k) =>
      mapping[k] === "_name" ||
      (typeof mapping[k] === "string" &&
        (mapping[k].toLowerCase().includes("name") ||
          mapping[k].toLowerCase().includes("full")))
  );
  if (nameField && row[nameField]) {
    const sorted = sortNameTokens(row[nameField]);
    if (sorted) {
      const allContacts = await dbClient.execute({
        sql: "SELECT * FROM contacts",
        args: [],
      });
      for (const c of allContacts.rows) {
        const cSorted = sortNameTokens(c.name);
        if (cSorted === sorted) return c;
      }
      // Try partial match: at least 2 tokens overlap
      const tokens = sorted.split(" ");
      if (tokens.length >= 2) {
        for (const c of allContacts.rows) {
          const cTokens = sortNameTokens(c.name).split(" ");
          const overlap = tokens.filter((t) => cTokens.includes(t)).length;
          if (overlap >= 2) return c;
        }
      }
    }
  }

  return null;
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { form_id, run_id, mapping, csv_rows } = await req.json();
    if (!form_id || !run_id || !mapping || !csv_rows) {
      return NextResponse.json(
        {
          success: false,
          error: "form_id, run_id, mapping, and csv_rows are required",
        },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < csv_rows.length; i++) {
      const row = csv_rows[i];
      try {
        // Skip empty rows
        const hasData = Object.values(row).some(
          (v) => v !== undefined && v !== null && String(v).trim() !== ""
        );
        if (!hasData) {
          skipped++;
          continue;
        }

        // Resolve contact
        let contact = await resolveContact(db, row, mapping);

        // Extract email for upsert
        let email = null;
        const emailKey = Object.keys(mapping).find(
          (k) =>
            mapping[k] === "_email" ||
            (typeof mapping[k] === "string" &&
              mapping[k].toLowerCase().includes("email"))
        );
        if (emailKey && row[emailKey]) {
          email = row[emailKey].toLowerCase().trim();
        }

        // Extract name
        let name = "Unknown";
        const nameKey = Object.keys(mapping).find(
          (k) =>
            mapping[k] === "_name" ||
            (typeof mapping[k] === "string" &&
              (mapping[k].toLowerCase().includes("name") ||
                mapping[k].toLowerCase().includes("full")))
        );
        if (nameKey && row[nameKey]) {
          name = row[nameKey].trim();
        }

        // Extract phone
        let phone = null;
        const phoneKey = Object.keys(mapping).find(
          (k) =>
            mapping[k] === "_phone" ||
            (typeof mapping[k] === "string" &&
              (mapping[k].toLowerCase().includes("phone") ||
                mapping[k].toLowerCase().includes("telephone")))
        );
        if (phoneKey && row[phoneKey]) {
          phone = row[phoneKey].replace(/[^\d+]/g, "");
        }

        if (!contact && email && email.includes("@")) {
          // Create or update contact
          const cid =
            "USER_" +
            uuidv4().split("-")[0].toUpperCase() +
            Math.floor(Math.random() * 10000);

          const upsertRes = await db.execute({
            sql: `INSERT INTO contacts (cid, name, email, phone, role, status)
                  VALUES (?, ?, ?, ?, 'participant', 'approved')
                  ON CONFLICT (email) WHERE email IS NOT NULL AND email != ''
                  DO UPDATE SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, contacts.phone)
                  RETURNING *`,
            args: [cid, name, email, phone],
          });
          contact = upsertRes.rows[0];
        } else if (!contact) {
          // No email to key off — create with generated cid anyway
          const cid =
            "USER_" +
            uuidv4().split("-")[0].toUpperCase() +
            Math.floor(Math.random() * 10000);

          const insertRes = await db.execute({
            sql: `INSERT INTO contacts (cid, name, email, phone, role, status)
                  VALUES (?, ?, ?, ?, 'participant', 'approved')
                  ON CONFLICT DO NOTHING
                  RETURNING *`,
            args: [cid, name, email, phone],
          });
          if (insertRes.rows.length > 0) {
            contact = insertRes.rows[0];
          }
        }

        if (!contact) {
          errors.push({ row: i + 1, error: "Could not resolve or create contact" });
          continue;
        }

        // Build submission data: map csv columns to field IDs
        const submissionData = {};
        for (const csvCol of Object.keys(row)) {
          const fieldId = mapping[csvCol];
          if (fieldId && !fieldId.startsWith("_")) {
            submissionData[fieldId] = row[csvCol];
          }
        }

        // Insert submission
        await db.execute({
          sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, data, status)
                VALUES (?, ?, ?, ?, 'imported')`,
          args: [
            run_id,
            contact.cid,
            contact.name,
            JSON.stringify(submissionData),
          ],
        });

        imported++;
      } catch (rowErr) {
        errors.push({ row: i + 1, error: rowErr.message });
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      total: csv_rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
