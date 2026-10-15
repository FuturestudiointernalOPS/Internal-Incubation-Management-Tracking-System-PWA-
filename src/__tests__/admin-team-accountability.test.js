/**
 * The admin dashboard's team-accountability figures (accountabilityModel):
 * four-week window, submitted reports only, the roster counted even when it
 * never reported, the retro not due before Friday, and blockers read from the
 * blockers table rather than added to the report flags.
 */

import { teamAccountability } from "@/components/admin/dashboard-page/accountabilityModel";

// Thursday 15 October 2026 → ISO week 42; Friday 16 → still week 42.
const THURSDAY = new Date(2026, 9, 15, 10);
const FRIDAY = new Date(2026, 9, 16, 10);

const report = (user_id, report_type, week_number, over = {}) => ({
  user_id,
  user_name: user_id,
  user_role: "staff",
  report_type,
  week_number,
  year: 2026,
  status: "submitted",
  created_at: "2026-10-12T09:00:00Z",
  ...over,
});

const roster = [
  { cid: "A", name: "Ana", role: "staff" },
  { cid: "B", name: "Ben", role: "staff" },
  { cid: "C", name: "Cleo", role: "staff" },
];

describe("teamAccountability", () => {
  test("a fully reporting member is regular; one who never reported is inactive", () => {
    const reports = [39, 40, 41].flatMap((week) => [report("A", "standup", week), report("A", "retro", week)]);
    reports.push(report("A", "standup", 42));
    const result = teamAccountability({ reports, roster, blockers: [], now: THURSDAY });
    const byId = Object.fromEntries(result.rows.map((row) => [row.id, row]));
    expect(byId.A.status).toBe("regular");
    expect(byId.B.status).toBe("inactive");
    expect(byId.C.status).toBe("inactive");
    expect(result).toMatchObject({ regular: 1, atRisk: 0, inactive: 2, expected: 3 });
  });

  test("this week's stand-ups count per person; the retro is not due before Friday", () => {
    const reports = [report("A", "standup", 42), report("B", "standup", 42)];
    const thursday = teamAccountability({ reports, roster, blockers: [], now: THURSDAY });
    expect(thursday.standupsThisWeek).toBe(2);
    expect(thursday.retroDue).toBe(false);
    expect(thursday.rows.find((row) => row.id === "A").retroThisWeek).toBeNull();
    expect(thursday.rows.find((row) => row.id === "A").retros).toEqual({ done: 0, due: 3 });

    const friday = teamAccountability({ reports, roster, blockers: [], now: FRIDAY });
    expect(friday.retroDue).toBe(true);
    expect(friday.rows.find((row) => row.id === "A").retroThisWeek).toBe(false);
    expect(friday.rows.find((row) => row.id === "A").retros).toEqual({ done: 0, due: 4 });
  });

  test("drafts and reports older than four weeks are ignored", () => {
    const reports = [report("A", "standup", 42, { status: "draft" }), report("A", "standup", 30)];
    const result = teamAccountability({ reports, roster, blockers: [], now: THURSDAY });
    expect(result.standupsThisWeek).toBe(0);
    expect(result.rows.find((row) => row.id === "A").standups).toEqual({ done: 0, due: 4 });
  });

  test("blockers come from the blockers table, active only, never added to report flags", () => {
    const reports = [report("A", "standup", 42, { has_blockers: 1 }), report("B", "standup", 42)];
    const blockers = [
      { id: 1, user_id: "A", status: "active" },
      { id: 2, user_id: "A", status: "resolved" },
    ];
    const result = teamAccountability({ reports, roster, blockers, now: THURSDAY });
    expect(result.activeBlockers).toBe(1);
    expect(result.rows.find((row) => row.id === "A").blockers).toBe(1);
    expect(result.blockerRate).toBe(50);
  });

  test("someone outside the roster who filed a staff report still gets a row", () => {
    const result = teamAccountability({ reports: [report("SA", "standup", 42)], roster, blockers: [], now: THURSDAY });
    expect(result.rows.map((row) => row.id)).toContain("SA");
    expect(result.expected).toBe(4);
  });
});
