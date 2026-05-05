'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  Users, Briefcase, Activity, CheckCircle2, ChevronRight, 
  ExternalLink, FileText, Mail, MessageCircle, MoreVertical, 
  Plus, Search, Shield, Target, Zap, Clock, AlertCircle, Trash2, LayoutDashboard
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

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const fetchProgramData = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel Modular Fetching (< 1.5s Load Target)
      const [progRes, sessionRes, teamRes, partRes, subRes] = await Promise.all([
        fetch(`/api/pm/programs/${id}`).then(res => res.json()),
        fetch(`/api/sessions?program_id=${id}`).then(res => res.json()),
        fetch(`/api/pm/teams?program_id=${id}`).then(res => res.json()),
        fetch(`/api/participants?program_id=${id}`).then(res => res.json()),
        fetch(`/api/submissions?program_id=${id}`).then(res => res.json())
      ]);

      if (progRes.success) setProgram(progRes.program);
      if (sessionRes.success) setSessions(sessionRes.sessions || []);
      if (teamRes.success) setTeams(teamRes.teams || []);
      if (partRes.success) setParticipants(partRes.participants || []);
      if (subRes.success) setSubmissions(subRes.submissions || []);
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
                <button className="card border-dashed flex flex-col items-center justify-center gap-3 opacity-60 hover:opacity-100 transition-all min-h-[200px]">
                  <Plus className="w-8 h-8 text-[var(--text-secondary)]" />
                  <span className="text-xs font-bold uppercase tracking-widest">Deploy New Squad</span>
                </button>
              )}
            </div>
          )}

          {/* Additional tabs will be implemented here */}
          
        </div>
      </div>
    </DashboardLayout>
  );
}
