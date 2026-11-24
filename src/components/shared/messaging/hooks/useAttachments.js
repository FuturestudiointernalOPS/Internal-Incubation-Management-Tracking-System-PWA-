"use client";

import { useCallback } from "react";

export function useAttachments({ t }) {
  const notifyError = useCallback((message) => {
    window.dispatchEvent(
      new CustomEvent("impactos:notify", {
        detail: { type: "error", message },
      }),
    );
  }, []);

  const uploadAttachment = useCallback(async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.url) return { url: data.url };
    return { error: data.error || t("messaging.uploadFailed", { error: "" }) };
  }, [t]);

  const handleReplyFile = useCallback(async (event, {
    setReplyUploading,
    setReplyAttachmentUrl,
    setReplyAttachmentName,
    setReplyShowAttachment,
  }) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReplyUploading(true);
    try {
      const result = await uploadAttachment(file);
      if (result.url) {
        setReplyAttachmentUrl(result.url);
        setReplyAttachmentName(file.name);
        setReplyShowAttachment(true);
      } else {
        notifyError(result.error || t("messaging.uploadFailed", { error: "" }));
      }
    } catch (error) {
      console.error(error);
      notifyError(t("messaging.uploadFailed", { error: "" }));
    } finally {
      setReplyUploading(false);
      if (event.target) event.target.value = "";
    }
  }, [uploadAttachment, notifyError, t]);

  const handleComposeFile = useCallback(async (event, {
    setComposeUploading,
    setComposeAttachmentUrl,
    setComposeAttachmentName,
    setComposeShowAttachment,
  }) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setComposeUploading(true);
    try {
      const result = await uploadAttachment(file);
      if (result.url) {
        setComposeAttachmentUrl(result.url);
        setComposeAttachmentName(file.name);
        setComposeShowAttachment(true);
      } else {
        notifyError(result.error || t("messaging.uploadFailed", { error: "" }));
      }
    } catch (error) {
      console.error(error);
      notifyError(t("messaging.uploadFailed", { error: "" }));
    } finally {
      setComposeUploading(false);
      if (event.target) event.target.value = "";
    }
  }, [uploadAttachment, notifyError, t]);

  return {
    uploadAttachment,
    handleReplyFile,
    handleComposeFile,
  };
}