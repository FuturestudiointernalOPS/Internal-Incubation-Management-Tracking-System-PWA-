/**
 * Email — the Resend webhook DECISIONS.
 *
 * These used to sit inline in `src/app/api/webhooks/resend/route.js`. They now
 * live in `src/services/email/resendWebhook.js`. This suite pins the observable
 * behaviour: the signature check (including rotation), the freshness window, the
 * event → status map and the append to the delivery log.
 */

jest.mock("@/lib/db", () => ({ initDb: jest.fn().mockResolvedValue(undefined) }));

jest.mock("@/models/emailLogStore", () => ({
  runEmailLogStatement: jest.fn().mockResolvedValue(undefined),
  selectLatestEmailStatus: jest.fn(),
  selectEmailLogRow: jest.fn(),
  selectLastSentRowByRecipient: jest.fn(),
  selectLogByEmailId: jest.fn(),
  selectSentForRecipientInRun: jest.fn(),
  selectActivationLogRows: jest.fn(),
  selectEmailStatsRows: jest.fn(),
  insertStatusRow: jest.fn(),
  insertBouncedRow: jest.fn(),
  insertResendEventRow: jest.fn().mockResolvedValue(undefined),
  insertEmailResultSent: jest.fn(),
  insertEmailResultFailed: jest.fn(),
  insertStandaloneSent: jest.fn(),
  insertStandaloneFailed: jest.fn(),
  selectLatestPasswordSetupToken: jest.fn(),
}));

const crypto = require("crypto");
const store = require("@/models/emailLogStore");
const { processResendWebhook, verifySvixSignature } = require("@/services/email/resendWebhook");

const SECRET = "whsec_" + Buffer.from("supersecret").toString("base64");

function sign({ secret = SECRET, id, ts, raw }) {
  const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return crypto.createHmac("sha256", Buffer.from(key, "base64")).update(`${id}.${ts}.${raw}`).digest("base64");
}

function freshTs() {
  return String(Math.floor(Date.now() / 1000));
}

beforeEach(() => {
  jest.clearAllMocks();
  store.runEmailLogStatement.mockResolvedValue(undefined);
  store.insertResendEventRow.mockResolvedValue(undefined);
});

describe("processResendWebhook", () => {
  it("refuses missing signature headers", async () => {
    expect(await processResendWebhook({ secret: SECRET, svixId: null, svixTs: null, svixSig: "", raw: "{}" })).toEqual(
      { ok: false, status: 401, error: "Missing signature headers" },
    );
  });

  it("refuses an invalid signature", async () => {
    const result = await processResendWebhook({
      secret: SECRET,
      svixId: "msg_1",
      svixTs: freshTs(),
      svixSig: "v1,not-the-right-signature",
      raw: "{}",
    });

    expect(result).toEqual({ ok: false, status: 401, error: "Invalid signature" });
    expect(store.insertResendEventRow).not.toHaveBeenCalled();
  });

  it("accepts ANY valid candidate during secret rotation", async () => {
    const ts = freshTs();
    const raw = JSON.stringify({ type: "email.delivered", data: { email_id: "e1" } });
    const good = sign({ id: "msg_1", ts, raw });

    expect(
      verifySvixSignature({
        secret: SECRET,
        svixId: "msg_1",
        svixTs: ts,
        svixSig: `v1,deadbeef v1,${good}`,
        raw,
      }),
    ).toBe(true);
  });

  it("refuses a stale but otherwise valid signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 600);
    const raw = JSON.stringify({ type: "email.delivered" });
    const good = sign({ id: "msg_1", ts, raw });

    expect(
      await processResendWebhook({ secret: SECRET, svixId: "msg_1", svixTs: ts, svixSig: `v1,${good}`, raw }),
    ).toEqual({ ok: false, status: 401, error: "Stale signature" });
  });

  it("ignores a non-lifecycle event", async () => {
    const ts = freshTs();
    const raw = JSON.stringify({ type: "email.received" });
    const good = sign({ id: "msg_1", ts, raw });

    expect(
      await processResendWebhook({ secret: SECRET, svixId: "msg_1", svixTs: ts, svixSig: `v1,${good}`, raw }),
    ).toEqual({ ok: true, ignored: true });
    expect(store.insertResendEventRow).not.toHaveBeenCalled();
  });

  it("records a lifecycle event and maps its status", async () => {
    const ts = freshTs();
    const raw = JSON.stringify({
      type: "email.bounced",
      data: { email_id: "e1", reason: "mailbox full", created_at: "2026-05-01T10:00:00Z" },
    });
    const good = sign({ id: "msg_1", ts, raw });
    store.selectLogByEmailId.mockResolvedValue({
      rows: [{ submission_id: 3, contact_cid: "C1", email_type: "activation", provider: "resend", recipient: "a@x.io", email_id: "e1", sent_at: null }],
    });

    expect(
      await processResendWebhook({ secret: SECRET, svixId: "msg_1", svixTs: ts, svixSig: `v1,${good}`, raw }),
    ).toEqual({ ok: true, recorded: true, emailStatus: "bounced", email_id: "e1" });
    expect(store.insertResendEventRow).toHaveBeenCalled();
  });

  it("reports recorded:false for an unknown email_id", async () => {
    const ts = freshTs();
    const raw = JSON.stringify({ type: "email.delivered", data: { email_id: "unknown" } });
    const good = sign({ id: "msg_1", ts, raw });
    store.selectLogByEmailId.mockResolvedValue({ rows: [] });

    expect(
      await processResendWebhook({ secret: SECRET, svixId: "msg_1", svixTs: ts, svixSig: `v1,${good}`, raw }),
    ).toEqual({ ok: true, recorded: false, emailStatus: "delivered", email_id: "unknown" });
  });
});
