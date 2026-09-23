import { TEMPLATE_VARIABLES } from "@/lib/constants";

/**
 * THE VARIABLES EACH MESSAGE MAY USE — the contract the AI personalization works
 * against.
 *
 * Two jobs, one list:
 *  - it tells the model what each variable HOLDS, which is what lets it put the
 *    variables BACK into a text pasted with real values (a name, a score, a
 *    company, an organisation) instead of leaving one candidate's details in a
 *    message that is reused for every recipient;
 *  - it is the allowed set: the model may not write any variable outside it.
 *
 * The names come from the SAME shared list the template editors show, so the
 * variables an author sees and the variables the model may write cannot drift
 * apart. The ad-hoc composer is not one of the editable templates and keeps its
 * own short list — exactly what that sender fills in.
 */
const VARIABLE_MEANINGS = {
  name: "the recipient's own name — replace any personal name in the greeting, the body or the subject",
  form_name: "the name of the form they answered",
  score: "the recipient's numeric score — replace any specific score value",
  group_name: "the name of the group or programme they belong to",
  organization: "the name of the sending organisation (the brand that signs the message)",
  decision: "the decision word (approved / not accepted)",
  comment: "the reviewer's comment about their application",
  role: "the recipient's role title",
  activation_link: "the link that lets them set their password and activate their account",
  login_url: "the platform login link",
  programName: "the name of the programme",
  project_name: "the recipient's project or company name — replace any specific project or company name; when no name is found it reads \"votre projet\" / \"your project\" so the sentence stays complete",
  document_access: "the sentence telling the recipient how to reach their report — replace any sentence about the attached file or a download",
};

export const TEMPLATE_SPECS = {
  acknowledgement: { label: "submission confirmation", variables: TEMPLATE_VARIABLES.acknowledgement },
  approval: { label: "approval (acceptance) notification", variables: TEMPLATE_VARIABLES.approval },
  activation: {
    label: "account activation email that includes a password setup link",
    variables: TEMPLATE_VARIABLES.activation,
  },
  existing_user: {
    label: "access email for a person who already has an account (they must log in with their existing credentials)",
    variables: TEMPLATE_VARIABLES.existing_user,
  },
  rejection: { label: "polite rejection notification", variables: TEMPLATE_VARIABLES.rejection },
  result: { label: "result notification that accompanies a personalised report", variables: TEMPLATE_VARIABLES.result },
  manual: {
    label: "manual ad-hoc message to selected participants",
    variables: ["name", "group_name", "organization"],
  },
};

/** The {{variables}} this message may use, and what each one stands for. */
export function variableGuide(spec) {
  return (spec?.variables || [])
    .map((name) => `- {{${name}}} — ${VARIABLE_MEANINGS[name] || "a value only this message uses"}`)
    .join("\n");
}

/** Every variable name a message may use, lowercased — the allowed set. */
export function specVariableNames(spec) {
  return (spec?.variables || []).map((name) => String(name).toLowerCase());
}
