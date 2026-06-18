import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";

/**
 * Generates an invite token and sends activation email. Non-blocking.
 */
async function fireInvite(cid, name, email, role, groupId) {
  try {
    const token = uuidv4();
    const tokenType =
      role === "participant" ? "participant_invite" : "staff_invite";

    await db.execute({
      sql: `INSERT INTO password_setup_tokens (token, user_cid, token_type, role, group_id, expires_at)
            VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '48 hours')`,
      args: [token, cid, tokenType, role || null, groupId || null],
    });

    await db.execute({
      sql: "UPDATE contacts SET invited_at = NOW() WHERE cid = ?",
      args: [cid],
    });

    // Send email (non-blocking, fire and forget)
    import("@/lib/email").then(({ sendInviteEmail }) => {
      sendInviteEmail({ to: email, name, role, token }).catch((e) =>
        console.error("Invite email failed:", e),
      );
    });
  } catch (e) {
    console.error("Invite fire failed (non-blocking):", e.message);
  }
}

/**
 * CONTACTS API — PERSONNEL REGISTRY
 * Hardened for Gated Onboarding and Real-time Alerts.
 */

export async function POST(req) {
  try {
    await initDb();
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

      // No password — user sets it via activation link
      const hashedPassword = null;

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

        // Fire invite for auto-approved roles (participants) or pending that get auto-approved
        if (vc.status === "approved" || vc.role === "participant") {
          fireInvite(vc.cid, vc.name, vc.email, vc.role, vc.program_id).catch(
            () => {},
          );
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
              sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
              args: [vc.cid, pid, "system", "registration"],
            });

            await db.execute({
              sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by, source)
                    VALUES (?, ?, 'assigned', ?, 'registration')`,
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
            sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT (participant_id, program_id) DO NOTHING`,
            args: [data.cid, pid, data.assigned_by || "system", "manual"],
          });

          await db.execute({
            sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by, source)
                  VALUES (?, ?, 'assigned', ?, 'manual')`,
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
          sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
          args: [
            data.cid,
            data.program_id,
            data.assigned_by || "system",
            "manual",
          ],
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
          if (u.role !== "participant") {
            fireInvite(data.cid, u.name, u.email, u.role, null).catch(() => {});
          }

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
    ]);
    if (authError) return authError;

    let result;
    if (session.role === "participant") {
      // Participants can only see their own contact
      result = await db.execute({
        sql: "SELECT * FROM contacts WHERE cid = ?",
        args: [session.cid],
      });
    } else {
      result = await db.execute(
        "SELECT * FROM contacts ORDER BY created_at DESC",
      );
    }
    return NextResponse.json({ success: true, contacts: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
