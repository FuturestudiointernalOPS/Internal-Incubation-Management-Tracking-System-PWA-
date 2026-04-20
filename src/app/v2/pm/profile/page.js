'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Shield, Activity, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function PMProfile() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(sessionUser);
    if (sessionUser?.id) {
       fetchProfile(sessionUser.id);
    }
  }, []);

  const fetchProfile = async (cid) => {
     try {
        const res = await fetch('/api/contacts');
        const data = await res.json();
        const found = data.contacts.find(c => c.cid === cid);
        setDbUser(found);
     } catch(e) {}
  };

  if (!user || !dbUser) return null;

  return (
    <DashboardLayout role="program_manager" activeTab="profile">
       <div className="max-w-4xl mx-auto space-y-12">
          <header className="border-b border-white/5 pb-10">
             <div className="flex items-center gap-4 mb-4">
                <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Personal Node</span>
                <div className="h-px w-10 bg-indigo-500/30" />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Security Profile</h1>
             <p className="text-slate-500 font-bold mt-4 opacity-70">Managing your platform identity and operational credentials.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-1 space-y-6">
                <div className="ios-card bg-mesh py-16 flex flex-col items-center text-center">
                   <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center mb-6">
                      <User className="w-12 h-12 text-indigo-400" />
                   </div>
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter">{dbUser.name}</h3>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{dbUser.role}</p>
                </div>
                
                <div className="ios-card bg-[#0d0d18] border-white/5 p-8 space-y-4">
                   <div className="flex items-center gap-4">
                      <Shield className="w-5 h-5 text-indigo-500" />
                      <div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Access Level</p>
                         <p className="text-xs font-black text-white uppercase">Operational Authority</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <Activity className="w-5 h-5 text-emerald-500" />
                      <div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Status</p>
                         <p className="text-xs font-black text-emerald-400 uppercase">System Active</p>
                      </div>
                   </div>
                </div>
             </div>

             <div className="md:col-span-2 space-y-8">
                <div className="ios-card bg-[#0d0d18] border-white/5 !p-12">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">Contact Matrix</h3>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Mail className="w-3 h-3" /> Mail Index</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.email}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Phone className="w-3 h-3" /> Comm Line</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.phone || 'Not Integrated'}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Calendar className="w-3 h-3" /> Temporal Node (DOB)</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.dob || 'Not Assigned'}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><MapPin className="w-3 h-3" /> Physical Location</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.address || 'Confidential'}</p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Mother&apos;s Maiden Name</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.mother_name || 'N/A'}</p>
                      </div>
                   </div>
                </div>

                <div className="ios-card bg-indigo-500/5 border-indigo-500/20 !p-12 flex flex-col sm:flex-row items-center justify-between gap-8">
                   <div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">Credential Modification</h4>
                      <p className="text-xs text-slate-400 font-bold mt-2 italic">If you need to sync a new security key (password), contact the Super Admin Core.</p>
                   </div>
                   <button className="btn-prime !py-4 px-10 opacity-50 cursor-not-allowed flex items-center gap-2">
                      <Save className="w-5 h-5" /> Request Sync
                   </button>
                </div>
             </div>
          </div>
       </div>
    </DashboardLayout>
  );
}
