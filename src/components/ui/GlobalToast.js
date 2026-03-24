'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function GlobalToast() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleNotify = (e) => {
      const { type, message, duration = 4000 } = e.detail;
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

  return (
    <div className="fixed bottom-8 right-8 z-[1000] flex flex-col gap-3 pointer-events-none">
      {notifications.map((n) => (
        <div 
          key={n.id}
          className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl bg-[#0d0d18] border shadow-2xl min-w-[320px] backdrop-blur-3xl animate-in slide-in-from-right-4 duration-200 ${n.type === 'success' ? 'border-emerald-500/30' : 'border-rose-500/30'}`}
        >
          <div className={`p-2 rounded-xl h-fit ${n.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {n.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
             <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${n.type === 'success' ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
               {n.type === 'success' ? 'Operation Success' : 'System Error'}
             </p>
             <p className="text-sm font-bold text-white tracking-tight leading-tight">{n.message}</p>
          </div>
          <button 
            onClick={() => setNotifications(prev => prev.filter(nt => nt.id !== n.id))}
            className="text-slate-600 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
