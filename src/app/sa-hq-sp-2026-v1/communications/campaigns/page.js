'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, CheckCircle, Search, Rocket, X, Users, Loader2, List } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create Form State
  const [form, setForm] = useState({ name: '', form_id: '', cids: [] });
  const [searchContacts, setSearchContacts] = useState('');

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campRes, contRes, formRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/contacts'),
        fetch('/api/forms').catch(() => ({ json: () => ({ forms: [] }) }))
      ]);
      const [camps, conts, fms] = await Promise.all([campRes.json(), contRes.json(), formRes.json()]);
      
      if (camps.success) setCampaigns(camps.campaigns || []);
      if (conts.success) setContacts(conts.contacts || []);
      if (fms.success) setForms(fms.forms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitCampaign = async (e) => {
    e.preventDefault();
    if (!form.name || form.cids.length === 0) return alert('Campaign requires a name and at least 1 contact selected.');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setForm({ name: '', form_id: '', cids: [] });
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleContact = (cid) => {
    setForm(prev => {
      if (prev.cids.includes(cid)) return { ...prev, cids: prev.cids.filter(id => id !== cid) };
      return { ...prev, cids: [...prev.cids, cid] };
    });
  };

  const toggleAllContacts = () => {
    if (form.cids.length === filteredContacts.length) {
      setForm(p => ({ ...p, cids: [] }));
    } else {
      setForm(p => ({ ...p, cids: filteredContacts.map(c => c.cid) }));
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchContacts.toLowerCase()) || 
    c.email.toLowerCase().includes(searchContacts.toLowerCase())
  );

  return (
    <DashboardLayout role="super_admin">
      <div className="animation-reveal space-y-8 min-h-[60vh]">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Campaigns</h2>
            <p className="text-slate-400 font-bold tracking-tight">Create distribution campaigns and manage follow-ups.</p>
          </div>
          <div className="flex gap-4">
             <button 
              onClick={() => setShowCreateModal(true)} 
              className="btn-prime !py-4 shadow-indigo-600/10"
            >
              <Plus className="w-5 h-5 mr-2" /> Launch New Campaign
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <Rocket className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Campaigns</h4>
            <p className="text-slate-400 text-sm font-bold">You haven't launched any communication campaigns yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map(c => (
              <div key={c.id} className="ios-card group hover:border-indigo-500/30 transition-all duration-500">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Rocket className="w-6 h-6" />
                  </div>
                  <span className="badge badge-glow-success uppercase text-[8px] font-black">{c.status}</span>
                </div>
                
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 group-hover:text-indigo-400 transition-colors">{c.name}</h3>
                
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 mb-6">
                   <div className="flex items-center gap-3">
                     <Users className="w-5 h-5 text-slate-500" />
                     <div>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Contacts Target</p>
                       <p className="text-sm font-black text-white">{c.total_contacts}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3 border-l border-white/5 pl-4">
                     <CheckCircle className="w-5 h-5 text-emerald-500" />
                     <div>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Delivered</p>
                       <p className="text-sm font-black text-white">{c.sent_contacts}</p>
                     </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl ios-card !p-8 shadow-2xl bg-[#080810] border border-white/10 m-4 flex flex-col max-h-[90vh]">
                <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Configure Campaign</h3>
                  <p className="text-sm text-slate-400 font-bold">Select target contacts and attach tracking forms.</p>
                </div>
                
                <form onSubmit={submitCampaign} className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-1">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Campaign Reference Name</label>
                    <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Q4 Executive Outreach" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Linked Form (Optional)</label>
                    <select value={form.form_id} onChange={e => setForm({...form, form_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold appearance-none">
                       <option value="" className="bg-[#080810]">None</option>
                       {forms.map(f => <option key={f.form_id} value={f.form_id} className="bg-[#080810]">{f.name}</option>)}
                    </select>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Audience ({form.cids.length} Selected)</label>
                      <button type="button" onClick={toggleAllContacts} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">
                        Select All Filtered
                      </button>
                    </div>
                    
                    <div className="relative mb-4">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Search contacts..." 
                        value={searchContacts}
                        onChange={(e) => setSearchContacts(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors font-bold placeholder:text-slate-600"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                       {filteredContacts.length === 0 ? (
                         <p className="text-slate-500 text-xs font-bold text-center py-4">No contacts match search.</p>
                       ) : (
                         filteredContacts.map(c => (
                           <div key={c.cid} onClick={() => toggleContact(c.cid)} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${form.cids.includes(c.cid) ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                              <div className={`w-5 h-5 rounded flex items-center justify-center border ${form.cids.includes(c.cid) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                                {form.cids.includes(c.cid) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">{c.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{c.email}</p>
                              </div>
                           </div>
                         ))
                       )}
                    </div>
                  </div>
                  
                  <div className="pt-6">
                    <button type="submit" disabled={isSubmitting} className="w-full btn-prime !py-4 shadow-indigo-600/20 text-sm disabled:opacity-50">
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5 mr-2" />} 
                      {isSubmitting ? 'Provisioning...' : 'Provision Campaign Queue'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
