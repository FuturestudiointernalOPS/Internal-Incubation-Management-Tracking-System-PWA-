'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Shield, Activity, Save, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function PMProfile() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(sessionUser);
    const identifier = sessionUser?.cid || sessionUser?.id || sessionUser?.email;
    if (identifier) {
       fetchProfile(identifier);
    } else {
       setLoading(false);
    }
  }, []);

  const fetchProfile = async (identifier) => {
      console.log("Profile Sync: Initiating for ID:", identifier);
      try {
         const res = await fetch('/api/contacts');
         const data = await res.json();
         if (data.success && data.contacts) {
            const found = data.contacts.find(c => c.cid === identifier || c.id === identifier || c.email === identifier);
            console.log("Profile Sync: Result Found:", found ? "SUCCESS" : "FAILED");
            if (found) {
               setDbUser(found);
            } else {
               // Fallback for session users not in DB yet
               setDbUser({
                  name: user?.name || 'User',
                  email: user?.email || 'agent@impactos.com',
                  role: user?.role || 'program_manager',
                  cid: identifier,
                  password: 'UNSET'
               });
            }
         }
      } catch(e) { 
         console.error("Profile Sync Error:", e);
      } finally {
         setLoading(false);
      }
  };

  if (loading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
     </div>
  );

  // If no user found at all, show a critical error state instead of crashing
  if (!dbUser) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center p-8">
        <div className="ios-card bg-rose-500/5 border-rose-500/20 p-12 text-center max-w-md">
           <Shield className="w-16 h-16 text-rose-500 mx-auto mb-6 opacity-50" />
           <h2 className="text-2xl font-black text-white uppercase mb-4">Profile Sync Error</h2>
           <p className="text-slate-500 font-bold text-sm leading-relaxed mb-8">We could not synchronize your security credentials with the database. Please re-authenticate.</p>
           <button onClick={() => window.location.href='/terminal'} className="btn-prime w-full">Re-Authenticate</button>
        </div>
     </div>
  );

  return (
    <DashboardLayout role="program_manager" activeTab="profile">
       <div className="max-w-4xl mx-auto space-y-12">
          <header className="border-b border-white/5 pb-10">
             <div className="flex items-center gap-4 mb-4">
                <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Account Settings</span>
                <div className="h-px w-10 bg-white/10" />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">My Profile</h1>
             <p className="text-slate-500 font-bold mt-4 opacity-70">Manage your platform identity and account credentials.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-1 space-y-6">
                <div className="ios-card bg-mesh py-16 flex flex-col items-center text-center">
                   <div className="w-24 h-24 rounded-[2rem] bg-[#FF6600]/80/10 border-2 border-[#FF6600]/80/20 flex items-center justify-center mb-6">
                      <User className="w-12 h-12 text-indigo-400" />
                   </div>
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter">{dbUser.name}</h3>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{dbUser.role}</p>
                </div>
                
                <div className="ios-card bg-[#0d0d18] border-white/5 p-8 space-y-4">
                   <div className="flex items-center gap-4">
                      <Shield className="w-5 h-5 text-[#FF6600]/80" />
                      <div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Account Type</p>
                         <p className="text-xs font-black text-white uppercase">System Access</p>
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
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">Personal Information</h3>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><User className="w-3 h-3" /> Full Name</p>
                         <input 
                            id="edit_name_field"
                            defaultValue={dbUser.name}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black text-white outline-none focus:border-[#FF6600]/50 transition-all shadow-inner"
                         />
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Mail className="w-3 h-3" /> Email Address</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.email}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Phone className="w-3 h-3" /> Phone Number</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.phone || 'Not Integrated'}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><Calendar className="w-3 h-3" /> Date of Birth</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.dob || 'Not Assigned'}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"><MapPin className="w-3 h-3" /> Home Address</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.address || 'Confidential'}</p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                         <p className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Mother&apos;s Maiden Name</p>
                         <p className="text-sm font-bold text-white bg-white/5 p-4 rounded-xl border border-white/5">{dbUser.mother_name || 'N/A'}</p>
                      </div>
                   </div>
                </div>

                <div className="ios-card bg-[#FF6600]/80/5 border-[#FF6600]/80/20 !p-12 space-y-8">
                   <div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">Security Settings</h4>
                      <p className="text-xs text-slate-400 font-bold mt-2 italic">Synchronize a new security token to secure your terminal access.</p>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row items-end gap-6">
                      <div className="flex-1 space-y-2 w-full relative">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-2">New Password</label>
                         <div className="relative group">
                            <input 
                               type={showPassword ? "text" : "password"} 
                               defaultValue={dbUser.password}
                               id="new_password_field"
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
                            const newPass = document.getElementById('new_password_field').value;
                            const newName = document.getElementById('edit_name_field').value;
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
                               const data = await res.json();
                               if(data.success) {
                                  window.dispatchEvent(new CustomEvent('impactos:notify', { 
                                     detail: { type: 'success', message: 'Settings Saved.' } 
                                  }));
                                  fetchProfile(dbUser.cid);
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
