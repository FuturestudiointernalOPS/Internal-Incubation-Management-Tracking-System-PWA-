import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { parseEmailAddressList } from "@/lib/email/addresses";
import { sendManualMessages } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { run_id, submission_ids, subject, body: messageBody, cc } = await req.json();
    if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
      return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
    }
    if (!subject || !messageBody) {
      return NextResponse.json({ success: false, error: "subject and body are required" }, { status: 400 });
    }
    if (submission_ids.length > 500) {
      return NextResponse.json({ success: false, error: "A manual message can send to at most 500 recipients" }, { status: 400 });
    }

    const { emails: ccEmails, invalid: invalidCcAddresses } = parseEmailAddressList(cc);
    if (invalidCcAddresses.length > 0) {
      return NextResponse.json({ success: false, error: "invalid_cc_addresses" }, { status: 400 });
    }
    if (ccEmails.length > 10) {
      return NextResponse.json({ success: false, error: "too_many_cc_addresses" }, { status: 400 });
    }

    const result = await sendManualMessages({ run_id, submission_ids, subject, body: messageBody, cc: ccEmails });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}