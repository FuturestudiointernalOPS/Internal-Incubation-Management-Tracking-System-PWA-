import {
  selectTeamSnapshot,
  upsertTeamSnapshot,
  selectActiveBaseline,
  setBaselineFteIfNull,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema } from "./settings";
import { computeTeamShares, snapshotFte, toCount, toAmount, normalizePeriod } from "./rules";

/**
 * Kept as a re-export because Phase 1 callers (and its test) import
 * `normalizePeriod` from here. The implementation lives in `./rules` so the
 * monthly reporting layer shares exactly one period parser.
 */
export { normalizePeriod };

const shape = (row) =>
  row
    ? {
        id: row.id,
        period: row.reporting_period,
        womenEmployees: row.women_employees,
        menEmployees: row.men_employees,
        under35Women: row.under35_women,
        under35Men: row.under35_men,
        fullTimeEmployees: row.full_time_employees,
        partTimeEmployees: row.part_time_employees,
        partTimeDays: Number(row.part_time_days),
        fullTimeFounders: row.full_time_founders,
        partTimeFounders: row.part_time_founders,
        shares: computeTeamShares(row),
      }
    : null;

export async function getTeam({ ventureUuid, period }) {
  await ensureReportingSchema();
  const normalised = normalizePeriod(period);
  if (!normalised) return { error: "venture.reporting.validation.period" };
  const result = await selectTeamSnapshot(ventureUuid, normalised);
  return { team: shape((result.rows || [])[0]) };
}

export async function saveTeam({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();
  const period = normalizePeriod(input.period);
  if (!period) return { errors: ["venture.reporting.validation.period"] };

  const result = await upsertTeamSnapshot({
    ventureUuid,
    ventureCode,
    period,
    womenEmployees: toCount(input.womenEmployees),
    menEmployees: toCount(input.menEmployees),
    under35Women: toCount(input.under35Women),
    under35Men: toCount(input.under35Men),
    fullTimeEmployees: toCount(input.fullTimeEmployees),
    partTimeEmployees: toCount(input.partTimeEmployees),
    partTimeDays: toAmount(input.partTimeDays) || 0,
    fullTimeFounders: toCount(input.fullTimeFounders),
    partTimeFounders: toCount(input.partTimeFounders),
    actorCid,
  });

  const row = (result.rows || [])[0];
  if (row) await backfillBaselineFte({ ventureUuid, period, snapshot: row });

  return { team: shape(row) };
}

/**
 * A baseline captured BEFORE the workforce card was filled carries no FTE — the
 * founder was never asked twice. Fill it once, from the snapshot of the month
 * the baseline belongs to, and only while it is still empty.
 */
async function backfillBaselineFte({ ventureUuid, period, snapshot }) {
  const active = await selectActiveBaseline(ventureUuid);
  const baseline = (active.rows || [])[0];
  if (!baseline || (baseline.fte !== null && baseline.fte !== undefined)) return;

  const capturedMonth = baseline.captured_at
    ? new Date(baseline.captured_at).toISOString().slice(0, 7)
    : null;
  if (!capturedMonth || `${capturedMonth}-01` !== period) return;

  const fte = snapshotFte({
    fullTime: snapshot.full_time_employees,
    partTimeDays: snapshot.part_time_days,
    fullTimeFounders: snapshot.full_time_founders,
  });
  if (fte === null) return;

  await setBaselineFteIfNull(ventureUuid, fte);
}
