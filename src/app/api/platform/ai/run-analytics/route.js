import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { getSubmissionsByRunId } from "@/models/formRuns/readsAndHelpers/reads";
import { getFormFieldsByFormId, getRunRecordByPublicSlug, getRunRecordById } from "@/models/publicFormRuns";
import { deepseekIntelligence } from "@/lib/deepseek";
import {
  ensureRunAnalyticsTable,
  selectRunAnalytics,
  upsertRunAnalytics,
} from "@/models/platformAnalyticsStore";

export const dynamic = "force-dynamic";

/** The newest response on the run — half of the cache fingerprint. */
function latestSubmissionIso(submissions = []) {
  let latest = "";
  for (const submission of submissions) {
    if (!submission?.created_at) continue;
    const date = new Date(submission.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const iso = date.toISOString();
    if (iso > latest) latest = iso;
  }
  return latest;
}

/**
 * GET /api/platform/ai/run-analytics?run_id=XXX[&ai=1]
 *
 * Always: quantitative KPIs and question-by-question distributions — a fast read.
 * With `ai=1`: additionally asks the model for the executive synthesis, which is
 * slow and billed, so it is opt-in per request.
 */
export async function GET(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("run_id");
    const slug = searchParams.get("slug");

    if (!runId && !slug) {
      return NextResponse.json({ success: false, error: "run_id or slug is required" }, { status: 400 });
    }

    // Resolve run
    let targetRunId = runId;
    let runRecord = null;
    if (slug) {
      const r = await getRunRecordByPublicSlug(slug);
      runRecord = r.rows[0];
      targetRunId = runRecord?.id;
    } else {
      const r = await getRunRecordById(runId);
      runRecord = r.rows[0];
    }

    if (!targetRunId || !runRecord) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }

    // Get submissions for this run
    const subRes = await getSubmissionsByRunId(targetRunId);
    const submissions = (subRes.rows || []).filter((s) => s.status !== "draft");

    // Get form fields
    const fieldsRes = await getFormFieldsByFormId(runRecord.form_id);
    const fields = fieldsRes.rows || [];

    if (submissions.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalSubmissions: 0,
          uniqueVentures: 0,
          completionRate: 0,
        },
        aiSummary: "No completed submissions recorded yet for this run.",
        questionAnalytics: [],
      });
    }

    // ── Statistical Aggregations ──
    const totalCount = submissions.length;
    const ventureNames = new Set();
    const dataList = submissions.map((s) => {
      let d = s.data;
      if (typeof d === "string") {
        try { d = JSON.parse(d); } catch (_) { d = {}; }
      }
      return d || {};
    });

    dataList.forEach((d) => {
      const name = d["Startup Name"] || d.startup_name || d["Company Name"] || d.venture_id;
      if (name) ventureNames.add(name);
    });

    // Compute field value distributions
    const questionAnalytics = fields.map((f) => {
      const fId = String(f.id);
      const label = f.label || `Question ${f.id}`;
      const values = [];

      dataList.forEach((d) => {
        const val = d[fId] ?? d[label] ?? d[label.toLowerCase()];
        if (val !== undefined && val !== null && val !== "") {
          values.push(val);
        }
      });

      // Frequency map for choices / options
      const frequencies = {};
      let numericSum = 0;
      let numericCount = 0;

      values.forEach((v) => {
        const strVal = String(v).trim();
        frequencies[strVal] = (frequencies[strVal] || 0) + 1;
        const num = parseFloat(strVal.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(num)) {
          numericSum += num;
          numericCount++;
        }
      });

      return {
        field_id: f.id,
        label,
        type: f.field_type,
        answeredCount: values.length,
        frequencies,
        average: numericCount > 0 ? (numericSum / numericCount).toFixed(1) : null,
        sampleValues: values.slice(0, 5),
      };
    });

    // ── AI Executive Synthesis via DeepSeek / Model ──
    // OPT-IN ONLY (`ai=1`). The numbers are deterministic and must never wait on
    // a model call: the screen asks for the synthesis on a button, not on every
    // mount. Without the flag this route is a fast, cheap aggregation.
    let aiSynthesis = null;
    if (searchParams.get("ai") === "1") {
      // A stored synthesis is reused while this run's fingerprint is unchanged:
      // same number of responses, same newest response. Otherwise it is stale.
      const latestSubmissionAt = latestSubmissionIso(submissions);
      try {
        await ensureRunAnalyticsTable();
        const stored = await selectRunAnalytics(targetRunId);
        const row = stored?.rows?.[0];
        if (
          row &&
          Number(row.submissions_count) === totalCount &&
          String(row.latest_submission_at || "") === String(latestSubmissionAt || "")
        ) {
          aiSynthesis = row.payload;
        }
      } catch (cacheError) {
        console.warn("[Run Analytics] cache read failed:", cacheError.message);
      }

      if (!aiSynthesis) {
      try {
        const compactQuestions = questionAnalytics
          .filter((q) => q.answeredCount > 0)
          .map((q) => {
            const topFreq = Object.entries(q.frequencies)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([opt, cnt]) => `${opt}: ${cnt} (${Math.round((cnt / q.answeredCount) * 100)}%)`)
              .join(", ");
            return `- ${q.label}: ${topFreq || q.sampleValues.join("; ")}`;
          })
          .join("\n");

        const prompt = `You are the Chief Investment & Impact Officer at Future Studio (ImpactOS).
Analyze the following aggregate survey/census responses from our portfolio startups.
Total Submissions: ${totalCount} startups.

Run Name: "${runRecord.name}"

Aggregated Question Results:
${compactQuestions}

Provide a high-level, executive portfolio analysis in valid JSON format ONLY:
{
  "executiveSummary": "A concise, 3-paragraph executive overview covering (1) portfolio distribution & demographics, (2) traction/revenue & job creation, (3) strategic strengths, bottlenecks, and recommendations for Future Studio leadership.",
  "topMetrics": [
    {"label": "Key Insight 1", "value": "e.g. 72% Youth Founders", "sub": "under 35 years old"},
    {"label": "Key Insight 2", "value": "e.g. 14 New Jobs Created", "sub": "across cohort"},
    {"label": "Key Insight 3", "value": "e.g. $45,000+ Total Raised", "sub": "grants & equity"}
  ],
  "questionHighlights": [
    {"question": "Question label", "takeaway": "1-sentence executive takeaway for leadership"}
  ]
}

Return ONLY raw JSON, with no markdown code fences.`;

        const aiResponse = await deepseekIntelligence.chat(prompt);
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiSynthesis = JSON.parse(jsonMatch[0]);
        }
        // Store it so the next reader (this admin, another admin, a later visit)
        // gets the brief without paying for another model call.
        if (aiSynthesis) {
          await upsertRunAnalytics({
            runId: targetRunId,
            submissionsCount: totalCount,
            latestSubmissionAt,
            payload: aiSynthesis,
          }).catch((cacheError) => console.warn("[Run Analytics] cache write failed:", cacheError.message));
        }
      } catch (aiErr) {
        console.warn("[Run Analytics AI] Chat failed:", aiErr.message);
      }
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalSubmissions: totalCount,
        uniqueVentures: ventureNames.size || totalCount,
        completionRate: 100,
      },
      aiSynthesis,
      questionAnalytics,
    });
  } catch (err) {
    console.error("[Run Analytics] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
