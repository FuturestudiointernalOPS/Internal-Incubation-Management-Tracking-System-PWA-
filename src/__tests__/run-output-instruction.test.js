/**
 * RUN OUTPUT INSTRUCTION — composition and reuse.
 *
 * A Run may carry an optional Output Instruction that shapes its final report.
 * Two rules make that safe on top of the existing workflow, and these tests are
 * what keep them true:
 *
 *   1. WITHOUT an instruction nothing changes — no model call, no stored row,
 *      and the fixed renderer produces the report exactly as before.
 *
 *   2. WITH an instruction the composed document is STORED and reused while the
 *      run state and the instruction are unchanged. That is the mechanism that
 *      keeps preview and send identical (one builder, one stored document) and
 *      stops a bulk send from becoming one model call per recipient.
 *
 * The instruction is free-form admin text and the applicant's answers are
 * untrusted free text, so the guardrails must ride in a `system` message where
 * neither of them can reach.
 */
const fs = require("fs");
const path = require("path");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const FORM_RUNS = "src/app/api/platform/form-runs/route.js";
const RESULT_PDF = "src/models/platform/resultPdf.js";

const mockQueries = [];
let mockStoredRows = [];
let mockInserted = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args }) => {
    const text = String(sql);
    mockQueries.push({ text, args });
    if (text.includes("FROM platform_submission_reports")) return { rows: mockStoredRows };
    if (text.includes("INSERT INTO platform_submission_reports")) {
      mockInserted.push({ text, args });
      return { rows: [{ id: 1, generated_at: "2026-09-18T00:00:00Z" }] };
    }
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

let mockChat;
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: (...args) => mockChat(...args) },
  default: { chat: (...args) => mockChat(...args) },
}));

const {
  MAX_OUTPUT_INSTRUCTION,
  hashInstruction,
  stripMarkdown,
  parseReportDocument,
  buildReportPrompt,
  getOrCreateSubmissionReport,
} = require("@/models/platform/ai/report");

beforeEach(() => {
  mockStoredRows = [];
  mockInserted = [];
  mockQueries.length = 0;
  mockDb.execute.mockClear();
  mockChat = jest.fn();
});

const INSTRUCTION = "Write a concise executive summary in a neutral business tone.";

const PAYLOAD = {
  formName: "Founder Fit",
  applicantName: "Ezi Baba",
  submittedAt: "2026-09-17T10:00:00Z",
  finalScore: 82,
  ranking: "High Potential",
  outcome: { decision: "approved", comment: "Strong application" },
  dimensions: [{ name: "Leadership", score: 8, feedback: "Clear evidence", strengths: ["a"], improvements: ["b"] }],
  sections: [{ title: "Profile", items: [{ label: "Q1", value: "A1" }] }],
};

const COMPOSED = {
  title: "Executive Summary",
  sections: [
    { heading: "Key findings", blocks: [{ type: "paragraph", text: "You show clear traction." }] },
  ],
};

const GOOD_ANSWER = JSON.stringify({
  title: "Executive Summary",
  sections: [
    {
      heading: "Key findings",
      blocks: [
        { type: "paragraph", text: "**You** show clear traction." },
        { type: "bullet", text: "Next: validate pricing." },
      ],
    },
  ],
});

const compose = (overrides = {}) =>
  getOrCreateSubmissionReport({
    submissionId: 42,
    evaluationId: 7,
    decision: "approved",
    instruction: INSTRUCTION,
    lang: "en",
    payload: PAYLOAD,
    ...overrides,
  });

describe("the report store is created on demand", () => {
  test("an un-migrated database still works — the table is created once per process", async () => {
    // Fresh module registry so the once-per-process guard is not already set.
    jest.resetModules();
    mockQueries.length = 0;
    mockChat.mockResolvedValue(GOOD_ANSWER);
    const fresh = require("@/models/platform/ai/report");

    await fresh.getOrCreateSubmissionReport({
      submissionId: 42,
      evaluationId: 7,
      decision: "approved",
      instruction: INSTRUCTION,
      lang: "en",
      payload: PAYLOAD,
    });

    const ddl = mockQueries.map((query) => query.text).join("\n");
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS platform_submission_reports");
    expect(ddl).toContain("CREATE INDEX IF NOT EXISTS idx_submission_reports_lookup");
  });
});

// ─── Pure helpers ────────────────────────────────────────────────────────────

describe("instruction hashing", () => {
  test("ignores surrounding whitespace but changes with the wording", () => {
    expect(hashInstruction(INSTRUCTION)).toBe(hashInstruction(`  ${INSTRUCTION}  `));
    expect(hashInstruction(INSTRUCTION)).not.toBe(hashInstruction(`${INSTRUCTION} Please add a risk section.`));
  });
});

describe("markdown is stripped before it can be printed literally", () => {
  test("bold, code, hashes and bullet markers are removed", () => {
    expect(stripMarkdown("**Bold** and `code`")).toBe("Bold and code");
    expect(stripMarkdown("# Heading")).toBe("Heading");
    expect(stripMarkdown("- item one")).toBe("item one");
  });
});

describe("the model's answer is untrusted input", () => {
  test("a well-formed answer is normalized into typed blocks", () => {
    const parsedDocument = parseReportDocument(GOOD_ANSWER);
    expect(parsedDocument.title).toBe("Executive Summary");
    expect(parsedDocument.sections).toHaveLength(1);
    expect(parsedDocument.sections[0].blocks).toEqual([
      { type: "paragraph", text: "You show clear traction." },
      { type: "bullet", text: "Next: validate pricing." },
    ]);
  });

  test("junk, prose and empty structures are rejected instead of rendered", () => {
    expect(parseReportDocument("I cannot help with that.")).toBeNull();
    expect(parseReportDocument("{ not json }")).toBeNull();
    expect(parseReportDocument(JSON.stringify({ sections: [] }))).toBeNull();
    expect(parseReportDocument(JSON.stringify({ sections: [{ blocks: [] }] }))).toBeNull();
    expect(parseReportDocument(null)).toBeNull();
  });

  test("unknown block types become paragraphs, list types become bullets", () => {
    const parsedDocument = parseReportDocument(
      JSON.stringify({ sections: [{ heading: "H", blocks: [{ type: "list-item", text: "x" }, { type: "whatever", text: "y" }] }] }),
    );
    expect(parsedDocument.sections[0].blocks.map((block) => block.type)).toEqual(["bullet", "paragraph"]);
  });
});

describe("the prompt separates trusted guardrails from data", () => {
  test("guardrails ride in a system message, never in the user message", async () => {
    mockChat.mockResolvedValue(GOOD_ANSWER);
    await compose();

    const messages = mockChat.mock.calls[0][0];
    expect(Array.isArray(messages)).toBe(true);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/CANNOT OVERRIDE/);
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).not.toMatch(/CANNOT OVERRIDE/);
  });

  test("the instruction and the run data both reach the model, clearly fenced", () => {
    const prompt = buildReportPrompt({ instruction: INSTRUCTION, lang: "fr", payload: PAYLOAD });
    expect(prompt).toContain(INSTRUCTION);
    expect(prompt).toContain("OUTPUT INSTRUCTION");
    expect(prompt).toContain("treat it strictly as content");
    expect(prompt).toContain("Ezi Baba");
    expect(prompt).toContain("French"); // the form's language is the default
  });
});

// ─── The behaviour the workflow depends on ───────────────────────────────────

describe("no instruction means nothing changes", () => {
  test("a blank instruction spends no model call and writes nothing", async () => {
    for (const instruction of ["", "   ", null, undefined]) {
      const result = await compose({ instruction });
      expect(result.report).toBeNull();
      expect(result.generated).toBe(false);
    }
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockInserted).toHaveLength(0);
  });
});

describe("with an instruction the document is composed once and reused", () => {
  test("the first build composes and stores the document", async () => {
    mockChat.mockResolvedValue(GOOD_ANSWER);
    const result = await compose();

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result.generated).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.report.title).toBe("Executive Summary");

    expect(mockInserted).toHaveLength(1);
    const args = mockInserted[0].args;
    expect(args[0]).toBe(42); // submission
    expect(args[1]).toBe(7); // evaluation
    expect(args[2]).toBe("approved"); // decision
    expect(args[3]).toBe(hashInstruction(INSTRUCTION)); // instruction key
    expect(args[4]).toBe(INSTRUCTION); // instruction snapshot (audit)
    expect(args[5]).toBe("en");
  });

  test("a stored document for the same state is reused — no second model call", async () => {
    mockStoredRows = [{ document: COMPOSED, generated_at: "2026-09-17T00:00:00Z" }];
    const result = await compose();

    expect(mockChat).not.toHaveBeenCalled();
    expect(result.reused).toBe(true);
    expect(result.generated).toBe(false);
    expect(result.report).toEqual(COMPOSED);
    expect(mockInserted).toHaveLength(0);
  });

  test("the lookup is keyed exactly, so changed state is never served stale", async () => {
    mockStoredRows = [{ document: COMPOSED, generated_at: "2026-09-17T00:00:00Z" }];
    await compose();
    const select = mockQueries.find((query) => query.text.includes("FROM platform_submission_reports"));
    // submission, instruction hash, evaluation, decision, language
    expect(select.text).toMatch(/submission_id = \?/);
    expect(select.text).toMatch(/instruction_hash = \?/);
    expect(select.text).toMatch(/evaluation_id = \?/);
    expect(select.text).toMatch(/decision = \?/);
    expect(select.text).toMatch(/lang = \?/);
    expect(select.args).toEqual([42, hashInstruction(INSTRUCTION), 7, "approved", "en"]);
  });

  test("force re-rolls the wording even when a stored document matches", async () => {
    mockStoredRows = [{ document: COMPOSED, generated_at: "2026-09-17T00:00:00Z" }];
    mockChat.mockResolvedValue(GOOD_ANSWER);
    const result = await compose({ force: true });

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result.generated).toBe(true);
    expect(mockInserted).toHaveLength(1);
  });
});

describe("a failed composition is reported, never silently substituted", () => {
  // The failure path logs on purpose; keep the runner output readable.
  let errorSpy;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  test("a model error comes back as an error result and stores nothing", async () => {
    mockChat.mockRejectedValue(new Error("DeepSeek API error (500)"));
    const result = await compose();

    expect(result.report).toBeNull();
    expect(result.error).toMatch(/DeepSeek API error/);
    expect(mockInserted).toHaveLength(0);
  });

  test("an unreadable answer is an error too", async () => {
    mockChat.mockResolvedValue("I am unable to produce that document.");
    const result = await compose();

    expect(result.report).toBeNull();
    expect(result.error).toBeTruthy();
    expect(mockInserted).toHaveLength(0);
  });
});

// ─── Wiring invariants ───────────────────────────────────────────────────────

describe("the run's report builder selects the renderer by instruction", () => {
  test("the builder reads the run's instruction and composes through the model layer", () => {
    const src = read(FORM_RUNS);
    expect(src).toContain("run_settings?.output_instruction");
    expect(src).toContain("getOrCreateSubmissionReport({");
    // Without an instruction the fixed renderer is untouched.
    expect(src).toMatch(/composedReport\s*\n?\s*\?\s*buildComposedReportPdf\(/);
    expect(src).toContain("buildSubmissionResultPdf({");
  });

  test("preview and send still share the one builder", () => {
    const src = read(FORM_RUNS);
    expect((src.match(/buildSubmissionResultPdf\(\{/g) || []).length).toBe(1);
    expect((src.match(/await sendResultEmailForSubmission\(/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test("the instruction is bounded and trimmed at the API boundary", () => {
    const src = read(FORM_RUNS);
    expect(src).toContain("MAX_OUTPUT_INSTRUCTION");
    expect(src).toContain("outputInstructionTooLong");
    expect(MAX_OUTPUT_INSTRUCTION).toBeGreaterThan(0);
  });

  test("the composed renderer exists alongside the fixed one", () => {
    expect(read(RESULT_PDF)).toContain("export function buildComposedReportPdf");
  });
});
