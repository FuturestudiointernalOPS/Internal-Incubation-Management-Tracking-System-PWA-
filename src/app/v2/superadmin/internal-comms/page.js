'use client';

import React, { useState, useEffect } from 'react';
import { 
  Send, Users, Briefcase, Shield, 
  MessageSquare, Bell, Search, Filter,
  ChevronRight, MoreVertical, Trash2, Clock,
  CheckCircle2, AlertTriangle, Zap, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function SuperAdminComms() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState({});
  const [messages, setMessages] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [isComposing, setIsComposing] = useState(false);
  const [composeData, setComposeData] = useState({
    target_type: 'individual',
    target_id: '',
    subject: '',
    body: '',
    priority: 'normal'
  });

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(sessionUser);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const msgRes = await fetch('/api/v2/internal-comms');
      const msgData = await msgRes.json();
      if (msgData.success) setMessages(msgData.messages);

      const progRes = await fetch('/api/v2/pm/full-state'); // Reuse existing state fetcher if possible
      const progData = await progRes.json();
      if (progData.success) setPrograms(progData.programs || []);

      setIsLoaded(true);
    } catch (e) { console.error(e); setIsLoaded(true); }
  };

  const handleSendMessage = async () => {
    if (!composeData.body || !composeData.subject) return;
    try {
      const res = await fetch('/api/v2/internal-comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: user.id,
          ...composeData
        })
      });
      if ((await res.json()).success) {
        setIsComposing(false);
        setComposeData({ target_type: 'individual', target_id: '', subject: '', body: '', priority: 'normal' });
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-12">
        
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10">
           <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <Zap className="w-5 h-5 text-[#FF6600]" />
                 <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">Signal Protocol</span>
              </div>
              <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">Internal Command</h2>
              <p className="text-slate-400 font-bold max-w-xl opacity-70">Execute direct communication across the multi-tenant architecture.</p>
           </div>
           <button 
              onClick={() => setIsComposing(true)}
              className="px-12 py-5 bg-[#FF6600] text-black font-black uppercase text-[11px] tracking-widest rounded-[2rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/20 flex items-center gap-4"
           >
              <Send className="w-5 h-5" /> Deploy Message
           </button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
           
           {/* RECENT SIGNAL LOG */}
           <div className="xl:col-span-2 space-y-8">
              <div className="flex items-center justify-between">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Signal Log</h3>
                 <div className="flex items-center gap-4">
                    <button className="p-3 rounded-xl bg-white/5 text-slate-500 hover:text-white transition-all"><Search className="w-4 h-4"/></button>
                    <button className="p-3 rounded-xl bg-white/5 text-slate-500 hover:text-white transition-all"><Filter className="w-4 h-4"/></button>
                 </div>
              </div>

              <div className="space-y-4">
                 {messages.map(msg => (
                    <div key={msg.id} className="ios-card bg-white/[0.01] border-white/5 p-8 flex items-start gap-8 group hover:border-[#FF6600]/20 transition-all">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${msg.priority === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20'}`}>
                          <MessageSquare className="w-6 h-6" />
                       </div>
                       <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${msg.target_type === 'all' ? 'bg-[#FF6600]/80/20 text-indigo-400' : 'bg-white/5 text-slate-500'}`}>
                                   {msg.target_type}
                                </span>
                                <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">{msg.subject}</h4>
                             </div>
                             <span className="text-[10px] font-bold text-slate-600 font-sans">{new Date(msg.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-400 font-bold leading-relaxed">{msg.body}</p>
                          <div className="pt-4 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
                             <span className="text-[#FF6600]">To: {msg.target_id || "All Personnel"}</span>
                             <span className="opacity-20">•</span>
                             <span>Status: {msg.is_read ? 'Intercepted' : 'Transmitting'}</span>
                          </div>
                       </div>
                    </div>
                 ))}
                 {messages.length === 0 && <div className="ios-card border-dashed py-40 text-center italic text-slate-700 text-[11px] uppercase tracking-[0.4em]">No Active Signals in Logic Log...</div>}
              </div>
           </div>

           {/* TARGETING DIRECTORY */}
           <div className="space-y-8">
              <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Active Nodes</h3>
              <div className="space-y-4">
                 <div className="ios-card bg-[#FF6600]/5 border-[#FF6600]/10 p-8">
                    <h4 className="text-[11px] font-black text-[#FF6600] uppercase tracking-widest mb-6">Program Clusters</h4>
                    <div className="space-y-4">
                       {programs.map(prog => (
                          <div key={prog.id} className="flex items-center justify-between group cursor-pointer">
                             <div className="flex items-center gap-4">
                                <div className="w-2 h-2 rounded-full bg-[#FF6600]/30 group-hover:bg-[#FF6600] transition-colors" />
                                <span className="text-[12px] font-black text-white uppercase italic">{prog.name}</span>
                             </div>
                             <ChevronRight className="w-4 h-4 text-slate-800" />
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="ios-card bg-white/[0.01] border-white/5 p-8">
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6">Operational Roles</h4>
                    <div className="space-y-4 text-white font-black text-[12px] italic uppercase tracking-tighter">
                       <p className="hover:text-[#FF6600] cursor-pointer transition-colors">Program Managers</p>
                       <p className="hover:text-[#FF6600] cursor-pointer transition-colors">Group Leaders</p>
                       <p className="hover:text-[#FF6600] cursor-pointer transition-colors">Tactical Teachers</p>
                       <p className="hover:text-[#FF6600] cursor-pointer transition-colors">Participants</p>
                    </div>
                 </div>
              </div>
           </div>

        </div>

        {/* COMPOSE DRAWER */}
        <AnimatePresence>
           {isComposing && (
              <div className="fixed inset-0 z-[300] flex items-center justify-center p-12 bg-black/80 backdrop-blur-md">
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-[3rem] p-16 shadow-2xl space-y-12"
                 >
                    <div className="flex justify-between items-start">
                       <div className="space-y-4">
                          <div className="flex items-center gap-4">
                             <Zap className="w-5 h-5 text-[#FF6600]" />
                             <span className="text-[11px] font-black text-[#FF6600] uppercase tracking-[0.5em] italic">Signal Origin</span>
                          </div>
                          <h3 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">New Signal</h3>
                       </div>
                       <button onClick={() => setIsComposing(false)} className="p-5 bg-white/5 rounded-3xl text-slate-600 hover:text-white transition-all transform hover:rotate-90"><X className="w-8 h-8"/></button>
                    </div>

                    <div className="space-y-8">
                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Signal Target</label>
                             <div className="relative">
                                <select 
                                   className="w-full bg-[#0d0d18] border border-white/10 p-5 rounded-2xl text-white outline-none font-black appearance-none cursor-pointer focus:border-[#FF6600] shadow-inner uppercase tracking-widest text-[11px]"
                                   value={composeData.target_type}
                                   onChange={e => setComposeData({...composeData, target_type: e.target.value})}
                                >
                                   <option value="individual">INDIVIDUAL CID</option>
                                   <option value="program">PROGRAM CLUSTER</option>
                                   <option value="role">TACTICAL ROLE</option>
                                   <option value="all">GLOBAL BROADCAST</option>
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-700 pointer-events-none" />
                             </div>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Target Identifier</label>
                             <input 
                                placeholder="CID, Program ID, or Role..." 
                                className="w-full bg-[#0d0d18] border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-[#FF6600] transition-all font-black text-[11px] uppercase tracking-widest shadow-inner" 
                                value={composeData.target_id}
                                onChange={e => setComposeData({...composeData, target_id: e.target.value})}
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Subject Line</label>
                          <input 
                             placeholder="Operational Subject..." 
                             className="w-full bg-[#0d0d18] border border-white/10 p-7 rounded-3xl text-white outline-none focus:border-[#FF6600] transition-all font-black text-lg italic shadow-inner" 
                             value={composeData.subject}
                             onChange={e => setComposeData({...composeData, subject: e.target.value})}
                          />
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Signal Body</label>
                          <textarea 
                             rows={6}
                             placeholder="Architect signal content..." 
                             className="w-full bg-[#0d0d18] border border-white/10 p-8 rounded-[2rem] text-white outline-none focus:border-[#FF6600] transition-all font-bold leading-relaxed shadow-inner" 
                             value={composeData.body}
                             onChange={e => setComposeData({...composeData, body: e.target.value})}
                          />
                       </div>

                       <button 
                          onClick={handleSendMessage}
                          className="w-full py-7 bg-[#FF6600] text-black font-black uppercase text-[12px] tracking-[0.4em] rounded-[2rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/30 italic"
                       >
                          Transmit Signal
                       </button>
                    </div>
                 </motion.div>
              </div>
           )}
        </AnimatePresence>

      </div>
    </DashboardLayout>
  );
}

function ChevronDown(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>
  );
}

function X(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}
