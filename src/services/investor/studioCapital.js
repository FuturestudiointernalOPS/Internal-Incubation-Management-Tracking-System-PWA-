import {
  selectFinancingEventsDetailed,
  selectVenturesCreatedAt,
  selectPlatformInvestmentsTotal,
} from "@/models/investor/studioCapital";
import {
  listStudioVentureCapital,
  upsertStudioVentureCapital,
} from "@/models/investor/studioVentureCapital";

const num = (value) => (value == null || value === "" ? null : Number(value));
const ratio = (part, whole) => (Number(whole) > 0 ? Number(part) / Number(whole) : null);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** An event's amount, or null when it is a band we cannot convert here. */
function eventAmount(row) {
  if (row.amount_mode !== "exact") return null;
  const value = num(row.amount_value);
  return value == null ? null : value;
}

export async function listCapitalInputs() {
  return { ok: true, inputs: (await listStudioVentureCapital()).rows || [] };
}

export async function saveCapitalInput({ payload = {}, session }) {
  const ventureId = String(payload.venture_id || "").trim();
  if (!ventureId) {
    return { ok: false, status: 400, error: "venture_id is required." };
  }

  const result = await upsertStudioVentureCapital({
    ventureId,
    studioCapitalInvested: num(payload.studio_capital_invested),
    valuation: num(payload.valuation),
    valuationCurrency: payload.valuation_currency || null,
    ownershipPct: num(payload.ownership_pct),
    realizedProceeds: num(payload.realized_proceeds),
    cashDistributed: num(payload.cash_distributed),
    exited: payload.exited === undefined ? undefined : Boolean(payload.exited),
    asOf: payload.as_of || null,
    updatedBy: session?.cid || session?.id || null,
  });

  return { ok: true, input: result.rows?.[0] || null };
}

/**
 * F1–F8 from the venture event log, the platform's own investments, and the
 * studio capital inputs. A figure whose inputs are missing is null, never zero.
 */
export async function getStudioCapitalMetrics() {
  const [eventsResult, venturesResult, platformResult, capitalResult] = await Promise.all([
    selectFinancingEventsDetailed(),
    selectVenturesCreatedAt(),
    selectPlatformInvestmentsTotal(),
    listStudioVentureCapital(),
  ]);

  const rows = eventsResult.rows || [];
  const capitalRows = capitalResult.rows || [];

  const byType = new Map();
  const byVenture = new Map();
  let total = 0;
  let known = false;
  let approximate = false;

  for (const row of rows) {
    const amount = eventAmount(row);
    if (amount == null) {
      approximate = true;
      continue;
    }
    known = true;
    total += amount;

    const type = row.financing_type || "other";
    if (!byType.has(type)) byType.set(type, { type, total: 0, count: 0 });
    const bucket = byType.get(type);
    bucket.total += amount;
    bucket.count += 1;

    const key = String(row.venture_uuid);
    if (!byVenture.has(key)) byVenture.set(key, []);
    byVenture.get(key).push({ date: row.event_date, amount });
  }

  // F8 — everything after the first round, per venture.
  let followOn = 0;
  let followOnEvents = 0;
  for (const list of byVenture.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let index = 1; index < list.length; index += 1) {
      followOn += list[index].amount;
      followOnEvents += 1;
    }
  }

  // F4 — first financing date minus the venture's creation date.
  const createdById = new Map(
    (venturesResult.rows || []).map((row) => [String(row.venture_uuid), row.created_at]),
  );
  const daysToFirstRound = [];
  for (const [ventureUuid, list] of byVenture) {
    const created = createdById.get(ventureUuid);
    const first = [...list].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    if (!created || !first?.date) continue;
    const days = (new Date(first.date) - new Date(created)) / 86400000;
    if (Number.isFinite(days) && days >= 0) daysToFirstRound.push(days);
  }

  // ── Studio capital inputs ────────────────────────────────────────────────
  let studioCapitalTotal = 0;
  let studioCapitalKnown = false;
  let stakeValue = 0;
  let stakeKnown = false;
  let realized = 0;
  let realizedKnown = false;
  let distributed = 0;
  let distributedKnown = false;
  let exitedRows = 0;

  for (const row of capitalRows) {
    const capital = num(row.studio_capital_invested);
    if (capital != null) {
      studioCapitalTotal += capital;
      studioCapitalKnown = true;
    }
    const valuation = num(row.valuation);
    const ownership = num(row.ownership_pct);
    if (valuation != null && ownership != null) {
      stakeValue += valuation * (ownership / 100);
      stakeKnown = true;
    }
    const proceeds = num(row.realized_proceeds);
    if (proceeds != null) {
      realized += proceeds;
      realizedKnown = true;
    }
    const cash = num(row.cash_distributed);
    if (cash != null) {
      distributed += cash;
      distributedKnown = true;
    }
    if (row.exited) exitedRows += 1;
  }

  const externalCapital = known ? total : null;
  const platformTotal = num(platformResult.rows?.[0]?.total) || 0;

  const outsideToStudioRatio = studioCapitalKnown
    ? ratio(externalCapital, studioCapitalTotal)
    : null;
  const portfolioValuation = stakeKnown ? stakeValue : null;
  // TVPI = (realized proceeds + unrealized stake value) ÷ studio capital.
  // If a venture has exited but its proceeds are not captured, refuse the ratio
  // rather than understate it with a zero.
  const tvpiNumerator = (realizedKnown ? realized : 0) + stakeValue;
  const tvpi =
    studioCapitalKnown && stakeKnown && (realizedKnown || exitedRows === 0)
      ? tvpiNumerator / studioCapitalTotal
      : null;
  const dpi =
    studioCapitalKnown && distributedKnown && (distributed > 0 || exitedRows > 0)
      ? distributed / studioCapitalTotal
      : null;

  const notCaptured = [];
  if (outsideToStudioRatio == null) notCaptured.push("outsideToStudioRatio");
  if (portfolioValuation == null) notCaptured.push("portfolioValuation");
  if (tvpi == null) notCaptured.push("tvpi");
  if (dpi == null) notCaptured.push("dpi");

  return {
    F: {
      financingTotal: known ? total : null,
      financingApproximate: approximate,
      financingByType: [...byType.values()].sort((a, b) => b.total - a.total),
      followOnCapital: followOnEvents > 0 ? followOn : null,
      followOnEvents,
      medianDaysToFirstRound: median(daysToFirstRound),
      venturesWithFunding: byVenture.size,
      platformOriginatedCapital: platformTotal > 0 ? platformTotal : null,
      platformOriginatedShare: ratio(platformTotal, known ? total : null),
      studioCapitalInvested: studioCapitalKnown ? studioCapitalTotal : null,
      outsideToStudioRatio,
      portfolioValuation,
      tvpi,
      dpi,
      capitalInputs: capitalRows.length,
      notCaptured,
    },
  };
}
