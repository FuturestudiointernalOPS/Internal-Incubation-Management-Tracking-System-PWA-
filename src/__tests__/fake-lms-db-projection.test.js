/**
 * The fake LMS database must answer like a REAL driver: only the columns a
 * query asks for.
 *
 * It used to hand back the whole seeded row whatever the SELECT said, which
 * silently hid every bug where code read a column its own query never selected
 * — that is exactly how a "course not found" stayed invisible while the tests
 * stayed green. These checks pin the projection so it cannot quietly return.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");

describe("the fake LMS database returns only what a query asks for", () => {
  test("a SELECT projects its column list, dropping everything else", async () => {
    const db = createFakeDb();
    db.seed("lms_courses", [
      { id: "C-1", slug: "x", title: "T", status: "published", visibility: "public" },
    ]);

    const res = await db.execute({
      sql: "SELECT id, title FROM lms_courses WHERE id = ?",
      args: ["C-1"],
    });

    expect(res.rows[0]).toEqual({ id: "C-1", title: "T" });
    expect("status" in res.rows[0]).toBe(false);
  });

  test("a table-qualified column keeps its own name in the result", async () => {
    const db = createFakeDb();
    db.seed("platform_form_runs", [{ id: 7, public_slug: "s", status: "active" }]);

    const res = await db.execute({
      sql: "SELECT r.id, r.public_slug FROM platform_form_runs r WHERE r.public_slug = ?",
      args: ["s"],
    });

    expect(res.rows[0]).toEqual({ id: 7, public_slug: "s" });
  });

  test("SELECT * and an expression still return the whole row", async () => {
    const db = createFakeDb();
    db.seed("lms_courses", [{ id: "C-1", title: "T", extra: 1 }]);

    const star = await db.execute({ sql: "SELECT * FROM lms_courses", args: [] });
    expect(star.rows[0].extra).toBe(1);

    const counted = await db.execute({ sql: "SELECT COUNT(*) AS n FROM lms_courses", args: [] });
    expect(counted.rows[0]).toEqual({ n: 1 });
  });
});
