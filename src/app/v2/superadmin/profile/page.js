'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Save, Activity, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function SuperAdminProfile() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);

  useEffect(() => {
    const sessionUser = { id: 'prime-2026-active', role: 'super_admin', name: 'Master Admin', email: 'admin@impactos.com' };
    setUser(sessionUser);
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
     try {
        const res = await fetch('/api/contacts');
        const data = await res.json();
        // Super Admin is usually the one with role 'super_admin' or email admin@impactos.com
        const found = data.contacts.find(c => c.role === 'super_admin' || c.email === 'admin@impactos.com');
        if (found) setDbUser(found);
        else {
           // Fallback if no db record matches (shouldn't happen)
           setDbUser({ name: 'Master Admin', email: 'admin@impactos.com', role: 'super_admin', cid: 'ADM-001', password: 'FS-DEFAULT' });
        }
     } catch(e) {}
  };

  if (!dbUser) return null;

  return (
    <DashboardLayout role="super_admin" activeTab="profile">
       <div className="max-w-4xl mx-auto space-y-12">
          <header className="border-b border-white/5 pb-10">
             <div className="flex items-center gap-4 mb-4">
                <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Executive Node</span>
                <div className="h-px w-10 bg-indigo-500/30" />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Command Profile</h1>
             <p className="text-slate-500 font-bold mt-4 opacity-70">Managing root authority and structural credentials.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-1 space-y-6">
                <div className="ios-card bg-mesh py-16 flex flex-col items-center text-center">
                   <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center mb-6">
                      <Shield className="w-12 h-12 text-indigo-400" />
                   </div>
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter">{dbUser.name}</h3>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">ROOT AUTHORITY</p>
                </div>
             </div>

             <div className="md:col-span-2 space-y-8">
                <div className="ios-card bg-[#0d0d18] border-white/5 !p-12">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">Core Identity</h3>
                   <div className="space-y-6">
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Mail className="w-3 h-3" /> Root Email</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.email}</p>
                      </div>
                   </div>
                </div>

                <div className="ios-card bg-indigo-500/5 border-indigo-500/20 !p-12 space-y-8">
                   <div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">Root Token Rotation</h4>
                      <p className="text-xs text-slate-400 font-bold mt-2 italic">Update your master access key to secure the command HQ.</p>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row items-end gap-6">
                      <div className="flex-1 space-y-2 w-full">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-2">Master Access Key</label>
                         <input 
                            type="text" 
                            defaultValue={dbUser.password}
                            id="sa_password_field"
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black text-white outline-none focus:border-indigo-500/50 transition-all font-mono"
                         />
                      </div>
                      <button 
                         onClick={async () => {
                            const newPass = document.getElementById('sa_password_field').value;
                            if(!newPass) return;
                            try {
                               const res = await fetch('/api/contacts', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ cid: dbUser.cid, password: newPass })
                               });
                               if((await res.json()).success) {
                                  alert("Master Security Token Synchronized.");
                                  fetchProfile();
                               }
                            } catch(e) { alert("Sync Failed."); }
                         }}
                         className="btn-prime !py-4 px-10 flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                         <Save className="w-5 h-5" /> Sync Root
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </DashboardLayout>
  );
}
