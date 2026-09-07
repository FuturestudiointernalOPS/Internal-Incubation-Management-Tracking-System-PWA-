import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createHandler } from "@/lib/api/createHandler";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { ensureInvitationsTable, createInvitation, listActiveInvites } from "@/models/groups";

export const POST = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {
  // Rate limit: 20 program invite links per IP per 10 minutes
  const limited = enforceRateLimit(req, `program-invites:ip:${getClientIp(req)}`, {
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

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

  // Ensure table exists
  try {
    await ensureInvitationsTable();
  } catch (_) {}

  // Ensure the hashed-token column exists (idempotent, cached once per process)
  await ensureTokenHashColumns();

  const token = uuidv4();
  const expiresAt = new Date();

  if (expiresInHours) {
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  } else {
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  try {
    await createInvitation(
      token,
      hashToken(token),
      program_id,
      group_name,
      team_id,
      role,
      '',
      expiresAt.toISOString().replace("T", " ").replace("Z", ""),
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
    console.error("[Invite Generation Error]:", error.message, error.stack);
    return NextResponse.json(
      { error: "Failed to generate invite: " + error.message },
      { status: 500 },
    );
  }
});

export async function GET(req) {
  try {
    // Optionally fetch active invites for a specific program
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    const result = await listActiveInvites(program_id);
    return NextResponse.json({ invites: result.rows });
  } catch (error) {
    console.error("[Fetch Invites Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 },
    );
  }
}
