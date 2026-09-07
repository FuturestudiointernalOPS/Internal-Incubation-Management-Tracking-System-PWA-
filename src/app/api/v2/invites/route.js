// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { createV2Invitation, listV2Invitations } from "@/models/authFlows";

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;
    const {
      program_id,
      group_name,
      team_id,
      role = "participant",
      expiresInDays = 7,
      expiresInHours,
    } = await req.json();

    if (!program_id) {
      return NextResponse.json(
        { error: "Program ID is required" },
        { status: 400 },
      );
    }

    const token = uuidv4();
    const expiresAt = new Date();

    if (expiresInHours) {
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    } else {
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    await createV2Invitation(
      token,
      program_id,
      group_name,
      team_id,
      role,
      expiresAt,
    );

    // Detect the base URL dynamically from the request headers
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host");
    const baseUrl = `${protocol}://${host}`;
    const inviteUrl = `${baseUrl}/invite/${token}`;

    return NextResponse.json({
      message: "Invite generated successfully",
      token,
      inviteUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("[Invite Generation Error]:", error);
    return NextResponse.json(
      { error: "Failed to generate invite" },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;
    // Optionally fetch active invites for a specific program
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    const result = await listV2Invitations(program_id);
    return NextResponse.json({ invites: result.rows });
  } catch (error) {
    console.error("[Fetch Invites Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 },
    );
  }
}
