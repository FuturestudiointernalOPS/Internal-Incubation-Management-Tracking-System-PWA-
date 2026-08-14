import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, requireCapability } from "@/lib/auth";
export const dynamic = "force-dynamic";

/**
 * Generates an invite token and sends activation email. Non-blocking.
 */
async function fireInvite(cid, name, email, role, groupId) {
  try {
    const token = uuidv4();

    await db.execute({
      sql: `INSERT INTO password_setup_tokens (token, contact_cid, expires_at)
            VALUES (?, ?, NOW() + INTERVAL '48 hours')`,
      args: [token, cid],
    });

    await db.execute({
      sql: "UPDATE contacts SET invited_at = NOW() WHERE cid = ?",
      args: [cid],
    }).catch(() => {}); // Column may not exist yet — non-critical
    // Send email synchronously so Vercel doesn't kill the worker
    const { sendInviteEmail } = await import("@/lib/email");
    await sendInviteEmail({ to: email, name, role, token });
  } catch (e) {
    console.error("Invite fire failed:", e.message || e);
  }
}

/**
 * CONTACTS API — PERSONNEL REGISTRY
 * Hardened for Gated Onboarding and Real-time Alerts.
 */

export async function POST(req) {
  try {
    await initDb();
    // Auth is optional — public forms create contacts without login.
    // If authenticated, check capability.
    try {
      const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
      if (!authError) {
        const capError = await requireCapability("crm", "create");
        if (capError) return capError;
      }
    } catch (_) {}

    const body = await req.json();
    const contacts = Array.isArray(body) ? body : [body];

    console.log("--- CONTACT REGISTRATION START ---", {
      count: contacts.length,
    });

    const validContacts = [];
    const errors = [];

    for (const c of contacts) {
      // Mapping for Public Application Form
      const rawName = c.name || c.fullName || "Unknown Applicant";
      const rawEmail = (c.email || "").toLowerCase().trim();
      const rawPassword = (c.password || "").trim();

      if (!rawEmail) {
        errors.push({ name: rawName, error: "Email is required" });
        continue;
      }

      const cid =
        "USER_" +
        uuidv4().split("-")[0].toUpperCase() +
        Math.floor(Math.random() * 10000);

      // Hash password if provided; otherwise generate a temp hash (DB column is NOT NULL)
      const hashedPassword = rawPassword
        ? await bcrypt.hash(rawPassword, 10)
        : await bcrypt.hash(uuidv4(), 10);

      // Gated Status Logic (UPPERCASE NORMALIZATION)
      const groupName = (c.group_name || "unassigned").toUpperCase();
      const isInternal = groupName === "FUTURE STUDIO";

      // Use provided status, or default: approved for staff, pending for participants
      let initialStatus =
        c.status ||
        (isInternal || c.role === "participant" ? "pending" : "approved");

      // Strict Role Normalization
      let finalRole = c.role;
      if (!finalRole || finalRole === "unassigned") {
        finalRole = isInternal ? "staff" : "unassigned";
      }

      validContacts.push({
        cid,
        name: rawName.trim(),
        email: rawEmail,
        phone: c.phone || null,
        address: c.address || c.homeAddress || null,
        dob: c.dob || null,
        group_name: groupName,
        role: finalRole,
        password: hashedPassword,
        program_id: c.program_id || null,
        program_name: c.program_name || null,
        image: c.image || null,
        status: initialStatus,
        deleted: 0,
        gender: c.gender || null,
        mother_name: c.mother_name || null,
      });
    }

    let inserted = 0;
    for (const vc of validContacts) {
      try {
        console.log(`Saving contact: ${vc.email} as ${vc.status}`);

        await db.execute({
          sql: `INSERT INTO contacts (
                  cid, name, email, phone, address, dob, group_name,
                  role, password, program_id, program_name, image, status, deleted, gender, mother_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                  name = EXCLUDED.name,
                  phone = EXCLUDED.phone,
                  address = EXCLUDED.address,
                  status = EXCLUDED.status,
                  role = EXCLUDED.role,
                  group_name = EXCLUDED.group_name`,
          args: [
            vc.cid,
            vc.name,
            vc.email,
            vc.phone,
            vc.address,
            vc.dob,
            vc.group_name,
            vc.role,
            vc.password,
            vc.program_id,
            vc.program_name,
            vc.image,
            vc.status,
            vc.deleted,
            vc.gender,
            vc.mother_name,
          ],
        });

        if (vc.status === "pending") {
          console.log("Triggering Admin Notification for:", vc.name);
          await db.execute({
            sql: `INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)`,
            args: [
              "sa",
              "NEW ACCESS REQUEST",
              `${vc.name} has applied to join the FUTURE STUDIO group. Verification required.`,
              "verification",
            ],
          });
        }

        // Fire invite for ALL new contacts so they receive activation email
        if (vc.email) {
          await fireInvite(vc.cid, vc.name, vc.email, vc.role, vc.program_id);
        }

        // If program_ids or program_id provided, sync to participant_programs
        const programIdsToAssign =
          vc.program_ids && Array.isArray(vc.program_ids)
            ? vc.program_ids
            : vc.program_id
              ? [vc.program_id]
              : [];

        for (const pid of programIdsToAssign) {
          try {
            await db.execute({
              sql: `INSERT INTO participant_programs (participant_id, program_id)
                    VALUES (?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
              args: [vc.cid, pid],
            });

            await db.execute({
              sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                    VALUES (?, ?, 'assigned', ?)`,
              args: [vc.cid, pid, "system"],
            });
          } catch (e) {
            console.error(
              `Failed to assign ${vc.cid} to program ${pid}:`,
              e.message,
            );
          }
        }

        inserted++;
      } catch (err) {
        console.error(`SQL Save Error for ${vc.email}:`, err.message);
        errors.push({ email: vc.email, error: err.message });
      }
    }

    if (inserted === 0 && errors.length > 0) {
      console.error("All registrations failed:", errors[0].error);
      return NextResponse.json(
        { success: false, error: `Database Error: ${errors[0].error}` },
        { status: 400 },
      );
    }

    // Fire duplicate detection for new contacts (non-blocking)
    if (inserted > 0) {
      Promise.resolve().then(async () => {
        for (const vc of validContacts) {
          if (!vc.phone) continue;
          try {
            const existing = await db.execute({
              sql: `SELECT cid FROM contacts WHERE phone = ? AND cid != ? AND email != ? AND deleted_at IS NULL LIMIT 1`,
              args: [vc.phone, vc.cid, vc.email],
            });
            if (existing.rows.length > 0) {
              await db.execute({
                sql: `INSERT INTO contact_duplicate_flags (contact_cid_a, contact_cid_b, match_reason, confidence)
                      VALUES (?, ?, 'same_phone', 0.85)
                      ON CONFLICT (contact_cid_a, contact_cid_b) DO NOTHING`,
                args: [vc.cid, existing.rows[0].cid],
              });
            }
          } catch (_) {}
        }
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, inserted, errors });
  } catch (error) {
    console.error("CRITICAL CONTACTS ERROR:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "participant",
    ]);
    if (authError) return authError;
    const capError = await requireCapability("crm", "edit");
    if (capError) return capError;

    const data = await req.json();

    if (!data.cid) {
      return NextResponse.json(
        { success: false, error: "Contact ID (cid) is required for update." },
        { status: 400 },
      );
    }

    const fieldsToUpdate = [];
    const args = [];

    const updatableColumns = [
      "name",
      "email",
      "phone",
      "address",
      "dob",
      "group_name",
      "role",
      "password",
      "program_id",
      "program_name",
      "image",
      "status",
      "deleted",
      "archived_at",
      "archived_by",
      "gender",
      "mother_name",
    ];

    for (const col of updatableColumns) {
      if (data[col] !== undefined) {
        let val = data[col];
        if (typeof val === "string") val = val.trim();

        if (col === "password" && val === "") continue;

        if (col === "password") {
          const hashedPassword = await bcrypt.hash(val, 10);
          fieldsToUpdate.push(`${col} = ?`);
          args.push(hashedPassword);
        } else if (col === "email") {
          fieldsToUpdate.push(`${col} = ?`);
          args.push(val.toLowerCase());
        } else if (col === "archived_at" || col === "archived_by") {
          // Allow NULL for restore, or timestamp/text for archive
          fieldsToUpdate.push(`${col} = ?`);
          args.push(val || null);
        } else {
          fieldsToUpdate.push(`${col} = ?`);
          args.push(col === "deleted" ? (val ? 1 : 0) : val);
        }
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No fields to update.",
      });
    }

    args.push(data.cid);

    const match = await db.execute({
      sql: `UPDATE contacts SET ${fieldsToUpdate.join(", ")} WHERE cid = ?`,
      args: args,
    });

    // Sync participant_programs if program_ids array is provided
    if (Array.isArray(data.program_ids)) {
      // Verify all programs exist before assigning
      for (const pid of data.program_ids) {
        const check = await db.execute({
          sql: "SELECT id FROM v2_programs WHERE id = ?",
          args: [pid],
        });
        if (check.rows.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Program "${pid}" not found. Create it first before assigning.`,
            },
            { status: 404 },
          );
        }
      }

      // Remove existing assignments not in the new list
      if (data.program_ids.length > 0) {
        const placeholders = data.program_ids.map(() => "?").join(",");
        await db.execute({
          sql: `DELETE FROM participant_programs WHERE participant_id = ? AND program_id NOT IN (${placeholders})`,
          args: [data.cid, ...data.program_ids],
        });
      } else {
        await db.execute({
          sql: "DELETE FROM participant_programs WHERE participant_id = ?",
          args: [data.cid],
        });
      }

      // Add new assignments
      for (const pid of data.program_ids) {
        try {
          await db.execute({
            sql: `INSERT INTO participant_programs (participant_id, program_id)
                  VALUES (?, ?)
                  ON CONFLICT (participant_id, program_id) DO NOTHING`,
            args: [data.cid, pid],
          });

          await db.execute({
            sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                  VALUES (?, ?, 'assigned', ?)`,
            args: [data.cid, pid, data.assigned_by || "system"],
          });
        } catch (e) {
          console.error(
            `PUT program sync error for ${data.cid}, program ${pid}:`,
            e.message,
          );
        }
      }
    } else if (data.program_id) {
      // Single program_id fallback — ensure at least this one exists
      try {
        await db.execute({
          sql: `INSERT INTO participant_programs (participant_id, program_id)
                VALUES (?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
          args: [data.cid, data.program_id],
        });
      } catch (e) {
        console.error(`PUT program sync error for ${data.cid}:`, e.message);
      }
    }

    // If status changed to active/approved, fire invite and clear notifications
    if (data.status === "active" || data.status === "approved") {
      try {
        const userRes = await db.execute({
          sql: "SELECT name, email, role FROM contacts WHERE cid = ?",
          args: [data.cid],
        });
        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];

          // Fire invite for approved staff (participants already invited on registration)
          // Commented out — invite is now sent on registration, not on approval
          // if (u.role !== "participant") {
          //   fireInvite(data.cid, u.name, u.email, u.role, null).catch(() => {});
          // }

          // Clear notifications
          await db.execute({
            sql: `UPDATE v2_notifications
                      SET is_read = 1
                      WHERE recipient_id = 'sa'
                      AND message ILIKE ?
                      AND is_read = 0`,
            args: [`%${u.name}%`],
          });
        }
      } catch (e) {
        console.error("Auto-Purge Failure:", e);
      }
    }

    return NextResponse.json({
      success: true,
      rowsAffected: match.rowsAffected,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "participant",
      "founder",
    ]);
    if (authError) return authError;
    const capError = await requireCapability("crm", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const roleFilter = searchParams.get("role");
    const groupFilter = searchParams.get("group");

    let result;
    if (session.role === "participant" || session.role === "founder") {
      result = await db.execute({
        sql: "SELECT * FROM contacts WHERE cid = ?",
        args: [session.cid],
      });
    } else if (statusFilter === "archived" && session.role === "super_admin") {
      // Archived contacts (archived but not soft-deleted)
      result = await db.execute(
        "SELECT * FROM contacts WHERE archived_at IS NOT NULL AND deleted_at IS NULL ORDER BY name ASC",
      );
    } else if (session.role === "super_admin") {
      let sql = "SELECT * FROM contacts WHERE archived_at IS NULL AND deleted_at IS NULL";
      const args = [];
      if (roleFilter) {
        const roles = roleFilter.split(",");
        sql += " AND (" + roles.map(() => "role = ?").join(" OR ") + ")";
        args.push(...roles);
      }
      if (statusFilter && statusFilter !== "all") {
        sql += " AND status = ?";
        args.push(statusFilter);
      }
      if (groupFilter) {
        sql += " AND UPPER(TRIM(group_name)) = UPPER(TRIM(?))";
        args.push(groupFilter);
      }
      sql += " ORDER BY name ASC";
      result = await db.execute({ sql, args });
    } else {
      // Staff/PM/Teacher: active only
      let sql =
        "SELECT * FROM contacts WHERE archived_at IS NULL AND deleted_at IS NULL AND status = 'active'";
      const args = [];
      if (groupFilter) {
        sql += " AND UPPER(TRIM(group_name)) = UPPER(TRIM(?))";
        args.push(groupFilter);
      }
      sql += " ORDER BY name ASC";
      result = await db.execute({ sql, args });
    }
    return NextResponse.json({ success: true, contacts: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Soft-delete a contact (never physically deletes).
 * Sets deleted_at and deleted_by. Contact disappears from all views.
 */
export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireCapability("crm", "delete");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "Contact ID (cid) is required." },
        { status: 400 },
      );
    }

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    const deletedBy = session?.name || session?.email || session?.cid || "unknown";

    const result = await db.execute({
      sql: `UPDATE contacts SET deleted_at = NOW(), deleted_by = ? WHERE cid = ?`,
      args: [deletedBy, cid],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { success: false, error: "Contact not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact permanently deleted.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
