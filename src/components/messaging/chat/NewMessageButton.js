"use client";

import { Send } from "lucide-react";

export default function NewMessageButton({
  setShowCompose,
  setContactSearch,
  setComposeRecipient,
  setComposeBody,
  setComposeAttachmentUrl,
  setComposeAttachmentName,
  setComposeShowAttachment,
  setSendMode,
  sendModes,
  t,
}) {
  return (
<button
          onClick={() => {
            setShowCompose(true);
            setContactSearch("");
            setComposeRecipient("");
            setComposeBody("");
            setComposeAttachmentUrl("");
            setComposeAttachmentName("");
            setComposeShowAttachment(false);
            setSendMode(
              sendModes.includes("individual")
                ? "individual"
                : sendModes[0] || "individual",
            );
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
        >
          <Send className="w-3.5 h-3.5" /> {t("messaging.new")}
        </button>
  );
}
