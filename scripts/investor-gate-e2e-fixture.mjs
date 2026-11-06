/**
 * Staging E2E fixture: synthetic investor → live deal flow → intro → workspace
 * → meeting → investment confirmation. Marks is_test=true. Uses .env.local only.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envName = ".env.local";
let databaseUrl = null;
for (const line of readFileSync(path.join(root, envName), "utf8").split(/\r?\n/)) {
  const match = line.match(/^DATABASE_URL=(.*)$/);
  if (match) {
    databaseUrl = match[1].trim().replace(/^["']|["']$/g, "");
    break;
  }
}
if (!databaseUrl) throw new Error("Missing DATABASE_URL");

const TAG = `GATE-E2E-${new Date().toISOString().slice(0, 10)}`;
const cid = `gate-e2e-${Date.now()}`;
const email = `${cid}@sandbox.local`;
const ventureCode = `VNT-GATE-${Date.now().toString(36).toUpperCase()}`;

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
const manifest = { tag: TAG, started_at: new Date().toISOString(), steps: [] };

async function step(name, fn) {
  try {
    const result = await fn();
    manifest.steps.push({ name, ok: true, result });
    console.log("OK", name, result && typeof result === "object" ? JSON.stringify(result) : "");
    return result;
  } catch (error) {
    manifest.steps.push({ name, ok: false, error: String(error.message || error) });
    console.error("FAIL", name, error.message || error);
    throw error;
  }
}

try {
  await step("create_contact", async () => {
    // Fixture identity only — no password material written (login not required for data-path E2E).
    await client.query(
      `INSERT INTO contacts (cid, name, email, role, language, email_verified)
       VALUES ($1, $2, $3, 'member', 'en', true)`,
      [cid, "Gate E2E Investor", email],
    );
    return { cid, email };
  });

  const profileId = await step("create_investor_profile", async () => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO investor_profiles
         (id, user_id, approval_status, organization_name, visibility_mode, is_test, approved_at, source)
       VALUES ($1, $2, 'approved', $3, 'deal_flow_only', true, NOW(), 'gate_e2e')`,
      [id, cid, `${TAG} Capital`],
    );
    return { profileId: id };
  });

  const venture = await step("create_venture", async () => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO ventures (id, venture_id, name, company_name, industry, country, business_stage, status, description, created_at, updated_at)
       VALUES ($1, $2, $3, $3, 'Fintech', 'BJ', 'Validation', 'active', 'Synthetic gate venture — not real.', NOW(), NOW())`,
      [id, ventureCode, "DEMO Gate Venture"],
    );
    return { ventureUuid: id, ventureCode };
  });

  const deal = await step("create_live_deal_flow", async () => {
    const entry = await client.query(
      `INSERT INTO deal_flow_entries (venture_id, status, target_amount, currency, instrument, use_of_funds, opened_at, opened_by, created_at, updated_at)
       VALUES ($1, 'live', 25000000, 'XOF', 'equity', 'Synthetic raise for gate E2E', NOW(), $2, NOW(), NOW())
       RETURNING id`,
      [venture.ventureCode, cid],
    );
    const entryId = entry.rows[0].id;
    await client.query(
      `INSERT INTO deal_flow_decks
         (deal_flow_entry_id, file_ref, file_name, mime_type, version, status, download_allowed, uploaded_by, uploaded_at, published_at)
       VALUES ($1, $2, 'gate-deck.pdf', 'application/pdf', 1, 'published', false, $3, NOW(), NOW())`,
      [entryId, `deal-flow/gate/${entryId}.pdf`, cid],
    );
    return { dealFlowEntryId: entryId };
  });

  const pipeline = await step("pipeline_interested", async () => {
    // investment_pipeline.venture_id is UUID on staging
    const row = await client.query(
      `INSERT INTO investment_pipeline (id, investor_id, venture_id, stage, notes, stage_changed_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'interested', $4, NOW(), NOW(), NOW())
       ON CONFLICT (investor_id, venture_id) DO UPDATE
         SET stage = 'interested', updated_at = NOW()
       RETURNING id`,
      [randomUUID(), profileId.profileId, venture.ventureUuid, TAG],
    );
    return { pipelineId: row.rows[0].id };
  });

  const intro = await step("introduction_approved", async () => {
    const row = await client.query(
      `INSERT INTO investor_introduction_requests
         (investor_profile_id, venture_id, deal_flow_entry_id, pipeline_id, message, status, requested_at, decided_at, decided_by)
       VALUES ($1, $2, $3, $4, $5, 'approved', NOW(), NOW(), $6)
       RETURNING id`,
      [
        profileId.profileId,
        venture.ventureCode,
        deal.dealFlowEntryId,
        pipeline.pipelineId,
        "Synthetic introduction for gate E2E",
        cid,
      ],
    );
    return { introductionId: row.rows[0].id };
  });

  const workspace = await step("workspace", async () => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO relationship_workspaces
         (id, pipeline_id, investor_id, venture_id, status, current_stage, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', 'introduction', NOW(), NOW())`,
      [id, pipeline.pipelineId, profileId.profileId, venture.ventureUuid],
    );
    await client.query(
      `UPDATE investor_introduction_requests SET workspace_id = $1 WHERE id = $2`,
      [id, intro.introductionId],
    );
    return { workspaceId: id };
  });

  const meeting = await step("meeting_confirmed", async () => {
    const start = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    const row = await client.query(
      `INSERT INTO relationship_meetings
         (workspace_id, meeting_type, scheduled_date, scheduled_time, start_at, duration_minutes, timezone, location, video_link, status)
       VALUES ($1, 'introductory', $2, $3, $4, 30, 'Africa/Porto-Novo', 'video', 'https://meet.example.invalid/gate-e2e', 'confirmed')
       RETURNING id`,
      [
        workspace.workspaceId,
        start.toISOString().slice(0, 10),
        start.toISOString().slice(11, 19),
        start.toISOString(),
      ],
    );
    return { meetingId: row.rows[0].id, start_at: start.toISOString() };
  });

  const investment = await step("investment_confirmed", async () => {
    const row = await client.query(
      `INSERT INTO investor_investment_records
         (investor_profile_id, pipeline_id, venture_id, amount, currency, instrument, invested_on, confirmation_status, recorded_by)
       VALUES ($1, $2, $3, 5000000, 'XOF', 'equity', CURRENT_DATE, 'confirmed', $4)
       ON CONFLICT (pipeline_id) DO UPDATE
         SET amount = EXCLUDED.amount, confirmation_status = 'confirmed', updated_at = NOW()
       RETURNING id`,
      [profileId.profileId, pipeline.pipelineId, venture.ventureCode, cid],
    );
    await client.query(
      `UPDATE investment_pipeline SET stage = 'invested', stage_changed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [pipeline.pipelineId],
    );
    return { investmentId: row.rows[0].id };
  });

  manifest.ok = true;
  manifest.ids = {
    cid,
    email,
    ...profileId,
    ...venture,
    ...deal,
    ...pipeline,
    ...intro,
    ...workspace,
    ...meeting,
    ...investment,
  };
} catch (error) {
  manifest.ok = false;
  manifest.fatal = String(error.message || error);
} finally {
  await client.end();
  const evidenceDir = path.join(root, "docs/investor-platform/evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const out = path.join(evidenceDir, "E2E_MANIFEST.json");
  writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log("Wrote", out, "ok=", manifest.ok);
  process.exit(manifest.ok ? 0 : 1);
}
