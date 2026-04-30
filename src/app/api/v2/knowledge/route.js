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
    const formData = await req.formData();
    const title = formData.get("title");
    const description = formData.get("description");
    
    const files = [];
    // Extract all file fields
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const base64 = buffer.toString('base64');
        files.push({
          name: value.name,
          url: `data:${value.type};base64,${base64}`
        });
      }
    }

    if (!title || files.length === 0) {
      return NextResponse.json({ success: false, error: "Title and at least one PDF are required." }, { status: 400 });
    }

    const filesJson = JSON.stringify(files);

    const { lastInsertRowid } = await db.execute({
      sql: "INSERT INTO v2_knowledge_bank (title, description, url) VALUES (?, ?, ?)",
      args: [title, description, filesJson]
    });

    return NextResponse.json({ success: true, id: lastInsertRowid.toString() });
  } catch (error) {
    console.error("Knowledge POST Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const { rows } = await db.execute("SELECT * FROM v2_knowledge_bank ORDER BY timestamp DESC");
    
    const processed = rows.map(r => {
      try {
        return { ...r, files: JSON.parse(r.url || '[]') };
      } catch (e) {
        return { ...r, files: [{ name: r.fileName || 'Document', url: r.url }] };
      }
    });

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
    const title = formData.get("title");
    const description = formData.get("description");
    const action = formData.get("action");
    const is_archived = formData.get("is_archived");

    if (action === 'archive') {
      await db.execute({
        sql: "UPDATE v2_knowledge_bank SET is_archived = ? WHERE id = ?",
        args: [is_archived === '1' ? 1 : 0, id]
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'edit') {
      const existingFiles = JSON.parse(formData.get("existingFiles") || '[]');
      const newFiles = [];
      
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("file_") && value instanceof File) {
          const buffer = Buffer.from(await value.arrayBuffer());
          const base64 = buffer.toString('base64');
          newFiles.push({
            name: value.name,
            url: `data:${value.type};base64,${base64}`
          });
        }
      }

      const filesJson = JSON.stringify([...existingFiles, ...newFiles]);
      await db.execute({
        sql: "UPDATE v2_knowledge_bank SET title = ?, description = ?, url = ? WHERE id = ?",
        args: [title, description, filesJson, id]
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
