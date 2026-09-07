// Standalone verification of the template resolution chain (code copied
// verbatim from src/lib/email.js — the module cannot be imported directly in
// Node because of the Next.js "@/..." path alias).

const DEFAULT_TEMPLATES = {
  approval: {
    subject: "Your {{form_name}} application has been approved",
    body: "<p>Congratulations {{name}}!</p><p>Default body.</p>",
  },
  activation: {
    subject: "Welcome to {{organization}} — Set Your Password",
    body: "<p>Hello {{name}},</p>",
  },
};

function getTemplate(formSettings, templateKey, runSettings) {
  const custom = formSettings?.automation?.templates?.[templateKey] || {};
  const runCustom = runSettings?.templates?.[templateKey] || {};
  const text = (v) => (typeof v === "string" ? v.trim() : v);
  const pick = (runVal, formVal) => text(runVal) || text(formVal) || "";
  const def = DEFAULT_TEMPLATES[templateKey];
  return {
    subject: pick(runCustom.subject, custom.subject) || def?.subject || "",
    body: pick(runCustom.body, custom.body) || def?.body || "",
  };
}

const FORM_DESIGNED = {
  automation: {
    templates: {
      approval: { subject: "You're in! — {{form_name}}", body: "<h2>Welcome</h2><p>Hello {{name}}</p>" },
    },
  },
};

let failed = 0;
function check(label, got, expect) {
  const ok = JSON.stringify(got) === JSON.stringify(expect);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`);
  if (!ok) console.log("      got:    ", JSON.stringify(got), "\n      expect: ", JSON.stringify(expect));
}

// 1. No overrides → platform default
check(
  "no overrides -> default",
  getTemplate({}, "approval", {}),
  DEFAULT_TEMPLATES.approval
);

// 2. Form-level design used when run has nothing
check(
  "form design used when run empty",
  getTemplate(FORM_DESIGNED, "approval", {}),
  { subject: "You're in! — {{form_name}}", body: "<h2>Welcome</h2><p>Hello {{name}}</p>" }
);

// 3. Run-level full override wins
check(
  "run-level full override wins",
  getTemplate(FORM_DESIGNED, "approval", {
    templates: { approval: { subject: "Run subject", body: "<p>Run body</p>" } },
  }),
  { subject: "Run subject", body: "<p>Run body</p>" }
);

// 4. THE BUG: empty-string run fields must NOT shadow the form design
check(
  "blank run fields fall through to form design",
  getTemplate(FORM_DESIGNED, "approval", {
    templates: { approval: { subject: "", body: "   " } },
  }),
  { subject: "You're in! — {{form_name}}", body: "<h2>Welcome</h2><p>Hello {{name}}</p>" }
);

// 5. Blank run subject only → form subject, run body
check(
  "blank run subject falls through, run body kept",
  getTemplate(FORM_DESIGNED, "approval", {
    templates: { approval: { subject: "", body: "<p>Run body</p>" } },
  }),
  { subject: "You're in! — {{form_name}}", body: "<p>Run body</p>" }
);

// 6. Blank form fields fall through to default
check(
  "blank form fields fall through to default",
  getTemplate({ automation: { templates: { approval: { subject: " ", body: "" } } } }, "approval", {}),
  DEFAULT_TEMPLATES.approval
);

// 7. Unknown key with nothing saved → default
check(
  "missing key -> default for that key",
  getTemplate(FORM_DESIGNED, "activation", {}),
  DEFAULT_TEMPLATES.activation
);

console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
