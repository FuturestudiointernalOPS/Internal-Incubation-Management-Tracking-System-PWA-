/**
 * The blank shapes the PM program workspace's forms start from.
 *
 * These are the default values handed to `useState` on the screen's first render.
 * The screen still owns every piece of state; only the shapes live here, and each
 * is the literal the screen declared inline before the split.
 */

export const INITIAL_WORKSPACE_FORMS = {
  newTeam: {
    name: "",
    group_name: "",
    handler_name: "",
    member_ids: [],
    leader_id: "",
    staff_id: "",
  },
  newKPI: { title: "" },
  pmReportAttachments: {
    type: "",
    url: "",
  },
  newSession: {
    title: "",
    week_number: 1,
    status: "pending",
    kpi_ids: [],
    handler_ids: [],
    handler_names: [],
    scheduled_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    notes: "",
    extra_materials: [],
    requirements: [],
  },
  newSessionMaterial: {
    type: "text",
    content: "",
    name: "",
  },
  newRequirement: {
    title: "",
    description: "",
    allowed_format: "pdf",
    kpi_ids: [],
    due_date: "",
    assignee_type: "all",
    assignee_id: "",
    resource_url: "",
    resource_label: "",
  },
  newPMReport: {
    summary: "",
    status: "optimal",
    // New structured fields
    week_status: "",
    week_rating: "",
    main_topic: "",
    // KPI-linked assignment tracking
    assignment_given: false,
    assignment_kpi_ids: [],
    assignment_objective: "",
    assignment_outcome: "",
    attendance_level: "",
    participation_level: "",
    participants_need_attention: false,
    participants_attention_notes: "",
    standout_participants: false,
    standout_notes: "",
    delivery_quality: "",
    participant_understanding: "",
    delivery_challenges: false,
    delivery_challenge_note: "",
    had_issues: false,
    issue_types: [],
    requires_admin_attention: false,
    additional_issue_note: "",
    program_on_track: true,
    planned_adjustments: "",
  },
  newStaff: { staff_id: "", role: "staff" },
};
