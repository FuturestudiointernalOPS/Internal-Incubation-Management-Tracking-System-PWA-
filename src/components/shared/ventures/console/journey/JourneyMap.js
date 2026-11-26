"use client";

import { Check, Route } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { stageStatusWord, statusLabel } from "@/lib/ventureStatuses";

/**
 * THE JOURNEY MAP — the roadmap as a picture.
 *
 * Read-only, and computed from the SAME payload the stage cards below already
 * hold: it asks the server for nothing new and keeps no second source of truth.
 * A stage's figure is its own milestones, so a number here can never disagree
 * with the card underneath it.
 *
 * The founder's payload already carries `milestone_counts`; the manager's
 * carries the milestones themselves. Both shapes are accepted, which is why the
 * same map can sit on all three journey screens.
 */
const completedMilestones = (stage) => {
  if (stage.milestone_counts) return stage.milestone_counts;
  const milestones = (stage.milestones || []).filter((milestone) => milestone.is_archived !== true);
  return {
    total: milestones.length,
    completed: milestones.filter((milestone) => String(milestone.status || "").toLowerCase() === "completed").length,
  };
};

export default function JourneyMap({ stages = [] }) {
  const { t } = useI18n();

  const active = stages.filter((stage) => stage.is_archived !== true);
  if (active.length === 0) return null;

  const steps = active.map((stage, index) => {
    const counts = completedMilestones(stage);
    const total = Number(counts.total) || 0;
    const done = Number(counts.completed) || 0;
    const word = stageStatusWord(stage.status);
    const rawStatus = String(stage.status || "").toLowerCase();
    return {
      id: stage.id,
      order: index + 1,
      name: stage.name,
      word,
      done,
      total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      // The STORED words are upcoming | active | completed; the shared vocabulary
      // gives `active` the id `in_progress`, so the raw status is what decides.
      isDone: rawStatus === "completed" || (total > 0 && done === total),
      isActive: rawStatus === "active",
    };
  });

  const totalMilestones = steps.reduce((sum, step) => sum + step.total, 0);
  const doneMilestones = steps.reduce((sum, step) => sum + step.done, 0);
  const overall = totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : 0;

  return (
    <section className="jy-map" aria-label={t("venture.journeyMap.title")}>
      <div className="jy-map-head">
        <h3>
          <Route size={15} /> {t("venture.journeyMap.title")}
        </h3>
        <p className="jy-map-total">
          {totalMilestones > 0
            ? t("venture.journeyMap.overall", { percent: overall })
            : t("venture.journeyMap.noMilestones")}
        </p>
      </div>

      <ol className="jy-map-track">
        {steps.map((step, index) => {
          const previous = index > 0 ? steps[index - 1] : null;
          return (
            <li key={step.id} className="jy-map-step">
              {previous && (
                <span
                  className={`jy-map-line ${previous.isDone ? "is-done" : previous.isActive ? "is-active" : ""}`}
                  aria-hidden="true"
                />
              )}
              <span className={`jy-map-node ${step.isDone ? "is-done" : step.isActive ? "is-active" : ""}`}>
                {step.isDone ? <Check size={15} /> : step.order}
              </span>
              <p className="jy-map-name" title={step.name}>
                {step.name}
              </p>
              <span className="jy-map-bar" aria-hidden="true">
                <i style={{ width: `${step.percent}%` }} />
              </span>
              <p className="jy-map-meta">
                {step.total > 0
                  ? t("venture.journeyMap.milestones", {
                      done: step.done,
                      total: step.total,
                      percent: step.percent,
                    })
                  : t("venture.journeyMap.noMilestones")}
              </p>
              <p className="jy-map-status">{statusLabel(step.word, t)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
