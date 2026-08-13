/**
 * Activation recipient-email resolution tests.
 * Run: node scripts/test-activation-email.mjs
 *
 * Verifies the priority contract:
 *   existing valid contact email → valid submission email → null (cannot proceed)
 * and that placeholder/import-fallback addresses are never treated as recipients.
 */

import { isPlaceholderEmail, resolveRecipientEmail } from "../src/lib/email.js";

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

console.log("\nPlaceholder detection");
check("import placeholder rejected", isPlaceholderEmail("import-user123@placeholder.impactos.local"));
check("any @placeholder rejected", isPlaceholderEmail("x@placeholder.example.com"));
check(".local rejected", isPlaceholderEmail("x@futurestudio.local"));
check("example.com rejected", isPlaceholderEmail("x@example.com"));
check("missing @ rejected", isPlaceholderEmail("not-an-email"));
check("real address accepted", !isPlaceholderEmail("john@email.com"));

console.log("\nResolution priority");
check(
  "valid contact email wins",
  resolveRecipientEmail({ contactEmail: "John@Email.COM", submissionData: { email: "other@x.com" } }) === "john@email.com"
);
check(
  "placeholder contact email falls back to submission email",
  resolveRecipientEmail({ contactEmail: "import-x@placeholder.impactos.local", submissionData: { email: "real@x.com", other: "text" } }) === "real@x.com"
);
check(
  "missing contact email uses submission email",
  resolveRecipientEmail({ contactEmail: null, submissionData: { "Email": "mary@x.com" } }) === "mary@x.com"
);
check(
  "placeholder in submission skipped for real one",
  resolveRecipientEmail({ contactEmail: null, submissionData: { a: "import-x@placeholder.impactos.local", b: "good@x.com" } }) === "good@x.com"
);
check(
  "no usable email → null",
  resolveRecipientEmail({ contactEmail: "import-x@placeholder.impactos.local", submissionData: { a: "import-y@placeholder.impactos.local" } }) === null
);
check(
  "empty everything → null",
  resolveRecipientEmail({ contactEmail: null, submissionData: {} }) === null
);
check(
  "phone objects are ignored",
  resolveRecipientEmail({ contactEmail: null, submissionData: { phone: '{"code":"+229","number":"123"}' } }) === null
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
