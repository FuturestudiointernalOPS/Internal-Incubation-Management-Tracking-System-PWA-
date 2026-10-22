/**
 * Sending a reminder must SAY what happened.
 *
 * The bar used to end a send by going idle: a partial failure, a send that
 * reached nobody, and a request that never completed all looked the same as a
 * success. It now announces the outcome, and a request that threw is reported
 * instead of being swallowed.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const BAR = "src/components/ventures/projects/WorkItemReminderBar.js";

describe("the reminder bar reports the outcome of a send", () => {
  test("it announces the result of the send it just made", () => {
    const src = read(BAR);
    expect(src).toContain("announceSend(payload.outcome)");
    expect(src).toContain("venture.reminders.sentToast");
    expect(src).toContain("venture.reminders.sentWithFailures");
    expect(src).toContain("venture.reminders.nobodyReachable");
  });

  test("a request that never completed is reported, not swallowed", () => {
    const src = read(BAR);
    const send = src.slice(src.indexOf("const send = async"));
    expect(send).toContain("catch {");
    expect(send).toContain("venture.reminders.sendFailed");
  });

  test("every announced sentence exists in both languages", () => {
    const en = JSON.parse(read("src/locales/en/venture.json")).venture.reminders;
    const fr = JSON.parse(read("src/locales/fr/venture.json")).venture.reminders;
    for (const key of ["sentToast", "sentWithFailures", "sentWithoutFile", "sendFailed"]) {
      expect(typeof en[key]).toBe("string");
      expect(typeof fr[key]).toBe("string");
      // French must not silently fall back to English.
      expect(fr[key]).not.toBe(en[key]);
    }
  });
});
