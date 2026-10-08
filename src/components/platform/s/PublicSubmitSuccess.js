import SubmissionSuccess from "@/components/public/run-submit/SubmissionSuccess";

/**
 * The success screen of the public run. The screen owns the submission result;
 * this resolves the server-provided message's placeholders (escaping every value
 * that comes from what the visitor typed) before it is rendered.
 */
export default function PublicSubmitSuccess({
  t,
  successConfig,
  fields,
  formData,
  form,
  run,
}) {
  const escapeHtml = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  };

  const resolvePlaceholders = (template) => {
    if (!template) return null;
    let result = template;
    // Resolve by field label placeholders (values are user input — escape them)
    for (const field of fields) {
      const rawLabel = (field.label || "").toLowerCase();
      const safeKey = rawLabel.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const value = formData[field.id] != null ? escapeHtml(String(formData[field.id])) : "";
      result = result.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, "gi"), value);
      result = result.replace(new RegExp(`\\{\\{field_${field.id}\\}\\}`, "gi"), value);
    }
    // Common special placeholders (all dynamic values escaped)
    const nameField = fields.find(field => (field.label || "").toLowerCase().includes("name"));
    const emailField = fields.find(field => (field.label || "").toLowerCase().includes("email"));
    if (nameField) {
      const nameVal = escapeHtml(String(formData[nameField.id] || ""));
      result = result.replace(/\{\{submitter_name\}\}/gi, nameVal);
      result = result.replace(/\{\{name\}\}/gi, nameVal);
    }
    if (emailField) {
      result = result.replace(/\{\{submitter_email\}\}/gi, escapeHtml(String(formData[emailField.id] || "")));
    }
    result = result.replace(/\{\{form_name\}\}/gi, escapeHtml(form?.name || ""));
    result = result.replace(/\{\{group_name\}\}/gi, escapeHtml(run?.group_name || ""));
    result = result.replace(/\{\{organization\}\}/gi, escapeHtml("ImpactOS"));
    return result;
  };

  const successMessage = successConfig?.message
    ? resolvePlaceholders(successConfig.message)
    : null;

  return (
    <SubmissionSuccess
      t={t}
      successMessage={successMessage}
      redirectUrl={successConfig?.redirect_url}
    />
  );
}
