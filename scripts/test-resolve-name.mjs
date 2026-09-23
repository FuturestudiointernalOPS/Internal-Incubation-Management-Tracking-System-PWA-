// Standalone verification of resolvePersonName priority (code copied verbatim
// from src/lib/email.js — the module cannot be imported directly in Node
// because of the Next.js "@/..." path alias).

const GENERIC_NAMES = /^(unknown|anonymous|n\/a|none|participant|null|undefined|-+|\s*)$/i;

function isGenericName(value) {
  return GENERIC_NAMES.test(typeof value === "string" ? value.trim() : "");
}

const FULL_NAME_HINTS = /^(full\s*name|fullname|nom\s+complet|prenom\s*et\s*nom|prénom\s*et\s*nom|nom\s*et\s*pr[eé]nom|nom\s*&\s*pr[eé]nom)$/i;
const FIRST_NAME_HINTS = /(first|given|pr[eé]nom|prenom)/i;
const LAST_NAME_HINTS = /(last|surname|family)/i;
const FR_LAST_NAME_HINTS = /^(nom|nom\s+de\s+famille)$/i;
const NAME_HINTS = /^(name)$/i;

function resolvePersonName({ contactName, contactFirstName, contactLastName, submitterName, submissionData, fieldLabels }) {
  const clean = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const stringify = (value) => {
    if (typeof value !== "string") return "";
    try {
      if (value.startsWith("{") && value.includes('"code"')) return ""; // phone objects
    } catch (_) {}
    return value;
  };
  const labelOf = (key) => {
    const raw =
      fieldLabels && fieldLabels[String(key)] != null
        ? String(fieldLabels[String(key)])
        : String(key);
    return raw.toLowerCase().trim();
  };

  const fullNames = [];
  const firstNames = [];
  const lastNames = [];
  let bareName = "";

  for (const [key, value] of Object.entries(data)) {
    const cleanedValue = clean(stringify(value));
    if (!cleanedValue) continue;
    const label = labelOf(key);
    if (!label) continue;
    if (FULL_NAME_HINTS.test(label)) fullNames.push(cleanedValue);
    else if (FIRST_NAME_HINTS.test(label)) firstNames.push(cleanedValue);
    else if (LAST_NAME_HINTS.test(label) || FR_LAST_NAME_HINTS.test(label)) lastNames.push(cleanedValue);
    else if (NAME_HINTS.test(label)) bareName = bareName || cleanedValue;
  }

  const candidates = [];

  // 1. CRM verified full name
  if (clean(contactName)) candidates.push(clean(contactName));

  // 2. Submission full-name field(s)
  for (const fullName of fullNames) candidates.push(fullName);

  // 3. CRM first (+ last) name when stored separately
  const crmFirst = clean(contactFirstName);
  const crmLast = clean(contactLastName);
  if (crmFirst || crmLast) candidates.push(`${crmFirst} ${crmLast}`.trim());

  // 4. Submission first-name field, combined with its last name when present
  if (firstNames.length > 0) {
    candidates.push(`${firstNames[0]} ${lastNames[0] || ""}`.trim());
  } else if (lastNames.length > 0) {
    candidates.push(lastNames[0]);
  }

  // 5. Other recognized name field (bare English "Name")
  if (bareName) candidates.push(bareName);

  // 6. Stored submission submitter_name
  if (clean(submitterName)) candidates.push(clean(submitterName));

  // 7. Any remaining name-ish answer (label or key contains name words)
  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const key = labelOf(fieldKey);
    const cleanedValue = clean(stringify(fieldValue));
    if (!cleanedValue || !key) continue;
    if (key.includes("name") || key.includes("nom") || key.includes("prénom") || key.includes("prenom")) {
      candidates.push(cleanedValue);
    }
  }

  for (const candidate of candidates) {
    if (candidate && !GENERIC_NAMES.test(candidate)) return candidate;
  }
  return "";
}

const cases = [
  // ── THE reported bug: data keyed by FIELD ID + labels map ──
  {
    label: "field-id keyed Full Name — CRM verified name wins (directive priority 1)",
    input: {
      contactName: "Godwin O",
      submitterName: "Godwin",
      submissionData: { "101": "Godwin Okafor", "102": "Godwin" },
      fieldLabels: { "101": "Full Name", "102": "Name" },
    },
    expect: "Godwin O",
  },
  {
    label: "French: Nom complet via field id beats Prénom/Nom",
    input: {
      contactName: "",
      submitterName: "Marie",
      submissionData: { "10": "Marie Claire Dossou", "11": "Marie", "12": "Dossou" },
      fieldLabels: { "10": "Nom complet", "11": "Prénom", "12": "Nom" },
    },
    expect: "Marie Claire Dossou",
  },
  {
    label: "French: Prénom + Nom combine into full name",
    input: {
      contactName: "",
      submitterName: "",
      submissionData: { "11": "Marie", "12": "Dossou" },
      fieldLabels: { "11": "Prénom", "12": "Nom" },
    },
    expect: "Marie Dossou",
  },
  {
    label: "Only Prénom -> use first name",
    input: {
      contactName: "",
      submitterName: "",
      submissionData: { "11": "Marie" },
      fieldLabels: { "11": "Prénom" },
    },
    expect: "Marie",
  },
  {
    label: "Only English Name field -> used as full name",
    input: {
      contactName: "",
      submitterName: "",
      submissionData: { "3": "John Doe" },
      fieldLabels: { "3": "Name" },
    },
    expect: "John Doe",
  },
  // ── Priority rules ──
  {
    label: "CRM verified full name wins over form full name (directive order)",
    input: {
      contactName: "Marie Claire Dossou (verified)",
      submitterName: "",
      submissionData: { "1": "Marie Dossou" },
      fieldLabels: { "1": "Full Name" },
    },
    expect: "Marie Claire Dossou (verified)",
  },
  {
    label: "Full name takes priority over first name",
    input: {
      contactName: "",
      submitterName: "",
      submissionData: { "1": "Marie Claire Dossou", "2": "Marie" },
      fieldLabels: { "1": "Full Name", "2": "First Name" },
    },
    expect: "Marie Claire Dossou",
  },
  {
    label: "CRM name Unknown -> falls through to submission full name",
    input: {
      contactName: "Unknown",
      submitterName: "Unknown",
      submissionData: { "1": "John Doe" },
      fieldLabels: { "1": "Full Name" },
    },
    expect: "John Doe",
  },
  {
    label: "placeholder full name -> real name from other field",
    input: {
      contactName: "",
      submitterName: "",
      submissionData: { "1": "Unknown", "2": "Real Person" },
      fieldLabels: { "1": "Full Name", "2": "Name" },
    },
    expect: "Real Person",
  },
  {
    label: "nothing usable -> empty string (caller picks neutral fallback)",
    input: {
      contactName: "Unknown",
      submitterName: "Anonymous",
      submissionData: { "9": "a@b.com" },
      fieldLabels: { "9": "Email" },
    },
    expect: "",
  },
  {
    label: "CRM separate first+last names combine",
    input: {
      contactName: "",
      contactFirstName: "Ada",
      contactLastName: "Lovelace",
      submitterName: "",
      submissionData: {},
      fieldLabels: {},
    },
    expect: "Ada Lovelace",
  },
  {
    label: "no fieldLabels -> falls back to label-less hints + submitter name",
    input: {
      contactName: "",
      submitterName: "Jane Doe",
      submissionData: { "1": "ignored" },
      fieldLabels: {},
    },
    expect: "Jane Doe",
  },
  {
    label: "isGenericName detects placeholders",
    input: { probe: true },
    expect: "Unknown",
    fn: () => {
      const ok =
        isGenericName("Unknown") &&
        isGenericName("Anonymous") &&
        isGenericName("N/A") &&
        isGenericName("") &&
        !isGenericName("Marie Claire Dossou");
      return ok ? "Unknown" : "FAIL";
    },
  },
];

let failed = 0;
for (const testCase of cases) {
  const got = testCase.fn ? testCase.fn() : resolvePersonName(testCase.input);
  const ok = got === testCase.expect;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${testCase.label}`);
  if (!ok) console.log("      got:    ", JSON.stringify(got), "\n      expect: ", JSON.stringify(testCase.expect));
}
console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
