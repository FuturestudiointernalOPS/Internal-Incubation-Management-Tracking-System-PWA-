'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Save, Activity, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function TeacherProfile() {
  const [dbUser, setDbUser] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
     try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const res = await fetch('/api/contacts');
        const data = await res.json();
        const found = data.contacts.find(c => c.cid === user.cid || c.email === user.email);
        setDbUser(found);
     } catch(e) {}
  };

  if (!dbUser) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="teacher" activeTab="profile">
       <div className="max-w-4xl mx-auto space-y-12">
          <header className="border-b border-white/5 pb-10">
             <div className="flex items-center gap-4 mb-4">
                <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Reviewer Node</span>
                <div className="h-px w-10 bg-indigo-500/30" />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Security Profile</h1>
             <p className="text-slate-500 font-bold mt-4 opacity-70">Managing your evaluation authority and access credentials.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-1 space-y-6">
                <div className="ios-card bg-mesh py-16 flex flex-col items-center text-center">
                   <div className="w-24 h-24 rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mb-6">
                      <Target className="w-12 h-12 text-emerald-400" />
                   </div>
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter">{dbUser.name}</h3>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">EVALUATION AUTHORITY</p>
                </div>
             </div>

             <div className="md:col-span-2 space-y-8">
                <div className="ios-card bg-[#0d0d18] border-white/5 !p-12">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">Identity Data</h3>
                   <div className="space-y-6">
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Mail className="w-3 h-3" /> Evaluation Email</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.email}</p>
                      </div>
                   </div>
                </div>

                <div className="ios-card bg-indigo-500/5 border-indigo-500/20 !p-12 space-y-8">
                   <div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">Credential Rotation</h4>
                      <p className="text-xs text-slate-400 font-bold mt-2 italic">Update your review terminal access key.</p>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row items-end gap-6">
                      <div className="flex-1 space-y-2 w-full">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-2">Access Token</label>
                         <input 
                            type="text" 
                            defaultValue={dbUser.password}
                            id="teacher_password_field"
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black text-white outline-none focus:border-indigo-500/50 transition-all font-mono"
                         />
                      </div>
                      <button 
                         onClick={async () => {
                            const newPass = document.getElementById('teacher_password_field').value;
                            if(!newPass) return;
                            try {
                               const res = await fetch('/api/contacts', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ cid: dbUser.cid, password: newPass })
                               });
                               if((await res.json()).success) {
                                  alert("Access Token Synchronized.");
                                  fetchProfile();
                               }
                            } catch(e) { alert("Sync Failed."); }
                         }}
                         className="btn-prime !py-4 px-10 flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                         <Save className="w-5 h-5" /> Sync Access
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </DashboardLayout>
  );
}
