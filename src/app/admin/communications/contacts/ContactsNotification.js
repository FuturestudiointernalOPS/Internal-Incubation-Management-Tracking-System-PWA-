"use client";

import { CheckCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ContactsNotification({ notification }) {
  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-8 left-1/2 -translate-x-1/2 z-[600] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 ${notification.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          <span className="text-xs font-bold uppercase tracking-widest">
            {notification.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
