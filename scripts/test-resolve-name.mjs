// Standalone verification of resolvePersonName priority (code copied verbatim
// from src/lib/email.js — the module cannot be imported directly in Node
// because of the Next.js "@/..." path alias).
const GENERIC_NAMES = /^(unknown|anonymous|n\/a|none|participant|null|undefined|\-+|\s*)$/i;
const FULL_NAME_HINTS = /^(full\s*name|fullname|nom(\s+complet)?|prenom\s*et\s*nom|prénom\s*et\s*nom)$/i;
const NAME_HINTS = /^(name|nom)$/i;
const FIRST_NAME_HINTS = /(first|given|pr[eé]nom|prenom)/i;
const LAST_NAME_HINTS = /(last|surname|family)/i;

function resolvePersonName({ contactName, submitterName, submissionData }) {
  const clean = (v) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const stringify = (v) => {
    if (typeof v !== "string") return "";
    try {
      if (v.startsWith("{") && v.includes('"code"')) return ""; // phone objects
    } catch (_) {}
    return v;
  };

  const candidates = [];

  // 1. Explicit full-name answers FIRST — "Full Name" beats every other source
  for (const [k, v] of Object.entries(data)) {
    if (FULL_NAME_HINTS.test(String(k)) && clean(stringify(v))) {
      candidates.push(clean(stringify(v)));
    }
  }

  // 2. Stored names: CRM name, then submission submitter name
  if (clean(contactName)) candidates.push(clean(contactName));
  if (clean(submitterName)) candidates.push(clean(submitterName));

  // 3. Bare "Name" form answer
  for (const [k, v] of Object.entries(data)) {
    if (NAME_HINTS.test(String(k)) && clean(stringify(v))) {
      candidates.push(clean(stringify(v)));
    }
  }

  // 4. First-name + last-name combination when stored separately
  let firstPart = "";
  let lastPart = "";
  for (const [k, v] of Object.entries(data)) {
    const key = String(k);
    const val = clean(stringify(v));
    if (!val) continue;
    if (!FULL_NAME_HINTS.test(key) && FIRST_NAME_HINTS.test(key) && !lastPart && !key.toLowerCase().includes("last")) {
      if (!firstPart) firstPart = val;
    }
    if (!FULL_NAME_HINTS.test(key) && LAST_NAME_HINTS.test(key)) {
      if (!lastPart) lastPart = val;
    }
  }
  if (firstPart || lastPart) candidates.push(`${firstPart} ${lastPart}`.trim());

  // 5. Any remaining name-ish answer
  for (const [k, v] of Object.entries(data)) {
    const key = String(k).toLowerCase();
    const val = clean(stringify(v));
    if (!val) continue;
    if (key.includes("name") || key.includes("nom") || key.includes("prénom") || key.includes("prenom")) {
      candidates.push(val);
    }
  }

  for (const c of candidates) {
    if (c && !GENERIC_NAMES.test(c)) return c;
  }
  return "";
}

const cases = [
  {
    label: "Full Name beats Name field and CRM name",
    input: { contactName: "Godwin O", submitterName: "Godwin", submissionData: { "Full Name": "Godwin Okafor", "Name": "Godwin" } },
    expect: "Godwin Okafor",
  },
  {
    label: "Full Name beats submitter_name",
    input: { contactName: "", submitterName: "Mary", submissionData: { "Name": "Mary", "Full Name": "Mary Johnson" } },
    expect: "Mary Johnson",
  },
  {
    label: "No full name -> CRM name wins over bare Name field",
    input: { contactName: "Mary Johnson", submitterName: "Mary", submissionData: { "Name": "Mary" } },
    expect: "Mary Johnson",
  },
  {
    label: "No full/CRM -> submitter name wins",
    input: { contactName: "", submitterName: "Jane Doe", submissionData: { "Name": "Jane" } },
    expect: "Jane Doe",
  },
  {
    label: "French full name field (Nom complet)",
    input: { contactName: "", submitterName: "", submissionData: { "Nom complet": "Jean Dupont", "Nom": "Dupont" } },
    expect: "Jean Dupont",
  },
  {
    label: "Prénom et Nom counts as full name",
    input: { contactName: "", submitterName: "", submissionData: { "Prénom et Nom": "Awa Sarr" } },
    expect: "Awa Sarr",
  },
  {
    label: "Full Name is placeholder -> falls back to real Name",
    input: { contactName: "", submitterName: "", submissionData: { "Full Name": "Unknown", "Name": "Real Person" } },
    expect: "Real Person",
  },
  {
    label: "Nothing usable -> empty string",
    input: { contactName: "", submitterName: "", submissionData: { "Email": "a@b.com" } },
    expect: "",
  },
  {
    label: "first + last combination",
    input: { contactName: "", submitterName: "", submissionData: { "First Name": "Ada", "Last Name": "Lovelace" } },
    expect: "Ada Lovelace",
  },
];

let failed = 0;
for (const c of cases) {
  const got = resolvePersonName(c.input);
  const ok = got === c.expect;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${c.label}\n      got:    "${got}"\n      expect: "${c.expect}"`);
}
console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
