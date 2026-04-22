'use client';
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Plus, Users, Mail, Phone, Search, 
  AlertCircle, X, Loader2, CheckCircle, Download, 
  CreditCard, MapPin, Calendar as CalendarIcon, Edit3, Briefcase,
  Key, MessageCircle, Send, Globe, Shield, User
} from 'lucide-react';
import Papa from 'papaparse';
import { IMPACT_CACHE } from '@/utils/impactCache';
import { useSearchParams } from 'next/navigation';

/**
 * CORPORATE REGISTRY (OUR TEAM)
 * Unified personnel management hub with tactical communication nodes.
 */
export default function ContactsPage() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals & UI State
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  
  const [selectedGroup, setSelectedGroup] = useState('All Contacts');
  const [families, setFamilies] = useState([]);

  useEffect(() => {
    if (roleParam) setSelectedGroup(roleParam.toUpperCase());
  }, [roleParam]);

  const fileInputRef = useRef(null);
  
  // Forms
  const [familyForm, setFamilyForm] = useState({ name: '' });
  const [form, setForm] = useState({ cid: '', name: '', email: '', phone: '', address: '', dob: '', group_name: '', gender: '', mother_name: '', password: '' });
  const [credsForm, setCredsForm] = useState({ cid: '', name: '', password: '' });

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

  const fetchRegistryData = async () => {
    try {
      if (!IMPACT_CACHE.get('contacts')) setLoading(true);
      const res = await fetch('/api/v2/contacts/full-state');
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts || []);
        setFamilies(data.families || []);
        IMPACT_CACHE.set('contacts', data.contacts || []);
        IMPACT_CACHE.set('families', data.families || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitFamily = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/contacts/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(familyForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowFamilyModal(false);
        setFamilyForm({ name: '' });
        fetchRegistryData();
      }
    } catch (err) { console.error(err); }
  };

  const handleCredsUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/contacts', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ cid: credsForm.cid, password: credsForm.password })
      });
      const data = await res.json();
      if (data.success) {
         setShowCredsModal(false);
         fetchRegistryData();
         window.dispatchEvent(new CustomEvent('impactos:notify', { 
             detail: { type: 'success', message: 'Credentials updated successfully.' } 
         }));
      }
    } catch (e) {
       window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: 'Failed to update credentials.' } 
       }));
    }
  };

  const filtered = (Array.isArray(contacts) ? contacts : []).filter(c => {
    const searchVal = search.toLowerCase();
    const nameMatch = (c.name || '').toLowerCase().includes(searchVal);
    const emailMatch = (c.email || '').toLowerCase().includes(searchVal);
    const cidMatch = (c.cid || '').toLowerCase().includes(searchVal);
    const matchesSearch = nameMatch || emailMatch || cidMatch;
    
    const matchesGroup = selectedGroup === 'All Contacts' || c.group_name?.toUpperCase() === selectedGroup.toUpperCase();
    return matchesSearch && matchesGroup;
  });

  return (
    <DashboardLayout role="super_admin" activeTab="staff" modals={
      <AnimatePresence>
        {showFamilyModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-sm !p-12 space-y-8 border-white/10 text-center">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">New Corporate Group</h3>
                <input value={familyForm.name} onChange={e => setFamilyForm({name: e.target.value})} placeholder="Group Name..." className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 text-center uppercase font-black" />
                <button onClick={submitFamily} className="w-full btn-strong !py-4 rounded-xl !text-sm">Register Group</button>
             </motion.div>
          </div>
        )}
        
        {showManualModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-lg !p-12 space-y-10 border-white/10">
               <div className="flex justify-between items-start">
                  <div>
                     <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">{form.cid ? 'Update Entity' : 'New Entry'}</h3>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Managing corporate identity data</p>
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
                  if ((await res.json()).success) {
                     setShowManualModal(false);
                     fetchRegistryData();
                  }
               }}>
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Full Identity</label>
                        <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 font-bold" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Email Address</label>
                           <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 font-bold" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Phone</label>
                           <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 font-bold" />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Corporate Group</label>
                        <select value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 appearance-none font-bold">
                           <option value="" className="bg-[#080810]">Select Group...</option>
                           <option value="Staff" className="bg-[#080810]">Staff (Project Managers)</option>
                           {families.map(f => <option key={f.id} value={f.name} className="bg-[#080810]">{f.name}</option>)}
                        </select>
                     </div>
                  </div>
                  <button type="submit" className="w-full btn-strong !py-4 rounded-xl font-black uppercase text-xs tracking-widest">Save Entity</button>
               </form>
            </motion.div>
          </div>
        )}

        {showCredsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-sm !p-12 space-y-8 border-white/10 text-center">
               <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="p-4 bg-[#0066FF]/10 rounded-2xl text-[#0066FF]">
                     <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Reset Credentials</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Updating credentials for {credsForm.name}</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1 text-left">
                     <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Username (CID)</label>
                     <input readOnly value={credsForm.cid} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-slate-500 outline-none font-bold" />
                  </div>
                  <div className="space-y-1 text-left">
                     <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">New Password</label>
                     <input type="text" placeholder="Enter new password..." value={credsForm.password} onChange={e => setCredsForm({...credsForm, password: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 font-bold" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setShowCredsModal(false)} className="py-4 bg-white/5 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">Cancel</button>
                  <button onClick={handleCredsUpdate} className="py-4 bg-[#0066FF] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-all">Reset Password</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    }>
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#0066FF] font-black text-[10px] uppercase tracking-[0.4em]">Corporate Registry</span>
               <div className="h-px w-10 bg-[#0066FF]/30" />
               <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">Staff Control</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Our Team</h2>
            <p className="text-slate-500 font-bold mt-4 uppercase text-[10px] tracking-widest leading-none font-sans opacity-60">Management of staff and external collaborators</p>
          </div>

          <div className="flex gap-4">
             <button onClick={() => setShowFamilyModal(true)} className="btn-ghost flex items-center gap-2 !px-6 text-[10px] font-black uppercase tracking-widest"><Plus className="w-4 h-4" /> Group</button>
             <button onClick={() => setShowManualModal(true)} className="btn-prime flex items-center gap-2 !px-8 text-[10px] font-black uppercase tracking-widest"><Plus className="w-5 h-5" /> New Contact</button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
           <div className="xl:col-span-1 space-y-6">
              <div className="ios-card !p-8 border-white/5 space-y-8">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search identity..." className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white outline-none focus:border-[#0066FF]/50 font-bold transition-all" />
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 font-sans opacity-60">Filter by Node</h4>
                    <div className="space-y-1">
                       <button onClick={() => setSelectedGroup('All Contacts')} className={`w-full text-left px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedGroup === 'All Contacts' ? 'bg-[#0066FF] text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>All Territory</button>
                       <button onClick={() => setSelectedGroup('Staff')} className={`w-full text-left px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedGroup === 'Staff' ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/20' : 'text-slate-400 hover:bg-white/5'}`}>Corporate Team</button>
                       {families.map(f => (
                          <button key={f.id} onClick={() => setSelectedGroup(f.name)} className={`w-full text-left px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedGroup === f.name ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:bg-white/5'}`}>{f.name}</button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           <div className="xl:col-span-3 space-y-6">
              {loading ? (
                 <div className="p-20 text-center"><Loader2 className="w-12 h-12 text-[#0066FF] animate-spin mx-auto mb-6" /><p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Synchronizing Registry...</p></div>
              ) : filtered.length === 0 ? (
                 <div className="ios-card bg-white/[0.01] border-white/5 py-40 flex flex-col items-center justify-center text-center">
                    <Users className="w-20 h-20 text-slate-800 mb-6 opacity-10" />
                    <h4 className="text-2xl font-black text-white uppercase mb-2">No Match Detected</h4>
                    <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest leading-relaxed font-sans opacity-60">Adjust your filters or search query to locate contacts.</p>
                 </div>
              ) : (
                <div className="ios-card !p-0 overflow-hidden border-white/5 shadow-2xl">
                 <table className="executive-table w-full">
                   <thead>
                     <tr className="border-b border-white/5 bg-white/[0.02]">
                       <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Identity & Username</th>
                       <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Communication Nodes</th>
                       <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Protocol</th>
                     </tr>
                   </thead>
                   <tbody>
                     {filtered.map(c => (
                       <tr key={c.cid} className="group hover:bg-white/[0.01] transition-colors border-b border-white/[0.02]">
                         <td className="px-8 py-8">
                           <p className="font-black text-white uppercase tracking-tighter text-xl leading-none mb-3 italic">{c.name}</p>
                           <div className="flex items-center gap-3">
                              <span className="text-[8px] font-black text-[#0066FF] uppercase tracking-widest bg-[#0066FF]/10 px-2 py-1 rounded-md border border-[#0066FF]/20 cursor-default">{c.group_name || 'Individual'}</span>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/5">
                                 <User className="w-2.5 h-2.5 text-slate-600" />
                                 <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter uppercase">{c.cid}</span>
                              </div>
                           </div>
                         </td>
                         <td className="px-8 py-8">
                           <div className="flex flex-col gap-3">
                               <a href={`mailto:${c.email}`} className="flex items-center gap-3 text-xs font-bold text-slate-400 font-sans hover:text-[#0066FF] transition-all group/mail">
                                  <div className="p-1.5 bg-white/5 rounded-lg group-hover/mail:bg-[#0066FF]/10 transition-all">
                                     <Mail className="w-3.5 h-3.5 text-slate-700 group-hover/mail:text-[#0066FF]" />
                                  </div>
                                  {c.email}
                               </a>
                               {c.phone && (
                                  <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-xs font-bold text-slate-400 font-sans hover:text-emerald-500 transition-all group/wa">
                                     <div className="p-1.5 bg-white/5 rounded-lg group-hover/wa:bg-emerald-500/10 transition-all">
                                        <MessageCircle className="w-3.5 h-3.5 text-slate-700 group-hover/wa:text-emerald-500" />
                                     </div>
                                     Whatsapp Direct
                                  </a>
                               )}
                           </div>
                         </td>
                         <td className="px-8 py-8 text-right">
                           <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                 onClick={() => { setCredsForm({ cid: c.cid, name: c.name, password: '' }); setShowCredsModal(true); }}
                                 className="p-3 bg-white/5 hover:bg-[#0066FF]/10 rounded-xl text-slate-400 hover:text-[#0066FF] transition-all border border-transparent hover:border-[#0066FF]/20 group/reset"
                                 title="Reset Credentials"
                              >
                                 <Key className="w-5 h-5" />
                              </button>
                              <button 
                                 onClick={() => { setForm({ ...c, password: '' }); setShowManualModal(true); }}
                                 className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10"
                                 title="Edit Profile"
                              >
                                 <Edit3 className="w-5 h-5" />
                              </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                </div>
              )}
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
