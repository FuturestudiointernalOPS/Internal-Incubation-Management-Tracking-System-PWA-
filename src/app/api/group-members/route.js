import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { group_id, participant_id } = body;

    if (!group_id || !participant_id) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Check if participant is already in a group for this program
    // We'd need to fetch the group's program_id first
    const { data: groupData } = await supabase.from('v2_groups').select('program_id').eq('id', group_id).single();
    
    if (groupData) {
       const { data: existing } = await supabase.from('v2_group_members')
          .select('id, v2_groups(program_id)')
          .eq('participant_id', participant_id);
       
       const alreadyInProgram = existing?.some(m => m.v2_groups.program_id === groupData.program_id);
       if (alreadyInProgram) {
          return NextResponse.json({ success: false, error: "Participant already assigned to a team in this program." }, { status: 400 });
       }
    }

    const { data, error } = await supabase
      .from("v2_group_members")
      .insert([{ group_id, participant_id }])
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, membership: data[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const group_id = searchParams.get('group_id');

    let query = supabase.from("v2_group_members").select("*, v2_participants(*)");
    
    if (group_id) {
       query = query.eq('group_id', group_id);
    }

    const { data, error } = await query;

    if (error) {
       return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, members: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
