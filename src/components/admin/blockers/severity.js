const SEVERITY_CONFIG = {
  low: {
    label: "Low",
    color: "text-[var(--text-secondary)]",
    bg: "bg-divider/20",
  },
  medium: { label: "Medium", color: "text-amber-500", bg: "bg-amber-500/10" },
  high: { label: "High", color: "text-rose-500", bg: "bg-rose-500/10" },
  critical: { label: "Critical", color: "text-red-600", bg: "bg-red-600/10" },
};

// Translation keys keyed by raw severity value (raw values stay for API/comparisons)
const SEVERITY_LABEL_KEYS = {
  low: "adminMisc.blockers.severityLow",
  medium: "adminMisc.blockers.severityMedium",
  high: "adminMisc.blockers.severityHigh",
  critical: "adminMisc.blockers.severityCritical",
};

export function formatSeverity(severity, t) {
  const config = SEVERITY_CONFIG[severity];
  return t(SEVERITY_LABEL_KEYS[severity] || "") || config?.label || severity;
}

export function getSeverityColor(severity) {
  const config = SEVERITY_CONFIG[severity];
  return config ? config.color : "text-[var(--text-secondary)]";
}

export function getSeverityBg(severity) {
  const config = SEVERITY_CONFIG[severity];
  return config ? config.bg : "bg-divider/20";
}
