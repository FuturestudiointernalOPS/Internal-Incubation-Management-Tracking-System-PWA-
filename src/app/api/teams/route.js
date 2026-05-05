import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('program_id');

    let sql = "SELECT * FROM v2_teams";
    let args = [];

    if (programId) {
      sql += " WHERE program_id = ?";
      args.push(programId);
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, teams: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { program_id, name, handler_id, handler_name, member_ids } = await req.json();

    if (!program_id || !name) {
      return NextResponse.json({ success: false, error: "Program ID and Name are required." }, { status: 400 });
    }

    // Generate Team Username (TEAM_SLUG_ID) and Password
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 10);
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const generatedUsername = `${slug}_${randomStr}`;
    const generatedPassword = `FST${randomStr}`;

    // 1. Create Team Record
    const result = await db.execute({
      sql: "INSERT INTO v2_teams (program_id, name, handler_id, handler_name, password, team_username) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
      args: [program_id, name, handler_id || null, handler_name || null, generatedPassword, generatedUsername]
    });

    const team = result.rows[0];

    // 2. Link Members to Team if provided
    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      const placeholders = member_ids.map(() => "?").join(",");
      await db.execute({
        sql: `UPDATE contacts SET team_id = ? WHERE cid IN (${placeholders})`,
        args: [team.id, ...member_ids]
      });

      // 3. Send Emails to Members
      const memberRes = await db.execute({
        sql: `SELECT email, name FROM contacts WHERE cid IN (${placeholders})`,
        args: [...member_ids]
      });

      for (const member of memberRes.rows) {
        try {
          await sendEmail({
            to: member.email,
            subject: `Team Credentials: ${name}`,
            body: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #FF6600;">Welcome to Team ${name}</h2>
                <p>Hello ${member.name},</p>
                <p>You have been added to a new team in the ImpactOS platform. Here are your shared team access credentials:</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Team Name:</strong> ${name}</p>
                  <p style="margin: 5px 0;"><strong>Login Username:</strong> ${generatedUsername}</p>
                  <p style="margin: 5px 0;"><strong>Password:</strong> ${generatedPassword}</p>
                </div>
                <p>Please use these credentials to log in to the platform at the link below:</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://impactos-pwa.vercel.app'}/login" style="display: inline-block; background: #FF6600; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Access Platform</a>
                <p style="margin-top: 30px; font-size: 12px; color: #64748b;">This is a shared team account. All members of your team will use these same credentials.</p>
              </div>
            `,
            isHtml: true
          });
        } catch (mailError) {
          console.error(`Failed to send email to ${member.email}:`, mailError);
        }
      }
    }

    return NextResponse.json({ success: true, team });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

