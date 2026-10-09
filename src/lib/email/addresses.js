/**
 * Which address, which name, which language
 *
 * Every pure decision about a recipient: placeholders, submissions, generic
 *  * names, project names, language detection, greeting name. No I/O — which is why
 *  * sendEmail can call isPlaceholderEmail without a cycle.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

/**
 * Send an invite email with activation link
 */
export function resolveGreetingName(name) {
  const cleanedName = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (!cleanedName || cleanedName.includes("@")) return "";
  if (/^(unknown|anonymous|n\/a|none|participant|null|undefined|-+|\s*)$/i.test(cleanedName)) return "";
  return cleanedName;
}

/**
 * Artificial/placeholder addresses (import fallbacks, reserved domains) must
 * never be treated as real recipients.
 */
export function isPlaceholderEmail(email) {
  if (!email || typeof email !== "string") return true;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) return true;
  if (normalizedEmail.includes("placeholder")) return true;
  if (normalizedEmail.includes("@example.") || normalizedEmail.includes("@test.") || normalizedEmail.endsWith(".local") || normalizedEmail.endsWith(".invalid")) return true;
  if (normalizedEmail.startsWith("import-")) return true; // import-generated placeholder pattern
  return false;
}

/** Parse a comma-, semicolon-, or newline-separated email address list. */
export function parseEmailAddressList(value) {
  const entries = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => String(entry || "").split(/[,;\n]+/))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const emails = [];
  const invalid = [];
  const seen = new Set();

  for (const email of entries) {
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || isPlaceholderEmail(email)) {
      invalid.push(email);
    } else if (!seen.has(email)) {
      seen.add(email);
      emails.push(email);
    }
  }

  return { emails, invalid };
}

/**
 * Resolve the real applicant email for a submission:
 *   1. a real email answer from the form response (label-aware: Email,
 *      E-mail, Courriel, Adresse e-mail… — no hardcoded single label)
 *   2. any other real email-looking value in the submission data
 *   3. the CRM/contact email (verified, only when it is not a placeholder)
 * Internal placeholder addresses (import-…@placeholder…, .local, example.com)
 * are NEVER returned. Empty string when nothing real exists.
 * Used by the Run Overview display, CSV export, decision emails and scores —
 * the UI and the email-sending workflow always agree on the recipient.
 */
export function resolveSubmissionEmail({ submissionData, fieldLabels, contactEmail }) {
  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const labelOf = (fieldKey) => {
    const raw =
      fieldLabels && fieldLabels[String(fieldKey)] != null
        ? String(fieldLabels[String(fieldKey)])
        : String(fieldKey);
    return raw.toLowerCase().trim();
  };
  const isReal = (candidate) =>
    typeof candidate === "string" && candidate.includes("@") && !isPlaceholderEmail(candidate);
  // English + French email question labels (Email, E-mail, Email Address,
  // Adresse e-mail, Courriel, Mel…). Never matches a bare "Adresse" field.
  const EMAIL_HINTS = /(e-?mail|courriel|mel|adresse\s*(e-?mail|mail))/i;

  const labeled = [];
  const anyReal = [];
  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const value = typeof fieldValue === "string" ? fieldValue.trim() : "";
    if (!isReal(value)) continue;
    if (EMAIL_HINTS.test(labelOf(fieldKey))) labeled.push(value);
    else anyReal.push(value);
  }
  if (labeled.length > 0) return labeled[0].toLowerCase();
  if (anyReal.length > 0) return anyReal[0].toLowerCase();
  if (isReal(contactEmail)) return String(contactEmail).trim().toLowerCase();
  return "";
}

/**
 * Alias kept for the activation flow — the single source of truth is
 * resolveSubmissionEmail above (label-aware, placeholder-safe, EN/FR).
 */
export function resolveRecipientEmail({ contactEmail, submissionData, fieldLabels }) {
  return resolveSubmissionEmail({ submissionData, fieldLabels, contactEmail });
}

const GENERIC_NAMES = /^(unknown|anonymous|n\/a|none|participant|null|undefined|-+|\s*)$/i;

/** True when a value is a placeholder rather than a real person name. */
export function isGenericName(v) {
  return GENERIC_NAMES.test(typeof v === "string" ? v.trim() : "");
}

// Explicit full-name fields (strongest submission signal). Intentionally
// excludes the bare "name"/"nom" field so "Full Name"/"Nom complet" always
// wins over the shorter fields.
const FULL_NAME_HINTS = /^(full\s*name|fullname|nom\s+complet|prenom\s*et\s*nom|prénom\s*et\s*nom|nom\s*et\s*pr[eé]nom|nom\s*&\s*pr[eé]nom)$/i;

const FIRST_NAME_HINTS = /(first|given|pr[eé]nom|prenom)/i;

const LAST_NAME_HINTS = /(last|surname|family)/i;

// Bare French "Nom" / "Nom de famille" is a LAST name (combined with "Prénom").
const FR_LAST_NAME_HINTS = /^(nom|nom\s+de\s+famille)$/i;

// Bare English "Name" is treated as a full-name field.
const NAME_HINTS = /^(name)$/i;

/**
 * Resolve the best real person name deterministically (application code
 * resolves identity — the AI never has to guess who the applicant is).
 *
 * Priority (per product directive):
 *   1. CRM verified full name (contacts.name)
 *   2. Full-name field from the submission
 *   3. CRM first (+ last) name when stored separately
 *   4. First-name field from the submission (combined with its last name)
 *   5. Other recognized name field (bare "Name")
 *   6. Stored submission submitter_name
 *   7. Any other name-ish answer
 *   8. "" — the caller decides the neutral fallback
 *
 * Language-aware: English and French labels are understood as equivalent
 * semantic fields (Full Name / Nom complet, First Name / Prénom).
 *
 * `fieldLabels` maps a submission data KEY (usually the numeric field id)
 * to the actual question label — without it, label hints can never match
 * and form answers are effectively invisible to name resolution.
 *
 * Placeholder values (Unknown / Anonymous / N/A / ...) are never returned
 * when a real name exists anywhere.
 */
export function resolvePersonName({ contactName, contactFirstName, contactLastName, submitterName, submissionData, fieldLabels }) {
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
  // Effective label for a data key: field id → real question label.
  const labelOf = (fieldKey) => {
    const raw =
      fieldLabels && fieldLabels[String(fieldKey)] != null
        ? String(fieldLabels[String(fieldKey)])
        : String(fieldKey);
    return raw.toLowerCase().trim();
  };

  const fullNames = [];
  const firstNames = [];
  const lastNames = [];
  let bareName = "";

  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const value = clean(stringify(fieldValue));
    if (!value) continue;
    const label = labelOf(fieldKey);
    if (!label) continue;
    if (FULL_NAME_HINTS.test(label)) fullNames.push(value);
    else if (FIRST_NAME_HINTS.test(label)) firstNames.push(value);
    else if (LAST_NAME_HINTS.test(label) || FR_LAST_NAME_HINTS.test(label)) lastNames.push(value);
    else if (NAME_HINTS.test(label)) bareName = bareName || value;
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
    const value = clean(stringify(fieldValue));
    if (!value || !key) continue;
    if (key.includes("name") || key.includes("nom") || key.includes("prénom") || key.includes("prenom")) {
      candidates.push(value);
    }
  }

  for (const candidate of candidates) {
    if (candidate && !GENERIC_NAMES.test(candidate)) return candidate;
  }
  return "";
}

// Project / venture name fields. The Founder Fit Score asks for a "Startup
// Name"; other venture forms use Project / Nom du projet. Kept apart from the
// person-name hints on purpose — a company name is never the applicant's name.
const PROJECT_NAME_HINTS =
  /^(startup|project|company|venture|business)\s*(name)?$|^nom\s+(du\s+|de\s+la\s+|de\s+l['’]?)?(projet|startup|entreprise|soci[eé]t[eé]|structure|organisation|organization)$|^(raison|d[ée]nomination)\s+sociale$|^(nom|name)\s+(du\s+|of\s+(the\s+)?)?(projet|project)$/i;

/**
 * Resolve the applicant's project / venture name from the submission, using the
 * form's real question labels (submission data is keyed by field id). Returns
 * "" when the form never asked for one — callers then fall back to neutral
 * wording instead of printing an empty gap.
 */
export function resolveProjectName({ submissionData, fieldLabels }) {
  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const clean = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
  const labelOf = (fieldKey) =>
    fieldLabels && fieldLabels[String(fieldKey)] != null ? String(fieldLabels[String(fieldKey)]) : String(fieldKey);

  let loose = "";
  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const value = clean(fieldValue);
    if (!value) continue;
    const label = labelOf(fieldKey).trim();
    if (PROJECT_NAME_HINTS.test(label)) return value;
    // Softer net, never enough on its own: a label that merely mentions the
    // venture ("Startup Industry") must not match, hence the name/nom word.
    if (!loose && /(startup|projet|project|venture|entreprise|company|structure|soci[eé]t[eé])/i.test(label) && /(name|nom)/i.test(label)) {
      loose = value;
    }
  }
  return loose;
}

/**
 * Infer the workflow language from form question labels. Returns "fr" when the
 * form's questions are predominantly French (Nom complet / Prénom / Courriel…),
 * otherwise "en". Used to set a new contact's language so the Welcome email
 * matches the form/workflow the applicant completed.
 */
export function detectLanguage(fieldLabels) {
  let fr = 0;
  let en = 0;
  for (const label of Object.values(fieldLabels || {})) {
    const labelText = String(label).toLowerCase();
    if (/nom complet|pr[eé]nom|prenom|courriel|t[eé]l[eé]phone|date de naissance|ville|pays/.test(labelText)) {
      fr++;
    } else if (/full name|first name|last name|email address|phone|date of birth|city|country/.test(labelText)) {
      en++;
    }
  }
  return fr > en ? "fr" : "en";
}

/**
 * Map account state to the kind of email to send:
 *  - no account                    → "create_activate"
 *  - account exists, not activated → "activate_existing"
 *  - account exists AND activated  → "login_existing"
 */
export function decideEmailKind({ accountExists, accountActivated }) {
  if (!accountExists) return "create_activate";
  return accountActivated ? "login_existing" : "activate_existing";
}
