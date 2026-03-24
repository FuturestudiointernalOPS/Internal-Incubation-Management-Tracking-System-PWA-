'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Filter, Download, 
  MoreVertical, Edit, Trash2, Calendar,
  Layers, ChevronRight, ArrowUpDown, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function CohortManagement() {
  const [cohorts, setCohorts] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAddCohort, setShowAddCohort] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const response = await fetch('/api/data');
      const db = await response.json();
      setCohorts(db.cohorts || []);
      setIsLoaded(true);
    }
    fetchData();
  }, []);

  return (
    <DashboardLayout role="program_manager">
      <div className="space-y-12">
        <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Cohort Command Hub</h2>
            <button onClick={() => setShowAddCohort(true)} className="flex items-center gap-3 px-8 py-3.5 bg-indigo-600 rounded-2xl text-sm font-black text-white hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest leading-none">
                <Plus className="w-4 h-4" /> Initialize New Cohort
            </button>
        </div>

        {/* Filters & Export Bar */}
        <div className="ios-card bg-white p-6 border-slate-100 shadow-xl shadow-slate-100 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                    <input 
                      placeholder="Search across all cohorts..." 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-6 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>
                <button className="flex items-center gap-3 px-6 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">
                    <Filter className="w-4 h-4" /> Filter
                </button>
            </div>
            <div className="flex items-center gap-3">
                <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><Download className="w-4 h-4" /></button>
                <div className="h-8 w-px bg-slate-100 mx-2" />
                <button className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-indigo-600 transition-all uppercase tracking-widest">
                    Bulk Actions <ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </div>

        {/* Cohort Table */}
        <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200/50">
           <table className="w-full text-left">
               <thead>
                   <tr className="bg-slate-50 border-b border-slate-100 font-headings">
                       <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] w-16">
                           <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                       </th>
                       <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Cohort Identity</th>
                       <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Population</th>
                       <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Duration</th>
                       <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">System Status</th>
                       <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Action Cluster</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                   {cohorts.map((cohort, i) => (
                       <tr key={cohort.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-10 py-8"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></td>
                           <td className="px-10 py-8 group">
                               <div className="flex items-center gap-6">
                                   <div className="w-16 h-16 rounded-2xl bg-indigo-50 border-2 border-indigo-100/50 flex flex-col items-center justify-center group-hover:bg-indigo-600 transition-all overflow-hidden relative">
                                       <Calendar className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors mb-1" />
                                       <span className="text-[9px] font-black text-indigo-500 group-hover:text-white/80 transition-colors uppercase tracking-widest">Q1</span>
                                   </div>
                                   <div>
                                       <p className="font-extrabold text-lg text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">{cohort.name}</p>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">ID: COH-{cohort.id}226</p>
                                   </div>
                               </div>
                           </td>
                           <td className="px-10 py-8">
                               <div className="flex items-center gap-3">
                                   <div className="flex -space-x-3">
                                       {[1,2,3].map(j => <div key={j} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />)}
                                   </div>
                                   <span className="text-sm font-black text-slate-600">12 Teams</span>
                               </div>
                           </td>
                           <td className="px-10 py-8">
                               <div className="space-y-1.5 min-w-[120px]">
                                   <p className="text-xs font-bold text-slate-700 leading-none">Mar 2026 - Jun 2026</p>
                                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                       <div className="w-1/3 h-full bg-indigo-500 rounded-full" />
                                   </div>
                               </div>
                           </td>
                           <td className="px-10 py-8">
                               <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${cohort.status === 'active' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                   <span className={`w-2 h-2 rounded-full mr-3 ${cohort.status === 'active' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                                   {cohort.status}
                               </span>
                           </td>
                           <td className="px-10 py-8 text-right">
                               <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0">
                                   <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><Edit className="w-4 h-4" /></button>
                                   <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm transition-all"><Trash2 className="w-4 h-4" /></button>
                                   <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 shadow-sm transition-all"><MoreVertical className="w-4 h-4" /></button>
                               </div>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
           
           {/* Pagination */}
           <div className="bg-slate-50 border-t border-slate-100 px-10 py-6 flex items-center justify-between">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Showing {cohorts.length} of 18 Deployments</p>
               <div className="flex items-center gap-3">
                   <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30" disabled><ChevronLeft className="w-4 h-4" /></button>
                   <div className="flex items-center gap-1">
                       <button className="w-10 h-10 bg-indigo-600 text-white rounded-xl text-xs font-black">1</button>
                       <button className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-xl text-xs font-black hover:bg-slate-50 transition-all">2</button>
                   </div>
                   <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400"><ChevronRightIcon className="w-4 h-4" /></button>
               </div>
           </div>
        </div>

        {/* Empty State visualizer */}
        <div className="ios-card bg-indigo-600/[0.02] border-indigo-100 border-dashed p-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-white flex-center shadow-xl shadow-indigo-100/50">
                <Layers className="w-10 h-10 text-indigo-200" />
            </div>
            <div className="space-y-2">
                <h4 className="text-lg font-black text-slate-900 uppercase">Archive Management</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] max-w-sm leading-relaxed">System is showing current deployments. Switch to archive mode to view historical program cycles.</p>
            </div>
            <button className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">Enable Archive Mode</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
