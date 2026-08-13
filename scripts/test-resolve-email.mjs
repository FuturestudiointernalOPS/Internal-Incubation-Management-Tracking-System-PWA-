// Standalone verification of resolveSubmissionEmail (code copied verbatim from
// src/lib/email.js — the module cannot be imported directly in Node because of
// the Next.js "@/..." path alias).

function isPlaceholderEmail(email) {
  if (!email || typeof email !== "string") return true;
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return true;
  if (e.includes("placeholder")) return true;
  if (e.includes("@example.") || e.includes("@test.") || e.endsWith(".local") || e.endsWith(".invalid")) return true;
  if (e.startsWith("import-")) return true;
  return false;
}

function resolveSubmissionEmail({ submissionData, fieldLabels, contactEmail }) {
  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const labelOf = (k) => {
    const raw =
      fieldLabels && fieldLabels[String(k)] != null
        ? String(fieldLabels[String(k)])
        : String(k);
    return raw.toLowerCase().trim();
  };
  const isReal = (v) =>
    typeof v === "string" && v.includes("@") && !isPlaceholderEmail(v);
  const EMAIL_HINTS = /(e-?mail|courriel|mel|adresse\s*(e-?mail|mail))/i;

  const labeled = [];
  const anyReal = [];
  for (const [k, v] of Object.entries(data)) {
    const val = typeof v === "string" ? v.trim() : "";
    if (!isReal(val)) continue;
    if (EMAIL_HINTS.test(labelOf(k))) labeled.push(val);
    else anyReal.push(val);
  }
  if (labeled.length > 0) return labeled[0].toLowerCase();
  if (anyReal.length > 0) return anyReal[0].toLowerCase();
  if (isReal(contactEmail)) return String(contactEmail).trim().toLowerCase();
  return "";
}

const cases = [
  {
    label: "THE BUG: imported row — placeholder contact email must NOT win",
    input: {
      submissionData: { "10": "applicant@gmail.com" },
      fieldLabels: { "10": "Email Address" },
      contactEmail: "import-user_cf060b6c2752@placeholder.impactos.local",
    },
    expect: "applicant@gmail.com",
  },
  {
    label: "French label 'Adresse e-mail'",
    input: {
      submissionData: { "7": "Marie.D@outlook.fr" },
      fieldLabels: { "7": "Adresse e-mail" },
      contactEmail: "import-x@placeholder.impactos.local",
    },
    expect: "marie.d@outlook.fr",
  },
  {
    label: "French label 'Courriel'",
    input: {
      submissionData: { "9": "Jean@yahoo.fr" },
      fieldLabels: { "9": "Courriel" },
      contactEmail: "",
    },
    expect: "jean@yahoo.fr",
  },
  {
    label: "French label 'Mel'",
    input: {
      submissionData: { "4": "Awa@mel.bj" },
      fieldLabels: { "4": "Mel" },
      contactEmail: "",
    },
    expect: "awa@mel.bj",
  },
  {
    label: "English label 'E-mail'",
    input: {
      submissionData: { "2": "John@doe.com" },
      fieldLabels: { "2": "E-mail" },
      contactEmail: "",
    },
    expect: "john@doe.com",
  },
  {
    label: "Email field wins over a non-email-labeled @ value",
    input: {
      submissionData: { "5": "note@referee.com", "6": "real@applicant.com" },
      fieldLabels: { "5": "Referee contact", "6": "Email" },
      contactEmail: "",
    },
    expect: "real@applicant.com",
  },
  {
    label: "No email field → any real @-value fallback",
    input: {
      submissionData: { "5": "only@email.com" },
      fieldLabels: { "5": "Notes" },
      contactEmail: "import-x@placeholder.impactos.local",
    },
    expect: "only@email.com",
  },
  {
    label: "Real CRM email used when submission has none",
    input: {
      submissionData: { "8": "John Doe" },
      fieldLabels: { "8": "Full Name" },
      contactEmail: "verified@crm.com",
    },
    expect: "verified@crm.com",
  },
  {
    label: "Placeholder everywhere → empty string",
    input: {
      submissionData: { "8": "import-abc@placeholder.impactos.local" },
      fieldLabels: { "8": "Email" },
      contactEmail: "import-user_cf060b6c2752@placeholder.impactos.local",
    },
    expect: "",
  },
  {
    label: "Bare 'Adresse' (street) label with a @ value is ignored as email-field",
    input: {
      submissionData: { "1": "Cotonou", "2": "real@me.com" },
      fieldLabels: { "1": "Adresse", "2": "Email" },
      contactEmail: "",
    },
    expect: "real@me.com",
  },
];

let failed = 0;
for (const c of cases) {
  const got = resolveSubmissionEmail(c.input);
  const ok = got === c.expect;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${c.label}`);
  if (!ok) console.log("      got:    ", JSON.stringify(got), "\n      expect: ", JSON.stringify(c.expect));
}
console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
