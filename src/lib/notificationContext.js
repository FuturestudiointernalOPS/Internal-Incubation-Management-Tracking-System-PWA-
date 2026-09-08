/**
 * Notification drill-down grouping (Vinance 3 — Phase 1).
 *
 * Pure function that turns raw inbox rows (v2_notifications with entity
 * context columns) into the §4 breadcrumb tree:
 *
 *   venture → journey stage → milestone → tasks/sessions
 *
 * Rows without a venture context fall into `general`. Rows with partial
 * context (e.g. a session without a stage) attach at the deepest known
 * level. Counts at every node include the row itself.
 */

function findOrCreate(list, keyField, id, seed) {
  let node = list.find((n) => String(n[keyField]) === String(id));
  if (!node) {
    node = { ...seed, [keyField]: id, count: 0 };
    list.push(node);
  }
  return node;
}

/**
 * @param {Array<object>} rows v2_notifications rows (entity_* fields nullable)
 * @returns {{ unread_total: number, general: number, ventures: Array }}
 */
export function groupNotificationContext(rows = []) {
  const result = { unread_total: rows.length, general: 0, ventures: [] };

  for (const row of rows) {
    const ventureId = row.entity_venture_id;
    if (!ventureId) {
      result.general += 1;
      continue;
    }

    const venture = findOrCreate(result.ventures, "venture_id", ventureId, {
      journeys: [],
      tasks: [],
      sessions: [],
    });
    venture.count += 1;

    const stageId = row.entity_journey_stage_id;
    if (stageId) {
      const journey = findOrCreate(venture.journeys, "journey_stage_id", stageId, {
        milestones: [],
        tasks: [],
        sessions: [],
      });
      journey.count += 1;

      const milestoneId = row.entity_milestone_id;
      if (milestoneId) {
        const milestone = findOrCreate(journey.milestones, "milestone_id", milestoneId, {
          tasks: [],
          sessions: [],
        });
        milestone.count += 1;

        if (row.entity_task_id) {
          const task = findOrCreate(milestone.tasks, "task_id", row.entity_task_id, {});
          task.count += 1;
        } else if (row.entity_session_id) {
          const session = findOrCreate(milestone.sessions, "session_id", row.entity_session_id, {});
          session.count += 1;
        }
      } else if (row.entity_task_id) {
        const task = findOrCreate(journey.tasks, "task_id", row.entity_task_id, {});
        task.count += 1;
      } else if (row.entity_session_id) {
        const session = findOrCreate(journey.sessions, "session_id", row.entity_session_id, {});
        session.count += 1;
      }
    } else if (row.entity_task_id) {
      const task = findOrCreate(venture.tasks, "task_id", row.entity_task_id, {});
      task.count += 1;
    } else if (row.entity_session_id) {
      const session = findOrCreate(venture.sessions, "session_id", row.entity_session_id, {});
      session.count += 1;
    }
  }

  return result;
}

export default { groupNotificationContext };
