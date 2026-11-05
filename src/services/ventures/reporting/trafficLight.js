/**
 * THE TRAFFIC LIGHT — spec §11. PURE.
 *
 * Health, independent of stage: a venture can be in Growth and red, or in
 * Validation and green. Three dimensions, each scored green/amber/red, and the
 * overall light is THE WORST of the three.
 *
 * Every threshold is read from the studio's settings, so the studio moves the
 * bar without a deploy. The WORST-OF-THREE rule is not configurable: it is the
 * definition of the light.
 *
 * `unknown` is a real outcome: a dimension with no data is not red, and an
 * overall light built on no data at all is not green.
 */

import { settingValue } from "./settingDefinitions";

export const GREEN = "green";
export const AMBER = "amber";
export const RED = "red";
export const UNKNOWN = "unknown";

const SEVERITY = { [GREEN]: 0, [AMBER]: 1, [RED]: 2 };

/** Higher is better (runway, growth, milestones). */
function scoreAtLeast(value, greenFrom, amberFrom) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return UNKNOWN;
  const numeric = Number(value);
  if (numeric >= greenFrom) return GREEN;
  if (numeric >= amberFrom) return AMBER;
  return RED;
}

/**
 * @param {object} input
 * @param {number|null} input.runwayMonths        latest computed runway, or null
 * @param {number|null} input.customerGrowth     latest 3-month growth as a PERCENT
 * @param {{dueTotal:number,onTime:number}|null} input.milestones
 * @param {object} input.settings
 */
export function evaluateTrafficLight({ runwayMonths = null, customerGrowth = null, milestones = null, settings = {} }) {
  const dimensions = [
    {
      key: "runway",
      status: scoreAtLeast(
        runwayMonths,
        settingValue(settings, "traffic_runway_green_months"),
        settingValue(settings, "traffic_runway_amber_months"),
      ),
      value: runwayMonths,
      green: settingValue(settings, "traffic_runway_green_months"),
      amber: settingValue(settings, "traffic_runway_amber_months"),
      unit: "months",
    },
    {
      key: "growth",
      status: scoreAtLeast(
        customerGrowth,
        settingValue(settings, "traffic_growth_green_pct"),
        settingValue(settings, "traffic_growth_amber_pct"),
      ),
      value: customerGrowth,
      green: settingValue(settings, "traffic_growth_green_pct"),
      amber: settingValue(settings, "traffic_growth_amber_pct"),
      unit: "percent",
    },
    {
      key: "milestones",
      status: scoreAtLeast(
        milestones && milestones.dueTotal > 0
          ? (milestones.onTime / milestones.dueTotal) * 100
          : null,
        settingValue(settings, "traffic_milestones_green_pct"),
        settingValue(settings, "traffic_milestones_amber_pct"),
      ),
      value:
        milestones && milestones.dueTotal > 0
          ? (milestones.onTime / milestones.dueTotal) * 100
          : null,
      green: settingValue(settings, "traffic_milestones_green_pct"),
      amber: settingValue(settings, "traffic_milestones_amber_pct"),
      unit: "percent",
      dueTotal: milestones?.dueTotal ?? 0,
      onTime: milestones?.onTime ?? 0,
    },
  ];

  const known = dimensions.filter((dimension) => dimension.status !== UNKNOWN);
  const overall = known.length
    ? known.reduce(
        (worst, dimension) =>
          SEVERITY[dimension.status] > SEVERITY[worst] ? dimension.status : worst,
        GREEN,
      )
    : UNKNOWN;

  return { overall, dimensions };
}
