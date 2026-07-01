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
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    // SECURITY: Users can only request their own messages unless super_admin
    if (session.role !== "super_admin" && userId !== session.cid) {
      return NextResponse.json(
        { success: false, error: "You can only access your own messages." },
        { status: 403 },
      );
    }

    const targetCid = userId || session.cid;
    const res = await db.execute({
      sql: "SELECT * FROM v2_messages WHERE (recipient_id = ? OR sender_id = ?) AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at DESC",
      args: [targetCid, targetCid],
    });

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
    const { program_id, sender_id, recipient_id, subject, body } =
      await req.json();

    // SECURITY: Sender must match the authenticated user
    if (sender_id !== session.cid && session.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Cannot send messages as another user." },
        { status: 403 },
      );
    }

    // SECURITY: Broadcast to all participants is reserved to super_admin
    if (recipient_id === "all" && session.role !== "super_admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only super admins can message all participants.",
        },
        { status: 403 },
      );
    }

    // NOTE: v2_messages has no program_id column — dropped from INSERT (was broken, unreachable).
    const result = await db.execute({
      sql: `INSERT INTO v2_messages (sender_id, recipient_id, subject, body)
            VALUES (?, ?, ?, ?) RETURNING *`,
      args: [sender_id, recipient_id === "all" ? null : recipient_id, subject, body],
    });

    // NOTIFICATION BRIDGE
    // If recipient_id is 'all', notify all participants in program
    let emails = [];
    if (recipient_id === "all") {
      const res = await db.execute({
        sql: "SELECT email FROM v2_participants WHERE program_id = ?",
        args: [program_id],
      });
      emails = res.rows.map((r) => r.email);
    } else {
      emails = [recipient_id];
    }

    // In a real email setup, we would trigger SMTP here.
    // For now, we create internal notifications.
    for (const email of emails) {
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, 'message')",
        args: [email, subject || "New Message from PM", body],
      });
    }

    return NextResponse.json({ success: true, message: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
