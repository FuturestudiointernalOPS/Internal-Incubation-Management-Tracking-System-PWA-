/**
 * Plan import — Turning a reviewed draft into journey rows (one transaction).
 *
 * Part of `services/ventures/planImport` (split out of the former single
 * 1 178-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/planImport.js`.
 */
// Edges are added through the ONE dependency writer in the platform, so an
// imported plan gets the same cycle refusal (including transitive) that a
// hand-made edge gets.
import { addDependency } from "@/services/ventures/timeline";
import { recordVentureChange } from "@/models/ventureChangeLog";
import {
  applyPlanImportDraft,
  insertDeliverable,
  insertJourneyStage,
  insertMilestone,
  insertTask,
  runInTransaction,
  selectMaxStageOrder,
} from "@/models/venturePlanImportStore";
import { newUuid, toText } from "./proposal";

/**
 * APPLY — turn an approved draft into real journey rows (Phase 3).
 *
 * This is the only place a proposal becomes work. It runs in ONE transaction
 * for the structure, so a half-built programme can never be left behind; the
 * dependency edges are added afterwards because their own guard (cycle
 * detection) reads the table as it goes, and a refused edge is REPORTED rather
 * than silently dropped.
 *
 * Only an OPEN draft can be applied: the update that marks it applied is
 * guarded on `status = 'proposed'`, so two people pressing Apply cannot build
 * the programme twice.
 */
export async function applyPlanImport({ dbId, importId, proposal, actorCid = null }) {
  const counts = { journeys: 0, milestones: 0, tasks: 0, deliverables: 0, dependencies: 0 };
  const warnings = [];
  const taskIdByRef = new Map();

  // EXTERNAL ASSIGNMENTS ARE NAMES. A tracker naming Amina records that the work
  // is Amina's — nothing more. No person row is created, no account, no email
  // invented, nothing that could later be mistaken for a platform member. The
  // assignment carries her NAME; if a human later resolves it to a real ImpactOS
  // person, the name stays and the contact id is filled in beside it.
  // Collected while the structure is built, written to the change log only once
  // the draft has actually closed — so the log never claims an apply that did not
  // commit.
  const createdJourneys = [];
  const createdMilestones = [];

  await runInTransaction(async (query) => {
    // Stage order is UNIQUE per Venture, so an import onto a Venture that already
    // has a journey CONTINUES the numbering rather than colliding with it. That
    // is also the shape the product wants: a later assessment proposes the next
    // chapter, it does not replace the previous one.
    const existing = await selectMaxStageOrder(query, dbId);
    const startingOrder = Number(existing.rows?.[0]?.max_order || 0);
    const ventureAlreadyHasAJourney = startingOrder > 0;

    // The first journey of a FIRST import starts active (a programme has to begin
    // somewhere); any other journey waits for its own start date, which the
    // engine promotes when that date arrives. So a journey with no start date
    // stays Upcoming until someone gives it one — never silently opened.
    let stageOrder = startingOrder;
    let stageIndex = 0;
    for (const journey of proposal.journeys || []) {
      stageOrder += 1;
      stageIndex += 1;
      const stageId = newUuid();
      const stageStatus = !ventureAlreadyHasAJourney && stageIndex === 1 ? "active" : "upcoming";
      await insertJourneyStage(query, {
        id: stageId,
        ventureId: dbId,
        name: journey.name,
        description: journey.description || null,
        objective: journey.objective || null,
        targetDate: journey.target_date || null,
        stageOrder,
        status: stageStatus,
        startDate: journey.start_date || null,
        importId: String(importId),
      });
      counts.journeys += 1;
      createdJourneys.push({ id: stageId, label: journey.name });

      let milestoneOrder = 0;
      for (const milestone of journey.milestones || []) {
        milestoneOrder += 1;
        const milestoneId = newUuid();
        await insertMilestone(query, {
          id: milestoneId,
          ventureId: dbId,
          title: milestone.name,
          description: milestone.description || null,
          objective: milestone.objective || null,
          status: stageStatus === "active" ? "not_started" : "upcoming",
          priority: milestone.priority || "medium",
          displayOrder: milestoneOrder,
          journeyStageId: stageId,
          startDate: milestone.start_date || null,
          targetDate: milestone.target_date || null,
          createdBy: actorCid,
        });
        counts.milestones += 1;
        createdMilestones.push({ id: milestoneId, label: milestone.name, journey: journey.name });

        let taskOrder = 0;
        for (const task of milestone.tasks || []) {
          taskOrder += 1;
          // The tracker's extra context travels as REAL fields, never folded
          // text: Phase stays a label, Support keeps its own (display-only)
          // name — nobody is assigned work by it — and the Definition of Done
          // keeps its own column instead of being swallowed by the description.
          const labels = [];
          if (toText(task.phase)) labels.push(toText(task.phase));

          const inserted = await insertTask(query, {
            ventureId: String(dbId),
            milestoneId,
            title: task.title,
            description: toText(task.description) || null,
            priority: task.priority || "medium",
            startDate: task.start_date || null,
            dueDate: task.due_date || null,
            assignedCid: task.owner_cid || null,
            assignedName: task.owner_name || null,
            definitionOfDone: toText(task.definition_of_done) || null,
            supportName: toText(task.support) || null,
            sourceRef: toText(task.ref) || null,
            displayOrder: taskOrder,
            labels,
          });
          counts.tasks += 1;
          const newTaskId = inserted.rows?.[0]?.id;
          if (task.ref && newTaskId !== undefined && newTaskId !== null) taskIdByRef.set(task.ref, newTaskId);

          for (const deliverable of task.deliverables || []) {
            // The link that makes "Activity → Deliverable" a relationship: the
            // deliverable points at the task that produces it.
            await insertDeliverable(query, {
              milestoneId,
              ventureId: String(dbId),
              title: deliverable.title,
              dueDate: task.due_date || null,
              assignedCid: task.owner_cid || null,
              assignedName: task.owner_name || null,
              taskId: newTaskId ?? null,
              createdBy: actorCid || "system",
            });
            counts.deliverables += 1;
          }
        }
      }
    }
  });

  // Edges come second: each one is cycle-checked against the rows already there,
  // so a loop in the tracker is refused with a reason instead of poisoning the
  // roadmap. One refused edge must not lose the rest.
  for (const journey of proposal.journeys || []) {
    for (const milestone of journey.milestones || []) {
      for (const task of milestone.tasks || []) {
        const target = taskIdByRef.get(task.ref);
        if (target === undefined) continue;
        for (const reference of task.depends_on || []) {
          const source = taskIdByRef.get(reference);
          if (source === undefined) continue;
          try {
            await addDependency({
              ventureId: dbId,
              sourceType: "task",
              sourceId: source,
              targetType: "task",
              targetId: target,
            });
            counts.dependencies += 1;
          } catch (error) {
            warnings.push(`Dependency ${reference} → ${task.ref || task.title} was skipped: ${error.message}`);
          }
        }
      }
    }
  }

  // Closing the draft is the LAST step and the guarded one: if the draft was
  // already applied (or discarded) this changes nothing and we say so.
  const closed = await applyPlanImportDraft({ actorCid, counts, importId, dbId });
  if (!closed.rows?.[0]?.id) {
    return { error: "This proposal was already applied or discarded.", counts };
  }

  // The record of what this import brought in. Written AFTER the draft closed,
  // so the log and the status can never disagree.
  for (const journey of createdJourneys) {
    await recordVentureChange({
      dbId,
      entityType: "journey",
      entityId: journey.id,
      entityLabel: journey.label,
      action: "created",
      actorCid,
      metadata: { source: "plan_import", import_id: String(importId) },
    });
  }
  for (const milestone of createdMilestones) {
    await recordVentureChange({
      dbId,
      entityType: "milestone",
      entityId: milestone.id,
      entityLabel: milestone.label,
      action: "created",
      actorCid,
      metadata: { source: "plan_import", import_id: String(importId), journey: milestone.journey },
    });
  }
  await recordVentureChange({
    dbId,
    entityType: "import",
    entityId: String(importId),
    entityLabel: createdJourneys[0]?.label || null,
    action: "applied",
    actorCid,
    metadata: counts,
  });

  return { counts, warnings };
}
