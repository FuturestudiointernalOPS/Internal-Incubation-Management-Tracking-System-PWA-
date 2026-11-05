"use client";

import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import { notify } from "@/lib/notify";

/**
 * The Venture's review queue and the one decision it supports.
 *
 * Both surfaces that show a decision queue — the Venture Manager's cockpit and
 * the Super Admin's venture dashboard — read and write through this hook, so the
 * two can never drift: same endpoint, same server-side scope filter, same
 * confirmation, same refresh after a decision.
 *
 * It holds no rule of its own: the server decides which submissions this person
 * may see and decide.
 */
const EMPTY_QUEUE = [];
const pickQueue = (payload) => (payload?.success ? payload.items || EMPTY_QUEUE : EMPTY_QUEUE);

export function useReviewQueue(ventureId) {
  const { t } = useI18n();
  const { prompt } = useDialogs();
  const { data: items, loading, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/submissions/review-queue` : null,
    { defaultValue: EMPTY_QUEUE, transform: pickQueue, deps: [ventureId] },
  );

  const decide = useCallback(
    async (item, decision) => {
      const comment =
        decision === "changes_requested"
          ? (await prompt({ message: t("staff.ventureReview.commentPrompt"), required: false })) || ""
          : "";
      try {
        const response = await fetch(
          `/api/ventures/${ventureId}/tasks/${item.task_id}/submissions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "review",
              submission_id: item.submission_id,
              decision,
              comment: comment || null,
            }),
          },
        );
        const data = await response.json();
        if (data.success) await refresh();
        else notify("error", data.error || t("staff.ventureReview.reviewFailed"));
      } catch (_) {
        notify("error", t("staff.ventureReview.reviewFailed"));
      }
    },
    [ventureId, refresh, prompt, t],
  );

  return { items: items || EMPTY_QUEUE, loading, reload: refresh, decide };
}
