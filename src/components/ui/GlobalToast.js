"use client";

import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, AlertCircle, X, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

/**
 * GLOBAL TOAST SYSTEM
 * Unified notification hub for the ImpactOS terminal.
 * Supports: success, error, info, warning.
 */
export default function GlobalToast() {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState([]);
  // Monotonic toast id. `Date.now()` collides whenever two toasts are raised in
  // the same millisecond (a burst of failures, or one handler firing twice in a
  // tick), which made React see duplicate list keys and could drop or duplicate
  // a toast.
  const nextId = useRef(0);
  // The translator in force, read through a ref so the listener below can stay
  // mounted once: a toast lives for several seconds and must be de-duplicated
  // against the language current when it was raised.
  const translateRef = useRef(t);
  useEffect(() => {
    translateRef.current = t;
  });

  useEffect(() => {
    const handleNotify = (event) => {
      // A longer default than before: a full sentence (a permission refusal, an
      // error naming a field) needs time to be read, and the old 4s expired
      // while the eyes were still arriving at it.
      const { type = "info", message, duration = 8000 } = event.detail;
      const id = ++nextId.current;

      setNotifications((prev) => {
        // The screen's own error toast and the global permission notice can
        // carry the SAME sentence: a page reports the server's key, while the
        // interceptor reports the permission key, and both resolve to one
        // message. Showing it twice helps nobody, so a toast already on screen
        // absorbs the newcomer and keeps its own timer.
        const resolved = translateRef.current(message || "") || message;
        const duplicate = prev.some(
          (existing) =>
            existing.type === type &&
            (translateRef.current(existing.message || "") || existing.message) ===
              resolved,
        );
        if (duplicate) return prev;
        return [...prev, { id, type, message }];
      });

      setTimeout(() => {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
      }, duration);
    };

    window.addEventListener("impactos:notify", handleNotify);
    return () => window.removeEventListener("impactos:notify", handleNotify);
  }, []);

  const getTypeStyle = (type) => {
    switch (type) {
      case "success":
        return {
          border: "border-emerald-500/30",
          bg: "bg-emerald-500/10",
          text: "text-emerald-500",
          icon: CheckCircle,
          label: "Success",
        };
      case "error":
        return {
          border: "border-rose-500/30",
          bg: "bg-rose-500/10",
          text: "text-rose-500",
          icon: AlertCircle,
          label: "Critical Error",
        };
      case "warning":
        return {
          border: "border-amber-500/30",
          bg: "bg-amber-500/10",
          text: "text-amber-500",
          icon: AlertTriangle,
          label: "Warning",
        };
      default:
        return {
          border: "border-blue-500/30",
          bg: "bg-blue-500/10",
          text: "text-blue-500",
          icon: Info,
          label: "Information",
        };
    }
  };

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-4 pointer-events-none w-full max-w-md px-4">
      <AnimatePresence>
        {notifications.map((notification) => {
          const style = getTypeStyle(notification.type);
          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: 20,
                scale: 0.95,
                transition: { duration: 0.2 },
              }}
              layout
              className={`pointer-events-auto flex items-start gap-4 px-6 py-5 rounded-[2rem] border backdrop-blur-3xl`}
              style={{
                background: "var(--surface-1)",
                borderColor: "var(--border-primary)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
              }}
            >
              <div className={`p-3 rounded-2xl ${style.bg} ${style.text}`}>
                <style.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60 ${style.text}`}
                >
                  {style.label}
                </p>
                <p
                  className="text-xs font-black tracking-tight leading-snug uppercase break-words whitespace-normal"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t(notification.message || "") || notification.message}
                </p>
              </div>
              <button
                onClick={() =>
                  setNotifications((prev) =>
                    prev.filter((otherNotification) => otherNotification.id !== notification.id),
                  )
                }
                className="transition-colors p-2"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(event) =>
                  (event.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseLeave={(event) =>
                  (event.currentTarget.style.color = "var(--text-tertiary)")
                }
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
