import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireProgramScope } from "@/lib/programScopedAccess";

export async function POST(req) {
  try {
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const { group_id, participant_id } = body;

    if (!group_id || !participant_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if participant is already in a group for this program
    // We'd need to fetch the group's program_id first
    const { data: groupData } = await supabase
      .from("v2_groups")
      .select("program_id")
      .eq("id", group_id)
      .single();

    if (!groupData) {
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );
    }

    // Record scope: a membership write belongs to the group's program, so the
    // caller must be staffed there. The group's program was just resolved.
    const scopeError = await requireProgramScope({ programId: groupData.program_id, wave: "groups" });
    if (scopeError) return scopeError;

    const { data: existing } = await supabase
      .from("v2_group_members")
      .select("id, v2_groups(program_id)")
      .eq("participant_id", participant_id);

    const alreadyInProgram = existing?.some(
      (member) => member.v2_groups.program_id === groupData.program_id,
    );
    if (alreadyInProgram) {
      return NextResponse.json(
        {
          success: false,
          error: "Participant already assigned to a team in this program.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("v2_group_members")
      .insert([{ group_id, participant_id }])
      .select();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, membership: data[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const group_id = searchParams.get("group_id");

    // Require a group: an unscoped read dumped EVERY membership, with the full
    // participant row attached.
    if (!group_id) {
      return NextResponse.json(
        { success: false, error: "group_id is required" },
        { status: 400 },
      );
    }

    const query = supabase
      .from("v2_group_members")
      .select("*, v2_participants(*)")
      .eq("group_id", group_id);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, members: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
