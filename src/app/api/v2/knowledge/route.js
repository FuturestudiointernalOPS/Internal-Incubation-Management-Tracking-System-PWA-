import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(req) {
  try {
    await initDb();
    
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const { title, description } = await req.json();
      const { lastInsertRowid } = await db.execute({
        sql: "INSERT INTO v2_knowledge_bank (title, description, url) VALUES (?, ?, ?)",
        args: [title, description, '[]']
      });
      return NextResponse.json({ success: true, id: lastInsertRowid.toString() });
    }

    const formData = await req.formData();
    const title = formData.get("title");
    const description = formData.get("description");
    
    const { lastInsertRowid } = await db.execute({
      sql: "INSERT INTO v2_knowledge_bank (title, description, url) VALUES (?, ?, ?)",
      args: [title, description, '[]']
    });
    const noteId = lastInsertRowid.toString();

    // Attach files sequentially (Legacy fallback or fast batch)
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        let finalUrl = "";
        if (process.env.BLOB_READ_WRITE_TOKEN) {
           const { put } = require('@vercel/blob');
           const blob = await put(`knowledge/${Date.now()}-${value.name}`, value, { 
              access: 'public',
              token: process.env.BLOB_READ_WRITE_TOKEN
           });
           finalUrl = blob.url;
        } else {
           const buffer = Buffer.from(await value.arrayBuffer());
           const base64 = buffer.toString('base64');
           finalUrl = `data:${value.type};base64,${base64}`;
        }
        
        await db.execute({
          sql: "INSERT INTO v2_knowledge_attachments (note_id, name, url) VALUES (?, ?, ?)",
          args: [Number(noteId), value.name, finalUrl]
        });
      }
    }

    return NextResponse.json({ success: true, id: noteId.toString() });
  } catch (error) {
    console.error("Knowledge POST Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const { rows: notes } = await db.execute("SELECT * FROM v2_knowledge_bank ORDER BY timestamp DESC");
    const { rows: files } = await db.execute("SELECT * FROM v2_knowledge_attachments");
    
    const processed = notes.map(n => ({
      ...n,
      files: files.filter(f => f.note_id === n.id).map(f => ({
         id: f.id,
         name: f.name,
         url: f.url
      }))
    }));

    return NextResponse.json({ success: true, conceptNotes: processed });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const formData = await req.formData();
    const id = formData.get("id");
    const action = formData.get("action");

    if (action === 'archive') {
      const is_archived = formData.get("is_archived");
      await db.execute({
        sql: "UPDATE v2_knowledge_bank SET is_archived = ? WHERE id = ?",
        args: [is_archived === '1' ? 1 : 0, id]
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'attach') {
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
      }

      let finalUrl = "";
      if (process.env.BLOB_READ_WRITE_TOKEN) {
         const { put } = require('@vercel/blob');
         const blob = await put(`knowledge/${Date.now()}-${file.name}`, file, { 
             access: 'public',
             token: process.env.BLOB_READ_WRITE_TOKEN
         });
         finalUrl = blob.url;
      } else {
         const buffer = Buffer.from(await file.arrayBuffer());
         const base64 = buffer.toString('base64');
         finalUrl = `data:${file.type};base64,${base64}`;
      }
      
      await db.execute({
        sql: "INSERT INTO v2_knowledge_attachments (note_id, name, url) VALUES (?, ?, ?)",
        args: [Number(id), file.name, finalUrl]
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete_file') {
       const fileId = formData.get("fileId");
       await db.execute({
          sql: "DELETE FROM v2_knowledge_attachments WHERE id = ?",
          args: [fileId]
       });
       return NextResponse.json({ success: true });
    }

    if (action === 'edit') {
      const title = formData.get("title");
      const description = formData.get("description");
      
      await db.execute({
        sql: "UPDATE v2_knowledge_bank SET title = ?, description = ? WHERE id = ?",
        args: [title, description, id]
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
