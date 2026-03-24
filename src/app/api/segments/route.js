import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await initDb();
    const result = await db.execute("SELECT * FROM segments ORDER BY created_at DESC");
    return NextResponse.json({ 
      success: true, 
      segments: result.rows.map(r => ({ ...r, filters: JSON.parse(r.filters) })) 
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { name, filters } = await req.json();
    
    if (!name || !filters) return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });

    const result = await db.execute({
      sql: "INSERT INTO segments (name, filters) VALUES (?, ?) RETURNING id",
      args: [name, JSON.stringify(filters)]
    });

    return NextResponse.json({ success: true, segment_id: result.rows[0].id });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
