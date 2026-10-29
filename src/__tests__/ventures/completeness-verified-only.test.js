/** Investment readiness counts APPROVED documents only: rejected, awaiting or expired earn nothing. */
const { computeDataRoomCompleteness } = require("@/services/ventures/dataRoom/access");

const required = [
  { category: "company_overview", level: "required" },
  { category: "legal_corporate", level: "required" },
];

test("a rejected required document no longer earns half a point", () => {
  const result = computeDataRoomCompleteness(required, [
    { category: "company_overview", status: "rejected" },
    { category: "legal_corporate", status: "uploaded" },
  ]);
  expect(result.readiness_percent).toBe(0);
});

test("only verified categories count", () => {
  expect(
    computeDataRoomCompleteness(required, [
      { category: "company_overview", status: "verified" },
      { category: "legal_corporate", status: "rejected" },
    ]).readiness_percent,
  ).toBe(50);
  expect(
    computeDataRoomCompleteness(required, [
      { category: "company_overview", status: "verified" },
      { category: "legal_corporate", status: "verified" },
    ]),
  ).toMatchObject({ readiness_percent: 100, is_ready: true });
});

test("a verified document wins over a rejected one in the same category", () => {
  const result = computeDataRoomCompleteness([{ category: "financial", level: "required" }], [
    { category: "financial", status: "rejected" },
    { category: "financial", status: "verified" },
  ]);
  expect(result.readiness_percent).toBe(100);
});

test("nothing required stays not measurable", () => {
  expect(computeDataRoomCompleteness([{ category: "team", level: "recommended" }], []).readiness_percent).toBeNull();
});
