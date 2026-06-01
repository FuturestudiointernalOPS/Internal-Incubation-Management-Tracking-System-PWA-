"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function AppModal({ isOpen, onClose, title, children, size = "md" }) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const widthMap = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full ${widthMap[size] || widthMap.md} rounded-2xl p-8 shadow-2xl overflow-hidden`}
            style={{ background: "var(--surface-1)", border: "1px solid var(--border-primary)" }}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg transition-all hover:rotate-90"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
