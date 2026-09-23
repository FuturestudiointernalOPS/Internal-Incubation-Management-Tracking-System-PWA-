import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getLegacyFormGroupName,
  findContactCidByEmail,
  findContactCidByPhone,
  findContactCidByName,
  createPublicResponseContact,
  createFormResponse,
  updateCampaignContactResponseStatus,
} from "@/models/forms";

export async function POST(req) {
  try {
    await initDb();
    const { cid, form_id, answers, publicData, group_name } = await req.json();

    if (!form_id || (!answers && !publicData)) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // PUB-3 — IDENTITY ANCHORING.
    // This endpoint is public, so a `cid` in the request proves nothing: anyone
    // could post someone else's id and forge a response onto their record. The
    // attribution is therefore resolved SERVER-SIDE, from the identity the
    // respondent actually typed (email → phone → name), never from the body.
    // The optional `cid` is now used only to DETECT a mismatch (a link naming a
    // different person than the typed email) and flag it for review.
    let resolvedCid = null;
    let confidence_score = 100;
    let match_status = 'auto';
    let resolvedGroupName = group_name;

    if (!resolvedGroupName) {
      try {
        const formResult = await getLegacyFormGroupName(form_id);
        if (formResult.rows.length > 0) {
          resolvedGroupName = formResult.rows[0].group_name;
        }
      } catch {
        // forms schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
        resolvedGroupName = group_name;
      }
    }

    if (publicData) {
      const emailMatch = await findContactCidByEmail(publicData.email || '');
      if (emailMatch.rows.length > 0) {
        resolvedCid = emailMatch.rows[0].cid;
        confidence_score = 100;
      }
      else if (publicData.phone) {
        const phoneMatch = await findContactCidByPhone(publicData.phone);
        if (phoneMatch.rows.length > 0) {
          resolvedCid = phoneMatch.rows[0].cid;
          confidence_score = 95;
        }
      }

      if (!resolvedCid && publicData.name) {
        const nameMatch = await findContactCidByName(publicData.name);
        if (nameMatch.rows.length > 0) {
          resolvedCid = nameMatch.rows[0].cid;
          confidence_score = 70;
        }
      }

      if (!resolvedCid && publicData.email) {
         resolvedCid = "USER_" + Math.random().toString(36).substring(2, 8).toUpperCase();
         await createPublicResponseContact({
           cid: resolvedCid,
           name: publicData.name || 'Anonymous',
           email: publicData.email,
           phone: publicData.phone || null,
           groupName: resolvedGroupName || null,
         });
         confidence_score = 100;
      }
    }

    // A supplied cid that does not match the identity the respondent typed is a
    // red flag: the link names a different person. Never write to that id; just
    // mark the response so a human reviews it.
    if (cid && publicData) {
      const confirmedCid = (await findContactCidByEmail(publicData.email || '')).rows?.[0]?.cid || null;
      if (!confirmedCid || String(confirmedCid) !== String(cid)) {
        match_status = 'flagged';
      }
    }

    if (confidence_score < 90) match_status = 'flagged';

    try {
      await createFormResponse({
        formId: form_id,
        cid: resolvedCid || null,
        answers,
        publicData,
        confidenceScore: confidence_score,
        matchStatus: match_status,
        groupName: resolvedGroupName || null,
      });
    } catch {
      // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
      // continue — campaign_contacts update below still executes
    }


    if (resolvedCid) {
      const hasYes = Object.values(answers || {}).some(value => value === 'Yes' || String(value).toLowerCase() === 'yes' || value === true);
      const hasNo = Object.values(answers || {}).some(value => value === 'No' || String(value).toLowerCase() === 'no' || value === false);
      let status = 'responded';
      if (hasYes) status = 'yes';
      else if (hasNo) status = 'no';

      await updateCampaignContactResponseStatus({
        status,
        cid: resolvedCid,
        formId: form_id,
      });
    }

    return NextResponse.json({ success: true, message: "Response recorded", confidence_score, match_status });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
