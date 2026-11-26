import { findInternalProgram } from "@/models/organizations/internalPrograms";
export async function isInternalProgramAvailable(programId) {
  if (programId === null || programId === undefined || String(programId).trim() === "") return false;
  return Boolean(await findInternalProgram(programId));
}
