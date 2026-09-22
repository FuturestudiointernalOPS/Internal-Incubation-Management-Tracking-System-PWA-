"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Info } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import { useI18n } from "@/lib/i18n";

/**
 * ════════════════════════════════════════════════════════════════
 * IN-APP DIALOGS — confirm / prompt / alert
 * ════════════════════════════════════════════════════════════════
 *
 * Replaces the browser's own pop-ups (`window.confirm`, `window.prompt`,
 * `window.alert`): those ignore the theme, freeze the tab while they are open
 * and cannot be styled or read as part of the product.
 *
 * Mounted once, by src/app/layout.js. Any client component asks for one:
 *
 *   const { confirm, prompt, alert } = useDialogs();
 *
 *   if (!(await confirm({ message: t("…"), tone: "danger" }))) return;
 *   const name = await prompt({ message: t("…"), defaultValue: current });
 *   await alert({ message: t("…") });
 *
 * `confirm` resolves to a boolean, `prompt` to the entered text (or null when
 * dismissed) and `alert` to undefined once acknowledged. Nothing resolves until
 * the person answers. A request raised while a dialog is already open is QUEUED
 * and shown when the current one closes, so a burst of requests can never stack
 * two modals on top of each other.
 *
 * Options — every one optional except `message`:
 *   message       the question, already translated
 *   title         heading; a translated default is used when omitted
 *   hint          a quieter second line — also taken from a "\n" inside `message`
 *   tone          "primary" (default) or "danger" — tints the icon and the accept button
 *   confirmLabel  accept button label
 *   cancelLabel   dismiss button label
 *   defaultValue  prompt only — the text the field starts with
 *   placeholder   prompt only
 *   inputLabel    prompt only
 *   inputType     prompt only — "text" (default) or "password"
 *   required      prompt only — refuse an empty answer (default true)
 *   validate      prompt only — (value) => translated error message, or null
 */

const CANCEL_VALUE = { confirm: false, prompt: null, alert: undefined };

/**
 * A bare render without the provider — a unit test of a single component, say —
 * REFUSES the action instead of falling back to a browser pop-up, so that no
 * code path can bring the native dialogs back.
 */
function refuseWhenUnmounted(kind) {
  return () => {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `<DialogProvider> is not mounted: ${kind}() was auto-refused. ` +
          "Wrap the tree in <DialogProvider> to get the in-app dialog.",
      );
    }
    return Promise.resolve(CANCEL_VALUE[kind]);
  };
}

const DialogContext = createContext({
  confirm: refuseWhenUnmounted("confirm"),
  prompt: refuseWhenUnmounted("prompt"),
  alert: refuseWhenUnmounted("alert"),
});

/** A confirm question and its optional hint are written as one "line\nhint" string. */
function splitMessage(message) {
  if (typeof message !== "string") return { question: "", hint: "" };
  const breakIndex = message.indexOf("\n");
  if (breakIndex === -1) return { question: message, hint: "" };
  return {
    question: message.slice(0, breakIndex),
    hint: message.slice(breakIndex + 1).replace(/\s*\n\s*/g, " "),
  };
}

export function DialogProvider({ children }) {
  const { t } = useI18n();
  const [request, setRequest] = useState(null);
  const [entry, setEntry] = useState("");
  const [entryError, setEntryError] = useState("");
  // The visible request and the ones waiting behind it. `active` mirrors
  // `request` so that a click handler can tell a queued request from the
  // displayed one without reading stale state.
  const activeRef = useRef(null);
  const queueRef = useRef([]);

  const open = useCallback((next) => {
    if (activeRef.current) {
      queueRef.current.push(next);
      return;
    }
    activeRef.current = next;
    setEntry(next.defaultValue == null ? "" : String(next.defaultValue));
    setEntryError("");
    setRequest(next);
  }, []);

  const settle = useCallback(
    (value) => {
      const current = activeRef.current;
      if (!current) return;
      activeRef.current = null;
      setRequest(null);
      setEntryError("");
      current.resolve(value);

      const next = queueRef.current.shift();
      // On the next tick, so the closing dialog animates out on its own.
      if (next) setTimeout(() => open(next), 0);
    },
    [open],
  );

  const ask = useCallback(
    (kind, options) =>
      new Promise((resolve) => {
        const config =
          typeof options === "string" ? { message: options } : options || {};
        open({ kind, resolve, ...config });
      }),
    [open],
  );

  const confirm = useCallback((options) => ask("confirm", options), [ask]);
  const prompt = useCallback((options) => ask("prompt", options), [ask]);
  const alert = useCallback((options) => ask("alert", options), [ask]);

  const value = useMemo(
    () => ({ confirm, prompt, alert }),
    [confirm, prompt, alert],
  );

  const kind = request?.kind;
  const danger = request?.tone === "danger";
  const { question, hint: inlineHint } = splitMessage(request?.message);
  const hint = request?.hint ?? inlineHint;

  const title =
    request?.title ||
    t(
      kind === "prompt"
        ? "common.dialog.promptTitle"
        : kind === "alert"
          ? "common.dialog.noticeTitle"
          : "common.dialog.confirmTitle",
    );

  const dismiss = () => settle(CANCEL_VALUE[kind]);

  const accept = () => {
    if (request?.required !== false && !entry.trim()) {
      setEntryError(t("common.dialog.required"));
      return;
    }
    const invalid = request?.validate?.(entry);
    if (invalid) {
      setEntryError(invalid);
      return;
    }
    settle(entry);
  };

  const Icon = danger ? AlertTriangle : Info;

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AppModal
        isOpen={Boolean(request)}
        onClose={dismiss}
        title={title}
        size="sm"
      >
        {request && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${
                  danger
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                  {question}
                </p>
                {hint && (
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {hint}
                  </p>
                )}
              </div>
            </div>

            {kind === "prompt" && (
              <AppInput
                label={request.inputLabel}
                type={request.inputType || "text"}
                value={entry}
                placeholder={request.placeholder}
                error={entryError}
                autoFocus
                onChange={(e) => {
                  setEntry(e.target.value);
                  if (entryError) setEntryError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    accept();
                  }
                }}
              />
            )}

            <div className="flex justify-end gap-2">
              {kind !== "alert" && (
                <AppButton variant="secondary" size="sm" onClick={dismiss}>
                  {request.cancelLabel || t("common.cancel")}
                </AppButton>
              )}
              <AppButton
                variant={danger ? "danger" : "primary"}
                size="sm"
                onClick={
                  kind === "prompt"
                    ? accept
                    : () => settle(kind === "alert" ? undefined : true)
                }
              >
                {request.confirmLabel ||
                  (kind === "alert" ? t("common.close") : t("common.confirm"))}
              </AppButton>
            </div>
          </div>
        )}
      </AppModal>
    </DialogContext.Provider>
  );
}

/**
 * The three dialog helpers. Use inside any client component under
 * <DialogProvider> (mounted in src/app/layout.js).
 */
export const useDialogs = () => useContext(DialogContext);
