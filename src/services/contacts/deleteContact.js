import { softDeleteContact } from "@/models/contacts";

/**
 * Soft-delete a contact. Capability gate stays in the controller.
 *
 * @returns {{ status: number, body: object }}
 */
export async function deleteContact({ cid, deletedBy }) {
  if (!cid) {
    return {
      status: 400,
      body: { success: false, error: "Contact ID (cid) is required." },
    };
  }

  const result = await softDeleteContact(deletedBy, cid);

  if (result.rowsAffected === 0) {
    return {
      status: 404,
      body: { success: false, error: "Contact not found." },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: "Contact permanently deleted.",
    },
  };
}
