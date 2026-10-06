'use client';

import {
  CheckCircle2,
  ChevronRight,
  Layers,
  MessageSquare,
  Target,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WeekActivitiesGrid({
  t,
  weekSessions,
  followups,
  selectedSession,
  setSelectedSession,
  newFollowup,
  setNewFollowup,
  weekNumber,
  isSubmitting,
  handleAddFollowup,
  weekDocs,
  weekSessionIds,
  weekPresentCount,
}) {
  return (
    <>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* ACTIVITIES */}
                    <div className="space-y-6">
                       <div className="flex items-center gap-3">
                          <Target className="w-3.5 h-3.5 text-slate-600" />
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.activities")}</p>
                       </div>
                       <div className="space-y-3">
                          {weekSessions.map((session, sessionIndex) => {
                             const sessionFollowups = followups.filter(followup => followup.session_id === session.id);
                             let materials = [];
                             try {
                               materials = session.resource_links ? JSON.parse(session.resource_links) : [];
                             } catch (error) {
                               console.error("Failed to parse resource links:", error);
                               materials = [];
                             }                                      
                             return (
                                <div key={`session-${session.id || sessionIndex}-${sessionIndex}`} className="space-y-2">
                                   <div 
                                      onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                                      className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#FF6600]/30 cursor-pointer transition-all"
                                   >
                                      <div className="flex items-center gap-4 text-left">
                                         <div className={`w-2 h-2 rounded-full ${session.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : session.status === 'in progress' ? 'bg-amber-500' : 'bg-slate-800'}`} />
                                         <div className="flex flex-col">
                                            <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{session.title}</p>
                                            <p className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest">{t("adminMisc.programDetail.assignmentStyle", { type: session.assignment_type || t("adminMisc.programDetail.workshop") })}</p>
                                         </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                         {sessionFollowups.length > 0 && <MessageSquare className="w-3 h-3 text-[#FF6600] animate-pulse" />}
                                         <ChevronRight className={`w-4 h-4 text-slate-700 transition-transform ${selectedSession === session.id ? 'rotate-90 text-[#FF6600]' : ''}`} />
                                      </div>
                                   </div>

                                   <AnimatePresence>
                                      {selectedSession === session.id && (
                                         <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                         >
                                            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 ml-4 mt-2 space-y-6 text-left">
                                               <div className="space-y-2">
                                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.activityGoal")}</p>
                                                  <p className="text-sm text-slate-300 leading-relaxed">{session.description || t("adminMisc.programDetail.noActivityGoal")}</p>
                                               </div>

                                               {materials.length > 0 && (
                                                  <div className="space-y-3">
                                                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.lessonMaterials")}</p>
                                                     <div className="flex flex-wrap gap-2">
                                                        {materials.map((material, materialIndex) => (
                                                           <a key={`material-${materialIndex}`} href={material.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-[10px] font-bold text-[#FF6600] uppercase tracking-widest hover:bg-[#FF6600] hover:text-black transition-all">
                                                              {material.title || t("adminMisc.programDetail.resourceLink")}
                                                           </a>
                                                        ))}
                                                     </div>
                                                  </div>
                                               )}

                                               {/* SESSION FEEDBACK */}
                                               <div className="pt-4 border-t border-white/5 space-y-4">
                                                  <div className="flex justify-between items-center">
                                                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.activityFeedback")}</p>
                                                     <button 
                                                        onClick={() => setNewFollowup({ week: weekNumber, session_id: session.id, comment: '' })}
                                                        className="text-[10px] font-bold text-[#FF6600] uppercase tracking-wide"
                                                     >
                                                        + {t("adminMisc.programDetail.leaveComment")}
                                                     </button>
                                                  </div>

                                                  <div className="space-y-2">
                                                     {sessionFollowups.map((followup, followupIndex) => (
                                                        <div key={`sf-${followup.id || followupIndex}-${followupIndex}`} className="p-3 rounded-xl bg-[#FF6600]/5 border border-[#FF6600]/10 flex gap-3">
                                                           <div className="w-6 h-6 rounded-lg bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shrink-0">
                                                              <Target className="w-3 h-3" />
                                                           </div>
                                                           <div className="flex-1 min-w-0">
                                                              <p className="text-[10px] text-white font-bold">{followup.comment}</p>
                                                           </div>
                                                        </div>
                                                     ))}
                                                  </div>

                                                  {newFollowup.session_id === session.id && (
                                                     <div className="space-y-3 mt-4">
                                                        <textarea 
                                                           value={newFollowup.comment}
                                                           onChange={event => setNewFollowup({...newFollowup, comment: event.target.value})}
                                                           placeholder={t("adminMisc.programDetail.feedbackPlaceholder")}
                                                           className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all resize-none"
                                                           rows={2}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                           <button onClick={() => setNewFollowup({ week: null, session_id: null, comment: '' })} className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t("adminMisc.programDetail.cancel")}</button>
                                                           <button 
                                                              disabled={isSubmitting || !newFollowup.comment.trim()}
                                                              onClick={() => handleAddFollowup(weekNumber, session.id)}
                                                              className="px-4 py-1.5 bg-[#FF6600] text-black text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-white transition-all"
                                                           >
                                                              {isSubmitting ? '...' : t("adminMisc.programDetail.post")}
                                                           </button>
                                                        </div>
                                                     </div>
                                                  )}
                                               </div>
                                            </div>
                                         </motion.div>
                                      )}
                                   </AnimatePresence>
                                </div>
                             );
                          })}
                          {weekSessions.length === 0 && <p className="text-[10px] font-medium text-slate-700 uppercase">{t("adminMisc.programDetail.noActivities")}</p>}
                       </div>
                    </div>

                    {/* ASSETS */}
                    <div className="space-y-6">
                       <div className="flex items-center gap-3">
                          <Layers className="w-3.5 h-3.5 text-slate-600" />
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.requiredTasks")}</p>
                       </div>
                       <div className="space-y-3">
                          {weekDocs.map((doc, docIndex) => (
                             <div key={`doc-${doc.id || docIndex}-${docIndex}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                <div className="flex items-center gap-4">
                                   <CheckCircle2 className={`w-4 h-4 ${doc.is_completed ? 'text-emerald-500' : 'text-slate-800'}`} />
                                   <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{doc.title}</p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${doc.is_completed ? 'text-emerald-500' : 'text-slate-600'}`}>{doc.is_completed ? t("adminMisc.programDetail.done") : t("adminMisc.programDetail.pending")}</span>
                             </div>
                          ))}
                          {/* Auto-added presence task for weeks with scheduled sessions */}
                          {weekSessionIds.length > 0 && (
                             <div key={`presence-${weekNumber}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                <div className="flex items-center gap-4">
                                   <CheckCircle2 className={`w-4 h-4 ${weekPresentCount > 0 ? 'text-emerald-500' : 'text-slate-800'}`} />
                                   <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{t("pmMisc.workspace.attendance")}</p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${weekPresentCount > 0 ? 'text-emerald-500' : 'text-slate-600'}`}>{weekPresentCount > 0 ? t("adminMisc.programDetail.done") : t("adminMisc.programDetail.pending")}</span>
                             </div>
                          )}
                          {weekDocs.length === 0 && weekSessionIds.length === 0 && <p className="text-[10px] font-medium text-slate-700 uppercase">{t("adminMisc.programDetail.noTasks")}</p>}
                       </div>
                    </div>
                 </div>
    </>
  );
}
