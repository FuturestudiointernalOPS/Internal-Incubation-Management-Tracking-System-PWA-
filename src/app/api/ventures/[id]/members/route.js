import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

async function resolveDbId(db, ventureId) {
  try {
    const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
    return r.rows?.[0]?.id || ventureId;
  } catch { return ventureId; }
}

// venture_members stores venture_id as the VNT code (TEXT), not the internal UUID.
// Convert an internal UUID (if passed) back to the VNT code so membership queries match.
async function resolveVentureCode(db, idOrCode) {
  if (!idOrCode) return idOrCode;
  if (typeof idOrCode === "string" && idOrCode.includes("-") && !idOrCode.startsWith("VNT-")) {
    try {
      const r = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [idOrCode] });
      return r.rows?.[0]?.venture_id || idOrCode;
    } catch { return idOrCode; }
  }
  return idOrCode;
}

async function getVentureFounderCount(db, ventureId) {
  const code = await resolveVentureCode(db, ventureId);
  const r = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL",
    args: [code],
  });
  return parseInt(r.rows?.[0]?.cnt || 0);
}

async function isVentureMember(db, ventureId, cid) {
  const code = await resolveVentureCode(db, ventureId);
  const r = await db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
  return r.rows?.length > 0;
}

async function isVentureFounder(db, ventureId, cid) {
  const code = await resolveVentureCode(db, ventureId);
  const r = await db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
  return r.rows?.length > 0;
}

// View access: any active member (founder or team_member) can see the roster.
async function checkAccess(db, ventureId, userRole, userCid) {
  if (["staff", "super_admin", "program_manager", "developer"].includes(userRole)) {
    return true;
  }
  if (userCid) {
    return await isVentureMember(db, ventureId, userCid);
  }
  return false;
}

// Mutation access (add/remove/edit members): founders manage the roster, not
// any team_member — mirrors business rule 10 (founders update venture info).
async function checkMutateAccess(db, ventureId, userRole, userCid) {
  if (["staff", "super_admin", "program_manager", "developer"].includes(userRole)) {
    return true;
  }
  if (userCid) {
    return await isVentureFounder(db, ventureId, userCid);
  }
  return false;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer",
    ]);
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const hasAccess = await checkAccess(db, id, userRole, userCid);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    // Archived Ventures: privileged staff may read the roster (historical);
    // non-privileged members lose active access (Phase 3).
    try {
      const { requireOperationalVentureAccess, roleIsPrivileged } = await import("@/lib/ventureAuth");
      if (!roleIsPrivileged(userRole)) {
        const gate = await requireOperationalVentureAccess({ ventureId: id, db, session: { role: userRole }, mutate: false });
        if (!gate.ok && gate.code === "archived") {
          return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 403 });
        }
      }
    } catch (_) {}

    const vRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
    const code = await resolveVentureCode(db, id);

    const result = await db.execute({
      sql: `
        SELECT vm.*, c.name as contact_name, c.email as contact_email
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.removed_at IS NULL
        ORDER BY vm.member_type, vm.joined_at DESC
      `,
      args: [code],
    });

    return NextResponse.json({ success: true, members: result.rows });
  } catch (error) {
    console.error("GET /api/ventures/[id]/members error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant", "founder", "staff", "program_manager", "super_admin", "teacher",
    ]);
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();
    const { contact_id, member_type, role, permissions, email, name, phone } = body;

    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const hasAccess = await checkAccess(db, id, userRole, userCid);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const canMutate = await checkMutateAccess(db, id, userRole, userCid);
    if (!canMutate) {
      return NextResponse.json(
        { success: false, error: "Only founders can manage venture members." },
        { status: 403 },
      );
    }

    // Archived Ventures are immutable (Phase 3) — no member mutations.
    try {
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const gate = await requireOperationalVentureAccess({ ventureId: id, db, session: { role: userRole }, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 409 });
      }
    } catch (_) {}

    if (!member_type) {
      return NextResponse.json(
        { success: false, error: "member_type is required" },
        { status: 400 },
      );
    }

    if (!["founder", "team_member"].includes(member_type)) {
      return NextResponse.json(
        { success: false, error: "member_type must be 'founder' or 'team_member'" },
        { status: 400 },
      );
    }

    // ── Identity resolution (Phase 2): add by existing contact_id OR by
    //    email/phone. Primary email → alternative email → phone → create
    //    pending contact. Conflicts go to CRM manual reconciliation — never
    //    a silent duplicate.
    let targetCid = contact_id;
    if (!targetCid) {
      if (!email || !email.includes("@")) {
        return NextResponse.json(
          { success: false, error: "contact_id or a valid email is required" },
          { status: 400 },
        );
      }
      const { resolvePersonIdentity, resolveOrCreateContactIdentity } = await import("@/lib/contactIdentity");
      const identity = await resolvePersonIdentity({ email, phone: phone || null });
      if (identity.status === "matched") {
        targetCid = identity.contact_cid;
      } else if (identity.status === "conflict") {
        return NextResponse.json(
          { success: false, error: "This person's identity is ambiguous (email/phone matched multiple contacts). Resolve the duplicate in CRM before adding them." },
          { status: 409 },
        );
      } else {
        targetCid = await resolveOrCreateContactIdentity({
          email,
          name,
          role: member_type === "founder" ? "founder" : "member",
        });
      }
      if (!targetCid) {
        return NextResponse.json(
          { success: false, error: "Could not resolve or create the member contact." },
          { status: 400 },
        );
      }
    } else {
      const existingContact = await db.execute({
        sql: "SELECT cid FROM contacts WHERE cid = ?",
        args: [targetCid],
      });
      if (existingContact.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Contact not found." },
          { status: 404 },
        );
      }
    }

    try {
      await db.execute({
        sql: `INSERT INTO venture_members (venture_id, contact_id, member_type, role, permissions, invited_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, targetCid, member_type, role || null, permissions || "edit", userCid || null],
      });
    } catch (err) {
      if (err.message?.includes("UNIQUE") || err.message?.includes("unique") || err.message?.includes("duplicate")) {
        return NextResponse.json(
          { success: false, error: "This contact is already a member of this venture" },
          { status: 409 },
        );
      }
      throw err;
    }

    // Append-only membership history (contact_roles mirror)
    try {
      const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
      await syncVentureRoleHistory({
        contactCid: targetCid,
        ventureId: id,
        role: role || (member_type === "founder" ? "founder" : "member"),
        active: true,
        actorCid: userCid || null,
        notes: "member added",
      });
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/ventures/[id]/members error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant", "founder", "staff", "program_manager", "super_admin", "teacher",
    ]);
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();
    const { member_id, role, permissions, action } = body;

    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const hasAccess = await checkAccess(db, id, userRole, userCid);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const canMutate = await checkMutateAccess(db, id, userRole, userCid);
    if (!canMutate) {
      return NextResponse.json(
        { success: false, error: "Only founders can manage venture members." },
        { status: 403 },
      );
    }

    // Archived Ventures are immutable (Phase 3) — no member mutations.
    try {
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const gate = await requireOperationalVentureAccess({ ventureId: id, db, session: { role: userRole }, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 409 });
      }
    } catch (_) {}

    if (!member_id) {
      return NextResponse.json({ success: false, error: "member_id is required" }, { status: 400 });
    }

    if (action === "remove") {
      const member = await db.execute({
        sql: "SELECT member_type, contact_id, role FROM venture_members WHERE id = ? AND venture_id = ?",
        args: [member_id, id],
      });

      if (!member.rows?.[0]) {
        return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
      }

      if (member.rows[0].member_type === "founder") {
        const founderCount = await getVentureFounderCount(db, id);
        if (founderCount <= 1) {
          return NextResponse.json(
            { success: false, error: "Every venture must have at least one founder. Cannot remove the last founder." },
            { status: 409 },
          );
        }
      }

      await db.execute({
        sql: "UPDATE venture_members SET removed_at = NOW() WHERE id = ? AND venture_id = ?",
        args: [member_id, id],
      });

      // Close the append-only membership history row (account/contact intact).
      try {
        const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
        const removedRole = member.rows[0].member_type === "founder" ? "founder" : member.rows[0].role || "member";
        if (member.rows[0].contact_id) {
          await syncVentureRoleHistory({
            contactCid: member.rows[0].contact_id,
            ventureId: id,
            role: removedRole,
            active: false,
            actorCid: userCid || null,
            notes: "member removed — account and CRM contact remain intact",
          });
        }
      } catch (_) {}
    } else {
      let memberContactId = null;
      try {
        const m = await db.execute({
          sql: "SELECT contact_id FROM venture_members WHERE id = ? AND venture_id = ?",
          args: [member_id, id],
        });
        memberContactId = m.rows?.[0]?.contact_id || null;
      } catch (_) {}
      const updates = [];
      const upArgs = [];
      if (role !== undefined) { updates.push("role = ?"); upArgs.push(role); }
      if (permissions !== undefined) { updates.push("permissions = ?"); upArgs.push(permissions); }
      if (updates.length === 0) {
        return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
      }
      upArgs.push(member_id, id);
      await db.execute({
        sql: `UPDATE venture_members SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
        args: upArgs,
      });
      try {
        const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
        if (memberContactId && role !== undefined) {
          await syncVentureRoleHistory({
            contactCid: memberContactId,
            ventureId: id,
            role: role || "member",
            active: true,
            actorCid: userCid || null,
            notes: "member role updated",
          });
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/ventures/[id]/members error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
