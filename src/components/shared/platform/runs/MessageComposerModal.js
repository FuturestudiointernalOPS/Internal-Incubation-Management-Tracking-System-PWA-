import { X, Sparkles } from "lucide-react";
import { useState } from "react";

export default function MessageComposerModal({
  messageResult, renderMessageResult, messageSubject, setMessageSubject,
  messageBody, setMessageBody, aiPersonalizing, onPersonalize,
  messageSending, onSend, selectedCount, onClose, t,
}) {
  const [showCc, setShowCc] = useState(false);
  const [ccAddresses, setCcAddresses] = useState("");

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-secondary border border-[var(--border-primary)] shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)] shrink-0">
          <div>
            <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.messageSend")}</h3>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">{t("platformMisc.runs.messageRecipients", { count: selectedCount })}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messageResult ? (
            renderMessageResult(messageResult)
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.messageSubject")}</label>
                <input value={messageSubject} onChange={(event) => setMessageSubject(event.target.value)} placeholder="Enter subject..." className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCc}
                    onChange={(event) => setShowCc(event.target.checked)}
                    className="accent-[var(--brand-orange)]"
                  />
                  {t("platformMisc.runs.messageCc")}
                </label>
                {showCc && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("platformMisc.runs.messageCcAddresses")}
                    </label>
                    <input
                      type="text"
                      inputMode="email"
                      value={ccAddresses}
                      onChange={(event) => setCcAddresses(event.target.value)}
                      placeholder={t("platformMisc.runs.messageCcPlaceholder")}
                      className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                    />
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {t("platformMisc.runs.messageCcHint")}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.messageBody")}</label>
                <textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={6} placeholder="Enter message..." className="w-full px-3 py-2.5 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-y" />
              </div>
              <button
                onClick={onPersonalize}
                disabled={aiPersonalizing}
                className="px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-purple-500/20 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> {aiPersonalizing ? t("platformMisc.runs.messagePersonalizing") : t("platformMisc.runs.messageAiPersonalize")}
              </button>
            </>
          )}
        </div>

        {!messageResult && (
          <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-primary)] bg-secondary shrink-0">
            <button onClick={onClose} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button>
            <button onClick={() => onSend(showCc ? ccAddresses : "")} disabled={messageSending || selectedCount === 0} className="flex-1 btn btn-primary">{messageSending ? t("platformMisc.runs.messageSending") : t("platformMisc.runs.messageSendTo", { count: selectedCount })}</button>
          </div>
        )}
      </div>
    </div>
  );
}
