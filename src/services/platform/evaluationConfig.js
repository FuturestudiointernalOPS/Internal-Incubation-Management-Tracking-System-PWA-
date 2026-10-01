/**
 * Platform — a form's evaluation framework (SERVICE layer).
 *
 * The domain work behind `/api/platform/ai/evaluation-config`: read, save and
 * remove the AI evaluation framework stored on a form. The CONTROLLER keeps
 * `initDb`, the `forms.view` (read) / `forms.edit` (write) capabilities and the
 * envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions, no SQL, no HTTP. It reads and
 * writes through `@/models/**`.
 */

import {
  deleteEvaluationFrameworkByFormId,
  getEvaluationFrameworkByFormId,
  upsertFormEvaluationFramework,
} from "@/models/platformAi";

/** @returns {Promise<{status: number, body: Object}>} */
export async function getEvaluationFramework({ formId }) {
  if (!formId) {
    return { status: 400, body: { success: false, error: "form_id required" } };
  }

  const result = await getEvaluationFrameworkByFormId(formId);

  if (result.rows.length === 0) {
    return { status: 200, body: { success: true, framework: null } };
  }

  return {
    status: 200,
    body: {
      success: true,
      framework: result.rows[0].framework,
      source_document: result.rows[0].source_document,
    },
  };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function saveEvaluationFramework({ form_id, framework, source_document }) {
  if (!form_id || !framework) {
    return { status: 400, body: { success: false, error: "form_id and framework required" } };
  }

  await upsertFormEvaluationFramework(form_id, framework, source_document);
  return { status: 200, body: { success: true } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function removeEvaluationFramework({ formId }) {
  if (!formId) {
    return { status: 400, body: { success: false, error: "form_id required" } };
  }

  await deleteEvaluationFrameworkByFormId(formId);
  return { status: 200, body: { success: true } };
}
