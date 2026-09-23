/**
 * Campaign dispatch — GET /api/send-pending.
 *
 * A recipient is marked "completed" ONLY after a real send. Before this, the
 * step was closed and counted as sent even when the email never left the
 * system, which silently skipped recipients instead of retrying them.
 */

jest.mock("@/lib/db", () => ({
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/lib/mailer", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/models/workspace", () => ({
  getPendingCampaignContacts: jest.fn(),
  completeCampaignContact: jest.fn(),
}));

const { sendEmail } = require("@/lib/mailer");
const {
  getPendingCampaignContacts,
  completeCampaignContact,
} = require("@/models/workspace");
const { GET } = require("@/app/api/send-pending/route");

const contact = (over = {}) => ({
  cc_id: 1,
  email: "guest@outside.io",
  name: "Ada",
  contact_cid: "USR_1",
  campaign_name: "Spring",
  step_subject: "Subject",
  step_body: "Body",
  form_id: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  completeCampaignContact.mockResolvedValue(undefined);
});

it("closes and counts a recipient only when the email actually went out", async () => {
  getPendingCampaignContacts.mockResolvedValue({
    rows: [contact({ cc_id: 1, email: "ok@b.co" }), contact({ cc_id: 2, email: "bad@b.co" })],
  });
  sendEmail
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: false, error: "quota" });

  const body = await (await GET()).json();

  expect(body).toEqual({ success: true, sent: 1, failed: 1 });
  // Only the delivered recipient is marked done; the other stays pending.
  expect(completeCampaignContact).toHaveBeenCalledTimes(1);
  expect(completeCampaignContact).toHaveBeenCalledWith(1);
});

it("does not mark anything done when every send fails", async () => {
  getPendingCampaignContacts.mockResolvedValue({ rows: [contact({ cc_id: 7 })] });
  sendEmail.mockResolvedValueOnce({ success: false, error: "no provider configured" });

  const body = await (await GET()).json();

  expect(body).toEqual({ success: true, sent: 0, failed: 1 });
  expect(completeCampaignContact).not.toHaveBeenCalled();
});
