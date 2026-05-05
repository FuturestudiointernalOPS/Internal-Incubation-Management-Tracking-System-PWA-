import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

/**
 * KNOWLEDGE BANK API — OPERATIONAL INTELLIGENCE
 */

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { title, description, files } = body;
    
    console.log("--- KNOWLEDGE POST START ---", { title, filesCount: files?.length });

    // 1. Insert Metadata
    const sql = "INSERT INTO v2_knowledge_bank (title, description, url) VALUES (?, ?, ?) RETURNING id";
    const res = await db.execute({
      sql,
      args: [title, description, '[]']
    });
    
    // Extract ID safely for BigInt compatibility
    const noteId = res.rows[0]?.id;
    if (!noteId) throw new Error("Failed to retrieve generated ID from Supabase");
    
    console.log("Note Created with ID:", noteId);

    // 2. Insert File Associations
    if (files && Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        await db.execute({
          sql: "INSERT INTO v2_knowledge_attachments (note_id, name, url) VALUES (?, ?, ?)",
          args: [noteId, file.name, file.url]
        });
        console.log("Attached File:", file.name);
      }
    }

    return NextResponse.json({ success: true, id: noteId });
  } catch (error) {
    console.error("CRITICAL KNOWLEDGE ERROR:", error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    // Use BigInt safe query
    const notesRes = await db.execute("SELECT * FROM v2_knowledge_bank ORDER BY timestamp DESC");
    const filesRes = await db.execute("SELECT * FROM v2_knowledge_attachments");
    
    const notes = notesRes.rows;
    const files = filesRes.rows;
    
    const processed = notes.map(n => ({
      ...n,
      // Ensure BigInt comparison is string-safe
      files: files.filter(f => String(f.note_id) === String(n.id)).map(f => ({
         id: f.id,
         name: f.name,
         url: f.url
      }))
    }));

    return NextResponse.json({ success: true, conceptNotes: processed });
  } catch (error) {
    console.error("Knowledge GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const body = await req.json();
    const { id, action } = body;

    if (action === 'archive') {
      const { is_archived } = body;
      await db.execute({
        sql: "UPDATE v2_knowledge_bank SET is_archived = ? WHERE id = ?",
        args: [is_archived ? 1 : 0, id]
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Knowledge PATCH Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();
    await db.execute({
      sql: "DELETE FROM v2_knowledge_bank WHERE id = ?",
      args: [id]
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Knowledge DELETE Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
