import { selectTeamSnapshot, upsertTeamSnapshot } from "@/models/ventureReportingStore";
import { ensureReportingSchema } from "./settings";
import { computeTeamShares, toCount, toAmount, normalizePeriod } from "./rules";

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

  return { team: shape((result.rows || [])[0]) };
}
