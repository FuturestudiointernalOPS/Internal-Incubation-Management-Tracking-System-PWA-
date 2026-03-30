import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      program_id, 
      name, 
      status, 
      type, 
      concept_note, 
      assigned_pm_id 
    } = body;

    if (!program_id || !name) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("v2_projects")
      .insert([
        { 
          program_id, 
          name, 
          status: status || 'Active', 
          type: type || 'Incubation', 
          concept_note,
          assigned_pm_id // We should ensure our schema handles this, or link it via the program
        }
      ])
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, project: data[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');
    const assigned_pm_id = searchParams.get('pm_id');

    let query = supabase.from("v2_projects").select("*, v2_programs(name)");
    
    if (program_id) {
       query = query.eq('program_id', program_id);
    }
    if (assigned_pm_id) {
       // Filtering by PM ID (assuming PM is linked to program or project)
       // For now, filtering directly on project if column exists or via join
       // Based on Ticket 1.2 schema, we might need a join or direct column
       query = query.eq('assigned_pm_id', assigned_pm_id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
       return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, projects: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
