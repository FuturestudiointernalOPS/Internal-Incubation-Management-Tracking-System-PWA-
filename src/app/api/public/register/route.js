import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { registerParticipantViaGroupLink } from "@/services/lms";

/**
 * PUBLIC endpoint — no auth required.
 * POST /api/public/register
 * Handles participant registration via public group link.
 *
 * The group lookup/fallback, the anonymous-submission rule, the
 * facilitator/participant conflict guard and the membership sync live in
 * `@/services/lms`. Field presence and the password length stay here as
 * controller validation.
 */
export async function POST(req) {
  try {
    await initDb();
    const { name, email, password, phone, group_id } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const result = await registerParticipantViaGroupLink({
      name,
      email,
      password,
      phone,
      groupId: group_id,
    });

    if (!result.ok) {
      if (result.reason === "role_conflict") {
        return NextResponse.json(
          {
            success: false,
            error: "errors.roleConflictParticipantFacilitator",
            message: "You are already assigned as a facilitator in this program.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message:
        "Application Submitted. Our team will review your application. If approved, you'll receive an email with your login instructions.",
      user: result.user,
    });
  } catch (error) {
    console.error("Public registration error:", error);
    return NextResponse.json({ error: "Registration failed. " + (error.message || "") }, { status: 500 });
  }
}
