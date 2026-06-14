import { supabaseAdmin } from "@/lib/supabase-admin";
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";

/**
 * NOTIFICATIONS API — SIGNAL AGGREGATION
 * Fetches real-time alerts for the Super Admin (Approvals, Alerts, etc.)
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { recipient_id, title, message, type } = await req.json();

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Title and message required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, NOW())`,
      args: [recipient_id || "sa", title, message, type || "general"],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Notification Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get("recipient_id") || "sa";

    // Use db.execute instead of supabaseAdmin for consistency
    const result = await db.execute({
      sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? AND (is_read = false OR is_read IS NULL) ORDER BY created_at DESC",
      args: [recipientId],
    });

    return NextResponse.json({
      success: true,
      notifications: result.rows || [],
    });
  } catch (error) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;
    const { id, action } = await req.json();

    if (action === "read") {
      const { error } = await supabaseAdmin
        .from("v2_notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("PATCH Notifications Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
