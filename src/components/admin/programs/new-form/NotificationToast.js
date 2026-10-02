import { CheckCircle2, AlertCircle, X } from "lucide-react";

/** Fixed notification toast shown after an action completes or fails. */
export default function NotificationToast({ notification, onClose }) {
  if (!notification) return null;

  return (
    <div className="fixed top-10 right-10 z-[1000] animate-in slide-in-from-right-10">
      <div
        className={`flex items-center gap-4 p-5 rounded-2xl border shadow-2xl backdrop-blur-xl ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}
      >
        {notification.type === "success" ? (
          <CheckCircle2 className="w-6 h-6" />
        ) : (
          <AlertCircle className="w-6 h-6" />
        )}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
            {notification.type.toUpperCase()}
          </p>
          <p className="text-xs font-bold text-white/90">
            {notification.message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 opacity-40 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
