import { supabase } from "@/lib/supabase";

/**
 * V2 GATING ENGINE
 * Logic for locking/unlocking lifecycle nodes based on review approvals.
 */
export const v2Gating = {
  /**
   * Check if a specific week is unlocked for a group or participant.
   * Logic: Week N is unlocked if all deliverables for Week N-1 are APPROVED.
   */
  async isWeekUnlocked(programId, weekNumber, groupId = null, participantId = null) {
    if (weekNumber <= 1) return true; // Week 1 always unlocked

    // Fetch all deliverables for the PREVIOUS week
    const { data: deliverables } = await supabase
      .from('v2_deliverables')
      .select('id')
      .eq('program_id', programId)
      .eq('week_number', weekNumber - 1);

    if (!deliverables || deliverables.length === 0) return true; // No deliverables, no gate

    // Fetch submissions for those deliverables
    let query = supabase
      .from('v2_submissions')
      .select('id, deliverable_id, status')
      .in('deliverable_id', deliverables.map(d => d.id))
      .eq('status', 'approved');

    if (groupId) query = query.eq('group_id', groupId);
    else if (participantId) query = query.eq('participant_id', participantId);

    const { data: approvedSubmissions } = await query;

    // Must have same number of approved submissions as deliverables
    return approvedSubmissions?.length === deliverables.length;
  },

  /**
   * Calculate progression metrics for a group or participant.
   */
  async getProgressionMetrics(programId, groupId = null, participantId = null) {
     // Fetch total deliverables
     const { data: totalDel } = await supabase
        .from('v2_deliverables')
        .select('id')
        .eq('program_id', programId);
     
     if (!totalDel || totalDel.length === 0) return { percentComplete: 0, currentWeek: 1 };

     // Fetch approved submissions
     let query = supabase
        .from('v2_submissions')
        .select('id, v2_deliverables(week_number)')
        .eq('program_id', programId)
        .eq('status', 'approved');
     
     if (groupId) query = query.eq('group_id', groupId);
     else if (participantId) query = query.eq('participant_id', participantId);

     const { data: approved } = await query;

     const percent = Math.floor((approved?.length || 0) / totalDel.length * 100);
     
     // Current week is the highest approved week + 1
     const maxWeek = approved?.reduce((max, s) => Math.max(max, s.v2_deliverables.week_number), 0) || 0;

     return {
        percentComplete: percent,
        currentWeek: maxWeek + 1,
        approvedCount: approved?.length || 0,
        totalCount: totalDel.length
     };
  }
};
