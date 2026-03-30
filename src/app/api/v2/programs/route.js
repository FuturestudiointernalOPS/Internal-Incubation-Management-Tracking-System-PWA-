import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { 
      name, 
      description, 
      duration_weeks, 
      duration_days, 
      topics, 
      outcomes, 
      deliverables, 
      resources, 
      assigned_pm_id,
      feedback_enabled 
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Program name is required" }, { status: 400 });
    }

    const programId = `P-2026-${uuidv4().slice(0, 8).toUpperCase()}`;

    const { lastInsertRowid } = await db.execute({
      sql: `INSERT INTO v2_programs (
        id, name, description, duration_weeks, duration_days, 
        topics, outcomes, deliverables, resources, assigned_pm_id, feedback_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        programId,
        name,
        description,
        duration_weeks || 13,
        duration_days || 0,
        JSON.stringify(topics || []),
        JSON.stringify(outcomes || []),
        JSON.stringify(deliverables || []),
        JSON.stringify(resources || []),
        assigned_pm_id || null,
        feedback_enabled !== undefined ? (feedback_enabled ? 1 : 0) : 1
      ]
    });

    return NextResponse.json({ 
      success: true, 
      program: { id: programId, name, description } 
    });
  } catch (error) {
    console.error("V2 Program Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const { rows } = await db.execute("SELECT * FROM v2_programs ORDER BY created_at DESC");
    
    // Parse JSON columns
    const programs = rows.map(r => ({
       ...r,
       topics: r.topics ? JSON.parse(r.topics) : [],
       outcomes: r.outcomes ? JSON.parse(r.outcomes) : [],
       deliverables: r.deliverables ? JSON.parse(r.deliverables) : [],
       resources: r.resources ? JSON.parse(r.resources) : [],
       feedback_enabled: !!r.feedback_enabled
    }));

    return NextResponse.json({ success: true, programs });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
