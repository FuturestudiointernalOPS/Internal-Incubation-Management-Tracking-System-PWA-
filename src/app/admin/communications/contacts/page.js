'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Plus, Users, Mail, Phone, Search, X, Loader2, CheckCircle, 
  Edit3, Shield, Key, MessageCircle, Send, Globe, Trash2, Archive, 
  Upload, Filter, ArrowLeft, RefreshCw, Star, Link as LinkIcon,
  Copy, Check, UserCheck, UserX
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import { TableSkeleton } from '@/components/ui/Skeleton';

/**
 * IMPACTOS CORPORATE REGISTRY — PERSONNEL MANAGEMENT
 * Centralized governance for Staff, Project Managers, and Operational Teams.
 * Features: Automatic Join Links, Gated Approvals, and WhatsApp Dispatch.
 */

function ContactsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roleParam = searchParams.get('role');
  
  const [contacts, setContacts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All Contacts');
  const [showArchived, setShowArchived] = useState(false);
  const [copiedGroup, setCopiedGroup] = useState(null);

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Forms
  const [form, setForm] = useState({ cid: '', name: '', email: '', phone: '', group_name: '', role: 'staff', password: '' });
  const [credsForm, setCredsForm] = useState({ cid: '', name: '', email: '', password: '' });
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('individual');
  const [newGroupProgramId, setNewGroupProgramId] = useState('');
  
  // Feedback
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (roleParam) {
      const normalized = roleParam.toLowerCase() === 'staff' ? 'Future Studio' : roleParam;
      setSelectedGroup(normalized);
    }
  }, [roleParam]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [contRes, teamRes, progRes] = await Promise.all([
        fetch('/api/contacts/full-state'),
        fetch('/api/pm/teams'),
        fetch('/api/pm/programs')
      ]);
      const [contData, teamData, progData] = await Promise.all([contRes.json(), teamRes.json(), progRes.json()]);

      if (contData.success) {
        setContacts(contData.contacts || []);
        setFamilies(contData.families || []);
      }
      if (teamData.success) setTeams(teamData.teams || []);
      if (progData.success) setPrograms(progData.programs || []);
    } catch (e) {
      console.error("Registry Sync Failure:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    return Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  };

  const toggleStatus = async (cid, currentStatus, currentGroup) => {
    const newStatus = (currentStatus === 'active' || currentStatus === 'approved') ? 'inactive' : 'active';
    const payload = { cid, status: newStatus };
    
    // Hard Enforcement: If activating a Future Studio member, ensure they are staff
    if (newStatus === 'active' && currentGroup?.toUpperCase() === 'FUTURE STUDIO') {
       payload.role = 'staff';
    }

    try {
      await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchData();
    } catch (e) {
      console.error("Failed to toggle status:", e);
    }
  };

  const handleSaveContact = async () => {
    setIsProcessing(true);
    try {
      const payload = { ...form };
      // Hard Enforcement: If saving a Future Studio member, ensure they are staff
      if (payload.group_name?.toUpperCase() === 'FUTURE STUDIO') {
         payload.role = 'staff';
      }

      const method = form.cid ? 'PUT' : 'POST';
      const res = await fetch('/api/contacts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
         setNotification({ type: 'success', message: 'Identity saved successfully.' });
         setTimeout(() => setNotification(null), 3000);
         setShowManualModal(false);
         fetchData(); // Refresh the registry
      } else {
         setNotification({ type: 'error', message: data.error || 'Failed to save identity.' });
         setTimeout(() => setNotification(null), 4000);
      }
    } catch (e) {
      console.error("Failed to save contact:", e);
      setNotification({ type: 'error', message: 'Network error. Please try again.' });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/families', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name: newGroupName.trim(), type: newGroupType, program_id: newGroupProgramId || null })
      });
      const data = await res.json();
      if (data.success) {
         setNotification({ type: 'success', message: 'Operational segment created.' });
         setTimeout(() => setNotification(null), 3000);
         setShowGroupModal(false);
         setNewGroupName('');
         setNewGroupType('individual');
         setNewGroupProgramId('');
         fetchData(); 
      } else {
         setNotification({ type: 'error', message: data.error || 'Failed to create segment.' });
         setTimeout(() => setNotification(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: 'Network error.' });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async (c) => {
    const newPass = generatePassword();
    setIsProcessing(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: c.cid, password: newPass })
      });
      const data = await res.json();
      if (data.success) {
        setCredsForm({ ...c, password: newPass });
        setShowCredsModal(true);
      } else {
        setNotification({ type: 'error', message: 'Failed to reset password.' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyJoinLink = (groupName) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/register-staff?group=${encodeURIComponent(groupName)}`;
    navigator.clipboard.writeText(link);
    setCopiedGroup(groupName);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  const filtered = contacts.filter(c => {
    const term = search.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
    const matchesGroup = selectedGroup === 'All Contacts' || c.group_name?.toUpperCase() === selectedGroup.toUpperCase();
    const matchesArchive = showArchived ? !!c.deleted : !c.deleted;
    return matchesSearch && matchesGroup && matchesArchive;
  });

  const getWhatsAppLink = (c, pass) => {
    const phone = c.phone?.replace(/[^0-9]/g, '');
    if (!phone) return '#';
    const msg = `Hello ${c.name},\n\nYour ImpactOS account is ready.\n\nURL: ${window.location.origin}/login\nUser: ${c.email}\nPass: ${pass || 'N/A'}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <DashboardLayout role="super_admin" activeTab="communication">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[600] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span className="text-xs font-bold uppercase tracking-widest">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-10 pb-20 animate-in text-left">
        
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button 
              onClick={() => router.push('/admin')}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Dashboard
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.4em]">Registry</span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-[var(--text-primary)]">STAFF</h1>
            </div>
          </div>
          
          <div className="flex gap-3">
             <button 
                onClick={() => setShowArchived(!showArchived)}
                className={`btn btn-secondary gap-2 ${showArchived ? 'border-[var(--brand-orange)] text-[var(--brand-orange)]' : ''}`}
             >
                <Archive className="w-4 h-4" /> {showArchived ? 'Active Mode' : 'Archive'}
             </button>
             <button 
                onClick={() => { setForm({ cid: '', name: '', email: '', phone: '', group_name: '', role: 'staff', password: '' }); setShowManualModal(true); }}
                className="btn btn-primary gap-2"
             >
                <Plus className="w-4 h-4" /> Add Member
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* SIDEBAR FILTERS WITH JOIN LINKS */}
          <div className="xl:col-span-1 space-y-6">
            <div className="card space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                <input 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  placeholder="Filter by name/email..." 
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-2 mb-3">
                   <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Groups</p>
                   <button 
                     onClick={() => setShowGroupModal(true)} 
                     className="text-[10px] font-bold text-[var(--brand-orange)] hover:opacity-80 uppercase tracking-widest transition-colors flex items-center gap-1"
                   >
                     <Plus className="w-3 h-3" /> New
                   </button>
                </div>
                <div className="space-y-2">
                  {['All Contacts', ...families.map(f => ({ ...f, type: 'family' }))].map(groupObj => {
                    const group = typeof groupObj === 'string' ? groupObj : groupObj.name;
                    const isAll = group === 'All Contacts';
                    const isArchived = groupObj.is_archived;

                    return (
                      <div key={group} className={`flex gap-2 group ${isArchived ? 'opacity-50 grayscale' : ''}`}>
                        <button
                          onClick={() => setSelectedGroup(group)}
                          className={`flex-1 text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${selectedGroup === group ? 'bg-[var(--brand-orange)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'}`}
                        >
                          {group} {isArchived && '(ARCHIVED)'}
                        </button>
                        {!isAll && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => copyJoinLink(group)}
                              title="Copy Join Link"
                              className={`p-3 rounded-xl border border-[var(--border-primary)] transition-all ${copiedGroup === group ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-[var(--bg-primary)] text-slate-500 hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]'}`}
                            >
                              {copiedGroup === group ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={async () => {
                                if (!confirm(`Archive ${group}?`)) return;
                                await fetch('/api/families', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: groupObj.id, is_archived: !isArchived })
                                });
                                fetchData();
                              }}
                              title={isArchived ? "Restore" : "Archive"}
                              className="p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] text-slate-500 hover:text-orange-500"
                            >
                              {isArchived ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="card border-blue-500/20 bg-blue-500/5 p-6">
               <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-5 h-5 text-blue-400" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Staff Onboarding</h4>
               </div>
               <p className="text-[10px] font-medium text-slate-400 uppercase leading-relaxed">
                  Click the link icon to generate a unique registration URL.
               </p>
            </div>
          </div>

          {/* MAIN TABLE */}
          <div className="xl:col-span-3">
            {loading ? (
              <TableSkeleton rows={8} />
            ) : filtered.length === 0 ? (
              <div className="card py-32 flex flex-col items-center justify-center text-center space-y-4 opacity-60 border-dashed">
                <Users className="w-12 h-12 text-[var(--text-secondary)]" />
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">No matching identities found in registry.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Group / Role</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.cid} className="group">
                        <td>
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:border-[var(--brand-orange)] transition-colors">
                                <UserIcon className="w-5 h-5" />
                             </div>
                             <div className="flex flex-col">
                               <span className="text-base font-bold text-[var(--text-primary)] uppercase tracking-tight">{c.name}</span>
                               <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">{c.email}</span>
                             </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded text-[9px] font-bold uppercase">
                              {c.group_name || 'Individual'}
                            </span>
                            <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${c.status === 'pending' ? 'bg-orange-500/10 text-orange-400' : (c.role === 'staff' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400')}`}>
                              {c.status === 'pending' ? 'PENDING VERIFICATION' : c.role?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => toggleStatus(c.cid, c.status, c.group_name)}
                              title={c.status === 'active' || c.status === 'approved' ? 'Deactivate User' : 'Approve & Activate User'}
                              className={`p-2.5 rounded-lg border transition-all ${c.status === 'active' || c.status === 'approved' ? 'bg-[var(--bg-primary)] border-[var(--border-primary)] hover:text-rose-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                            >
                              {c.status === 'active' || c.status === 'approved' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => { setForm(c); setShowManualModal(true); }}
                              className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] hover:text-[var(--brand-orange)] transition-all"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              disabled={isProcessing}
                              onClick={() => handleResetPassword(c)}
                              title="Reset Password & Sync"
                              className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] hover:text-blue-500 transition-all disabled:opacity-50"
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            </button>
                            {/* Delete button removed to protect data integrity */}
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

      {/* MODALS */}
      {showManualModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-xl space-y-8 border-[var(--brand-orange)]/30 animate-in">
            <div className="flex justify-between items-center text-left">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight">{form.cid ? 'Edit Staff' : 'Add Staff'}</h3>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">Staff Member Profile</p>
              </div>
              <button onClick={() => setShowManualModal(false)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Full Name</label>
                <input 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Email Address</label>
                  <input 
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})} 
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Phone Number</label>
                  <input 
                    value={form.phone} 
                    onChange={e => setForm({...form, phone: e.target.value})} 
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Assigned Group</label>
                <select 
                  value={form.group_name} 
                  onChange={e => setForm({...form, group_name: e.target.value})} 
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">Select Group...</option>
                  {families.map(f => <option key={f.id} value={f.name}>{f.name.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Login Details</label>
                   <button 
                     onClick={() => setForm({...form, password: generatePassword()})}
                     className="text-[9px] font-bold text-[var(--brand-orange)] uppercase"
                   >
                     Generate Password
                   </button>
                </div>
                <input 
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})} 
                  placeholder="Set login password..."
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <button 
                onClick={handleSaveContact}
                disabled={isProcessing}
                className="btn btn-primary w-full py-5 font-bold uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredsModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-8 border-blue-500/30 text-center animate-in">
             <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500">
                   <Key className="w-8 h-8" />
                </div>
                <div>
                   <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase">Staff Login</h3>
                   <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">{credsForm.name}</p>
                </div>
             </div>

             <div className="space-y-4 text-left">
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase ml-2">Username</label>
                   <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl font-mono text-xs opacity-60 truncate">{credsForm.email}</div>
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between items-center px-2 mb-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">New Password (Synced)</label>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(credsForm.password); setNotification({ type: 'success', message: 'Password copied.' }); setTimeout(() => setNotification(null), 2000); }}
                        className="text-[9px] font-bold text-[var(--brand-orange)] uppercase flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                   </div>
                   <div className="p-4 bg-[var(--bg-primary)] border border-emerald-500/30 rounded-xl font-mono text-base text-emerald-500 font-bold text-center tracking-widest">{credsForm.password}</div>
                   <p className="text-[8px] font-bold text-emerald-500/60 uppercase text-center mt-2 italic tracking-widest">Saved to database automatically</p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowCredsModal(false)}
                  className="btn btn-secondary text-[10px] uppercase font-bold"
                >
                  Close
                </button>
                <a 
                  href={getWhatsAppLink(credsForm, credsForm.password)}
                  target="_blank"
                  className="btn btn-primary bg-emerald-500 hover:bg-emerald-600 text-[10px] flex items-center justify-center gap-2 uppercase font-bold"
                >
                  <MessageCircle className="w-4 h-4" /> Send WhatsApp
                </a>
             </div>
          </div>
        </div>
      )      {showGroupModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-6 border-[var(--brand-orange)]/30 animate-in text-left">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight">Create Group / Segment</h3>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">Define the segment type and focus area</p>
              </div>
              <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Group Name / Identity</label>
                <input 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)} 
                  placeholder="e.g. SolarTech or Tech Cohort..."
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" 
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Program Logic (Focus)</label>
                <select
                  value={newGroupType}
                  onChange={e => setNewGroupType(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] appearance-none"
                >
                  <option value="individual">Individual Students</option>
                  <option value="company">Business Entities / Companies</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Initial Program Assignment</label>
                <select
                  value={newGroupProgramId}
                  onChange={e => setNewGroupProgramId(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] appearance-none"
                >
                  <option value="">Select Program (Optional)...</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button 
                onClick={handleCreateGroup}
                disabled={isProcessing || !newGroupName.trim()}
                className="btn btn-primary w-full py-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Segment
              </button>
            </div>
          </div>
        </div>
      )})}

    </DashboardLayout>
  );
}

// Minimal placeholder for missing icon
function UserIcon({ className }) {
   return <Users className={className} />;
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <ContactsPageContent />
    </Suspense>
  );
}
