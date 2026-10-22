/**
 * VENTURE DATA ROOM — the public decision surface.
 *
 * The feature is split by concern so no file outgrows the project's limit:
 *
 *   access     who the caller is, the catalogue read, requirement list,
 *              completeness calculation
 *   documents  upload, replace (version), review, metadata, removal
 *   grants     per-investor access and the requirement configuration
 *   shared     the small shaping helpers the three share
 *
 * Importers keep using `@/services/ventures/dataRoom`, exactly as before.
 */

export {
  resolveDataRoomViewer,
  loadDataRoomRequirements,
  computeDataRoomCompleteness,
  buildDataRoom,
  loadDataRoomDocument,
  recordDataRoomAccess,
} from "./access";

export {
  createDataRoomDocument,
  replaceDataRoomDocument,
  reviewDataRoomDocument,
  updateDataRoomMetadata,
  deleteDataRoomDocument,
} from "./documents";

export {
  grantDataRoomAccess,
  revokeDataRoomAccess,
  setDataRoomRequirement,
} from "./grants";
