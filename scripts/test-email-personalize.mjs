/**
 * Structure-preservation tests for AI email template personalization.
 *
 * Run: node scripts/test-email-personalize.mjs
 *
 * Covers the acceptance tests A–H on the deterministic layer
 * (src/lib/platform/ai/email-personalize.js). The AI wording itself is
 * non-deterministic; these tests prove that no matter what the AI returns,
 * the original structure, links, formatting, and placeholders survive.
 */

import {
  tagSkeleton,
  splitHtmlParts,
  splicePersonalizedSegments,
  ensureSegmentPlaceholders,
  stripUnknownPlaceholders,
  validateStructure,
  validateSubject,
  finalizeSubject,
} from "../src/lib/platform/ai/email-personalize.js";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// Simulate "AI returns different wording for each text segment".
function simulateAi(parts, rewordFn) {
  const segments = parts
    .filter((p) => p.type === "text" && p.value.trim().length > 0)
    .map((p) => rewordFn(p.value));
  return splicePersonalizedSegments(parts, segments);
}

const reword = (s) => `[AI] ${s.trim()} personalized. `;

console.log("\nTEST A — Paragraphs remain separate");
{
  const draft = "<p>Dear {{name}},</p>\n\n<p>You have been selected.</p>\n\n<p>Regards, Future Studio</p>";
  const out = simulateAi(splitHtmlParts(draft), reword);
  check("skeleton preserved", tagSkeleton(out) === tagSkeleton(draft), tagSkeleton(out));
  check("3 paragraphs kept", (out.match(/<p>/g) || []).length === 3);
  check("paragraph gap kept", out.includes("</p>\n\n<p>"));
}

console.log("\nTEST B — Numbered list remains numbered");
{
  const draft = "<p>Next steps:</p><ol><li>1. Complete your profile</li><li>2. Join the group</li><li>3. Attend orientation</li></ol>";
  const out = simulateAi(splitHtmlParts(draft), reword);
  check("skeleton preserved", tagSkeleton(out) === tagSkeleton(draft));
  check("still <ol><li> structure", out.includes("<ol><li>") && (out.match(/<li>/g) || []).length === 3);
  check("numbers kept", out.includes("1.") && out.includes("2.") && out.includes("3."));
}

console.log("\nTEST C — Bullet list remains bullets");
{
  const draft = "<p>Bring:</p><ul><li>• ID card</li><li>• Notebook</li></ul>";
  const out = simulateAi(splitHtmlParts(draft), reword);
  check("skeleton preserved", tagSkeleton(out) === tagSkeleton(draft));
  check("still <ul><li> structure", out.includes("<ul><li>") && (out.match(/<li>/g) || []).length === 2);
  check("bullets kept", (out.match(/•/g) || []).length === 2);
}

console.log("\nTEST D — Heading + paragraphs + list hierarchy");
{
  const draft = "<h2>Congratulations</h2><p>Dear {{name}},</p><p>We are pleased to inform you that you have been selected.</p><ol><li>1. Step one</li><li>2. Step two</li></ol><p>Regards, Future Studio</p>";
  const out = simulateAi(splitHtmlParts(draft), reword);
  check("skeleton preserved", tagSkeleton(out) === tagSkeleton(draft), tagSkeleton(out));
  check("h2 kept", out.includes("<h2>"));
  check("ol+li kept", out.includes("<ol><li>"));
}

console.log("\nTEST E — Links unchanged");
{
  const draft = '<p>Join us <a href="https://futurestudio.bj/onboard">here</a> today.</p>';
  const out = simulateAi(splitHtmlParts(draft), reword);
  check("href preserved verbatim", out.includes('href="https://futurestudio.bj/onboard"'));
  check("skeleton preserved", tagSkeleton(out) === tagSkeleton(draft));
}

console.log("\nTEST F — Bold/italic formatting kept");
{
  const draft = "<p><strong>Important:</strong> bring your <em>ID</em>.</p>";
  const out = simulateAi(splitHtmlParts(draft), reword);
  check("strong kept", out.includes("<strong>") && out.includes("</strong>"));
  check("em kept", out.includes("<em>") && out.includes("</em>"));
  check("skeleton preserved", tagSkeleton(out) === tagSkeleton(draft));
}

console.log("\nTEST G — Placeholder variables survive");
{
  const draft = "<p>Dear {{name}}, your score is {{score}}.</p>";
  const parts = splitHtmlParts(draft);

  // G1: AI drops a placeholder → restored deterministically (mirrors the
  // route's Tier-2 pipeline: restore → strip unknown → splice)
  const originals = parts.filter((p) => p.type === "text" && p.value.trim().length > 0).map((p) => p.value);
  const aiOutput = ["Dear friend, your score is great."];
  const cleaned = originals.map((original, i) =>
    stripUnknownPlaceholders(ensureSegmentPlaceholders(original, aiOutput[i]), new Set(["name", "score"]))
  );
  const dropped = splicePersonalizedSegments(parts, cleaned);
  check("dropped placeholder restored", dropped.includes("{{name}}") && dropped.includes("{{score}}"));

  // G2: AI invents an incompatible variable → stripped
  const invented = "<p>Dear {{name}} {{first_name}}, score {{score}}.</p>";
  const stripped = stripUnknownPlaceholders(invented, new Set(["name", "score"]));
  check("invented variable stripped", !stripped.includes("{{first_name}}") && stripped.includes("{{name}}"));

  // G3: structural validator rejects unknown variables
  const v1 = validateStructure(draft, invented, new Set(["name", "score"]));
  check("validator rejects unknown placeholder", v1.ok === false && v1.reason.includes("unknown_placeholder"));

  // G4: validator rejects missing placeholder
  const v2 = validateStructure(draft, "<p>Dear friend, your score is {{score}}.</p>", new Set(["name", "score"]));
  check("validator rejects missing placeholder", v2.ok === false && v2.reason.includes("missing_placeholder"));

  // G5: validator rejects changed structure
  const v3 = validateStructure(draft, "<p>Dear {{name}}, your score is {{score}}.</p><p>extra</p>", new Set(["name", "score"]));
  check("validator rejects structure change", v3.ok === false && v3.reason === "structure_changed");

  // G6: valid personalization passes
  const v4 = validateStructure(draft, "<p>Dear {{name}}, your AI score is {{score}}.</p>", new Set(["name", "score"]));
  check("validator accepts valid personalization", v4.ok === true);

  // G7: ensureSegmentPlaceholders idempotent on good segments
  const kept = ensureSegmentPlaceholders("Dear {{name}}", "Dear friend");
  check("ensureSegmentPlaceholders restores", kept.includes("{{name}}"));
}

console.log("\nTEST H — Empty subject follows the default-subject contract");
{
  check("empty draft stays empty", finalizeSubject("", "AI invented subject") === "");
  check("provided subject can be personalized", finalizeSubject("Welcome {{name}}", "Bonjour {{name}}") === "Bonjour {{name}}");
  check("invalid personalized subject falls back to draft", finalizeSubject("Welcome {{name}}", null) === "Welcome {{name}}");

  const ok = validateSubject("Welcome {{name}}", "Bonjour {{name}}", new Set(["name"]));
  check("subject validator accepts valid", ok.ok === true);
  const bad = validateSubject("Welcome {{name}}", "Bonjour", new Set(["name"]));
  check("subject validator rejects missing placeholder", bad.ok === false);
  // At send time the empty subject resolves via email.js getTemplate:
  // run.settings.templates → form.automation.templates → DEFAULT_TEMPLATES.
}

console.log("\nTEST — Spliced result always matches the original skeleton");
{
  const draft = "<p>A</p>\n\n<ul><li>• x</li></ul><p>B <strong>C</strong> <a href=\"https://x.y\">link</a>.</p>";
  const parts = splitHtmlParts(draft);
  const out = splicePersonalizedSegments(parts, parts.filter((p) => p.type === "text" && p.value.trim()).map(() => "reworded"));
  check("skeleton identical by construction", tagSkeleton(out) === tagSkeleton(draft));
  check("whitespace gaps preserved", out.includes("</p>\n\n<ul>"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
