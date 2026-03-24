'use client';
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, Users, Mail, Phone, Search, AlertCircle, X, Loader2, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals & UI State
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('All Contacts');
  const fileInputRef = useRef(null);
  
  // Forms
  const [form, setForm] = useState({ name: '', email: '', phone: '', group_name: '' });
  const [bulkGroupName, setBulkGroupName] = useState('');

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (data.success) setContacts(data.contacts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStats(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rawData = results.data;
        const formatted = rawData.map(row => ({
          name: row.name || row.Name || row.NAME || '',
          email: row.email || row.Email || row.EMAIL || '',
          phone: row.phone || row.Phone || row.PHONE || null,
          group_name: bulkGroupName || 'Unassigned'
        }));

        try {
          const res = await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formatted)
          });
          const json = await res.json();
          if (json.success) {
            setUploadStats({ inserted: json.inserted, errors: json.errors });
            setShowBulkModal(false);
            setBulkGroupName('');
            fetchContacts();
          } else {
            console.error(json.error);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const submitManualContact = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([form])
      });
      const data = await res.json();
      if (data.success) {
        setShowManualModal(false);
        setForm({ name: '', email: '', phone: '' });
        fetchContacts();
      } else {
        alert(data.errors[0]?.error || data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const groups = ['All Contacts', ...new Set(contacts.map(c => c.group_name).filter(Boolean))];

  const filtered = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                         c.email.toLowerCase().includes(search.toLowerCase()) ||
                         (c.group_name && c.group_name.toLowerCase().includes(search.toLowerCase()));
    
    if (selectedGroup === 'All Contacts') return matchesSearch;
    return matchesSearch && c.group_name === selectedGroup;
  });

  return (
    <DashboardLayout role="super_admin">
      <div className="animation-reveal space-y-8 min-h-[60vh]">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Contacts HQ</h2>
            <p className="text-slate-400 font-bold tracking-tight">Upload and manage communications contacts.</p>
          </div>
          <div className="flex gap-4">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => setShowBulkModal(true)} 
              disabled={isUploading}
              className="btn-ghost !py-4 shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
              {isUploading ? 'Processing CSV...' : 'Bulk Family Import'}
            </button>
            <button 
              onClick={() => {
                setForm({ name: '', email: '', phone: '', group_name: selectedGroup !== 'All Contacts' ? selectedGroup : '' });
                setShowManualModal(true);
              }} 
              className="btn-prime !py-4 shadow-indigo-600/10"
            >
              <Plus className="w-5 h-5 mr-2" /> Individual Entry
            </button>
          </div>
        </header>

        {/* Group Filter Chips */}
        <div className="flex flex-wrap gap-2 pb-4">
           {groups.map(g => (
             <button
               key={g}
               onClick={() => setSelectedGroup(g)}
               className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${selectedGroup === g ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
             >
               {g}
             </button>
           ))}
        </div>

        {uploadStats && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-4 shadow-2xl">
            <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest mb-1">Upload Complete</p>
              <p className="text-xs font-bold text-emerald-400 mb-2">{uploadStats.inserted} Contacts successfully stored.</p>
              {uploadStats.errors?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-black text-rose-400 uppercase tracking-widest">Failed Entries ({uploadStats.errors.length}):</p>
                  <ul className="text-[10px] text-rose-300 max-h-24 overflow-y-auto pr-4 list-disc pl-4 custom-scrollbar">
                    {uploadStats.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err.email}: {err.error}</li>
                    ))}
                    {uploadStats.errors.length > 10 && <li>...and {uploadStats.errors.length - 10} more.</li>}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={() => setUploadStats(null)} className="ml-auto text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </motion.div>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-indigo-500/30 transition-colors font-bold placeholder:text-slate-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <Users className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Contacts Found</h4>
            <p className="text-slate-400 text-sm font-bold">Import your first CSV or create someone manually to start your campaign operations.</p>
          </div>
        ) : (
          <div className="ios-card !p-0 overflow-visible bg-transparent border-none">
            <table className="executive-table w-full">
              <thead>
                <tr className="bg-transparent border-none shadow-none">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Tracking ID</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Identity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Group/Family</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Contact Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.cid} className="group hover:bg-white/[0.02] transition-colors rounded-3xl border-b border-white/[0.03]">
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-inner">
                        {c.cid}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-white uppercase tracking-tighter text-base">{c.name}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border border-white/5 px-2 py-1 rounded bg-white/[0.02]">
                        {c.group_name || 'Individual'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-400"><Mail className="w-3.5 h-3.5" /> {c.email}</span>
                        {c.phone && <span className="flex items-center gap-2 text-xs font-bold text-slate-400"><Phone className="w-3.5 h-3.5" /> {c.phone}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Manual Addition Modal */}
        <AnimatePresence>
          {showManualModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowManualModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md ios-card !p-8 shadow-2xl bg-[#080810] border border-white/10 m-4">
                <button onClick={() => setShowManualModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">New Contact</h3>
                  <p className="text-sm text-slate-400 font-bold">Add an individual recipient to the database.</p>
                </div>
                <form onSubmit={submitManualContact} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
                    <input autoFocus required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Group / Family Name</label>
                    <input required type="text" value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" placeholder="E.g. Johnson Family" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email</label>
                      <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phone</label>
                      <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" />
                    </div>
                  </div>
                  <div className="pt-4">
                    <button type="submit" className="w-full btn-prime !py-4 shadow-indigo-600/20 text-sm">Add to Group Database</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Bulk Addition Modal */}
        <AnimatePresence>
          {showBulkModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBulkModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md ios-card !p-8 shadow-2xl bg-[#080810] border border-white/10 m-4">
                <button onClick={() => setShowBulkModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                <div className="mb-8 text-center">
                  <Upload className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Family Import</h3>
                  <p className="text-sm text-slate-400 font-bold">Assign a group identity to this bulk list.</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Destination Group Name</label>
                    <input required type="text" value={bulkGroupName} onChange={e => setBulkGroupName(e.target.value)} placeholder="E.g. Lagos Outreach Group" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" />
                  </div>
                  
                  <button 
                    disabled={!bulkGroupName || isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full btn-prime !py-5 shadow-indigo-600/20 text-sm disabled:opacity-30 disabled:grayscale transition-all"
                  >
                    Select CSV File & Initialize
                  </button>
                  
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center">Requirement: CSV must contain 'name' and 'email' columns.</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
