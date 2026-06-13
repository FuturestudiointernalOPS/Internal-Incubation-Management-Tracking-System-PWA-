import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid"); // Get messages for a specific user

    let query = "SELECT * FROM v2_messages";
    let args = [];

    if (cid) {
      query +=
        " WHERE recipient_id = ? OR sender_id = ? OR target_type = 'all'";
      args = [cid, cid];
    }

    query += " ORDER BY created_at DESC";

    const res = await db.execute({ sql: query, args });
    return NextResponse.json({ success: true, messages: res.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const {
      sender_id,
      recipient_id,
      target_type,
      target_id,
      subject,
      body,
      priority,
    } = await req.json();

    // Ensure is_read column exists (safe migration)
    try {
      await db.execute(
        "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0",
      );
    } catch (_) {}

    await db.execute({
      sql: "INSERT INTO v2_messages (sender_id, recipient_id, target_type, target_id, subject, body, priority, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        sender_id,
        recipient_id || null,
        target_type || "individual",
        target_id || null,
        subject,
        body,
        priority || "normal",
        0,
      ],
    });

    // ARCHITECTURE UPGRADE: Trigger Notifications on Message Transmission
    if (recipient_id) {
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
        args: [
          recipient_id,
          subject,
          body.substring(0, 50) + (body.length > 50 ? "..." : ""),
          "message",
        ],
      });
    } else if (target_type === "role" && target_id) {
      // Notify all users with the given role
      const roleMap = {
        staff: "Staff",
        program_manager: "Program Manager",
        super_admin: "Super Admin",
        teacher: "Teacher",
        participant: "Participant",
      };
      const dbRole = roleMap[target_id];
      if (dbRole) {
        const members = await db.execute(
          "SELECT cid FROM contacts WHERE role = ?",
          [dbRole],
        );
        for (const m of members.rows) {
          if (m.cid === sender_id) continue;
          await db.execute({
            sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
            args: [
              m.cid,
              subject,
              body.substring(0, 50) + (body.length > 50 ? "..." : ""),
              "message",
            ],
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
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
    ]);
    if (authError) return authError;
    const { messageIds, conversationWith } = await req.json();

    // Ensure is_read column exists
    try {
      await db.execute(
        "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0",
      );
    } catch (_) {}

    if (Array.isArray(messageIds) && messageIds.length > 0) {
      const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(",");
      await db.execute({
        sql: `UPDATE v2_messages SET is_read = 1 WHERE id IN (${placeholders})`,
        args: messageIds,
      });
    } else if (conversationWith) {
      // Mark all messages from a specific sender as read
      await db.execute({
        sql: "UPDATE v2_messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ? AND (is_read IS NULL OR is_read = 0)",
        args: [conversationWith.senderId, conversationWith.recipientId],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
