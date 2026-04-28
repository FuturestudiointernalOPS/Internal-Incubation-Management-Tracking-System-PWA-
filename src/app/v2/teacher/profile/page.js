'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Save, Activity, Target, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function TeacherProfile() {
  const [dbUser, setDbUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
     try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const res = await fetch('/api/contacts');
        const data = await res.json();
        if (data.success && data.contacts) {
           const found = data.contacts.find(c => c.cid === user.cid || c.email === user.email);
           if (found) {
              setDbUser(found);
           } else {
              setDbUser({
                 name: user.name || 'Authorized Reviewer',
                 email: user.email || 'teacher@impactos.com',
                 role: 'teacher',
                 cid: user.cid || 'TCH-FALLBACK',
                 password: 'UNSET'
              });
           }
        }
     } catch(e) {
        console.error(e);
     } finally {
        setLoading(false);
     }
  };

  if (loading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/80/20 border-t-[#FF6600]/80 rounded-full animate-spin" />
     </div>
  );

  if (!dbUser) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center p-8">
        <div className="ios-card bg-rose-500/5 border-rose-500/20 p-12 text-center max-w-md">
           <Shield className="w-16 h-16 text-rose-500 mx-auto mb-6 opacity-50" />
           <h2 className="text-2xl font-black text-white uppercase mb-4">Profile Sync Error</h2>
           <p className="text-slate-500 font-bold text-sm leading-relaxed mb-8">We could not synchronize your reviewer credentials with the database. Please re-authenticate.</p>
           <button onClick={() => window.location.href='/terminal'} className="btn-prime w-full">Re-Authenticate</button>
        </div>
     </div>
  );

  return (
    <DashboardLayout role="teacher" activeTab="profile">
       <div className="max-w-4xl mx-auto space-y-12">
          <header className="border-b border-white/5 pb-10">
             <div className="flex items-center gap-4 mb-4">
                <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Reviewer Node</span>
                <div className="h-px w-10 bg-[#FF6600]/80/30" />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">My Profile</h1>
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
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><User className="w-3 h-3" /> Full Name</p>
                         <input 
                            id="teacher_name_field"
                            defaultValue={dbUser.name}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black text-white outline-none focus:border-[#FF6600]/50 transition-all"
                         />
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Mail className="w-3 h-3" /> Evaluation Email</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.email}</p>
                      </div>
                   </div>
                </div>

                <div className="ios-card bg-[#FF6600]/80/5 border-[#FF6600]/80/20 !p-12 space-y-8">
                   <div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">Security Settings</h4>
                      <p className="text-xs text-slate-400 font-bold mt-2 italic">Update your review terminal access key.</p>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row items-end gap-6">
                      <div className="flex-1 space-y-2 w-full relative">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-2">Access Token</label>
                         <div className="relative group">
                            <input 
                               type={showPassword ? "text" : "password"} 
                               defaultValue={dbUser.password}
                               id="teacher_password_field"
                               className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pr-14 text-xs font-black text-white outline-none focus:border-[#FF6600]/80/50 transition-all font-mono"
                            />
                            <button 
                               onClick={() => setShowPassword(!showPassword)}
                               className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-[#FF6600]/80 transition-colors"
                            >
                               {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                         </div>
                      </div>
                      <button 
                         onClick={async () => {
                            const newPass = document.getElementById('teacher_password_field').value;
                            const newName = document.getElementById('teacher_name_field').value;
                            if(!newPass && !newName) return;
                            try {
                               const res = await fetch('/api/contacts', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                     cid: dbUser.cid, 
                                     password: newPass || dbUser.password,
                                     name: newName || dbUser.name
                                  })
                               });
                               if((await res.json()).success) {
                                  window.dispatchEvent(new CustomEvent('impactos:notify', { 
                                     detail: { type: 'success', message: 'Settings Saved.' } 
                                  }));
                                  fetchProfile();
                               }
                            } catch(e) { 
                               window.dispatchEvent(new CustomEvent('impactos:notify', { 
                                  detail: { type: 'error', message: 'Update Failed.' } 
                               }));
                            }
                         }}
                         className="btn-prime !py-4 px-10 flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                         <Save className="w-5 h-5" /> Save Settings
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </DashboardLayout>
  );
}
