import { supabaseAdmin } from "@/lib/supabase-admin";
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

/**
 * NOTIFICATIONS API — SIGNAL AGGREGATION
 * Fetches real-time alerts for the Super Admin (Approvals, Alerts, etc.)
 */

export async function POST(req) {
  try {
    await initDb();
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
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get("recipient_id") || "sa";

    // Fetch unread notifications using the Supabase SDK (more reliable on Vercel)
    const { data, error } = await supabaseAdmin
      .from("v2_notifications")
      .select("*")
      .eq("recipient_id", recipientId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase Query Error:", error);
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, notifications: data || [] });
  } catch (error) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        hint: "Check if the v2_notifications table and is_read column exist in Supabase.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
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
