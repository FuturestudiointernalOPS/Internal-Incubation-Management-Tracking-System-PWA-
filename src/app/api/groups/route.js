import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * GROUPS API
 *
 * GET    /api/groups — list all groups with defaults
 * GET    /api/groups?id=X — single group with full defaults
 * POST   /api/groups — create a new group
 * PUT    /api/groups — update group (name, description, access_profile_id)
 * DELETE /api/groups?id=X — deactivate a group
 */

export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const groupName = searchParams.get("name");

    if (groupName) {
      // Lookup by name — return same as id but lookup first
      const lookupRes = await db.execute({
        sql: "SELECT id FROM groups WHERE name = ?",
        args: [groupName.trim().toUpperCase()],
      });
      if (lookupRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Group not found" },
          { status: 404 },
        );
      }
      // Redirect to id-based lookup by constructing the URL
      const url = new URL(req.url);
      url.searchParams.delete("name");
      url.searchParams.set("id", lookupRes.rows[0].id);
      const redirectReq = new Request(url, req);
      return GET(redirectReq);
    }

    if (id) {
      // Single group with all defaults
      const groupRes = await db.execute({
        sql: "SELECT * FROM groups WHERE id = ?",
        args: [parseInt(id)],
      });
      if (groupRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Group not found" },
          { status: 404 },
        );
      }
      const group = groupRes.rows[0];

      // Get default responsibilities
      const respRes = await db.execute({
        sql: `SELECT r.id, r.name, r.key
              FROM group_default_responsibilities gdr
              JOIN responsibilities r ON r.id = gdr.responsibility_id
              WHERE gdr.group_id = ?`,
        args: [group.id],
      });

      // Get access profile
      let accessProfile = null;
      if (group.access_profile_id) {
        const profileRes = await db.execute({
          sql: "SELECT id, name, description FROM access_profiles WHERE id = ?",
          args: [group.access_profile_id],
        });
        if (profileRes.rows.length > 0) accessProfile = profileRes.rows[0];
      }

      // Get member count
      const memberRes = await db.execute({
        sql: "SELECT COUNT(*) as cnt FROM user_groups WHERE group_name = ?",
        args: [group.name],
      });

      return NextResponse.json({
        success: true,
        group: {
          ...group,
          default_responsibilities: respRes.rows,
          access_profile: accessProfile,
          member_count: parseInt(memberRes.rows[0]?.cnt || 0),
        },
      });
    }

    // List all groups with member counts
    const groupsRes = await db.execute({
      sql: "SELECT * FROM groups ORDER BY name ASC",
    });

    const groups = await Promise.all(
      groupsRes.rows.map(async (g) => {
        const memberRes = await db.execute({
          sql: "SELECT COUNT(*) as cnt FROM user_groups WHERE group_name = ?",
          args: [g.name],
        });
        return {
          ...g,
          member_count: parseInt(memberRes.rows[0]?.cnt || 0),
        };
      }),
    );

    return NextResponse.json({ success: true, groups });
  } catch (err) {
    console.error("[Groups] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const body = await req.json();
    const { name, description, access_profile_id } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Group name is required" },
        { status: 400 },
      );
    }

    const groupName = name.trim().toUpperCase();

    // Check if group already exists
    const existing = await db.execute({
      sql: "SELECT id FROM groups WHERE name = ?",
      args: [groupName],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Group "${groupName}" already exists` },
        { status: 409 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO groups (name, description, access_profile_id)
            VALUES (?, ?, ?)`,
      args: [
        groupName,
        description || "",
        access_profile_id ? parseInt(access_profile_id) : null,
      ],
    });

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: `Group "${groupName}" created`,
    });
  } catch (err) {
    console.error("[Groups] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const body = await req.json();
    const { id, name, description, access_profile_id, default_responsibilities } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const groupId = parseInt(id);

    // Update group fields
    if (name !== undefined) {
      await db.execute({
        sql: "UPDATE groups SET name = ?, updated_at = NOW() WHERE id = ?",
        args: [name.trim().toUpperCase(), groupId],
      });
      // Also sync user_groups group_name
      const old = await db.execute({
        sql: "SELECT name FROM groups WHERE id = ?",
        args: [groupId],
      });
      if (old.rows.length > 0 && old.rows[0].name !== name.trim().toUpperCase()) {
        await db.execute({
          sql: "UPDATE user_groups SET group_name = ? WHERE group_name = ?",
          args: [name.trim().toUpperCase(), old.rows[0].name],
        });
      }
    }
    if (description !== undefined) {
      await db.execute({
        sql: "UPDATE groups SET description = ?, updated_at = NOW() WHERE id = ?",
        args: [description, groupId],
      });
    }
    if (access_profile_id !== undefined) {
      await db.execute({
        sql: "UPDATE groups SET access_profile_id = ?, updated_at = NOW() WHERE id = ?",
        args: [access_profile_id ? parseInt(access_profile_id) : null, groupId],
      });
    }

    // Update default responsibilities
    if (default_responsibilities !== undefined) {
      await db.execute({
        sql: "DELETE FROM group_default_responsibilities WHERE group_id = ?",
        args: [groupId],
      });
      if (Array.isArray(default_responsibilities)) {
        for (const respId of default_responsibilities) {
          await db.execute({
            sql: `INSERT INTO group_default_responsibilities (group_id, responsibility_id)
                  VALUES (?, ?) ON CONFLICT DO NOTHING`,
            args: [groupId, parseInt(respId)],
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Group updated",
    });
  } catch (err) {
    console.error("[Groups] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Soft-deactivate: set is_active = 0
    await db.execute({
      sql: "UPDATE groups SET is_active = 0, updated_at = NOW() WHERE id = ?",
      args: [parseInt(id)],
    });

    return NextResponse.json({
      success: true,
      message: "Group deactivated",
    });
  } catch (err) {
    console.error("[Groups] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
