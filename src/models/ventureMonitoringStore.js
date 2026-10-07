/**
 * Venture system monitoring, health & reporting — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/monitoring`: the health checks and
 * their history, the metrics, the system alerts, the jobs, the queues, the
 * storage / database / API probes and the generated reports.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Health checks ────────────────────────────────────────────────────────────

/** A trivial database ping. */
export function pingDatabase() {
  return db.execute({ sql: "SELECT 1 as ping" });
}

/** Count the queue-statistics rows. */
export function countQueueStatistics() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM queue_statistics" });
}

/** Count the Ventures (health probe). */
export function countVenturesForHealth() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM ventures" });
}

/** Count the venture notifications (health probe). */
export function countNotificationsForHealth() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_notifications" });
}

/** Record one health-check result. */
export function insertHealthCheck(component, status, responseTimeMs, message, detailsJson) {
  return db.execute({
    sql: `INSERT INTO system_health_checks (component, status, response_time_ms, message, details) VALUES (?, ?, ?, ?, ?::jsonb)`,
    args: [component, status, responseTimeMs, message, detailsJson],
  });
}

/** The latest health-check row of a component. */
export function selectLatestHealthCheck(component) {
  return db.execute({
    sql: "SELECT * FROM system_health_checks WHERE component=? ORDER BY checked_at DESC LIMIT 1",
    args: [component],
  });
}

/** The health-check history (optional component filter), newest first. */
export function selectHealthCheckHistory(component, limit) {
  let sql = "SELECT * FROM system_health_checks";
  const args = [];
  if (component) { sql += " WHERE component=?"; args.push(component); }
  sql += " ORDER BY checked_at DESC LIMIT ?"; args.push(limit);
  return db.execute({ sql, args });
}

// ── Metrics ──────────────────────────────────────────────────────────────────

/** Metrics for a name within a window, newest first. */
export function selectMetrics(metricName, hoursAgo, limit) {
  let sql = "SELECT * FROM system_metrics WHERE metric_name=?";
  const args = [metricName];
  if (hoursAgo) { sql += " AND recorded_at > NOW() - INTERVAL '1 hour' * ?"; args.push(hoursAgo); }
  sql += " ORDER BY recorded_at DESC LIMIT ?"; args.push(limit);
  return db.execute({ sql, args });
}

/** Aggregated recent metrics per name (dashboard). */
export function selectRecentMetrics(hoursAgo) {
  return db.execute({
    sql: `SELECT metric_name, AVG(metric_value) as avg_value, COUNT(*) as count, MAX(metric_value) as max_value, MIN(metric_value) as min_value, unit
          FROM system_metrics WHERE recorded_at > NOW() - INTERVAL '1 hour' * ?
          GROUP BY metric_name, unit ORDER BY metric_name`,
    args: [hoursAgo],
  });
}

// ── Alerts ───────────────────────────────────────────────────────────────────

/** The open system alerts, newest first. */
export function selectOpenAlerts() {
  return db.execute({ sql: "SELECT * FROM system_alerts WHERE status='open' ORDER BY created_at DESC LIMIT 20" });
}

/** Count the open system alerts. */
export function countOpenAlerts() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM system_alerts WHERE status='open'" });
}

/** Count the critical unresolved alerts. */
export function countCriticalAlerts() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM system_alerts WHERE severity='critical' AND status!='resolved'" });
}

/** Unresolved alerts grouped by type + severity. */
export function selectAlertsByType() {
  return db.execute({ sql: "SELECT alert_type, severity, COUNT(*) as c FROM system_alerts WHERE status!='resolved' GROUP BY alert_type, severity ORDER BY c DESC" });
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

/** Job-history rows (optional filters), newest first. */
export function selectJobs({ status, jobType, limit, offset } = {}) {
  let sql = "SELECT * FROM job_history WHERE 1=1";
  const args = [];
  if (status) { sql += " AND status=?"; args.push(status); }
  if (jobType) { sql += " AND job_type=?"; args.push(jobType); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

/** Count the running jobs. */
export function countJobsRunning() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='running'" });
}

/** Count the queued jobs. */
export function countJobsQueued() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='queued'" });
}

/** Count the failed jobs. */
export function countJobsFailed() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='failed'" });
}

/** Count the jobs completed in the last 24 hours. */
export function countJobsCompleted24h() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM job_history WHERE status='completed' AND created_at > NOW() - INTERVAL '24 hours'" });
}

/** One job-history row. */
export function selectJobById(jobId) {
  return db.execute({ sql: "SELECT * FROM job_history WHERE id=?", args: [jobId] });
}

/** Re-queue a failed job. */
export function retryJobRow(jobId) {
  return db.execute({
    sql: "UPDATE job_history SET status='queued', retry_count=retry_count+1, error_message=NULL WHERE id=?",
    args: [jobId],
  });
}

// ── Queues ───────────────────────────────────────────────────────────────────

/** Queue-statistics rows (optional queue filter), newest first. */
export function selectQueueStats({ queueName, limit, offset } = {}) {
  let sql = "SELECT * FROM queue_statistics WHERE 1=1";
  const args = [];
  if (queueName) { sql += " AND queue_name=?"; args.push(queueName); }
  sql += " ORDER BY recorded_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

/** The latest queue-statistics row per queue. */
export function selectLatestQueueStats() {
  return db.execute({
    sql: `SELECT qs.* FROM queue_statistics qs
          INNER JOIN (SELECT queue_name, MAX(recorded_at) as max_ts FROM queue_statistics GROUP BY queue_name) latest
          ON qs.queue_name = latest.queue_name AND qs.recorded_at = latest.max_ts`,
  });
}

// ── Storage / database ───────────────────────────────────────────────────────

/** The current database size in bytes. */
export function selectDatabaseSize() {
  return db.execute({ sql: "SELECT pg_database_size(current_database()) as size" });
}

/** Count the contacts (storage probe). */
export function countContactsForStorage() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM contacts" });
}

/** Count the verification documents (storage probe). */
export function countVerificationDocumentsForStorage() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_verification_documents" });
}

/** Count the active database connections. */
export function countActiveDbConnections() {
  return db.execute({ sql: "SELECT COUNT(*) as active FROM pg_stat_activity WHERE state='active'" });
}

/** The top user tables by approximate row count. */
export function selectTableStats() {
  return db.execute({
    sql: `SELECT schemaname, tablename, n_live_tup as approx_rows, pg_total_relation_size(schemaname||'.'||tablename) as total_bytes
          FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20`,
  });
}

// ── API monitoring ───────────────────────────────────────────────────────────

/** Count the API requests in the window. */
export function countApiRequests(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Count the API errors (5xx) in the window. */
export function countApiErrors(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM api_usage_logs WHERE response_status >= 500 AND created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** The slow API endpoints in the window. */
export function selectSlowEndpoints(hoursAgo) {
  return db.execute({
    sql: `SELECT endpoint, COUNT(*) as calls, AVG(duration_ms) as avg_ms, MAX(duration_ms) as max_ms
          FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ?
          GROUP BY endpoint HAVING AVG(duration_ms) > 1000 ORDER BY avg_ms DESC LIMIT 10`,
    args: [hoursAgo],
  });
}

/** The busiest API endpoints in the window. */
export function selectTopEndpoints(hoursAgo) {
  return db.execute({
    sql: `SELECT endpoint, COUNT(*) as calls, AVG(duration_ms) as avg_ms
          FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ?
          GROUP BY endpoint ORDER BY calls DESC LIMIT 10`,
    args: [hoursAgo],
  });
}

// ── Reports ──────────────────────────────────────────────────────────────────

/** Insert one system report, returning its id. */
export function insertSystemReport(reportType, title, periodStart, periodEnd, summary, dataJson) {
  return db.execute({
    sql: `INSERT INTO system_reports (report_type, title, period_start, period_end, summary, data, generated_by) VALUES (?, ?, ?, ?, ?, ?::jsonb, 'system') RETURNING id`,
    args: [reportType, title, periodStart, periodEnd, summary, dataJson],
  });
}

/** System-report rows (optional type filter), newest first. */
export function selectSystemReports({ reportType, limit, offset } = {}) {
  let sql = "SELECT * FROM system_reports WHERE 1=1";
  const args = [];
  if (reportType) { sql += " AND report_type=?"; args.push(reportType); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}
