'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Zap, Layers, Users, Activity, Shield, 
  ChevronRight, Sparkles, Rocket, TrendingUp, Target,
  CheckCircle2, XCircle, Bell, UserCheck, Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

/**
 * IMPACTOS OPERATIONAL COMMAND — ADMIN DASHBOARD
 * Performance-optimized state tracking and centralized program control.
 * Features: Gated Staff Approval, Real-time Notifications, Metric Intelligence.
 */

const StatCard = ({ title, value, icon: Icon, color, badge, onClick, loading }) => (
  <div 
    onClick={onClick}
    className={`card group transition-all ${onClick ? 'cursor-pointer hover:border-[var(--brand-orange)]' : ''}`}
  >
    <div className="flex justify-between items-start mb-6">
      <div className={`p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] ${color} group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      {badge && <span className="status-badge bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{badge}</span>}
    </div>
    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">{title}</p>
    {loading ? <div className="h-9 w-20 bg-[var(--border-primary)]/20 animate-pulse rounded-lg" /> : (
      <h3 className="text-3xl font-bold text-[var(--text-primary)] uppercase tracking-tighter">{value}</h3>
    )}
  </div>
);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ programs: 0, participants: 0, totalStaff: 0 });
  const [activity, setActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  
  const router = useRouter();

  const fetchDashboardData = useCallback(async () => {
    try {
      const [stateRes, notifRes] = await Promise.all([
        fetch('/api/superadmin/full-state'),
        fetch('/api/notifications?recipient_id=sa')
      ]);
      
      const stateData = await stateRes.json();
      const notifData = await notifRes.json();
      
      if (stateData.success) {
         setStats(stateData.stats || {});
         setActivity(stateData.activity || []);
         setActivePrograms(stateData.activePrograms || []);
      }
      if (notifData.success) {
         setNotifications(notifData.notifications || []);
      }
    } catch (err) {
      console.error("Operational Command Sync Failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.replace('/terminal');
      return;
    }
    const user = JSON.parse(userString);
    if (user.role !== 'super_admin') {
      router.replace('/terminal');
      return;
    }
    fetchDashboardData();
  }, [router, fetchDashboardData]);

  const handleApproval = async (notif) => {
    setProcessingId(notif.id);
    try {
       // 1. Identify the user from the message (In a real app, we'd have a userId in the notification)
       // For now, we'll find the pending staff from contacts
       const contactsRes = await fetch('/api/contacts');
       const contactsData = await contactsRes.json();
       const pendingUser = contactsData.contacts.find(c => 
          c.status === 'pending' && notif.message.includes(c.name)
       );

       if (pendingUser) {
          // 2. Approve the user
          await fetch('/api/contacts', {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ cid: pendingUser.cid, status: 'approved' })
          });
       }

       // 3. Mark notification as read
       await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id, action: 'read' })
       });

       fetchDashboardData();
    } catch (e) {
       console.error("Approval Failed:", e);
    } finally {
       setProcessingId(null);
    }
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-10 animate-in text-left">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">Operational Intelligence</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">ADMIN COMMAND</h1>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => router.push('/admin/programs/new')}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" />
              New Program
            </button>
          </div>
        </header>

        {/* NOTIFICATION HUB — ONLY VISIBLE WHEN ALERTED */}
        {notifications.length > 0 && (
          <div className="grid grid-cols-1 gap-6">
            {notifications.map(notif => (
              <div key={notif.id} className="card border-orange-500/30 bg-orange-500/5 flex flex-col md:flex-row justify-between items-center gap-6 animate-pulse hover:animate-none">
                <div className="flex items-center gap-5">
                   <div className="p-3 rounded-xl bg-orange-500/20 text-orange-500">
                      <Bell className="w-6 h-6" />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold uppercase tracking-tight text-[var(--text-primary)]">{notif.title}</h4>
                      <p className="text-[11px] font-medium text-[var(--brand-orange)] uppercase tracking-widest mt-1">{notif.message}</p>
                   </div>
                </div>
                <div className="flex gap-3">
                   <button 
                      onClick={() => handleApproval(notif)}
                      disabled={processingId === notif.id}
                      className="btn btn-primary !bg-emerald-500 hover:!bg-emerald-600 border-none px-6 py-2.5 flex items-center gap-2"
                   >
                      {processingId === notif.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      <span className="text-[10px] font-black uppercase">Approve Access</span>
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Active Programs" 
            value={stats.programs} 
            icon={Layers} 
            color="text-[var(--brand-orange)]" 
            badge="LIVE" 
            onClick={() => router.push('/admin/programs')}
            loading={loading}
          />
          <StatCard 
            title="Operational Staff" 
            value={stats.totalStaff} 
            icon={Users} 
            color="text-emerald-500" 
            onClick={() => router.push('/admin/communications/contacts')}
            loading={loading}
          />
          <StatCard 
            title="Total Participants" 
            value={stats.participants} 
            icon={Rocket} 
            color="text-blue-500" 
            onClick={() => router.push('/admin/communications/contacts')}
            loading={loading}
          />
          <StatCard 
            title="System Health" 
            value="100%" 
            icon={Activity} 
            color="text-rose-500" 
            badge="OPTIMAL"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ACTIVITY FEED */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--brand-orange)]" /> 
                Recent Signal Feed
              </h4>
            </div>
            
            <div className="space-y-4">
              {loading ? <TableSkeleton rows={4} /> : (
                activity.length > 0 ? activity.slice(0, 6).map((log, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:border-[var(--brand-orange)]">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight">{log.action}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">{log.user || 'System'} · {new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--border-primary)]" />
                  </div>
                )) : (
                  <p className="text-[10px] text-[var(--text-secondary)] italic opacity-50 py-10 text-center">Awaiting incoming signals...</p>
                )
              )}
            </div>
          </div>

          {/* ACTIVE PROGRAMS LIST */}
          <div className="card">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" /> 
                Active Programs
              </h4>
              <button 
                onClick={() => router.push('/admin/programs')}
                className="text-[9px] font-bold text-[var(--brand-orange)] uppercase hover:underline"
              >
                View All
              </button>
            </div>
            
            <div className="space-y-4">
              {loading ? <TableSkeleton rows={3} /> : (
                activePrograms.length > 0 ? activePrograms.map((prog, i) => (
                  <div 
                    key={prog.id} 
                    onClick={() => router.push(`/admin/programs/${prog.id}`)}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-all cursor-pointer group border border-transparent hover:border-[var(--border-primary)]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                      <Rocket className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight truncate">{prog.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-[8px] font-bold text-emerald-500 uppercase px-1.5 py-0.5 bg-emerald-500/10 rounded">{prog.status}</span>
                         <span className="text-[8px] text-[var(--text-secondary)] font-medium uppercase">{new Date(prog.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[var(--border-primary)]" />
                  </div>
                )) : (
                  <p className="text-[10px] text-[var(--text-secondary)] italic opacity-50 py-10 text-center">No active programs found.</p>
                )
              )}
            </div>
          </div>

          {/* QUICK COMMANDS */}
          <div className="space-y-6">
            <div className="card space-y-4">
              <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2">Tactical Actions</h4>
              <button 
                onClick={() => router.push('/admin/communications/contacts')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-orange)] transition-all"
              >
                <span className="text-xs font-bold uppercase tracking-tight">Manage Registry</span>
                <Users className="w-4 h-4 text-[var(--brand-orange)]" />
              </button>
              <button 
                onClick={() => router.push('/admin/knowledge')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-orange)] transition-all"
              >
                <span className="text-xs font-bold uppercase tracking-tight">Knowledge Bank</span>
                <Target className="w-4 h-4 text-blue-500" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
