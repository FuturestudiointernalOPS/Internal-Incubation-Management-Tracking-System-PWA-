import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    let query = "SELECT * FROM v2_standard_types WHERE status = 'active'";
    let args = [];
    
    if (category) {
      query += " AND category = ?";
      args.push(category);
    }

    const res = await db.execute({ sql: query, args });
    return NextResponse.json({ success: true, types: res.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { category, label, id } = await req.json();
    
    if (id) {
       // UPDATE MODE
       await db.execute({
         sql: "UPDATE v2_standard_types SET label = ? WHERE id = ?",
         args: [label, id]
       });
    } else {
       // INSERT MODE
       await db.execute({
         sql: "INSERT INTO v2_standard_types (category, label) VALUES (?, ?)",
         args: [category, label]
       });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();
    await db.execute({ sql: "DELETE FROM v2_standard_types WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
