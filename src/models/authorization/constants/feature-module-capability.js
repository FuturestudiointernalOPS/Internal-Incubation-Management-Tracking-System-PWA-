/**
 * ImpactOS — Authorization Foundation: FEATURE → MODULE → CAPABILITIES
 *
 * For every FEATURE, the capability MODULES that belong to it (via
 * MODULE_TO_FEATURE) and — for each module — the capabilities, in the same
 * shape CAPABILITY_CATALOG uses: cap → { label, risk, description }.
 *
 * Feature-first: features follow FEATURE_ORDER; a feature's modules follow
 * MODULE_TO_FEATURE.
 */

export const FEATURE_MODULE_CAPABILITY = {
  crm: {
    contacts: {
      view: {
        label: "View",
        risk: "low",
        description: "See people and contact records"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Add new contacts"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Modify contact records"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Remove contacts (soft delete)"
      }
    },
    duplicates: {
      view: {
        label: "View",
        risk: "low",
        description: "See duplicate contact flags"
      },
      resolve: {
        label: "Resolve",
        risk: "high",
        description: "Resolve duplicate contact pairs"
      }
    },
    bulk_upload: {
      execute: {
        label: "Execute",
        risk: "high",
        description: "Run bulk contact/people imports"
      }
    },
    crm: {
      view: {
        label: "View",
        risk: "low",
        description: "Access CRM workspace, people directory, organizations, and timeline"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Create CRM organizations and contact-organization relationships"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Modify CRM organizations and relationships"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Remove CRM organizations and relationships (soft delete)"
      },
      assign: {
        label: "Assign",
        risk: "medium",
        description: "Assign ownership of CRM records"
      },
      manage: {
        label: "Manage",
        risk: "high",
        description: "Administer CRM configuration, module capabilities, and pipeline (Phase 2+)"
      }
    },
    org_membership: {
      view: {
        label: "View",
        risk: "medium",
        description: "See organizational membership"
      },
      manage: {
        label: "Manage",
        risk: "critical",
        description: "Manage protected-group membership (e.g. FUTURE STUDIO)"
      }
    }
  },
  communication: {
    messaging: {
      view: {
        label: "View",
        risk: "low",
        description: "Read conversations"
      },
      send: {
        label: "Send",
        risk: "medium",
        description: "Send messages"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete messages (retention rule: never used)"
      }
    },
    internal_comms: {
      view: {
        label: "View",
        risk: "low",
        description: "See internal communication"
      },
      create_announcements: {
        label: "Create Announcements",
        risk: "medium",
        description: "Post announcements"
      },
      moderate: {
        label: "Moderate",
        risk: "high",
        description: "Edit/delete announcements"
      }
    },
    forms: {
      view: {
        label: "View",
        risk: "low",
        description: "See forms"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Create forms"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Edit forms and publish versions"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Archive or permanently delete forms"
      }
    },
    runs: {
      view: {
        label: "View",
        risk: "low",
        description: "See runs, assignments and submissions"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Create, launch and change the status of runs"
      },
      edit: {
        label: "Edit",
        risk: "high",
        description: "Assign people and send run emails"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete runs and submissions"
      },
      review: {
        label: "Review",
        risk: "high",
        description: "Approve or reject an applicant (decides admission and sends the decision email)"
      }
    }
  },
  programs: {
    programs: {
      view: {
        label: "View",
        risk: "low",
        description: "See programs"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Create new programs"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Edit program content and teams"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete programs"
      },
      publish: {
        label: "Publish",
        risk: "medium",
        parent: "edit",
        description: "Publish program content"
      }
    },
    facilitator: {
      "participants.view": {
        label: "View Participants",
        risk: "medium",
        description: "See program participants"
      },
      "attendance.view": {
        label: "View Attendance",
        risk: "low",
        description: "See attendance"
      },
      "attendance.record": {
        label: "Record Attendance",
        risk: "medium",
        description: "Record attendance"
      },
      "assignments.view": {
        label: "View Assignments",
        risk: "low",
        description: "See assignments"
      },
      "assignments.grade": {
        label: "Grade Assignments",
        risk: "high",
        description: "Grade submissions"
      },
      "sessions.conduct": {
        label: "Conduct Sessions",
        risk: "medium",
        description: "Run sessions"
      },
      "reviews.submit": {
        label: "Submit Reviews",
        risk: "medium",
        description: "Submit reviews"
      }
    }
  },
  ventures: {
    ventures: {
      view: {
        label: "View",
        risk: "low",
        description: "See ventures"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Register ventures"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Edit ventures"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete ventures"
      }
    }
  },
  investors: {
    investor: {
      view: {
        label: "View",
        risk: "low",
        description: "See investor data"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Create investor records"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Edit investor records"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete investor records"
      }
    }
  },
  finance: {
    finance: {
      view: {
        label: "View",
        risk: "medium",
        description: "See financial data"
      },
      create: {
        label: "Create",
        risk: "high",
        description: "Create transactions"
      },
      edit: {
        label: "Edit",
        risk: "high",
        description: "Edit financial records"
      },
      delete: {
        label: "Delete",
        risk: "critical",
        description: "Delete financial records"
      },
      export: {
        label: "Export",
        risk: "high",
        description: "Export financial data"
      }
    }
  },
  operations: {
    projects: {
      view: {
        label: "View",
        risk: "low",
        description: "See projects"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Create projects"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Edit projects"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete projects"
      },
      archive: {
        label: "Archive",
        risk: "medium",
        parent: "edit",
        description: "Archive projects"
      }
    },
    tasks: {
      view: {
        label: "View",
        risk: "low",
        description: "See tasks"
      },
      create: {
        label: "Create",
        risk: "low",
        description: "Create tasks"
      },
      edit: {
        label: "Edit",
        risk: "low",
        description: "Edit tasks"
      },
      delete: {
        label: "Delete",
        risk: "medium",
        description: "Delete tasks"
      }
    }
  },
  reports: {
    reports: {
      view: {
        label: "View",
        risk: "low",
        description: "See reports"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Submit standups, retros and op-reports"
      },
      export: {
        label: "Export",
        risk: "medium",
        description: "Export report data"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete reports"
      }
    }
  },
  knowledge: {
    knowledge: {
      view: {
        label: "View",
        risk: "low",
        description: "Read knowledge base"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Add knowledge articles"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Edit knowledge articles"
      },
      delete: {
        label: "Delete",
        risk: "medium",
        description: "Delete knowledge articles"
      }
    }
  },
  lms: {
    lms: {
      view: {
        label: "View",
        risk: "low",
        description: "See courses and learning materials"
      },
      create: {
        label: "Create",
        risk: "medium",
        description: "Create courses"
      },
      edit: {
        label: "Edit",
        risk: "medium",
        description: "Edit courses and sections"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete courses"
      }
    }
  },
  security: {
    users: {
      view: {
        label: "View",
        risk: "medium",
        description: "See user accounts"
      },
      create: {
        label: "Create",
        risk: "high",
        description: "Create user accounts"
      },
      edit: {
        label: "Edit",
        risk: "high",
        description: "Edit user accounts"
      },
      suspend: {
        label: "Suspend",
        risk: "high",
        description: "Suspend accounts"
      },
      delete: {
        label: "Delete",
        risk: "high",
        description: "Delete accounts"
      },
      assign_roles: {
        label: "Assign Roles",
        risk: "high",
        description: "Change user roles"
      }
    },
    permissions: {
      view_matrix: {
        label: "View Matrix",
        risk: "medium",
        description: "See permission matrices"
      },
      grant: {
        label: "Grant",
        risk: "high",
        description: "Grant individual access"
      },
      revoke: {
        label: "Revoke",
        risk: "high",
        description: "Revoke individual access"
      },
      assign_capabilities: {
        label: "Assign Capabilities",
        risk: "high",
        description: "Assign capabilities to roles/groups"
      },
      assign_groups: {
        label: "Assign Groups",
        risk: "high",
        description: "Manage group membership"
      },
      assign_responsibilities: {
        label: "Assign Responsibilities",
        risk: "high",
        description: "Manage responsibilities"
      },
      promote_super_admin: {
        label: "Promote Super Admin",
        risk: "critical",
        description: "Grant Super Admin"
      },
      remove_super_admin: {
        label: "Remove Super Admin",
        risk: "critical",
        description: "Remove Super Admin"
      },
      configure_eligibility: {
        label: "Configure Eligibility",
        risk: "critical",
        description: "Define who may receive features"
      }
    }
  },
  settings: {
    settings: {
      view: {
        label: "View",
        risk: "medium",
        description: "See system settings"
      },
      edit: {
        label: "Edit",
        risk: "high",
        description: "Modify system settings"
      }
    },
    engineering: {
      view: {
        label: "View",
        risk: "low",
        description: "See engineering dashboards"
      },
      manage_tasks: {
        label: "Manage Tasks",
        risk: "medium",
        description: "Manage engineering tasks"
      },
      manage_errors: {
        label: "Manage Errors",
        risk: "medium",
        description: "Manage error logs"
      }
    }
  }
};
