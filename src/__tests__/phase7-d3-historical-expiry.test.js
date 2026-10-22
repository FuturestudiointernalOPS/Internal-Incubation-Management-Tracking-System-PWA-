/**
 * PHASE 7 — D3 : expiration de la trace historique (durée de conservation).
 *
 * L'arbitrage D3 (docs/permissions/phase-1-decisions.md) tranche : la lecture
 * résiduelle d'un ancien gestionnaire **expire** selon une **durée de
 * conservation configurable par le super admin** (heures / jours / mois /
 * années), **défaut 6 mois**. L'expiration est ancrée sur la **fin de
 * responsabilité** (les dates stockées des cartes terminées), donc **idempotente**
 * — un ancrage sur `now` re-daterait la ligne à chaque passage.
 *
 * Ces tests couvrent la partie PURE (aucune base, aucune horloge) : lecture du
 * réglage, calcul de l'échéance, choix de l'ancrage.
 */
const {
  DEFAULT_HISTORICAL_RETENTION,
  HISTORICAL_RETENTION_SETTING_KEY,
  RETENTION_UNITS,
  parseHistoricalRetention,
  computeHistoricalExpiry,
  latestHistoryAnchor,
  historicalExpiryFor,
} = require("@/services/authorization/historicalAccess");

describe("D3 — parseHistoricalRetention", () => {
  test("the default is 6 months", () => {
    expect(DEFAULT_HISTORICAL_RETENTION).toEqual({ amount: 6, unit: "months" });
    expect(parseHistoricalRetention(null)).toEqual({ amount: 6, unit: "months" });
    expect(parseHistoricalRetention("")).toEqual({ amount: 6, unit: "months" });
  });

  test("the Super-Admin setting key is the documented one", () => {
    expect(HISTORICAL_RETENTION_SETTING_KEY).toBe("historical_access_retention");
  });

  test("accepts a JSON object and a compact string", () => {
    expect(parseHistoricalRetention('{"amount":3,"unit":"years"}')).toEqual({ amount: 3, unit: "years" });
    expect(parseHistoricalRetention("6:months")).toEqual({ amount: 6, unit: "months" });
    expect(parseHistoricalRetention("48 hours")).toEqual({ amount: 48, unit: "hours" });
    expect(parseHistoricalRetention({ amount: 30, unit: "days" })).toEqual({ amount: 30, unit: "days" });
  });

  test("the four units are supported", () => {
    expect(RETENTION_UNITS).toEqual(["hours", "days", "months", "years"]);
  });

  test("anything invalid falls back to the default (never unbounded)", () => {
    expect(parseHistoricalRetention("nonsense")).toEqual({ amount: 6, unit: "months" });
    expect(parseHistoricalRetention("6:fortnights")).toEqual({ amount: 6, unit: "months" });
    expect(parseHistoricalRetention("0:days")).toEqual({ amount: 6, unit: "months" });
    expect(parseHistoricalRetention("-3:days")).toEqual({ amount: 6, unit: "months" });
  });
});

describe("D3 — computeHistoricalExpiry", () => {
  test("hours and days are wall-clock additions", () => {
    expect(computeHistoricalExpiry("2026-01-01T00:00:00.000Z", { amount: 12, unit: "hours" })).toBe(
      "2026-01-01T12:00:00.000Z",
    );
    expect(computeHistoricalExpiry("2026-01-01T00:00:00.000Z", { amount: 10, unit: "days" })).toBe(
      "2026-01-11T00:00:00.000Z",
    );
  });

  test("months and years are calendar-aware (UTC)", () => {
    expect(computeHistoricalExpiry("2026-01-15T00:00:00.000Z", { amount: 6, unit: "months" })).toBe(
      "2026-07-15T00:00:00.000Z",
    );
    expect(computeHistoricalExpiry("2026-03-01T00:00:00.000Z", { amount: 1, unit: "years" })).toBe(
      "2027-03-01T00:00:00.000Z",
    );
  });

  test("no anchor means no expiry (null)", () => {
    expect(computeHistoricalExpiry(null, { amount: 6, unit: "months" })).toBeNull();
    expect(computeHistoricalExpiry("not-a-date", { amount: 6, unit: "months" })).toBeNull();
  });
});

describe("D3 — latestHistoryAnchor", () => {
  test("takes the greatest of ends_at / ended_at across the ended cards", () => {
    const anchor = latestHistoryAnchor([
      { ends_at: "2026-01-01T00:00:00.000Z", ended_at: "2026-01-05T00:00:00.000Z" },
      { ends_at: null, ended_at: "2026-02-20T00:00:00.000Z" },
      { ends_at: "2025-12-01T00:00:00.000Z", ended_at: null },
    ]);
    expect(anchor.toISOString()).toBe("2026-02-20T00:00:00.000Z");
  });

  test("no dates at all means no anchor", () => {
    expect(latestHistoryAnchor([{ context_id: "P1" }, {}])).toBeNull();
    expect(latestHistoryAnchor([])).toBeNull();
  });
});

describe("D3 — historicalExpiryFor", () => {
  test("anchors on the latest ended card and applies the retention", () => {
    const rows = [{ ends_at: "2026-01-15T00:00:00.000Z", ended_at: "2026-01-10T00:00:00.000Z" }];
    expect(historicalExpiryFor(rows, "6:months")).toBe("2026-07-15T00:00:00.000Z");
    expect(historicalExpiryFor(rows, null)).toBe("2026-07-15T00:00:00.000Z"); // default
  });

  test("no ended card means no expiry", () => {
    expect(historicalExpiryFor([], "6:months")).toBeNull();
  });
});
