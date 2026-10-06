/** Internal messaging public entry point; scope and use-cases stay independently readable. */
export { resolveProgramMemberIds, resolveGroupMemberIds, resolveUserMessageScope, recipientSharesProgram } from "./internal-comms/scope";
export { mayReadInbox, readMessageInbox } from "./internal-comms/inbox";
export { sendInternalMessage } from "./internal-comms/send";
export { markMessagesRead } from "./internal-comms/read";
