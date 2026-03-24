import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await initDb();
    const result = await db.execute("SELECT * FROM forms ORDER BY created_at DESC");
    
    // Parse JSON schemas if needed. In client it's better to stay clean.
    const formsWithParsedSchemas = result.rows.map(row => ({
      ...row,
      schema: JSON.parse(row.schema)
    }));
    
    return NextResponse.json({ success: true, forms: formsWithParsedSchemas });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const data = await req.json();
    const { name, schema } = data;
    
    if (!name || !schema) return NextResponse.json({ success: false, error: "Name and Schema required" }, { status: 400 });

    const form_id = "FORM_" + uuidv4().split('-')[0].toUpperCase();
    
    await db.execute({
      sql: "INSERT INTO forms (form_id, name, schema) VALUES (?, ?, ?)",
      args: [form_id, name, JSON.stringify(schema)]
    });
    
    return NextResponse.json({ success: true, form_id });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
