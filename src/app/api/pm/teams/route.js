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

    // 1. Create Team Record (name = sub-team, group_name = parent group)
    const result = await db.execute({
      sql: "INSERT INTO v2_teams (id, program_id, name, handler_id, handler_name, password, team_username, group_name, leader_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
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
    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      // Separate IDs by type
      const intIds = member_ids.filter(
        (id) => id && !isNaN(id) && !id.toString().startsWith("USER_"),
      );
      const strIds = member_ids.filter(
        (id) => id && id.toString().startsWith("USER_"),
      );

      // Update manual participants
      if (intIds.length > 0) {
        const placeholders = intIds.map(() => "?").join(",");
        await db.execute({
          sql: `UPDATE v2_participants SET v2_team_id = ? WHERE id IN (${placeholders})`,
          args: [team.id, ...intIds],
        });
      }

      // Update synced contacts (DO NOT OVERWRITE group_name, update v2_team_id)
      if (strIds.length > 0) {
        const placeholders = strIds.map(() => "?").join(",");
        await db.execute({
          sql: `UPDATE contacts SET v2_team_id = ? WHERE cid IN (${placeholders})`,
          args: [team.id, ...strIds],
        });
      }

      // 3. Send Emails (Combined logic for all members)
      const allMembers = [];

      if (intIds.length > 0) {
        const placeholders = intIds.map(() => "?").join(",");
        const res = await db.execute({
          sql: `SELECT email, name FROM v2_participants WHERE id IN (${placeholders})`,
          args: [...intIds],
        });
        allMembers.push(...res.rows);
      }

      if (strIds.length > 0) {
        const placeholders = strIds.map(() => "?").join(",");
        const res = await db.execute({
          sql: `SELECT email, name FROM contacts WHERE cid IN (${placeholders})`,
          args: [...strIds],
        });
        allMembers.push(...res.rows);
      }

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

    return NextResponse.json({ success: true, team });
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
    const { team_id, member_ids } = await req.json();

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

    // Link Members to Team (Copied Logic from POST)
    const intIds = member_ids.filter(
      (id) => id && !isNaN(id) && !id.toString().startsWith("USER_"),
    );
    const strIds = member_ids.filter(
      (id) => id && id.toString().startsWith("USER_"),
    );

    if (intIds.length > 0) {
      const placeholders = intIds.map(() => "?").join(",");
      await db.execute({
        sql: `UPDATE v2_participants SET v2_team_id = ? WHERE id IN (${placeholders})`,
        args: [team.id, ...intIds],
      });
    }

    if (strIds.length > 0) {
      const placeholders = strIds.map(() => "?").join(",");
      await db.execute({
        sql: `UPDATE contacts SET v2_team_id = ? WHERE cid IN (${placeholders})`,
        args: [team.id, ...strIds],
      });
    }

    // Send Emails (Copied Logic from POST)
    const allMembers = [];
    if (intIds.length > 0) {
      const res = await db.execute({
        sql: `SELECT email, name FROM v2_participants WHERE id IN (${intIds.map(() => "?").join(",")})`,
        args: [...intIds],
      });
      allMembers.push(...res.rows);
    }
    if (strIds.length > 0) {
      const res = await db.execute({
        sql: `SELECT email, name FROM contacts WHERE cid IN (${strIds.map(() => "?").join(",")})`,
        args: [...strIds],
      });
      allMembers.push(...res.rows);
    }

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
