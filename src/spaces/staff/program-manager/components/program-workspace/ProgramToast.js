export default function ProgramToast({ toast }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest border ${
        toast.type === "error"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200"
      }`}
    >
      {toast.msg}
    </div>
  );
}
