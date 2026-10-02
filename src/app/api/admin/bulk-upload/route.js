import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { NextResponse } from "next/server";
import {
  csvWantsInternalGroup,
  importContacts,
  parseContactCsv,
} from "@/services/dashboard/bulkImport";

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
 *
 * The parse, the validation, the role boundary and the processing live in
 * `services/dashboard/bulkImport`; this controller keeps the capability gates,
 * the protected-group boundary and the envelope.
 */
export async function POST(req) {
  try {
    await initDb();
    // Bulk imports are allowed for anyone who works in CRM (product decision):
    // either the dedicated bulk_upload.execute capability when it is granted,
    // or the CRM module's create capability — importing contacts IS creating
    // contacts. Super Admin bypasses the resolver entirely. The FUTURE STUDIO
    // protected-group boundary below remains an independent second gate.
    const ownCapError = await requireAuthorization("bulk_upload", "execute");
    if (ownCapError) {
      const crmCapError = await requireAuthorization("contacts", "create");
      if (crmCapError) return crmCapError;
    }

    // Role assignment is a separate authority — an importer holding only CRM
    // create must not be able to mint privileged identities via the CSV.
    const assignRoleError = await requireAuthorization("permissions", "assign_capabilities");
    const canAssignRole = !assignRoleError;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "CSV file is required." },
        { status: 400 },
      );
    }

    const text = await file.text();
    const { rows, parseErrors, empty } = parseContactCsv(text);

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

    if (empty) {
      return NextResponse.json(
        { success: false, error: "CSV file is empty." },
        { status: 400 },
      );
    }

    // Protected group boundary: bulk-importing people INTO FUTURE STUDIO is
    // an organizational-membership action — assign_capabilities alone must
    // not grant it (only org_membership.manage).
    if (csvWantsInternalGroup(rows)) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const { status, body } = await importContacts({ rows, canAssignRole });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
