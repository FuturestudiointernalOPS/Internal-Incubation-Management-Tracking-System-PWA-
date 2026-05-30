'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, 
  ChevronLeft, ChevronRight, Filter, Search,
  Briefcase, Users, Zap, Shield
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';

/**
 * TEACHER SESSION CALENDAR — TACTICAL TIMELINE
 * Clean, high-density schedule for active teammates.
 */

export default function TeacherCalendar() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { t } = useI18n();

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`/api/pm/schedule?teacher_id=${user.cid || user.id}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.schedule || []);
      }
    } catch (error) {
      console.error("Calendar Fetch Failure:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Padding for start of month
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let d = 1; d <= totalDays; d++) calendarDays.push(d);

  const getSessionsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sessions.filter(s => s.scheduled_date === dateStr);
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8 animate-in text-left">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-secondary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">Tactical Timeline</span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic">Session <span className="text-[var(--text-secondary)] opacity-40">Calendar</span></h1>
          </div>
          
          <div className="flex items-center gap-4 bg-secondary border border-[var(--border-primary)] p-2 rounded-2xl shadow-sm">
            <button onClick={prevMonth} className="p-2 hover:bg-tertiary rounded-xl transition-all text-[var(--text-primary)]"><ChevronLeft className="w-5 h-5" /></button>
            <div className="px-4 text-center min-w-[140px]">
              <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{monthName}</p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-60">{year}</p>
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-tertiary rounded-xl transition-all text-[var(--text-primary)]"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* CALENDAR GRID */}
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-7 gap-px bg-[var(--border-secondary)] border border-[var(--border-secondary)] rounded-3xl overflow-hidden shadow-2xl">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="bg-secondary py-4 text-center">
                  <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-60">{d}</span>
                </div>
              ))}
              
              {calendarDays.map((day, idx) => {
                const daySessions = getSessionsForDay(day);
                const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                
                return (
                  <div 
                    key={idx} 
                    className={`min-h-[120px] bg-secondary p-3 border-t border-r border-[var(--border-secondary)] transition-all group ${!day ? 'opacity-20' : 'hover:bg-tertiary/50'}`}
                  >
                    {day && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-black ${isToday ? 'w-6 h-6 rounded-full bg-[var(--brand-orange)] text-black flex items-center justify-center' : 'text-slate-500'}`}>
                            {day}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          {daySessions.map(s => (
                            <div key={s.id} className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400 uppercase tracking-tighter truncate leading-none">
                              {s.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* UPCOMING LIST */}
          <div className="space-y-6">
            <div className="ios-card bg-secondary border-[var(--border-secondary)] !p-8 shadow-sm">
              <h3 className="text-lg font-black text-[var(--text-primary)] uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                <Clock className="w-5 h-5 text-[var(--brand-orange)]" /> Upcoming
              </h3>
              
              <div className="space-y-6">
                {sessions.length > 0 ? sessions.slice(0, 5).map(s => (
                  <div key={s.id} className="group relative pl-4 border-l-2 border-[var(--brand-orange)]/20 hover:border-[var(--brand-orange)] transition-all py-1">
                    <p className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-widest mb-1">{s.scheduled_date}</p>
                    <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tighter group-hover:text-[var(--brand-orange)] transition-colors">{s.title}</h4>
                    <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1 opacity-60">{s.program_name}</p>
                    <div className="flex items-center gap-2 mt-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                      <Clock className="w-3 h-3" /> {s.start_time || '00:00'} - {s.end_time || '23:59'}
                    </div>
                  </div>
                )) : (
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase italic opacity-40">No sessions mapped.</p>
                )}
              </div>
            </div>

            <div className="ios-card bg-[var(--brand-orange)]/5 border-[var(--brand-orange)]/10 !p-8">
              <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-widest mb-4 flex items-center gap-2 opacity-80">
                <Zap className="w-3 h-3" /> Quick Insight
              </h4>
              <p className="text-[11px] font-bold text-[var(--text-secondary)] leading-relaxed uppercase opacity-70">
                Synchronize your physical presence with these tactical windows. Attendance vectors are logged in real-time.
              </p>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
