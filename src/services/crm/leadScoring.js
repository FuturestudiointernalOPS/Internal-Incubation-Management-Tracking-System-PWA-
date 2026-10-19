/**
 * Computed lead score — a transparent, rule-based 0–100 score.
 *
 * Each rule adds points for a fact already recorded on the lead or in its
 * activity stream, and the breakdown is returned with the total so the screen
 * can show WHY a lead scores what it does. Pure: no data access here.
 *
 * Bands used by the score panel: Priority ≥ 80, High ≥ 60, Medium ≥ 30.
 */

const QUALIFICATION_POINTS = { qualified: 30, in_review: 15 };

const STATUS_POINTS = {
  contacted: 5,
  nurturing: 10,
  engaged: 15,
  qualified: 20,
  converted: 25,
};

const POINTS_PER_ACTIVITY = 5;
const MAX_ACTIVITY_POINTS = 20;
const POINTS_PER_POSITIVE_OUTCOME = 5;
const MAX_POSITIVE_POINTS = 10;
const DAY_MS = 86_400_000;

export const MAX_LEAD_SCORE = 100;

function profilePoints(lead) {
  let points = 0;
  if (lead.organization_id) points += 5;
  if (lead.contact_cid) points += 5;
  if (lead.source) points += 5;
  if (lead.description) points += 5;
  return points;
}

function recencyPoints(activities, now) {
  const latest = activities
    .map((activity) => new Date(activity.activity_date || activity.created_at).getTime())
    // A task due in the future is a plan, not something that happened.
    .filter((time) => Number.isFinite(time) && time <= now.getTime())
    .sort((first, second) => second - first)[0];
  if (latest === undefined) return 0;
  const days = (now.getTime() - latest) / DAY_MS;
  if (days <= 14) return 10;
  if (days <= 30) return 5;
  return 0;
}

/**
 * @param {object} lead        the lead row
 * @param {object[]} activities its activity stream (activities and tasks)
 * @param {Date} [now]
 * @returns {{ score: number, breakdown: { key: string, points: number }[] }}
 */
export function computeLeadScore(lead, activities = [], now = new Date()) {
  const positives = activities.filter((activity) => activity.outcome === "positive").length;
  const breakdown = [
    { key: "qualification", points: QUALIFICATION_POINTS[lead.qualification_state] ?? 0 },
    { key: "status", points: STATUS_POINTS[lead.status] ?? 0 },
    { key: "profile", points: profilePoints(lead) },
    { key: "engagement", points: Math.min(MAX_ACTIVITY_POINTS, activities.length * POINTS_PER_ACTIVITY) },
    { key: "positiveOutcomes", points: Math.min(MAX_POSITIVE_POINTS, positives * POINTS_PER_POSITIVE_OUTCOME) },
    { key: "recency", points: recencyPoints(activities, now) },
  ];
  const total = breakdown.reduce((sum, rule) => sum + rule.points, 0);
  return { score: Math.min(MAX_LEAD_SCORE, total), breakdown };
}
