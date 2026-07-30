import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * PLATFORM FORMS API — CRUD with versioning
 *
 * GET    /api/platform/forms                   — List all forms
 * GET    /api/platform/forms?id=X              — Get one form + its fields + sections
 * GET    /api/platform/forms?collection_id=X   — Filter by collection
 * POST   /api/platform/forms                   — Create form
 * PUT    /api/platform/forms                   — Update form
 * POST   /api/platform/forms/publish           — Publish a new version
 * DELETE /api/platform/forms?id=X              — Archive
 */

export async function GET(req) {
  try {
    await initDb();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const collectionId = searchParams.get("collection_id");
    const status = searchParams.get("status");

    // Single form with fields + sections — allow any authenticated user (participants need this)
    if (id) {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

      const form = await db.execute({
        sql: "SELECT * FROM platform_forms WHERE id = ?",
        args: [parseInt(id)],
      });
      if (form.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      }

      const sections = await db.execute({
        sql: "SELECT * FROM platform_form_sections WHERE form_id = ? ORDER BY sort_order",
        args: [parseInt(id)],
      });

      const fields = await db.execute({
        sql: "SELECT * FROM platform_form_fields WHERE form_id = ? ORDER BY sort_order",
        args: [parseInt(id)],
      });

      let sectionsResult = sections.rows;
      let fieldsResult = fields.rows;

      // ─── Fallback: read from version snapshot if live tables are empty but form is published ───
      // Only fall back if the form hasn't been edited since the last publish
      if (sectionsResult.length === 0 && fieldsResult.length === 0 && form.rows[0].status === "published") {
        const version = await db.execute({
          sql: "SELECT snapshot, created_at FROM platform_form_versions WHERE form_id = ? ORDER BY version DESC LIMIT 1",
          args: [parseInt(id)],
        });
        // Only use snapshot if form hasn't been saved since publish (user intentionally cleared sections)
        if (version.rows.length > 0 && version.rows[0].snapshot) {
          const snapshotTime = new Date(version.rows[0].created_at).getTime();
          const updateTime = form.rows[0].updated_at ? new Date(form.rows[0].updated_at).getTime() : 0;
          // If form was updated after the snapshot, user intentionally edited — respect their changes
          if (updateTime <= snapshotTime) {
            const snap = version.rows[0].snapshot;
            sectionsResult = snap.sections || [];
            fieldsResult = snap.fields || [];
          }
        }
      }

      return NextResponse.json({
        success: true,
        form: form.rows[0],
        sections: sectionsResult,
        fields: fieldsResult,
      });
    }

    // All other operations require admin
    const authError = await requireAuth(["super_admin", "admin", "staff"]);
    if (authError) return authError;

    // List forms with filters
    let sql = "SELECT * FROM platform_forms WHERE 1=1";
    const args = [];

    if (collectionId) {
      sql += " AND collection_id = ?";
      args.push(parseInt(collectionId));
    }
    if (status && status !== "all") {
      sql += " AND status = ?";
      args.push(status);
    }
    sql += " ORDER BY updated_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, forms: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const body = await req.json();

    // PUBLISH action: creates a snapshot version
    if (body.action === "publish") {
      if (!body.id || !body.fields || !body.sections) {
        return NextResponse.json({ success: false, error: "id, fields, and sections are required" }, { status: 400 });
      }

      const form = await db.execute({
        sql: "SELECT * FROM platform_forms WHERE id = ?",
        args: [parseInt(body.id)],
      });
      if (form.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
      }

      const f = form.rows[0];
      const newVersion = (f.version || 1) + 1;
      const snapshot = {
        fields: body.fields,
        sections: body.sections,
        settings: f.settings,
        publishedAt: new Date().toISOString(),
        evaluation_framework: body.evaluation_framework || null,
      };

      // Save version snapshot
      await db.execute({
        sql: `INSERT INTO platform_form_versions (form_id, version, snapshot, published_by) VALUES (?, ?, ?, ?)`,
        args: [parseInt(body.id), newVersion, JSON.stringify(snapshot), session.cid || null],
      });

      // Increment version on form
      await db.execute({
        sql: "UPDATE platform_forms SET version = ?, status = 'published', updated_at = NOW() WHERE id = ?",
        args: [newVersion, parseInt(body.id)],
      });

      return NextResponse.json({ success: true, version: newVersion });
    }

    // CREATE action
    const { name, description, collection_id, visibility, settings, tags } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO platform_forms (name, description, collection_id, visibility, settings, tags, owner_id, owner_name, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [
        name.trim(),
        description || null,
        collection_id ? parseInt(collection_id) : null,
        visibility || "internal",
        JSON.stringify(settings || {}),
        tags || [],
        session.cid || null,
        null,
        session.cid || null,
      ],
    });

    return NextResponse.json({ success: true, form: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const body = await req.json();

    // SAVE FIELDS & SECTIONS (used by the builder)
    if (body.fields !== undefined || body.sections !== undefined) {
      const { id, fields, sections } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
      }

      // Upsert sections
      if (Array.isArray(sections)) {
        for (const sec of sections) {
          // Handle deletion: section marked for removal
          if (sec._delete && sec.id) {
            await db.execute({
              sql: "DELETE FROM platform_form_sections WHERE id = ? AND form_id = ?",
              args: [parseInt(sec.id), parseInt(id)],
            });
            continue;
          }
          if (sec.id) {
            await db.execute({
              sql: "UPDATE platform_form_sections SET title = ?, description = ?, sort_order = ?, settings = ? WHERE id = ? AND form_id = ?",
              args: [sec.title, sec.description || null, sec.sort_order || 0, JSON.stringify(sec.settings || {}), parseInt(sec.id), parseInt(id)],
            });
          } else {
            await db.execute({
              sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, ?, ?, ?)",
              args: [parseInt(id), sec.title, sec.description || null, sec.sort_order || 0],
            });
          }
        }
      }

      // Upsert fields
      if (Array.isArray(fields)) {
        for (const fld of fields) {
          if (fld.id) {
            await db.execute({
              sql: `UPDATE platform_form_fields
                    SET label = ?, field_type = ?, placeholder = ?, help_text = ?, required = ?,
                        options = ?, validation = ?, conditional_logic = ?, sort_order = ?,
                        section_id = ?, settings = ?, updated_at = NOW()
                    WHERE id = ? AND form_id = ?`,
              args: [
                fld.label, fld.field_type || "text", fld.placeholder || null, fld.help_text || null,
                fld.required ? 1 : 0,
                fld.options ? JSON.stringify(fld.options) : null,
                fld.validation ? JSON.stringify(fld.validation) : null,
                fld.conditional_logic ? JSON.stringify(fld.conditional_logic) : null,
                fld.sort_order || 0,
                fld.section_id ? parseInt(fld.section_id) : null,
                JSON.stringify(fld.settings || {}),
                parseInt(fld.id), parseInt(id),
              ],
            });
          } else {
            const result = await db.execute({
              sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, placeholder, help_text, required, options, validation, conditional_logic, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *`,
              args: [
                parseInt(id),
                fld.section_id ? parseInt(fld.section_id) : null,
                fld.field_type || "text",
                fld.label,
                fld.placeholder || null,
                fld.help_text || null,
                fld.required ? 1 : 0,
                fld.options ? JSON.stringify(fld.options) : null,
                fld.validation ? JSON.stringify(fld.validation) : null,
                fld.conditional_logic ? JSON.stringify(fld.conditional_logic) : null,
                fld.sort_order || 0,
              ],
            });
          }
        }
      }

      await db.execute({
        sql: "UPDATE platform_forms SET updated_at = NOW() WHERE id = ?",
        args: [parseInt(id)],
      });

      return NextResponse.json({ success: true });
    }

    // SIMPLE UPDATE (metadata only)
    const { id, name, description, collection_id, visibility, tags, status, settings } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const fields = [];
    const args = [];
    const updatable = { name, description, collection_id, visibility, tags, status };

    for (const [key, value] of Object.entries(updatable)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        args.push(key === "collection_id" && value ? parseInt(value) : value);
      }
    }
    if (settings !== undefined) {
      fields.push("settings = ?");
      args.push(JSON.stringify(settings));
    }
    fields.push("updated_at = NOW()");
    args.push(parseInt(id));

    const result = await db.execute({
      sql: `UPDATE platform_forms SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
      args,
    });

    return NextResponse.json({ success: true, form: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    await db.execute({
      sql: "UPDATE platform_forms SET status = 'archived', updated_at = NOW() WHERE id = ?",
      args: [parseInt(id)],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
