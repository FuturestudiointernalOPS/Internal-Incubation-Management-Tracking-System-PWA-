'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, Mail, Phone, Calendar, MapPin, User, ChevronRight, CheckCircle } from 'lucide-react';
import { IMPACT_CACHE } from '@/utils/impactCache';
import GlobalToast from '@/components/ui/GlobalToast';

/**
 * PUBLIC REGISTRATION FORM (Family-Specific)
 * Located at /register/[family]
 */
export default function FamilyRegistrationLink() {
  const params = useParams();
  const rawFamily = params.family;
  const decodedFamilyName = decodeURIComponent(rawFamily);
  
  const [formData, setFormData] = useState({
     name: '', email: '', phone: '', address: '', dob: ''
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success

  const handleSubmit = async (e) => {
     e.preventDefault();
     setStatus('loading');
     try {
        const payloadName = formData.name?.trim() || `Anonymous Guest`;
        const payloadEmail = formData.email?.trim() || `guest_${Date.now()}_${Math.floor(Math.random()*1000)}@system.local`;

        const payload = [{ 
           ...formData, 
           name: payloadName,
           email: payloadEmail,
           group_name: decodedFamilyName 
        }];

        const res = await fetch('/api/contacts', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success && data.inserted > 0) {
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'success', message: 'Registration successfully synced with central database.' } 
           }));
           setStatus('success');
           IMPACT_CACHE.clear('contacts');
        } else {
           const errReason = data.errors && data.errors.length > 0 ? data.errors[0].error : "Database error";
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'error', message: `Registration failed: ${errReason}` } 
           }));
           setStatus('idle');
        }
     } catch (err) {
        console.error(err);
        setStatus('idle');
     }
  };

  if (status === 'success') {
     return (
        <div className="min-h-screen bg-[#030308] flex items-center justify-center p-6">
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
             className="max-w-md w-full bg-white/[0.02] border border-white/5 p-12 rounded-[2rem] text-center"
           >
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                 <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Registration Confirmed</h2>
              <p className="text-slate-400 font-bold mb-6">You have been successfully added to the <span className="text-white uppercase tracking-widest text-[10px] bg-white/5 py-1 px-2 rounded ml-1">{decodedFamilyName}</span> group.</p>
              <p className="text-xs text-slate-500 font-bold italic">You may now close this window.</p>
           </motion.div>
           <GlobalToast />
        </div>
     );
  }


  return (
    <div className="min-h-screen bg-[#030308] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
       {/* Abstract Background */}
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[150px] pointer-events-none rounded-full" />
       <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[150px] pointer-events-none rounded-full" />
       
       <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl relative z-10"
       >
          <div className="text-center mb-10">
             <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg mx-auto mb-6">
               <Activity className="text-white w-8 h-8" />
             </div>
             <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-4">
               <ShieldCheck className="w-4 h-4 text-emerald-400" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Target Group: {decodedFamilyName}</span>
             </div>
             <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-4">Secure Intake Form</h1>
             <p className="text-slate-400 font-bold">Please fill in your details to process your placement. All fields are completely optional.</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 p-8 sm:p-12 rounded-[2rem] space-y-6 shadow-2xl backdrop-blur-xl group">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Full Identity / Name</label>
                <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                   <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Satoshi Nakamoto" className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 outline-none rounded-xl py-4 pl-12 pr-6 font-bold text-white transition-all" />
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Email Address</label>
                   <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="hello@world.com" className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 outline-none rounded-xl py-4 pl-12 pr-6 font-bold text-white transition-all" />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Phone Number</label>
                   <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+1 234 567 8900" className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 outline-none rounded-xl py-4 pl-12 pr-6 font-bold text-white transition-all" />
                   </div>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Date of Birth</label>
                <div className="relative">
                   <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                   <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 outline-none rounded-xl py-4 pl-12 pr-6 font-bold text-white transition-all" />
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Physical Address</label>
                <div className="relative">
                   <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                   <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full address..." className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 outline-none rounded-xl py-4 pl-12 pr-6 font-bold text-white transition-all" />
                </div>
             </div>

             <button 
                type="submit" 
                disabled={status === 'loading'}
                className="w-full relative overflow-hidden group/btn disabled:opacity-50 mt-4"
             >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300 group-hover/btn:scale-[1.02]" />
                <div className="relative py-4 px-8 flex items-center justify-center gap-2">
                   <span className="font-black uppercase tracking-widest text-sm text-white">{status === 'loading' ? 'Encrypting...' : 'Secure Submit'}</span>
                   <ChevronRight className="w-5 h-5 text-white group-hover/btn:translate-x-1 transition-transform" />
                </div>
             </button>
          </form>
       </motion.div>
       <GlobalToast />
    </div>
  );
}
