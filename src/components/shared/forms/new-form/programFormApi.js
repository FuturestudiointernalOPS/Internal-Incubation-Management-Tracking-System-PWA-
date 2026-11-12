import { uploadFile } from "@/lib/storage";

/**
 * Network actions for the New Program wizard.
 *
 * These are plain async functions: they perform the request and return the
 * parsed payload (or uploaded file descriptors). They never touch component
 * state and never translate anything — the component owns the setState wiring
 * and the user-facing messages.
 */

/**
 * Raised when a program material fails to reach storage. Carries the raw
 * storage error so the caller can build the translated message.
 */
export class ProgramFileUploadError extends Error {
  constructor(fileName, rawError) {
    super("program-file-upload-failed");
    this.name = "ProgramFileUploadError";
    this.fileName = fileName;
    this.rawError = rawError;
  }
}

export async function uploadProgramFiles(files) {
  const uploadedUrls = [];
  for (const file of files) {
    const path = `concept-notes/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const result = await uploadFile("knowledge", path, file);
    if (result.success) {
      uploadedUrls.push({
        name: file.name,
        url: result.url,
        type: file.type,
      });
    } else {
      throw new ProgramFileUploadError(file.name, result.error);
    }
  }
  return uploadedUrls;
}

export async function createFamily(body) {
  const response = await fetch("/api/families", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function createKnowledgeBase(newKB) {
  const response = await fetch("/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newKB),
  });
  return response.json();
}

export async function registerProgramType(typeKey) {
  try {
    await fetch("/api/program-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type_key: typeKey }),
    });
  } catch {
    // The local list still gets the new type below; a failed registration is
    // non-fatal for this session.
  }
}

export async function applyProgramTemplate({ templateId, name }) {
  const response = await fetch("/api/pm/programs/templates?action=apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: templateId,
      name,
    }),
  });
  return response.json();
}

export async function saveProgram(body) {
  const response = await fetch("/api/pm/programs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}
