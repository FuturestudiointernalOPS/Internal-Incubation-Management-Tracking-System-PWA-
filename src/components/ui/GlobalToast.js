'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * GLOBAL TOAST SYSTEM
 * Unified notification hub for the ImpactOS terminal.
 * Supports: success, error, info, warning.
 */
export default function GlobalToast() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleNotify = (e) => {
      const { type = 'info', message, duration = 4000 } = e.detail;
      const id = Date.now();
      
      setNotifications(prev => [...prev, { id, type, message }]);
      
      const timer = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
      
      return () => clearTimeout(timer);
    };

    window.addEventListener('impactos:notify', handleNotify);
    return () => window.removeEventListener('impactos:notify', handleNotify);
  }, []);

  const getTypeStyle = (type) => {
    switch (type) {
      case 'success': return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-500', icon: CheckCircle, label: 'Success' };
      case 'error': return { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-500', icon: AlertCircle, label: 'Critical Error' };
      case 'warning': return { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-500', icon: AlertTriangle, label: 'Warning' };
      default: return { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-500', icon: Info, label: 'Information' };
    }
  };

  return (
    <div className="fixed bottom-10 right-10 z-[2000] flex flex-col gap-4 pointer-events-none w-full max-w-sm">
      <AnimatePresence>
        {notifications.map((n) => {
          const style = getTypeStyle(n.type);
          return (
            <motion.div 
              key={n.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
              layout
              className={`pointer-events-auto flex items-center gap-4 px-6 py-5 rounded-[2rem] bg-white dark:bg-[#0d0d18]/90 border border-slate-200 dark:border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl`}
            >
              <div className={`p-3 rounded-2xl ${style.bg} ${style.text}`}>
                <style.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                 <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-60 ${style.text}`}>
                   {style.label}
                 </p>
                 <p className="text-xs font-black text-slate-800 dark:text-white tracking-tight leading-tight uppercase truncate">{n.message}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(nt => nt.id !== n.id))}
                className="text-slate-400 hover:text-slate-800 dark:text-slate-600 dark:hover:text-white transition-colors p-2"
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
