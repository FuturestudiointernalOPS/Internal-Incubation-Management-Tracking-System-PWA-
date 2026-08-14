/**
 * Activation recipient-email resolution tests.
 * Run: node scripts/test-activation-email.mjs
 *
 * Verifies the priority contract:
 *   existing valid contact email → valid submission email → null (cannot proceed)
 * and that placeholder/import-fallback addresses are never treated as recipients.
 */

import { isPlaceholderEmail, resolveRecipientEmail, resolvePersonName, decideEmailKind } from "../src/lib/email.js";

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

console.log("\nAccount-state email decision");
check("no account → create_activate", decideEmailKind({ accountExists: false, accountActivated: false }) === "create_activate");
check("exists + not activated → activate_existing", decideEmailKind({ accountExists: true, accountActivated: false }) === "activate_existing");
check("exists + activated → login_existing", decideEmailKind({ accountExists: true, accountActivated: true }) === "login_existing");

console.log("\nName resolution — never Unknown when a real name exists");
check(
  "CRM full name wins",
  resolvePersonName({ contactName: "Godwin Okafor", submitterName: "G O", submissionData: { "Full Name": "Mary" } }) === "Godwin Okafor"
);
check(
  "submitter name used when CRM empty",
  resolvePersonName({ contactName: "", submitterName: "Mary Johnson", submissionData: {} }) === "Mary Johnson"
);
check(
  "full name from form used when others empty",
  resolvePersonName({ contactName: "", submitterName: "", submissionData: { "Full Name": "Mary Johnson", email: "m@x.com" } }) === "Mary Johnson"
);
check(
  "first+last combined from separate fields",
  resolvePersonName({ contactName: "", submitterName: "", submissionData: { first_name: "Godwin", last_name: "Okafor" } }) === "Godwin Okafor"
);
check(
  "first name only",
  resolvePersonName({ contactName: "", submitterName: "", submissionData: { first_name: "Godwin" } }) === "Godwin"
);
check(
  "case 5: CRM empty name + form name used",
  resolvePersonName({ contactName: "Unknown", submitterName: "", submissionData: { "Nom et prénom": "Awa Bio" } }) === "Awa Bio"
);
check(
  "placeholder values skipped",
  resolvePersonName({ contactName: "Unknown", submitterName: "Anonymous", submissionData: {} }) === ""
);
check(
  "nothing anywhere → empty (caller uses neutral fallback)",
  resolvePersonName({ contactName: "", submitterName: "", submissionData: { email: "x@y.com" } }) === ""
);
check(
  "email values are not names",
  resolvePersonName({ contactName: "", submitterName: "", submissionData: { email: "x@y.com" } }) !== "x@y.com"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
