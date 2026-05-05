'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  Users, Briefcase, Activity, CheckCircle2, ChevronRight, 
  ExternalLink, FileText, Mail, MessageCircle, MoreVertical, 
  Plus, Search, Shield, Target, Zap, Clock, AlertCircle, Trash2, LayoutDashboard, X, Save, BarChart3
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';

/**
 * IMPACTOS OPERATIONAL CONTROL — PROGRAM WORKSPACE
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
  const [reports, setReports] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [events, setEvents] = useState([]);
  const [assignedStaff, setAssignedStaff] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [showPMReportModal, setShowPMReportModal] = useState(false);
  
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', handler_name: '' });
  const [newSession, setNewSession] = useState({ title: '', week_number: 1, status: 'pending' });
  const [newRequirement, setNewRequirement] = useState({ title: '', description: '', allowed_format: 'pdf' });
  const [newPMReport, setNewPMReport] = useState({ summary: '', status: 'optimal' });
  const [newStaff, setNewStaff] = useState({ staff_id: '', role: 'teacher' });
  const [newKPI, setNewKPI] = useState({ title: '', target_value: 80 });
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
      const res = await fetch('/api/pm/programs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: configNameRef.current?.value,
          description: configDescRef.current?.value,
          duration_weeks: parseInt(configWeeksRef.current?.value) || program?.duration_weeks,
          status: configStatusRef.current?.value,
          note_id: program?.note_id,
          assigned_pm_id: program?.assigned_pm_id,
          assigned_assistant_id: program?.assigned_assistant_id,
          materials: program?.materials,
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
      if (data.success) { 
        notify('Squad deployed.'); 
        setShowTeamModal(false); 
        setNewTeam({ name: '', handler_name: '' }); 
        fetchProgramData(); 
      }
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
        body: JSON.stringify({
          action: 'add_session',
          program_id: id,
          title: newSession.title,
          week_number: newSession.week_number,
          status: newSession.status,
        })
      });
      const data = await res.json();
      if (data.success) { notify('Session added.'); setShowSessionModal(false); setNewSession({ title: '', week_number: 1, status: 'pending' }); fetchProgramData(); }
      else notify(data.error || 'Add failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  const addRequirement = async () => {
    if (!newRequirement.title.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/pm/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_requirement',
          program_id: id,
          session_id: selectedSessionId,
          title: newRequirement.title,
          description: newRequirement.description,
          allowed_format: newRequirement.allowed_format,
        })
      });
      const data = await res.json();
      if (data.success) { 
        notify('Requirement anchored.'); 
        setShowRequirementModal(false); 
        setNewRequirement({ title: '', description: '', allowed_format: 'pdf' }); 
        fetchProgramData(); 
      } else notify(data.error || 'Failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  const submitPMReport = async () => {
    if (!newPMReport.summary.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/pm/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_pm_report',
          program_id: id,
          session_id: selectedSessionId,
          week_number: sessions.find(s => s.id === selectedSessionId)?.week_number,
          summary: newPMReport.summary,
          status: newPMReport.status,
          pm_id: user.cid || user.id
        })
      });
      const data = await res.json();
      if (data.success) { 
        notify('Weekly report transmitted.'); 
        setShowPMReportModal(false); 
        setNewPMReport({ summary: '', status: 'optimal' }); 
        fetchProgramData(); 
      } else notify(data.error || 'Failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  const addKPI = async () => {
    if (!newKPI.title.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/v2/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newKPI, program_id: id })
      });
      const data = await res.json();
      if (data.success) { notify('KPI defined.'); setShowKPIModal(false); setNewKPI({ title: '', target_value: 80 }); fetchProgramData(); }
      else notify(data.error || 'Failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  const removeKPI = async (kpiId) => {
    if (!confirm('Decommission this KPI?')) return;
    try {
      await fetch('/api/v2/kpis', { method: 'DELETE', body: JSON.stringify({ id: kpiId }) });
      notify('KPI removed.');
      fetchProgramData();
    } catch (e) {}
  };

  const assignStaff = async () => {
    if (!newStaff.staff_id) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/v2/program-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newStaff, program_id: id })
      });
      const data = await res.json();
      if (data.success) { notify('Personnel assigned.'); setShowStaffModal(false); setNewStaff({ staff_id: '', role: 'teacher' }); fetchProgramData(); }
      else notify(data.error || 'Assignment failed.', 'error');
    } catch (e) { notify('Network error.', 'error'); }
    finally { setIsSaving(false); }
  };

  const removeStaff = async (staffId) => {
    if (!confirm('Remove this staff member?')) return;
    try {
      const record = assignedStaff.find(s => s.cid === staffId);
      if (record && record.id) {
         await fetch('/api/v2/program-staff', { method: 'DELETE', body: JSON.stringify({ id: record.id }) });
         notify('Personnel removed.');
         fetchProgramData();
      }
    } catch (e) {}
  };

  const deleteSession = async (sessionId) => {
    if (!confirm('Decommission this node and all associated requirements?')) return;
    try {
       await fetch('/api/pm/curriculum', { 
         method: 'DELETE', 
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id: sessionId, type: 'session' }) 
       });
       notify('Session removed.');
       fetchProgramData();
    } catch (e) {}
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
        setStaffList(res.staffList || []);
        setReports(res.reports || []);
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
    { id: 'config', name: 'Configuration', icon: Shield },
    { id: 'curriculum', name: 'Curriculum', icon: FileText },
    { id: 'reports', name: 'Reports', icon: BarChart3 },
    { id: 'teams', name: 'Teams', icon: Target },
    { id: 'participants', name: 'Participants', icon: Users },
    { id: 'submissions', name: 'Submissions', icon: Activity },
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
                         <button onClick={() => deleteSession(session.id)} className="p-2 text-rose-500 hover:text-rose-700">
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-50">Associated Deliverables</span>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => { setSelectedSessionId(session.id); setShowPMReportModal(true); }}
                            className="text-[10px] font-black text-emerald-500 uppercase hover:underline"
                          >PM Report</button>
                          <button 
                            onClick={() => { setSelectedSessionId(session.id); setShowRequirementModal(true); }}
                            className="text-[10px] font-black text-[var(--brand-orange)] uppercase hover:underline"
                          >+ Requirement</button>
                        </div>
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
                            <button onClick={() => removeKPI(kpi.id)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setShowKPIModal(true)} className="btn btn-secondary w-full py-3 gap-2 border-dashed">
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
                          <button onClick={() => removeStaff(staff.cid)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setShowStaffModal(true)} className="btn btn-secondary w-full py-3 gap-2 border-dashed">
                      <Plus className="w-4 h-4" /> Assign Personnel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">Weekly Intelligence Feed</h3>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Total Signals:</span>
                   <span className="text-sm font-black">{reports.length}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {reports.map((report, i) => (
                  <div key={report.id || i} className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)] transition-all">
                    <div className="p-4 bg-[var(--bg-tertiary)] flex justify-between items-center border-b border-[var(--border-primary)]">
                       <div className="flex items-center gap-4">
                          <div className="px-3 py-1 bg-[var(--brand-orange)] text-white text-[10px] font-black rounded uppercase">
                             Week {report.week_number}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                             Submission by {report.teacher_name || 'Teacher'}
                          </span>
                       </div>
                       <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                          {new Date(report.created_at).toLocaleDateString()}
                       </span>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-4">
                          <div>
                             <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] mb-1">Challenges & Blockers</p>
                             <p className="text-xs text-[var(--text-primary)] leading-relaxed">{report.challenges || 'No data reported.'}</p>
                          </div>
                          <div>
                             <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Highlights & Successes</p>
                             <p className="text-xs text-[var(--text-primary)] leading-relaxed">{report.highlights || 'No data reported.'}</p>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div>
                             <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Strategic Next Steps</p>
                             <p className="text-xs text-[var(--text-primary)] leading-relaxed">{report.next_steps || 'No data reported.'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-2">
                             <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
                                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">Attendance</p>
                                <p className="text-sm font-black">{report.attendance_count || 0}</p>
                             </div>
                             <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
                                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">Sessions</p>
                                <p className="text-sm font-black">{report.sessions_completed || 0}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                   <div className="py-20 text-center card border-dashed opacity-40">
                      <BarChart3 className="w-10 h-10 mx-auto mb-4 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">Awaiting initial intelligence reports...</p>
                   </div>
                )}
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
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Assigned Handler</label>
                <select value={newTeam.handler_name} onChange={e => setNewTeam(p => ({...p, handler_name: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                   <option value="">Select Staff...</option>
                   {assignedStaff.map(s => (
                     <option key={s.cid} value={s.name}>{s.name} ({s.role})</option>
                   ))}
                </select>
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

      {/* ASSIGN STAFF MODAL */}
      {showStaffModal && (
        <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowStaffModal(false)}>
          <div className="card w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>Assign Personnel</h3>
              <button onClick={() => setShowStaffModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Select Staff Member</label>
                <select value={newStaff.staff_id} onChange={e => setNewStaff(p => ({...p, staff_id: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                  <option value="">Select Member...</option>
                  {staffList.map(s => (
                    <option key={s.cid} value={s.cid}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Assigned Role</label>
                <select value={newStaff.role} onChange={e => setNewStaff(p => ({...p, role: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                  <option value="teacher">Teacher</option>
                  <option value="assistant">Assistant</option>
                  <option value="evaluator">Evaluator</option>
                  <option value="handler">Handler</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowStaffModal(false)} className="flex-1 btn btn-secondary">Cancel</button>
              <button onClick={assignStaff} disabled={isSaving || !newStaff.staff_id} className="flex-1 btn btn-primary">{isSaving ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      {/* DEFINE KPI MODAL */}
      {showKPIModal && (
        <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowKPIModal(false)}>
          <div className="card w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>Define KPI Target</h3>
              <button onClick={() => setShowKPIModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>KPI Title</label>
                <input value={newKPI.title} onChange={e => setNewKPI(p => ({...p, title: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="e.g. Weekly Engagement" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Target Value (%)</label>
                <input type="number" min="0" max="100" value={newKPI.target_value} onChange={e => setNewKPI(p => ({...p, target_value: parseInt(e.target.value) || 0}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowKPIModal(false)} className="flex-1 btn btn-secondary">Cancel</button>
              <button onClick={addKPI} disabled={isSaving || !newKPI.title.trim()} className="flex-1 btn btn-primary">{isSaving ? 'Defining...' : 'Define'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ANCHOR REQUIREMENT MODAL */}
      {showRequirementModal && (
        <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowRequirementModal(false)}>
          <div className="card w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>Anchor Requirement</h3>
              <button onClick={() => setShowRequirementModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Requirement Title</label>
                <input value={newRequirement.title} onChange={e => setNewRequirement(p => ({...p, title: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="e.g. Project Proposal PDF" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Allowed Format</label>
                <select value={newRequirement.allowed_format} onChange={e => setNewRequirement(p => ({...p, allowed_format: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                   <option value="pdf">PDF Document</option>
                   <option value="image">Image File</option>
                   <option value="link">External Link</option>
                   <option value="video">Video Upload</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRequirementModal(false)} className="flex-1 btn btn-secondary">Cancel</button>
              <button onClick={addRequirement} disabled={isSaving || !newRequirement.title.trim()} className="flex-1 btn btn-primary">{isSaving ? 'Anchoring...' : 'Anchor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PM WEEKLY REPORT MODAL */}
      {showPMReportModal && (
        <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowPMReportModal(false)}>
          <div className="card w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>Weekly PM Intelligence</h3>
              <button onClick={() => setShowPMReportModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Project Status Summary</label>
                <textarea value={newPMReport.summary} onChange={e => setNewPMReport(p => ({...p, summary: e.target.value}))} rows="5" className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold text-[var(--text-primary)]" placeholder="How did this week's topic go? Any tactical successes or blockers?" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Strategic Health</label>
                <select value={newPMReport.status} onChange={e => setNewPMReport(p => ({...p, status: e.target.value}))} className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                   <option value="optimal">OPTIMAL</option>
                   <option value="stable">STABLE</option>
                   <option value="at_risk">AT RISK</option>
                   <option value="critical">CRITICAL</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPMReportModal(false)} className="flex-1 btn btn-secondary">Cancel</button>
              <button onClick={submitPMReport} disabled={isSaving || !newPMReport.summary.trim()} className="flex-1 btn btn-primary">{isSaving ? 'Transmitting...' : 'Submit to Super Admin'}</button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
