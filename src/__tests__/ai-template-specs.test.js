/**
 * The AI's variable contract.
 *
 * Personalization may PUT A VARIABLE BACK where a pasted text carries the
 * concrete value it stands for (a name, a score, a company) — without that, one
 * candidate's details would be sent to every recipient. It only works if the
 * model is told what each variable holds, and the names it may write must be the
 * SAME list the template editors show.
 */
const fs = require("fs");
const path = require("path");
const { TEMPLATE_SPECS, variableGuide, specVariableNames } = require("@/models/platform/ai/templateSpecs");
const { TEMPLATE_VARIABLES } = require("@/lib/constants");

const ROOT = path.resolve(__dirname, "..", "..");
const ROUTE = fs.readFileSync(path.join(ROOT, "src/app/api/platform/ai/personalize-template/route.js"), "utf8");

describe("the AI's variable list is the editors' list", () => {
  test("every editable template takes its variables from the shared list", () => {
    for (const [key, names] of Object.entries(TEMPLATE_VARIABLES)) {
      expect(TEMPLATE_SPECS[key]).toBeDefined();
      expect(specVariableNames(TEMPLATE_SPECS[key])).toEqual(names.map((name) => name.toLowerCase()));
    }
  });

  test("the specs cover exactly the editable templates plus the ad-hoc composer", () => {
    expect(Object.keys(TEMPLATE_SPECS).sort()).toEqual([...Object.keys(TEMPLATE_VARIABLES), "manual"].sort());
    expect(specVariableNames(TEMPLATE_SPECS.manual)).toEqual(["name", "group_name", "organization"]);
  });

  test("every variable a message may use is DESCRIBED for the model", () => {
    // A vague entry would leave the model unable to recognise the value it is
    // supposed to replace.
    const vague = Object.values(TEMPLATE_SPECS)
      .filter((spec) => variableGuide(spec).includes("a value only this message uses"))
      .map((spec) => spec.label);
    expect(vague).toEqual([]);
  });

  test("the guide names each variable with what it holds", () => {
    const guide = variableGuide(TEMPLATE_SPECS.result);
    expect(guide).toContain("{{name}} — the recipient's own name");
    expect(guide).toContain("{{score}}");
    expect(guide).toContain("{{project_name}}");
    expect(guide).toContain("{{document_access}}");
  });
});

describe("the personalization prompt asks for the variables back", () => {
  test("both tiers replace a concrete value and are forbidden to invent a variable", () => {
    expect(ROUTE).toContain("replace that value with the variable that stands for it");
    expect(ROUTE).toContain("never invent one");
    expect(ROUTE).toContain("never invent a variable that is not in that list");
  });

  test("the guide is interpolated into both prompts", () => {
    expect((ROUTE.match(/\$\{variableGuide\(spec\)\}/g) || []).length).toBe(2);
  });

  test("the allowed set is the message's own list, never the model's imagination", () => {
    expect(ROUTE).toContain("...specVariableNames(spec),");
  });
});
