'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Plus, Users, Mail, Phone, Search, 
  AlertCircle, X, Loader2, CheckCircle, Download, 
  CreditCard, MapPin, Calendar as CalendarIcon, Edit3, Briefcase,
  Key, MessageCircle, Send, Globe, Shield, User, RefreshCw, Star, Link as LinkIcon, Trash2, Archive
} from 'lucide-react';
import Papa from 'papaparse';
import { IMPACT_CACHE } from '@/utils/impactCache';
import { useSearchParams } from 'next/navigation';

/**
 * CORPORATE REGISTRY (FUTURE STUDIO)
 * Specialized management of Staff and Project Managers.
 */
function ContactsPageContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  
  const [contacts, setContacts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modals & UI State
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkGroupName, setBulkGroupName] = useState('');
  const [isBulkNew, setIsBulkNew] = useState(false);
  
  const [showGroupCredsModal, setShowGroupCredsModal] = useState(false);
  const [groupCredsForm, setGroupCredsForm] = useState({ id: '', name: '', email: '', password: '' });

  const [selectedGroup, setSelectedGroup] = useState('All Contacts');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', program_id: '', group_name: '', member_ids: [] });
  const [programs, setPrograms] = useState([]);
  const [families, setFamilies] = useState([]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (roleParam) {
      // Map 'Staff' to 'Future Studio' if legacy links are used, else use raw param
      const normalized = roleParam.toLowerCase() === 'staff' ? 'Future Studio' : roleParam;
      setSelectedGroup(normalized);
    }
  }, [roleParam]);

  const fileInputRef = useRef(null);
  
  // Forms
  const [familyForm, setFamilyForm] = useState({ name: '', program_id: '' });
  const [form, setForm] = useState({ cid: '', name: '', email: '', phone: '', address: '', dob: '', group_name: '', role: 'staff', gender: '', mother_name: '', password: '' });
  const [credsForm, setCredsForm] = useState({ cid: '', name: '', email: '', password: '', isDirty: false });

  useEffect(() => { 
    const cachedContacts = IMPACT_CACHE.get('contacts');
    const cachedFamilies = IMPACT_CACHE.get('families');
    if (cachedContacts && Array.isArray(cachedContacts)) {
      setContacts(cachedContacts);
      setLoading(false);
    }
    if (cachedFamilies) setFamilies(cachedFamilies);

    fetchRegistryData();
  }, []);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const fetchRegistryData = async () => {
    try {
      if (!IMPACT_CACHE.get('contacts')) setLoading(true);
      const [res, teamRes, progRes] = await Promise.all([
         fetch('/api/v2/contacts/full-state'),
         fetch('/api/v2/pm/teams'),
         fetch('/api/v2/pm/programs')
      ]);
      const data = await res.json();
      const tData = await teamRes.json();
      const pData = await progRes.json();

      if (data.success) {
        setContacts(data.contacts || []);
        setFamilies(data.families || []);
        IMPACT_CACHE.set('contacts', data.contacts || []);
        IMPACT_CACHE.set('families', data.families || []);
      }
      if (tData.success) setTeams(tData.teams || []);
      if (pData.success) setPrograms(pData.programs || []);
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
          detail: { type: 'error', message: 'Registry Synchronization Failure.' } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleCredsUpdate = async (e = null) => {
    if (e) e.preventDefault();
    if (!credsForm.password) return;
    
    try {
      const res = await fetch('/api/contacts', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ cid: credsForm.cid, password: credsForm.password })
      });
      const data = await res.json();
      if (data.success) {
         fetchRegistryData();
         setCredsForm(prev => ({ ...prev, isDirty: false }));
         window.dispatchEvent(new CustomEvent('impactos:notify', { 
             detail: { type: 'success', message: 'Credentials updated successfully.' } 
         }));
         return true;
      }
    } catch (e) {
       console.error(e);
    }
    return false;
  };

  const handleCloseCredsModal = async () => {
     if (credsForm.isDirty) {
        await handleCredsUpdate();
     }
     setShowCredsModal(false);
  };

  const filtered = (Array.isArray(contacts) ? contacts : []).filter(c => {
    const searchVal = search.toLowerCase();
    const nameMatch = (c.name || '').toLowerCase().includes(searchVal);
    const emailMatch = (c.email || '').toLowerCase().includes(searchVal);
    const cidMatch = (c.cid || '').toLowerCase().includes(searchVal);
    const matchesSearch = nameMatch || emailMatch || cidMatch;
    
    const matchesGroup = selectedGroup === 'All Contacts' || c.group_name?.toUpperCase() === selectedGroup.toUpperCase();
    const matchesArchive = showArchived ? !!c.deleted : !c.deleted;
    return matchesSearch && matchesGroup && matchesArchive;
  });

  const handleBulkSubmit = async () => {
     if (!bulkFile) return;
     if (!bulkGroupName && !isBulkNew) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: 'Select or name a group.' }}));
        return;
     }

     const finalGroupName = bulkGroupName;

     // If new group, create it first
     if (isBulkNew) {
        try {
           await fetch('/api/families', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: finalGroupName })
           });
        } catch (e) { console.error(e); }
     }

     Papa.parse(bulkFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
           const payload = results.data.map(row => ({
              name: row.name || row.Name || row.fullName || '',
              email: row.email || row.Email || '',
              phone: row.phone || row.Phone || '',
              group_name: finalGroupName,
              role: 'staff',
              password: generatePassword()
           })).filter(c => c.name && c.email);

           if (payload.length === 0) {
              window.dispatchEvent(new CustomEvent('impactos:notify', { 
                  detail: { type: 'error', message: 'No valid data. Headers must match: name, email, phone.' } 
              }));
              return;
           }

           try {
              const res = await fetch('/api/contacts', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(payload)
              });
              
              const data = await res.json();
              if (data.success && data.inserted > 0) {
                 fetchRegistryData();
                 setShowBulkModal(false);
                 setBulkFile(null);
                 setBulkGroupName('');
                 window.dispatchEvent(new CustomEvent('impactos:notify', { 
                     detail: { type: 'success', message: `${data.inserted} contacts assigned to ${finalGroupName}.` } 
                 }));
              } else {
                 const errorMsg = data.errors?.[0]?.error || 'No records were saved (Duplicate Email?).';
                 window.dispatchEvent(new CustomEvent('impactos:notify', { 
                     detail: { type: 'error', message: errorMsg } 
                 }));
              }
           } catch (err) { console.error(err); }
        }
     });
  };

  const onFileSelect = (e) => {
     const file = e.target.files[0];
     if (!file) return;
     setBulkFile(file);
     setShowBulkModal(true);
  };

  const getWhatsAppLink = (c, passwordOverride = null) => {
     const phone = (c.phone || '').replace(/[^0-9]/g, '');
     if (!phone) return '#';
     
     const password = passwordOverride || c.password || 'N/A';
     const loginUrl = typeof window !== 'undefined' ? window.location.origin + '/login' : 'https://impactos.app/login';
     
     const message = `Hello ${c.name},\n\nYour ImpactOS account has been provisioned.\n\nURL: ${loginUrl}\nUsername: ${c.email}\nPassword: ${password}\n\nPlease login and secure your account.`;
     
     return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <DashboardLayout role="super_admin" activeTab="Future Studio" modals={
      <AnimatePresence mode="wait">
        {showTeamModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl" onClick={() => setShowTeamModal(false)}>
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-lg !p-12 space-y-8 border-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Deploy New Unit ({selectedGroup})</h3>
                   <button onClick={() => setShowTeamModal(false)} className="text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all">
                      <X className="w-5 h-5" />
                   </button>
                </div>
                <div className="space-y-6">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Unit Name</label>
                      <input value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} placeholder="e.g. Alpha Squad..." className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Assigned Program</label>
                      <select value={teamForm.program_id} onChange={e => setTeamForm({...teamForm, program_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold appearance-none">
                         <option value="" className="bg-[#0f0f1a]">Select Program...</option>
                         {programs.map(p => <option key={p.id} value={p.id} className="bg-[#0f0f1a]">{p.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest italic">Member Assignment Pool ({filtered.length})</label>
                      <div className="max-h-48 overflow-y-auto space-y-2 p-4 bg-black/40 rounded-2xl border border-white/5 custom-scrollbar">
                         {filtered.map(c => (
                            <label key={c.cid} className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all border ${teamForm.member_ids.includes(c.cid) ? 'bg-[#FF6600]/10 border-[#FF6600]/20' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                               <input 
                                  type="checkbox" 
                                  checked={teamForm.member_ids.includes(c.cid)}
                                  onChange={e => {
                                     const ids = e.target.checked 
                                        ? [...teamForm.member_ids, c.cid]
                                        : teamForm.member_ids.filter(id => id !== c.cid);
                                     setTeamForm({...teamForm, member_ids: ids});
                                  }}
                                  className="w-5 h-5 accent-[#FF6600] rounded-lg"
                               />
                               <div className="flex flex-col">
                                  <span className="text-[11px] font-black text-white uppercase tracking-tighter">{c.name}</span>
                                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{c.email}</span>
                               </div>
                            </label>
                         ))}
                      </div>
                   </div>
                </div>
                <div className="pt-4">
                   <button 
                      disabled={isSubmittingTeam}
                      onClick={async () => {
                         if (!teamForm.name || !teamForm.program_id) {
                            window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: 'Name and Program required.' }}));
                            return;
                         }
                         setIsSubmittingTeam(true);
                         try {
                            const res = await fetch('/api/v2/pm/teams', {
                               method: 'POST',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify({ ...teamForm, group_name: selectedGroup })
                            });
                            const data = await res.json();
                            if (data.success) {
                               setShowTeamModal(false);
                               setTeamForm({ name: '', program_id: '', group_name: '', member_ids: [] });
                               fetchRegistryData();
                               window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: `Unit ${teamForm.name} deployed successfully.` }}));
                            }
                         } catch (e) {
                            console.error(e);
                         } finally {
                            setIsSubmittingTeam(false);
                         }
                      }} 
                      className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all ${isSubmittingTeam ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-[#FF6600] text-white shadow-orange-600/20 hover:scale-[1.02]'}`}
                   >
                      {isSubmittingTeam ? (
                         <div className="flex items-center justify-center gap-3">
                            <Loader2 className="w-4 h-4 animate-spin" /> Deploying System...
                         </div>
                      ) : 'DEPLOY OPERATIONAL UNIT'}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
        {showGroupCredsModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl" onClick={() => setShowGroupCredsModal(false)}>
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-sm !p-12 space-y-8 border-white/10 text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center gap-4 mb-6">
                   <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500">
                      <Shield className="w-8 h-8" />
                   </div>
                   <div>
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Group Access</h3>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Shared Credentials: {groupCredsForm.name}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="space-y-1 text-left">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Shared Username (Email)</label>
                      <input 
                         value={groupCredsForm.email} 
                         onChange={e => setGroupCredsForm({...groupCredsForm, email: e.target.value})} 
                         placeholder="Group email or username..." 
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold" 
                      />
                   </div>
                   <div className="space-y-1 text-left">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Shared Password</label>
                      <div className="relative">
                         <input 
                            type={showPassword ? "text" : "password"} 
                            value={groupCredsForm.password} 
                            onChange={e => setGroupCredsForm({...groupCredsForm, password: e.target.value})} 
                            placeholder="Enter shared password..." 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold pr-12" 
                         />
                         <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                            {showPassword ? <Globe className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                         </button>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <button 
                      onClick={async () => {
                         try {
                            const res = await fetch('/api/families', {
                               method: 'PUT',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify(groupCredsForm)
                            });
                            const data = await res.json();
                            if (data.success) {
                               setShowGroupCredsModal(false);
                               fetchRegistryData();
                               window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: 'Group access updated.' }}));
                            }
                         } catch (err) { console.error(err); }
                      }} 
                      className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20"
                   >
                      Update Group Access
                   </button>
                   <button onClick={() => setShowGroupCredsModal(false)} className="w-full py-4 bg-white/5 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">Cancel</button>
                </div>
             </motion.div>
          </div>
        )}
        {showFamilyModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl" onClick={() => setShowFamilyModal(false)}>
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-sm !p-12 space-y-8 border-white/10 text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter">New Corporate Group</h3>
                   <button onClick={() => setShowFamilyModal(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl">
                      <X className="w-5 h-5" />
                   </button>
                </div>
                <div className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Group Identity</label>
                      <input value={familyForm.name} onChange={e => setFamilyForm({...familyForm, name: e.target.value})} placeholder="e.g. Interns 2026..." className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-black uppercase" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Assign to Program</label>
                      <select value={familyForm.program_id} onChange={e => setFamilyForm({...familyForm, program_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 appearance-none font-bold">
                         <option value="" className="bg-[#080810]">Select Program (Optional)...</option>
                         {programs.map(p => <option key={p.id} value={p.id} className="bg-[#080810]">{p.name}</option>)}
                      </select>
                   </div>
                </div>
                <button onClick={async (e) => {
                   e.preventDefault();
                   if (!familyForm.name) return;
                   try {
                     const res = await fetch('/api/families', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify(familyForm)
                     });
                     const data = await res.json();
                     if (data.success) {
                       setShowFamilyModal(false);
                       setFamilyForm({ name: '', program_id: '' });
                       fetchRegistryData();
                       window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: `Group "${familyForm.name}" registered.` }}));
                     } else {
                        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: data.error || 'Registration failed.' }}));
                     }
                   } catch (err) { console.error(err); }
                }} className="w-full btn-prime !py-4 rounded-xl !text-xs font-black uppercase tracking-widest">Register Group</button>
             </motion.div>
          </div>
        )}
        
        {showManualModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl" onClick={() => setShowManualModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-lg !p-12 space-y-10 border-white/10" onClick={(e) => e.stopPropagation()}>
               <div className="flex justify-between items-start">
                  <div>
                     <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">{form.cid ? 'Edit Member Profile' : 'Add New Member'}</h3>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Complete the profile details to register a member into the registry</p>
                  </div>
                  <button onClick={() => setShowManualModal(false)} className="text-slate-600 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
               </div>
               <form className="space-y-6" onSubmit={async (e) => {
                  e.preventDefault();
                  const isEdit = !!form.cid;
                  const res = await fetch('/api/contacts', {
                     method: isEdit ? 'PUT' : 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify(isEdit ? form : [form])
                  });
                   const data = await res.json();
                   if (data.success && (data.inserted > 0 || data.rowsAffected > 0)) {
                      setShowManualModal(false);
                      fetchRegistryData();
                      window.dispatchEvent(new CustomEvent('impactos:notify', { 
                          detail: { type: 'success', message: 'Personnel identity deployed.' } 
                      }));
                   } else {
                      const errorMsg = data.error || (data.errors?.[0]?.error) || 'Submission failed (Possible Duplicate).';
                      window.dispatchEvent(new CustomEvent('impactos:notify', { 
                          detail: { type: 'error', message: errorMsg } 
                      }));
                   }
                }}>
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Full Name</label>
                        <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Master Email</label>
                           <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Phone</label>
                           <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold" />
                        </div>
                     </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Corporate Group</label>
                         <select value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 appearance-none font-bold">
                            <option value="" className="bg-[#080810]">Select Group...</option>
                            {families.filter(f => f.name?.toLowerCase() !== 'staff' && f.name?.toLowerCase() !== 'future studio').map(f => (
                               <option key={f.id} value={f.name} className="bg-[#080810]">{f.name}</option>
                            ))}
                         </select>
                      </div>
                     {( !form.cid && form.group_name?.toLowerCase() === 'future studio' ) && (
                        <div className="p-6 bg-[#FF6600]/5 border border-[#FF6600]/20 rounded-2xl space-y-4">
                           <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest italic">Access Credentials</h4>
                            <button type="button" onClick={() => setForm({...form, password: generatePassword()})} className="text-[10px] font-black text-white bg-[#FF6600] px-6 py-2 rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-600/20">Generate Password</button>
                           </div>
                           <div className="relative">
                              <input 
                                 type={showPassword ? "text" : "password"} 
                                 placeholder="Credentials Pending..." 
                                 value={form.password} 
                                 readOnly 
                                 className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-4 text-white text-xs font-mono pr-12" 
                              />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                                 {showPassword ? <Globe className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              </button>
                           </div>
                           {!form.password && <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest text-center italic">Password will be redacted until generation</p>}
                        </div>
                     )}
                  </div>
                  <button type="submit" className="w-full btn-strong !py-4 rounded-xl font-black uppercase text-xs tracking-widest">SAVE CHANGES</button>
               </form>
            </motion.div>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="ios-card w-full max-w-md !p-12 space-y-8 border-white/10 shadow-3xl bg-[#0d0d18]">
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Bulk Import Settings</h3>
                      <p className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest mt-2">Assign these contacts to a group</p>
                   </div>
                   <button onClick={() => setShowBulkModal(false)} className="text-slate-600 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                   <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                      <div>
                         <p className="text-xs font-black text-white uppercase">{bulkFile?.name}</p>
                         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CSV Data Ready</p>
                      </div>
                   </div>
                   <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic leading-relaxed">
                      Pro Tip: Ensure your CSV has headers: <span className="text-white">name, email, phone</span> for optimal field mapping.
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between px-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Group</label>
                      <button onClick={() => setIsBulkNew(!isBulkNew)} className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest underline underline-offset-4">
                         {isBulkNew ? 'Select Existing' : 'Create New Group'}
                      </button>
                   </div>
                   
                   {isBulkNew ? (
                      <input 
                         autoFocus
                         value={bulkGroupName}
                         onChange={e => setBulkGroupName(e.target.value)}
                         placeholder="New Group Name..."
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-black uppercase tracking-tighter"
                      />
                   ) : (
                      <select 
                         value={bulkGroupName}
                         onChange={e => setBulkGroupName(e.target.value)}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 appearance-none font-bold"
                      >
                         <option value="" className="bg-[#080810]">Select target segment...</option>
                         {families.filter(f => f.name?.toLowerCase() !== 'staff' && f.name?.toLowerCase() !== 'future studio').map(f => (
                            <option key={f.id} value={f.name} className="bg-[#080810] font-bold">{f.name}</option>
                         ))}
                      </select>
                   )}
                </div>

                <button 
                   onClick={handleBulkSubmit}
                   className="w-full btn-prime !py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-[#FF6600]/20"
                >
                   CONFIRM UPLOAD
                </button>
             </motion.div>
          </div>
        )}

        {showCredsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl" onClick={handleCloseCredsModal}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-sm !p-12 space-y-8 border-white/10 text-center" onClick={e => e.stopPropagation()}>
               <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="p-4 bg-[#FF6600]/10 rounded-2xl text-[#FF6600]">
                     <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Reset Credentials</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Personnel: {credsForm.name}</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1 text-left">
                     <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Username (Email)</label>
                     <input readOnly value={credsForm.email} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-slate-400 outline-none font-bold" />
                  </div>
                   <div className="space-y-1 text-left">
                      <div className="flex justify-between items-center mb-1">
                         <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Secure Password</label>
                         <button 
                            onClick={() => setCredsForm({...credsForm, password: generatePassword(), isDirty: true})} 
                            className={`text-[10px] font-black transition-all flex items-center gap-1 uppercase tracking-widest ${credsForm.isDirty ? 'text-emerald-500 italic' : 'text-[#FF6600] hover:text-white'}`}
                         >
                            {credsForm.isDirty ? <CheckCircle className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                            {credsForm.isDirty ? 'Generated' : 'Auto-Gen'}
                         </button>
                      </div>
                      <div className="relative">
                         <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Enter or generate password..." 
                            value={credsForm.password} 
                            onChange={e => setCredsForm({...credsForm, password: e.target.value, isDirty: true})} 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold pr-12 font-mono" 
                         />
                         <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                            {showPassword ? <Globe className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                         </button>
                      </div>
                   </div>
               </div>

               <div className="space-y-4">
                  <button onClick={handleCredsUpdate} className="w-full py-5 bg-[#FF6600] text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-blue-600/20">Update Master Access</button>
                  <div className="grid grid-cols-2 gap-4">
                     <button onClick={handleCloseCredsModal} className="py-4 bg-white/5 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">Close</button>
                     <button 
                        onClick={async () => {
                           await handleCredsUpdate();
                           const phone = (contacts.find(c => c.cid === credsForm.cid)?.phone || '').replace(/[^0-9]/g, '');
                           const link = getWhatsAppLink({ name: credsForm.name, email: credsForm.email, phone: phone }, credsForm.password);
                           window.open(link, '_blank');
                        }}
                        className="py-4 bg-emerald-500/10 text-emerald-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                     >
                        <MessageCircle className="w-3.5 h-3.5" /> Deploy WA
                     </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    }>
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10 font-sans">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Corporate Registry</span>
               <div className="h-px w-10 bg-[#FF6600]/30" />
               <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">Team Operations</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Future Studio</h2>
            <div className="flex items-center gap-4 mt-4">
               <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest leading-none opacity-60">Management of central studio personnel and project managers</p>
               <div className="h-4 w-px bg-white/10 mx-2" />
               <button 
                  onClick={() => setShowArchived(!showArchived)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${showArchived ? 'bg-orange-500 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:text-white'}`}
               >
                  <Archive className="w-3.5 h-3.5" />
                  {showArchived ? 'Viewing Archived' : 'View Archive'}
               </button>
            </div>
          </div>

          <div className="flex gap-4">
             <input type="file" accept=".csv" id="csv-upload" className="hidden" onChange={onFileSelect} />
             <label htmlFor="csv-upload" className="btn-ghost flex items-center gap-3 !px-6 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/5 cursor-pointer">
                <Upload className="w-4 h-4" /> Bulk Upload
             </label>
             <button onClick={() => setShowFamilyModal(true)} className="btn-ghost flex items-center gap-3 !px-6 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/5"><Plus className="w-4 h-4" /> Group</button>
             <button onClick={() => { setForm({ cid: '', name: '', email: '', phone: '', address: '', dob: '', group_name: (selectedGroup?.toLowerCase() === 'future studio' || selectedGroup === 'All Contacts') ? '' : selectedGroup, role: 'staff', gender: '', mother_name: '', password: '' }); setShowManualModal(true); }} className="btn-prime flex items-center gap-3 !px-8 text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-[#FF6600]/40"><Plus className="w-5 h-5" /> New Member</button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 font-sans">
           <div className="xl:col-span-1 space-y-6">
              <div className="ios-card !p-8 border-white/5 space-y-8 shadow-2xl bg-white/[0.01]">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter search..." className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold transition-all placeholder:text-slate-700" />
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 opacity-60 italic">Registry Segments</h4>
                    <div className="space-y-1">
                       <button onClick={() => setSelectedGroup('All Contacts')} className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedGroup === 'All Contacts' ? 'bg-[#FF6600] text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>Unified Registry</button>
                       <div className={`flex items-center justify-between rounded-2xl transition-all ${selectedGroup?.toLowerCase() === 'future studio' ? 'bg-[#FF6600] text-white shadow-lg shadow-[#FF6600]/20' : 'hover:bg-white/5'}`}>
                          <button onClick={() => setSelectedGroup('Future Studio')} className={`flex-1 text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest ${selectedGroup?.toLowerCase() === 'future studio' ? 'text-white' : 'text-slate-400'}`}>
                             Future Studio
                          </button>
                       </div>
                       <div className="h-px w-full bg-white/5 my-4" />
                        {families.filter(f => f.name?.toLowerCase() !== 'staff' && f.name?.toLowerCase() !== 'future studio').map(f => (
                           <div key={f.id} className={`flex flex-col rounded-2xl transition-all border ${selectedGroup === f.name ? 'bg-white/10 border-white/10' : 'border-transparent hover:bg-white/5'}`}>
                              <div className="flex items-center justify-between">
                                 <button onClick={() => setSelectedGroup(f.name)} className={`flex-1 text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest ${selectedGroup === f.name ? 'text-white' : 'text-slate-400'}`}>
                                    {f.name}
                                    {f.program_id && (
                                       <span className="block text-[7px] text-[#FF6600] mt-1 opacity-60">Linked to: {programs.find(p => p.id === f.program_id)?.name || 'Active Program'}</span>
                                    )}
                                 </button>
                                 <div className="flex items-center gap-1">
                                    <button 
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          setGroupCredsForm({ id: f.id, name: f.name, email: f.email || '', password: f.password || '' });
                                          setShowGroupCredsModal(true);
                                       }}
                                       className="p-3 text-slate-500 hover:text-emerald-500 transition-colors bg-black/20 rounded-xl border border-white/5"
                                       title="Group Credentials"
                                    >
                                       <Key className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          const link = `${window.location.origin}/register-staff?rid=${f.registration_id || encodeURIComponent(f.name)}`;
                                          navigator.clipboard.writeText(link);
                                          window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: 'Registration link copied!' }}));
                                       }}
                                       className="p-3 mr-2 text-slate-500 hover:text-[#FF6600] transition-colors bg-black/20 rounded-xl border border-white/5"
                                       title="Copy Registration Link"
                                    >
                                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                    </button>
                                 </div>
                             </div>
                             {f.registration_id && (
                                <p className="px-5 pb-3 text-[8px] font-black text-slate-600 uppercase tracking-widest">ID: {f.registration_id}</p>
                             )}
                          </div>
                       ))}
                    </div>
                 </div>

                 {selectedGroup !== 'All Contacts' && selectedGroup !== 'Future Studio' && (
                    <div className="ios-card !p-8 border-white/5 space-y-6 shadow-2xl bg-white/[0.01]">
                       <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic flex items-center gap-2">
                             <Shield className="w-3.5 h-3.5 text-[#FF6600]" /> Unit Command
                          </h4>
                          <button onClick={() => { 
                             const currentFamily = families.find(f => f.name === selectedGroup);
                             setTeamForm({ 
                                name: '', 
                                program_id: currentFamily?.program_id || programs[0]?.id || '', 
                                group_name: selectedGroup, 
                                member_ids: [] 
                             }); 
                             setShowTeamModal(true); 
                          }} className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 bg-[#FF6600]/5 px-3 py-1.5 rounded-lg border border-[#FF6600]/10 hover:bg-[#FF6600]/10">
                             <Plus className="w-3 h-3" /> New Unit
                          </button>
                       </div>
                       <div className="space-y-3">
                          {teams.filter(t => t.group_name === selectedGroup).length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-black/20 rounded-2xl border border-dashed border-white/5">
                                <Users className="w-8 h-8 text-slate-800 opacity-20" />
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] italic">No units deployed in this segment</p>
                             </div>
                          ) : (
                             teams.filter(t => t.group_name === selectedGroup).map(t => (
                                <div key={t.id} className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3 group/team hover:border-[#FF6600]/20 transition-all">
                                   <div className="flex items-center justify-between">
                                      <span className="text-sm font-black text-white uppercase italic tracking-tighter">{t.name}</span>
                                      <div className="flex items-center gap-1">
                                         <button 
                                            onClick={async () => {
                                               try {
                                                  const res = await fetch('/api/v2/invites', {
                                                     method: 'POST',
                                                     headers: { 'Content-Type': 'application/json' },
                                                     body: JSON.stringify({
                                                        program_id: t.program_id,
                                                        group_name: t.group_name,
                                                        role: 'participant',
                                                        team_id: t.id,
                                                        expiresInHours: 24,
                                                        created_by: 'super_admin'
                                                     })
                                                  });
                                                  const data = await res.json();
                                                  if (data.inviteUrl) {
                                                     navigator.clipboard.writeText(data.inviteUrl);
                                                     window.dispatchEvent(new CustomEvent('impactos:notify', { 
                                                        detail: { type: 'success', message: `Invite Link for ${t.name} copied!` } 
                                                     }));
                                                  }
                                               } catch (e) { console.error(e); }
                                            }}
                                            className="p-2 text-[#FF6600] hover:bg-[#FF6600]/10 rounded-lg transition-all"
                                            title="Copy Team Invite Link"
                                         >
                                            <LinkIcon className="w-3.5 h-3.5" />
                                         </button>
                                         <button 
                                            onClick={async () => {
                                               if (confirm(`Decommission unit ${t.name}? Members will be unassigned.`)) {
                                                  await fetch('/api/v2/pm/teams', { 
                                                     method: 'DELETE', 
                                                     headers: { 'Content-Type': 'application/json' },
                                                     body: JSON.stringify({ id: t.id }) 
                                                  });
                                                  fetchRegistryData();
                                               }
                                            }}
                                            className="opacity-0 group-hover/team:opacity-100 transition-all p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                         >
                                            <Trash2 className="w-4 h-4" />
                                         </button>
                                      </div>
                                   </div>
                                   <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                                      <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-2">
                                            <Shield className="w-3 h-3 text-emerald-500" />
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Username:</span>
                                         </div>
                                         <span className="text-[9px] font-mono text-white font-bold">{t.team_username}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-2">
                                            <Key className="w-3 h-3 text-amber-500" />
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Access Key:</span>
                                         </div>
                                         <span className="text-[9px] font-mono text-white font-bold opacity-20 group-hover/team:opacity-100 transition-all select-all">{t.password}</span>
                                      </div>
                                   </div>
                                </div>
                             ))
                          )}
                       </div>
                    </div>
                 )}
              </div>
           </div>

           <div className="xl:col-span-3 space-y-6">
              {selectedGroup?.toLowerCase() === 'future studio' && (
                 <div className="flex items-center justify-between bg-[#FF6600]/5 border border-[#FF6600]/10 p-4 rounded-2xl mb-4">
                    <div className="flex items-center gap-3">
                       <Shield className="w-5 h-5 text-[#FF6600]" />
                       <div>
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">Internal Security Protocol</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Access to this registry segment is restricted to Super Admins.</p>
                       </div>
                    </div>
                    <button 
                       onClick={async () => {
                          try {
                             const progRes = await fetch('/api/v2/pm/programs');
                             const progData = await progRes.json();
                             const program_id = progData.programs?.[0]?.id || 'SYSTEM-GENERIC';

                             const res = await fetch('/api/v2/invites', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                   program_id,
                                   group_name: 'Future Studio',
                                   role: 'staff',
                                   expiresInHours: 1,
                                   created_by: 'super_admin'
                                })
                             });
                             const data = await res.json();
                             if (data.inviteUrl) {
                                navigator.clipboard.writeText(data.inviteUrl);
                                window.dispatchEvent(new CustomEvent('impactos:notify', { 
                                   detail: { type: 'success', message: 'Future Studio Invite Copied (1hr Expiry)' } 
                                }));
                             }
                          } catch (e) {
                             console.error(e);
                          }
                       }}
                       className="px-6 py-2 bg-[#FF6600] text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white transition-all shadow-lg shadow-[#FF6600]/20 flex items-center gap-2"
                    >
                       <LinkIcon className="w-3.5 h-3.5" /> Invite via Link
                    </button>
                 </div>
              )}
              {loading ? (
                 <div className="p-20 text-center"><Loader2 className="w-12 h-12 text-[#FF6600] animate-spin mx-auto mb-6" /><p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Synchronizing Team Data...</p></div>
              ) : filtered.length === 0 ? (
                 <div className="ios-card bg-white/[0.01] border-white/5 py-40 flex flex-col items-center justify-center text-center">
                    <Users className="w-20 h-20 text-slate-800 mb-6 opacity-10" />
                    <h4 className="text-2xl font-black text-white uppercase mb-2 italic">Identity Deficit</h4>
                    <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest leading-relaxed opacity-60">No matching personnel records found in the current segment.</p>
                 </div>
              ) : (
                 <div className="space-y-4">
                    <div className="ios-card !p-0 overflow-x-auto border-white/5 shadow-2xl bg-white/[0.01] custom-scrollbar">
                  <table className="executive-table w-full border-collapse min-w-[900px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Identity & Operational Role</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Communication Matrix</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Clearance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => (
                        <tr key={c.cid} className="group hover:bg-white/[0.01] transition-colors border-b border-white/[0.02]">
                          <td className="px-8 py-8 min-w-[300px]">
                            <div className="flex items-center gap-4 mb-3">
                               <p className="font-black text-white uppercase tracking-tighter text-2xl leading-none italic whitespace-nowrap">{c.name}</p>
                               <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border whitespace-nowrap ${c.role === 'project_manager' ? 'bg-[#FF6600]/10 text-indigo-400 border-[#FF6600]/20' : 'bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20'}`}>
                                  {c.role === 'project_manager' ? 'PM' : 'STUDIO'}
                               </span>
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md border border-white/5 cursor-default truncate max-w-[100px]">{c.group_name || 'Individual'}</span>
                               <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/5">
                                  <Mail className="w-2.5 h-2.5 text-slate-600" />
                                  <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter uppercase truncate max-w-[120px]">{c.email}</span>
                               </div>
                               {c.password && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/5 rounded-md border border-emerald-500/10" title="Securely Hashed">
                                     <Shield className="w-2.5 h-2.5 text-emerald-600" />
                                     <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active Access</span>
                                  </div>
                               )}
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            <div className="flex flex-col gap-3">
                                <a href={`mailto:${c.email}`} className="flex items-center gap-4 text-xs font-bold text-slate-400 font-sans hover:text-white transition-all group/mail p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10">
                                   <div className="p-2 bg-white/10 rounded-xl group-hover/mail:bg-[#FF6600]/20 transition-all">
                                      <Send className="w-4 h-4 text-[#FF6600]" />
                                   </div>
                                   <div className="flex flex-col truncate">
                                      <span className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest mb-0.5">Direct Email</span>
                                      <span className="font-mono truncate">{c.email}</span>
                                   </div>
                                </a>
                                {c.phone && (
                                   <a 
                                      href={getWhatsAppLink(c)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="flex items-center gap-4 text-xs font-bold text-slate-400 font-sans hover:text-white transition-all group/wa p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 hover:bg-emerald-500/20"
                                   >
                                      <div className="p-2 bg-emerald-500/10 rounded-xl group-hover/wa:bg-emerald-500/20 transition-all">
                                         <MessageCircle className="w-4 h-4 text-emerald-500" />
                                      </div>
                                      <div className="flex flex-col truncate">
                                         <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">WhatsApp Protocol</span>
                                         <span className="font-mono truncate">{c.phone}</span>
                                      </div>
                                   </a>
                                )}
                            </div>
                          </td>
                          <td className="px-8 py-8 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-3">
                               {c.group_name?.toLowerCase() === 'future studio' && (
                                  <button 
                                     onClick={() => { setCredsForm({ cid: c.cid, name: c.name, email: c.email, password: generatePassword(), isDirty: true }); setShowCredsModal(true); }}
                                     className="p-4 bg-white/5 hover:bg-[#FF6600]/10 rounded-2xl text-slate-400 hover:text-[#FF6600] transition-all border border-transparent hover:border-[#FF6600]/20 group/reset"
                                     title="Provision Access"
                                  >
                                     <Key className="w-6 h-6" />
                                  </button>
                               )}
                               {showArchived ? (
                                  <button 
                                     onClick={async () => {
                                        const res = await fetch('/api/contacts', {
                                           method: 'PUT',
                                           headers: { 'Content-Type': 'application/json' },
                                           body: JSON.stringify({ cid: c.cid, deleted: 0 })
                                        });
                                        if (res.ok) {
                                           window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: 'Member restored.' }}));
                                           fetchRegistryData();
                                        }
                                     }}
                                     className="p-4 bg-emerald-500/10 hover:bg-emerald-500 rounded-2xl text-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                                     title="Restore Member"
                                  >
                                     <RefreshCw className="w-6 h-6" />
                                  </button>
                               ) : (
                                  <button 
                                     onClick={async () => {
                                        if (confirm('Archive this member? They will lose access immediately.')) {
                                           const res = await fetch('/api/contacts', {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ cid: c.cid, deleted: 1 })
                                           });
                                           if (res.ok) {
                                              window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: 'Member archived.' }}));
                                              fetchRegistryData();
                                           }
                                        }
                                     }}
                                     className="p-4 bg-white/5 hover:bg-rose-500/10 rounded-2xl text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-rose-500/20"
                                     title="Archive Member"
                                  >
                                     <Trash2 className="w-6 h-6" />
                                  </button>
                               )}
                               <button 
                                  onClick={() => { setForm({ ...c }); setShowManualModal(true); }}
                                  className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10"
                                  title="Update Member"
                               >
                                  <Edit3 className="w-6 h-6" />
                               </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin"></div></div>}>
      <ContactsPageContent />
    </Suspense>
  );
}
