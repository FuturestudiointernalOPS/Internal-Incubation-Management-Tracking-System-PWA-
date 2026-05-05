'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  Users, Briefcase, Activity, CheckCircle2, ChevronRight, 
  ExternalLink, FileText, Mail, MessageCircle, MoreVertical, 
  Plus, Search, Shield, Target, Zap, Clock, AlertCircle, Trash2, LayoutDashboard, X, Save
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';

/**
 * IMPACTOS OPERATIONAL CONTROL ÔÇö PROGRAM WORKSPACE
 * Performance-first, modular data loading, and clean data-first UI.
 */

export default function ProgramWorkspace() {
  const { id } = useParams();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [loading, setLoading] = useState(true);
  
  // State Modules
  const [user, setUser] = useState({});
  const [program, setProgram] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [events, setEvents] = useState([]);
  const [assignedStaff, setAssignedStaff] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', handler_name: '' });
  const [newSession, setNewSession] = useState({ title: '', week_number: 1, status: 'pending' });
  const [toast, setToast] = useState(null);
  const configNameRef = useRef(null);
  const configDescRef = useRef(null);
  const configWeeksRef = useRef(null);
  const configStatusRef = useRef(null);

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/pm/programs/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: configNameRef.current?.value,
          description: configDescRef.current?.value,
          duration_weeks: parseInt(configWeeksRef.current?.value) || program?.duration_weeks,
          status: configStatusRef.current?.value,
        })
      });
      const data = await res.json();
      if (data.success) { notify('Configuration saved.'); fetchProgramData(); }
      else notify(data.error || 'Save failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  const deployTeam = async () => {
    if (!newTeam.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/pm/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTeam, program_id: id })
      });
      const data = await res.json();
      if (data.success) { notify('Squad deployed.'); setShowTeamModal(false); setNewTeam({ name: '', handler_name: '' }); fetchProgramData(); }
      else notify(data.error || 'Deploy failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  const addSession = async () => {
    if (!newSession.title.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/pm/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSession, program_id: id })
      });
      const data = await res.json();
      if (data.success) { notify('Session added.'); setShowSessionModal(false); setNewSession({ title: '', week_number: 1, status: 'pending' }); fetchProgramData(); }
      else notify(data.error || 'Add failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const fetchProgramData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pm/full-state?id=${id}`).then(res => res.json());
      
      if (res.success) {
        setProgram(res.program);
        setSessions(res.sessions || []);
        setTeams(res.teams || []);
        setParticipants(res.participants || []);
        setSubmissions(res.submissions || []);
        setRequirements(res.documents || []);
        setKpis(res.kpis || []);
        setEvents(res.events || []);
        setAssignedStaff(res.assignedStaff || []);
      }
    } catch (error) {
      console.error("Operational Fetch Failure:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProgramData();
  }, [fetchProgramData]);

  if (loading) {
    return (
      <DashboardLayout role={user.role || "program_manager"}>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="w-12 h-12 border-4 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('loading')}</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'curriculum', name: 'Curriculum', icon: FileText },
    { id: 'teams', name: 'Teams', icon: Target },
    { id: 'participants', name: 'Participants', icon: Users },
    { id: 'submissions', name: 'Submissions', icon: Activity },
    { id: 'config', name: 'Configuration', icon: Shield },
  ];

  return (
    <DashboardLayout role={user.role || "program_manager"}>
      <div className="space-y-8 animate-in">
        
        {/* HEADER SECTION */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="status-badge bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{program?.status?.toUpperCase() || 'ACTIVE'}</span>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{program?.id}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">{program?.name}</h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl">{program?.description}</p>
          </div>
          
          {(user.role === 'super_admin' || user.role === 'program_manager') && (
            <div className="flex gap-3">
              <button className="btn btn-secondary gap-2">
                <Shield className="w-4 h-4" />
                Settings
              </button>
              <button className="btn btn-primary gap-2">
                <Plus className="w-4 h-4" />
                Deploy Node
              </button>
            </div>
          )}
        </header>

        {/* TAB NAVIGATION */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === tab.id ? 'border-[var(--brand-orange)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="pt-4">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold">{participants.length}</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">Total Participants</p>
                  <p className="text-[10px] text-emerald-500 font-bold mt-1">+12% from last cohort</p>
                </div>
              </div>
              
              <div className="card space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold">{submissions.length}</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">Operational Submissions</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">Completion Rate: 84%</p>
                </div>
              </div>

              <div className="card space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                    <Target className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold">{teams.length}</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">Deployed Squads</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">Active Operations</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Email</th>
                    <th>Squad</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.id}>
                      <td className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--bg-primary)] flex items-center justify-center font-bold text-xs border border-[var(--border-primary)]">
                          {p.name.charAt(0)}
                        </div>
                        <span className="font-bold">{p.name}</span>
                      </td>
                      <td>{p.email}</td>
                      <td>
                        <span className="px-2 py-1 bg-[var(--bg-primary)] rounded text-[10px] font-bold uppercase">
                          {p.group_name || 'Unassigned'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-medium">Operational</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-2 hover:text-[var(--brand-blue)]"><Mail className="w-4 h-4" /></button>
                          <button className="p-2 hover:text-emerald-500"><MessageCircle className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map(team => (
                <div key={team.id} className="card group hover:border-[var(--brand-orange)] transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                      <Target className="w-6 h-6" />
                    </div>
                    {(user.role === 'super_admin' || user.role === 'program_manager') && (
                      <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{team.name}</h3>
                  <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-6">Handler: {team.handler_name || 'Unassigned'}</p>
                  <div className="flex justify-between items-center pt-4 border-t border-[var(--border-primary)]">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Healthy</span>
                    <button className="text-[var(--brand-blue)] text-xs font-bold uppercase flex items-center gap-1">
                      Details <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(user.role === 'super_admin' || user.role === 'program_manager') && (
                <button onClick={() => setShowTeamModal(true)} className="card border-dashed flex flex-col items-center justify-center gap-3 opacity-60 hover:opacity-100 transition-all min-h-[200px]">
                  <Plus className="w-8 h-8 text-[var(--text-secondary)]" />
                  <span className="text-xs font-bold uppercase tracking-widest">Deploy New Squad</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'curriculum' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">Strategic Curriculum</h3>
                <button onClick={() => setShowSessionModal(true)} className="btn btn-primary btn-sm gap-2">
                  <Plus className="w-4 h-4" /> Add Session
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {sessions.map(session => (
                  <div key={session.id} className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)] transition-all">
                    <div className="p-6 bg-[var(--bg-tertiary)] flex justify-between items-center border-b border-[var(--border-primary)]">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] flex flex-col items-center justify-center text-[10px] font-black border border-[var(--border-primary)]">
                          <span className="text-[var(--brand-orange)]">W{session.week_number}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-[var(--text-primary)] uppercase">{session.title}</h4>
                          <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">{session.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded text-[9px] font-bold uppercase text-[var(--text-secondary)]">
                           {session.assignment_type || 'General'}
                         </span>
                         <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                           <MoreVertical className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-50">Associated Deliverables</span>
                        <button className="text-[10px] font-black text-[var(--brand-orange)] uppercase hover:underline">+ Requirement</button>
                      </div>
                      <div className="space-y-2">
                        {requirements.filter(r => r.session_id === session.id).map(req => (
                          <div key={req.id} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-[var(--brand-blue)]" />
                              <div>
                                <p className="text-xs font-bold text-[var(--text-primary)]">{req.title}</p>
                                <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Format: {req.allowed_format || 'PDF'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${req.is_completed ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                              <button className="text-[10px] font-bold text-rose-500 hover:underline">Remove</button>
                            </div>
                          </div>
                        ))}
                        {requirements.filter(r => r.session_id === session.id).length === 0 && (
                           <p className="text-[10px] italic text-[var(--text-secondary)] opacity-40">No specific document requirements anchored to this node.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-8 animate-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
                    Program Identity
                  </h3>
                  <div className="card space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Program Name</label>
                      <input ref={configNameRef} type="text" defaultValue={program?.name} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Strategic Description</label>
                      <textarea ref={configDescRef} rows="4" defaultValue={program?.description} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Duration (Weeks)</label>
                        <input ref={configWeeksRef} type="number" defaultValue={program?.duration_weeks} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Operational Status</label>
                        <select ref={configStatusRef} defaultValue={program?.status} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold">
                          <option value="active">ACTIVE</option>
                          <option value="archived">ARCHIVED</option>
                          <option value="draft">DRAFT</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={saveConfig} disabled={isSaving} className="btn btn-primary w-full py-4 mt-4 gap-2">
                      <Save className="w-4 h-4" />{isSaving ? 'Saving...' : 'Synchronize Global Settings'}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-500" />
                    Strategic KPIs
                  </h3>
                  <div className="card space-y-4">
                    <div className="space-y-2">
                      {kpis.map(kpi => (
                        <div key={kpi.id} className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                          <span className="font-bold text-sm uppercase tracking-tight">{kpi.title}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-[var(--brand-orange)]">{kpi.target_value}%</span>
                            <button className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-secondary w-full py-3 gap-2 border-dashed">
                      <Plus className="w-4 h-4" /> Define KPI Target
                    </button>
                  </div>

                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 mt-8">
                    <Users className="w-5 h-5 text-blue-500" />
                    Staff Deployment
                  </h3>
                  <div className="card space-y-4">
                    <div className="space-y-2">
                      {assignedStaff.map(staff => (
                        <div key={staff.cid} className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-[10px] font-black uppercase">{staff.name?.charAt(0)}</div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-tight">{staff.name}</p>
                              <p className="text-[9px] text-[var(--text-secondary)] font-bold">{staff.role}</p>
                            </div>
                          </div>
                          <button className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-secondary w-full py-3 gap-2 border-dashed">
                      <Plus className="w-4 h-4" /> Assign Personnel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Deliverable</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr key={sub.id}>
                      <td>{sub.participant_name || 'N/A'}</td>
                      <td>{sub.deliverable_title}</td>
                      <td className="text-[10px] opacity-60 font-bold">{new Date(sub.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button className="text-[var(--brand-blue)] text-[10px] font-black uppercase italic">Review</button>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-20 text-center opacity-30 italic">No submissions detected in this sector.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest border ${
          toast.type === 'error'
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>{toast.msg}</div>
      )}

      {/* DEPLOY SQUAD MODAL */}
      {showTeamModal && (
        <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowTeamModal(false)}>
          <div className="card w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>Deploy New Squad</h3>
              <button onClick={() => setShowTeamModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Squad Name</label>
                <input value={newTeam.name} onChange={e => setNewTeam(p => ({...p, name: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="e.g. Alpha Squad" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Handler Name</label>
                <input value={newTeam.handler_name} onChange={e => setNewTeam(p => ({...p, handler_name: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="e.g. Jane Doe" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowTeamModal(false)} className="flex-1 btn btn-secondary">Cancel</button>
              <button onClick={deployTeam} disabled={isSaving || !newTeam.name.trim()} className="flex-1 btn btn-primary">{isSaving ? 'Deploying...' : 'Deploy'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SESSION MODAL */}
      {showSessionModal && (
        <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowSessionModal(false)}>
          <div className="card w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>Add Session</h3>
              <button onClick={() => setShowSessionModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Session Title</label>
                <input value={newSession.title} onChange={e => setNewSession(p => ({...p, title: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="e.g. Orientation Week" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Week Number</label>
                <input type="number" min="1" value={newSession.week_number} onChange={e => setNewSession(p => ({...p, week_number: parseInt(e.target.value) || 1}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSessionModal(false)} className="flex-1 btn btn-secondary">Cancel</button>
              <button onClick={addSession} disabled={isSaving || !newSession.title.trim()} className="flex-1 btn btn-primary">{isSaving ? 'Adding...' : 'Add Session'}</button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
