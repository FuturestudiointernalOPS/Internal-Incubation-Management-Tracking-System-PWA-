"use client";

/**
 * The dismissible toast in the top-right corner.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function RelationshipsToast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-xs font-bold shadow-lg ${
      toast.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
    }`} onClick={onDismiss}>
      {toast.message}
    </div>
  );
}
