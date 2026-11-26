import { selectGlossary } from "@/models/ventureReportingStore";
import { ensureReportingSchema } from "./settings";

export async function getGlossary() {
  await ensureReportingSchema();
  const result = await selectGlossary();
  return result.rows || [];
}
