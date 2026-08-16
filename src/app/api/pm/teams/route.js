import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    let sql = "SELECT * FROM v2_teams";
    let args = [];

    if (programId) {
      sql += " WHERE program_id = ?";
      args.push(programId);
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, teams: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const data = await req.json();
    const {
      program_id,
      name,
      handler_id,
      handler_name,
      member_ids,
      group_name,
      leader_id,
      is_management_group,
    } = data;

    if (!program_id || !name) {
      return NextResponse.json(
        { success: false, error: "Missing squad parameters." },
        { status: 400 },
      );
    }

    // Generate Team Username and Password
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .substring(0, 10);
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const generatedUsername = `${slug}_${randomStr}`;
    const generatedPassword = `FST${randomStr}`;
    const teamId = crypto.randomUUID(); // Use built-in crypto for UUID

    // 1. Create Team Record (name = sub-team, group_name = parent group, approved by default)
    const result = await db.execute({
      sql: "INSERT INTO v2_teams (id, program_id, name, handler_id, handler_name, password, team_username, group_name, leader_id, is_venture_ready) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true) RETURNING *",
      args: [
        teamId,
        program_id,
        name,
        handler_id || null,
        handler_name || null,
        generatedPassword,
        generatedUsername,
        group_name || null,
        leader_id || null,
      ],
    });

    const team = result.rows[0];

    // 2. Link Members to Team
    let linkingWarning = null;
    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      try {
        // Classify IDs: UUID pattern for v2_participants, everything else for contacts
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuidIds = member_ids.filter((id) => id && UUID_RE.test(id.toString()));
        const contactIds = member_ids.filter((id) => id && !UUID_RE.test(id.toString()));

        // Update UUID-based participants (v2_participants table)
        if (uuidIds.length > 0) {
          const placeholders = uuidIds.map(() => "?").join(",");
          await db.execute({
            sql: `UPDATE v2_participants SET v2_team_id = ? WHERE id IN (${placeholders})`,
            args: [team.id, ...uuidIds],
          });
        }

        // Update contact-based participants (contacts table)
        if (contactIds.length > 0) {
          const placeholders = contactIds.map(() => "?").join(",");
          await db.execute({
            sql: `UPDATE contacts SET v2_team_id = ? WHERE cid IN (${placeholders})`,
            args: [team.id, ...contactIds],
          });
        }

        // 3. Send Emails
        const allMembers = [];

        if (uuidIds.length > 0) {
          const placeholders = uuidIds.map(() => "?").join(",");
          const res = await db.execute({
            sql: `SELECT email, name FROM v2_participants WHERE id IN (${placeholders})`,
            args: [...uuidIds],
          });
          allMembers.push(...res.rows);
        }

        if (contactIds.length > 0) {
          const placeholders = contactIds.map(() => "?").join(",");
          const res = await db.execute({
            sql: `SELECT email, name FROM contacts WHERE cid IN (${placeholders})`,
            args: [...contactIds],
          });
          allMembers.push(...res.rows);
        }

        // Management groups (facilitator cohort groups) do NOT send shared
        // team credentials — there is no shared team login for these groups.
        if (!is_management_group) {
          for (const member of allMembers) {
            try {
              await sendEmail({
                to: member.email,
                subject: `Unit Credentials Secured: ${name}`,
                body: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #FF6600;">Unit Deployment: ${name}</h2>
                  <p>Hello ${member.name},</p>
                  <p>You have been assigned to <strong>${name}</strong>. Here are the shared access credentials for your unit:</p>
                  <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;"><strong>Unit Username:</strong> ${generatedUsername}</p>
                    <p style="margin: 5px 0;"><strong>Unit Password:</strong> ${generatedPassword}</p>
                  </div>
                  <p>Use these credentials to access the program dashboard. All members of your unit will share these credentials.</p>
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://impactos-pwa.vercel.app"}/login" style="display: inline-block; background: #FF6600; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">Login to Command Center</a>
                </div>
              `,
                isHtml: true,
              });
            } catch (e) {
              console.error(`Email delivery failed for ${member.email}:`, e);
            }
          }
        }
      } catch (linkErr) {
        console.error("Team member linking failed:", linkErr.message);
        linkingWarning = `Team created but member linking failed: ${linkErr.message}`;
      }
    }

    return NextResponse.json({ success: true, team, ...(linkingWarning ? { warning: linkingWarning } : {}) });
  } catch (error) {
    console.error("Team Creation Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { team_id, member_ids, action, is_venture_ready, is_management_group } = await req.json();

    // Support set_venture_ready action (used by venture approval workflow)
    if (action === "set_venture_ready" && team_id) {
      await db.execute({
        sql: "UPDATE v2_teams SET is_venture_ready = ? WHERE id::text = ?",
        args: [is_venture_ready ? 1 : 0, team_id],
      });
      return NextResponse.json({ success: true });
    }

    if (!team_id || !member_ids || !Array.isArray(member_ids)) {
      return NextResponse.json(
        { success: false, error: "Missing parameters." },
        { status: 400 },
      );
    }

    // Fetch team details for email notification
    const teamRes = await db.execute({
      sql: "SELECT * FROM v2_teams WHERE id = ?",
      args: [team_id],
    });
    const team = teamRes.rows[0];
    if (!team)
      return NextResponse.json(
        { success: false, error: "Team not found." },
        { status: 404 },
      );

    // Link Members to Team — classify by UUID vs contact CID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuidIds = member_ids.filter((id) => id && UUID_RE.test(id.toString()));
    const contactIds = member_ids.filter((id) => id && !UUID_RE.test(id.toString()));

    if (uuidIds.length > 0) {
      const placeholders = uuidIds.map(() => "?").join(",");
      await db.execute({
        sql: `UPDATE v2_participants SET v2_team_id = ? WHERE id IN (${placeholders})`,
        args: [team.id, ...uuidIds],
      });
    }

    if (contactIds.length > 0) {
      const placeholders = contactIds.map(() => "?").join(",");
      await db.execute({
        sql: `UPDATE contacts SET v2_team_id = ? WHERE cid IN (${placeholders})`,
        args: [team.id, ...contactIds],
      });
    }

    // Send Emails (Copied Logic from POST)
    const allMembers = [];
    if (uuidIds.length > 0) {
      const res = await db.execute({
        sql: `SELECT email, name FROM v2_participants WHERE id IN (${uuidIds.map(() => "?").join(",")})`,
        args: [...uuidIds],
      });
      allMembers.push(...res.rows);
    }
    if (contactIds.length > 0) {
      const res = await db.execute({
        sql: `SELECT email, name FROM contacts WHERE cid IN (${contactIds.map(() => "?").join(",")})`,
        args: [...contactIds],
      });
      allMembers.push(...res.rows);
    }

    if (!is_management_group) {
      for (const member of allMembers) {
        try {
          await sendEmail({
            to: member.email,
            subject: `Unit Assignment Confirmed: ${team.name}`,
            body: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #FF6600;">Unit Assignment: ${team.name}</h2>
              <p>Hello ${member.name},</p>
              <p>You have been assigned to <strong>${team.name}</strong>. Here are your shared access credentials:</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 5px 0;"><strong>Unit Username:</strong> ${team.team_username}</p>
                <p style="margin: 5px 0;"><strong>Unit Password:</strong> ${team.password}</p>
              </div>
              <p>Use these credentials to access the program dashboard.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://impactos-pwa.vercel.app"}/login" style="display: inline-block; background: #FF6600; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">Login to Command Center</a>
            </div>
          `,
            isHtml: true,
          });
        } catch (e) {}
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { id } = await req.json();
    await db.execute({
      sql: "DELETE FROM v2_teams WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
