import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  createKnowledgeNote,
  createKnowledgeAttachment,
  listKnowledgeNotes,
  listKnowledgeAttachments,
  archiveKnowledgeNote,
  updateKnowledgeNote,
  insertKnowledgeAttachment,
  deleteKnowledgeNote,
} from "@/models/forms";
export const dynamic = "force-dynamic";

// Body parser size limit for file uploads
// Next.js App Router uses route segment config exports
export const maxDuration = 30;

/**
 * KNOWLEDGE BANK API — OPERATIONAL INTELLIGENCE
 */

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("knowledge", "create");
    if (capError) return capError;
    const body = await req.json();
    const { title, description, files } = body;

    console.log("--- KNOWLEDGE POST START ---", {
      title,
      filesCount: files?.length,
    });

    // 1. Insert Metadata
    const res = await createKnowledgeNote({
      title,
      description,
      url: "[]",
    });

    // Extract ID safely for BigInt compatibility
    const noteId = res.rows[0]?.id;
    if (!noteId)
      throw new Error("Failed to retrieve generated ID from Supabase");

    console.log("Note Created with ID:", noteId);

    // 2. Insert File Associations
    if (files && Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        await createKnowledgeAttachment(noteId, file.name, file.url);
        console.log("Attached File:", file.name);
      }
    }

    return NextResponse.json({ success: true, id: noteId });
  } catch (error) {
    console.error("CRITICAL KNOWLEDGE ERROR:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await initDb();
    const capError = await requireAuthorization("knowledge", "view");
    if (capError) return capError;
    // Use BigInt safe query
    const notesRes = await listKnowledgeNotes();
    const filesRes = await listKnowledgeAttachments();

    const notes = notesRes.rows;
    const files = filesRes.rows;

    const processed = notes.map((n) => ({
      ...n,
      // Ensure BigInt comparison is string-safe
      files: files
        .filter((f) => String(f.note_id) === String(n.id))
        .map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
        })),
    }));

    return NextResponse.json({ success: true, conceptNotes: processed });
  } catch (error) {
    console.error("Knowledge GET Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("knowledge", "edit");
    if (capError) return capError;
    const body = await req.json();
    const { id, action } = body;

    if (action === "archive") {
      const { is_archived } = body;
      await archiveKnowledgeNote(id, is_archived);
      return NextResponse.json({ success: true });
    }

    if (action === "edit") {
      const { title, description, files } = body;
      await updateKnowledgeNote(id, title, description);

      // Insert new File Associations if present
      if (files && Array.isArray(files) && files.length > 0) {
        for (const file of files) {
          await insertKnowledgeAttachment(id, file.name, file.url);
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Knowledge PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("knowledge", "delete");
    if (capError) return capError;
    const { id } = await req.json();
    await deleteKnowledgeNote(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Knowledge DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
