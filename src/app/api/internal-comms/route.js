import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

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
    ]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");

    // SECURITY: Users can only request their own messages unless super_admin
    const requestingCid = session.cid;
    if (session.role !== "super_admin" && cid !== requestingCid) {
      return NextResponse.json(
        { success: false, error: "You can only access your own messages." },
        { status: 403 },
      );
    }

    // Use the validated CID
    const targetCid = cid || requestingCid;

    // Ensure is_deleted column exists (safe migration)
    try {
      await db.execute(
        "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
      );
    } catch (_) {}

    let query = "SELECT * FROM v2_messages";
    let args = [];

    query +=
      " WHERE (recipient_id = ? OR sender_id = ?) AND target_type != 'all' AND (is_deleted IS NULL OR is_deleted = 0)";
    args = [targetCid, targetCid];

    // Super admins can also see broadcast messages
    if (session.role === "super_admin") {
      query = "SELECT * FROM v2_messages";
      args = [];
      if (targetCid) {
        query +=
          " WHERE (recipient_id = ? OR sender_id = ? OR target_type = 'all') AND (is_deleted IS NULL OR is_deleted = 0)";
        args = [targetCid, targetCid];
      }
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

    // SECURITY: Sender must match the authenticated user
    const sessionCid = session.cid;
    if (sender_id !== sessionCid && session.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Cannot send messages as another user." },
        { status: 403 },
      );
    }

    // SECURITY: Broadcast to all users is reserved to super_admin
    if (target_type === "all" && session.role !== "super_admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only super admins can broadcast to all users.",
        },
        { status: 403 },
      );
    }

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

    // Get sender name for notification
    let senderName = sender_id;
    try {
      const senderRes = await db.execute({
        sql: "SELECT name FROM contacts WHERE cid = ? OR id = ?",
        args: [sender_id, sender_id],
      });
      if (senderRes.rows.length > 0) senderName = senderRes.rows[0].name;
    } catch (_) {}

    // Trigger Notifications on Message Transmission
    const notifTitle = "New Message";
    const notifMessage = `You have 1 new message from ${senderName}`;

    if (recipient_id) {
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
        args: [recipient_id, notifTitle, notifMessage, "message"],
      });
    } else if (target_type === "role" && target_id) {
      const roleMap = {
        staff: "Staff",
        program_manager: "Program Manager",
        super_admin: "Super Admin",
        teacher: "Instructor",
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
            args: [m.cid, notifTitle, notifMessage, "message"],
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
    ]);
    if (authError) return authError;
    const { messageIds, conversationWith } = await req.json();

    // SECURITY: Validate the user is a participant in the conversation
    const sessionCid = session.cid;
    if (conversationWith) {
      if (
        conversationWith.recipientId !== sessionCid &&
        conversationWith.senderId !== sessionCid &&
        session.role !== "super_admin"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot mark messages as read for a conversation you are not part of.",
          },
          { status: 403 },
        );
      }
    }

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

export async function DELETE(req) {
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
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");
    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Query param required: id" },
        { status: 400 },
      );
    }

    // Ensure is_deleted column exists (safe migration)
    try {
      await db.execute(
        "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
      );
    } catch (_) {}

    const msgRes = await db.execute({
      sql: "SELECT sender_id FROM v2_messages WHERE id = ?",
      args: [messageId],
    });
    if (msgRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Message not found." },
        { status: 404 },
      );
    }

    // SECURITY: Only the sender (or super_admin) can delete a message
    if (
      msgRes.rows[0].sender_id !== session.cid &&
      session.role !== "super_admin"
    ) {
      return NextResponse.json(
        { success: false, error: "Cannot delete a message you did not send." },
        { status: 403 },
      );
    }

    await db.execute({
      sql: "UPDATE v2_messages SET is_deleted = 1 WHERE id = ?",
      args: [messageId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
