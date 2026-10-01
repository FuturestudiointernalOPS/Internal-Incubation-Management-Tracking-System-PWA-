/**
 * Strategic-objective progress — the rule the PM indicator must obey:
 *
 *   an objective's rate = approved (participant × linked deliverable) pairs
 *                         ────────────────────────────────────────────── × 100
 *                            active participants × linked deliverables
 *
 * A participant who got 2 of an objective's 3 linked deliverables approved
 * contributes 2/3 — not 0, not 1. Only approved submissions count; sessions
 * never do; an objective with no linked deliverable is not measurable and is
 * never cached; and a rate that truly falls must be able to fall to zero.
 *
 * Mocks @/lib/db's `execute`, mirroring the approach used across the suite.
 */
import db from "@/lib/db";
import { recalculateKpiProgress } from "@/models/kpi-progress";
import { averageKpiProgress } from "@/lib/constants";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn() },
}));

function makeDb({ kpis, participants, deliverables, submissions }) {
  const inserts = [];
  const deletes = [];
  db.execute.mockImplementation(async (query = {}) => {
    const statement = String(query.sql || "");
    if (statement.includes("SELECT * FROM v2_kpis")) return { rows: kpis };
    if (statement.includes("COUNT(*) AS count")) return { rows: [{ count: participants }] };
    if (statement.includes("FROM v2_document_requirements")) return { rows: deliverables };
    if (statement.includes("FROM v2_submissions")) return { rows: submissions };
    if (statement.includes("DELETE FROM kpi_progress")) {
      deletes.push(query.args);
      return { rows: [] };
    }
    if (statement.includes("INSERT INTO kpi_progress")) {
      inserts.push(query.args);
      return { rows: [] };
    }
    return { rows: [] };
  });
  return { inserts, deletes };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("the objective rate is fractional, not all-or-nothing", () => {
  it("counts a participant's approved deliverables as a fraction of the linked ones", async () => {
    // Two participants, one objective linked to three deliverables.
    // A approved d1 and d2 (2/3); B approved d1 (1/3) → 3 approved pairs of 6.
    makeDb({
      kpis: [{ id: 1, title: "Objective A" }],
      participants: 2,
      deliverables: [
        { id: "d1", kpi_ids: [1] },
        { id: "d2", kpi_ids: [1] },
        { id: "d3", kpi_ids: [1] },
      ],
      submissions: [
        { participant_id: "A", deliverable_id: "d1", document_id: "d1" },
        { participant_id: "A", deliverable_id: "d2", document_id: "d2" },
        { participant_id: "B", deliverable_id: "d1", document_id: "d1" },
      ],
    });

    const [objective] = await recalculateKpiProgress("P1");

    expect(objective.measurable).toBe(true);
    expect(objective.approved_count).toBe(3);
    expect(objective.participant_count).toBe(2);
    expect(objective.completion_rate).toBe(50); // 3 of 6, NOT 0 and NOT 100
  });

  it("counts one approval once even when both references point at the same deliverable", async () => {
    makeDb({
      kpis: [{ id: 1, title: "Objective A" }],
      participants: 1,
      deliverables: [{ id: "d1", kpi_ids: [1] }],
      submissions: [
        { participant_id: "A", deliverable_id: "d1", document_id: "d1" },
        { participant_id: "A", deliverable_id: "d1", document_id: "d1" },
      ],
    });

    const [objective] = await recalculateKpiProgress("P1");

    expect(objective.approved_count).toBe(1);
    expect(objective.completion_rate).toBe(100); // 1 of 1, not 2 of 1
  });
});

describe("an objective with nothing to measure", () => {
  it("is reported as not measurable and never cached", async () => {
    const { inserts, deletes } = makeDb({
      kpis: [{ id: 7, title: "Empty objective" }],
      participants: 5,
      deliverables: [],
      submissions: [],
    });

    const [objective] = await recalculateKpiProgress("P1");

    expect(objective.measurable).toBe(false);
    expect(objective.completion_rate).toBe(0);
    expect(inserts).toHaveLength(0); // nothing written…
    expect(deletes).toHaveLength(1); // …and any stale row is cleared
  });

  it("ignores sessions: an objective linked only to a session is not measurable", async () => {
    makeDb({
      kpis: [{ id: 1, title: "Session-only objective" }],
      participants: 3,
      // The deliverable exists but is linked to no objective; the objective's
      // only link lives on a session, which the rate never reads.
      deliverables: [{ id: "d1", kpi_ids: [] }],
      submissions: [{ participant_id: "A", deliverable_id: "d1", document_id: "d1" }],
    });

    const [objective] = await recalculateKpiProgress("P1");

    expect(objective.measurable).toBe(false);
    expect(objective.completion_rate).toBe(0);
  });
});

describe("a rate that falls can fall", () => {
  it("persists a drop back to zero — no 'never downgrade' guard", async () => {
    const { inserts } = makeDb({
      kpis: [{ id: 1, title: "Objective A" }],
      participants: 4,
      deliverables: [{ id: "d1", kpi_ids: [1] }],
      submissions: [],
    });

    await recalculateKpiProgress("P1");

    // INSERT args per row: program_id, kpi_id, kpi_name, completion_rate, …
    expect(inserts).toHaveLength(1);
    expect(inserts[0][3]).toBe(0);
  });
});

describe("the programme figure is the plain average of objectives", () => {
  it("weighs every objective the same", () => {
    expect(
      averageKpiProgress([{ progress: 80 }, { progress: 0 }, { progress: 100 }]),
    ).toBe(60);
  });

  it("returns null when there is no objective to average", () => {
    expect(averageKpiProgress([])).toBeNull();
    expect(averageKpiProgress(null)).toBeNull();
  });
});
