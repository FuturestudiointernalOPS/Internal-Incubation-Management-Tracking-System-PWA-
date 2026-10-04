import {
  Activity,
  Database,
  HardDrive,
  Layers,
  FileText,
  Terminal,
  Zap,
} from "lucide-react";

export function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export const STATUS_COLORS = {
  healthy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  degraded: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  unhealthy: "text-red-400 bg-red-500/10 border-red-500/20",
};

export const COMPONENT_ICONS = {
  app: Activity, database: Database, cache: Zap, queue: Layers,
  email: FileText, storage: HardDrive, search: Terminal,
  notifications: Activity, integrations: Activity,
};

export const COMPONENT_KEYS = {
  app: "adminMisc.system.componentApp",
  database: "adminMisc.system.componentDatabase",
  cache: "adminMisc.system.componentCache",
  queue: "adminMisc.system.componentQueue",
  email: "adminMisc.system.componentEmail",
  storage: "adminMisc.system.componentStorage",
  search: "adminMisc.system.componentSearch",
  notifications: "adminMisc.system.componentNotifications",
  integrations: "adminMisc.system.componentIntegrations",
};

export const STATUS_KEYS = {
  healthy: "adminMisc.system.statusHealthy",
  degraded: "adminMisc.system.statusDegraded",
  unhealthy: "adminMisc.system.statusUnhealthy",
};

export const ENV_KEYS = {
  development: "adminMisc.system.envDevelopment",
  production: "adminMisc.system.envProduction",
  staging: "adminMisc.system.envStaging",
};

export const REPORT_TYPE_KEYS = {
  daily: "adminMisc.system.reportTypeDaily",
  weekly: "adminMisc.system.reportTypeWeekly",
  monthly: "adminMisc.system.reportTypeMonthly",
};
