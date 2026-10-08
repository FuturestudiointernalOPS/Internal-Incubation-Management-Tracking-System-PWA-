import { GET } from "./handlers/get";
import { PUT } from "./handlers/put";
import { DELETE } from "./handlers/delete";
import {
  POST as statusPOST,
} from "./handlers/post/status";
import {
  POST as submitPOST,
} from "./handlers/post/submit";
import {
  POST as manualAddPOST,
} from "./handlers/post/manual_add";
import {
  POST as updateRespondentEmailPOST,
} from "./handlers/post/update_respondent_email";
import {
  POST as reviewPOST,
} from "./handlers/post/review";
import {
  POST as bulkReviewPOST,
} from "./handlers/post/bulk_review";
import {
  POST as retryEmailsPOST,
} from "./handlers/post/retry_emails";
import {
  POST as markEmailCancelledPOST,
} from "./handlers/post/mark_email_cancelled";
import {
  POST as launchPOST,
} from "./handlers/post/launch";
import {
  POST as assignPOST,
} from "./handlers/post/assign";
import {
  POST as unassignPOST,
} from "./handlers/post/unassign";
import {
  POST as previewResultPOST,
} from "./handlers/post/preview_result";
import {
  POST as regenerateReportPOST,
} from "./handlers/post/regenerate_report";
import {
  POST as sendResultEmailsPOST,
} from "./handlers/post/send_result_emails";
import {
  POST as dispatchScheduledResultEmailsPOST,
} from "./handlers/post/dispatch_scheduled_result_emails";
import {
  POST as deleteSubmissionPOST,
} from "./handlers/post/delete_submission";
import {
  POST as sendManualMessagePOST,
} from "./handlers/post/send_manual_message";
import {
  POST as sendActivationMessagesPOST,
} from "./handlers/post/send_activation_messages";
import {
  POST as regenerateLinkPOST,
} from "./handlers/post/regenerate_link";
import {
  POST as createPOST,
} from "./handlers/post/create";

const POST_HANDLERS = {
  status: statusPOST,
  submit: submitPOST,
  manual_add: manualAddPOST,
  update_respondent_email: updateRespondentEmailPOST,
  review: reviewPOST,
  bulk_review: bulkReviewPOST,
  retry_emails: retryEmailsPOST,
  mark_email_cancelled: markEmailCancelledPOST,
  launch: launchPOST,
  assign: assignPOST,
  unassign: unassignPOST,
  preview_result: previewResultPOST,
  regenerate_report: regenerateReportPOST,
  send_result_emails: sendResultEmailsPOST,
  dispatch_scheduled_result_emails: dispatchScheduledResultEmailsPOST,
  delete_submission: deleteSubmissionPOST,
  send_manual_message: sendManualMessagePOST,
  send_activation_messages: sendActivationMessagesPOST,
  regenerate_link: regenerateLinkPOST,
  // default (no action) = create
  create: createPOST,
};

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "create";
  const handler = POST_HANDLERS[action];
  if (!handler) {
    return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return handler(req);
}

export { GET, PUT, DELETE };