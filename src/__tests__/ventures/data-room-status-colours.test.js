/** A document's badge says whether it has been validated: green, awaiting, or red. */
const { STATUS_CLASS, STATUS_ACCENT } = require("@/components/ventures/data-room/dataRoomUi");
const en = require("@/locales/en/dataRoom.json");

test("approved is green, rejected is red, everything not yet validated is awaiting", () => {
  expect(STATUS_CLASS.verified).toBe("stf-tag g");
  expect(STATUS_CLASS.rejected).toBe("stf-tag r");
  expect(STATUS_CLASS.uploaded).toBe(STATUS_CLASS.under_review);
  expect(STATUS_CLASS.uploaded).toBe("stf-tag w");
});

test("the card edge carries the same verdict colour", () => {
  expect(STATUS_ACCENT.verified).toContain("--stf-done");
  expect(STATUS_ACCENT.rejected).toContain("--stf-crit");
  expect(STATUS_ACCENT.uploaded).toBe(STATUS_ACCENT.under_review);
});

test("the words read Approved / Rejected / Awaiting review", () => {
  const status = en.dataRoom.status;
  expect(status.verified).toBe("Approved");
  expect(status.rejected).toBe("Rejected");
  expect(status.uploaded).toBe("Awaiting review");
});
