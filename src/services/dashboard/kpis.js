/**
 * KPI definitions — the strategic-objective CRUD use cases (SERVICE layer).
 *
 * The work behind `POST`/`PUT`/`DELETE /api/kpis`: resolving which programme a
 * KPI belongs to (so the caller's scope gate is asked about the right one),
 * creating / retargeting / deleting the row, and the default target a KPI
 * carries when none is given (80).
 *
 * HTTP-free: it reads and writes through `@/models/platformConfig`. The
 * controller keeps the authentication, the validation, the program-scope gate,
 * the audit entry and the response envelope.
 */

import {
  deleteKpi,
  getV2KpiProgramId,
  insertKpi,
  updateKpi,
} from "@/models/platformConfig";

/** The target a KPI carries when the caller gives none. */
const DEFAULT_KPI_TARGET = 80;

/**
 * The programme a KPI belongs to. The scope gate needs it for the handlers that
 * receive only a KPI id.
 */
export async function resolveKpiProgramId(id) {
  const result = await getV2KpiProgramId(id);
  return result.rows?.[0]?.program_id;
}

/** Create a program KPI; returns the audit details the write implies. */
export async function createKpiDefinition({ programId, title, targetValue }) {
  await insertKpi(programId, title, targetValue);
  return { title, target_value: targetValue || DEFAULT_KPI_TARGET };
}

/** Rename / retarget a KPI; returns the audit details the write implies. */
export async function updateKpiDefinition({ id, title, targetValue }) {
  await updateKpi(id, title, targetValue);
  return { title, target_value: targetValue || DEFAULT_KPI_TARGET };
}

/** Delete a KPI. */
export async function deleteKpiDefinition(id) {
  await deleteKpi(id);
}
