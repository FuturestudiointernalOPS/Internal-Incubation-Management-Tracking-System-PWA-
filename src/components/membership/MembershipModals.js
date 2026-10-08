"use client";

/**
 * Membership modals — public entry point.
 *
 * The modals used to live in this single file. They now live in
 * `./membership-modals/*`, one file per modal plus the shared status visuals
 * and the lifecycle action helper. This file only re-exports them, so every
 * existing importer keeps resolving unchanged.
 */
export {
  notify,
  STATUS_STYLE,
  ACCOUNT_STYLE,
  Badge,
  runMembershipAction,
} from "./membership-modals/shared";
export { AddMemberModal } from "./membership-modals/AddMemberModal";
export { RenewModal } from "./membership-modals/RenewModal";
export { ConfirmModal } from "./membership-modals/ConfirmModal";
export { HistoryModal } from "./membership-modals/HistoryModal";
export { DetailModal } from "./membership-modals/DetailModal";
