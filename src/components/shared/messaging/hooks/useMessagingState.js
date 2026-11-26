"use client";

import { useState, useRef } from "react";

export function useMessagingState() {
  // Chat state
  const [activeConversation, setActiveConversation] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState("");
  const [replyAttachmentName, setReplyAttachmentName] = useState("");
  const [replyShowAttachment, setReplyShowAttachment] = useState(false);
  const [replyUploading, setReplyUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [sendMode, setSendMode] = useState("individual");
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeGroupId, setComposeGroupId] = useState("");
  const [composeProgram, setComposeProgram] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAttachmentUrl, setComposeAttachmentUrl] = useState("");
  const [composeAttachmentName, setComposeAttachmentName] = useState("");
  const [composeShowAttachment, setComposeShowAttachment] = useState(false);
  const [composeUploading, setComposeUploading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);

  // Mobile responsive
  const [mobileView, setMobileView] = useState("list");

  // Refs
  const chatEndRef = useRef(null);
  const replyInputRef = useRef(null);

  return {
    activeConversation,
    setActiveConversation,
    replyText,
    setReplyText,
    replyAttachmentUrl,
    setReplyAttachmentUrl,
    replyAttachmentName,
    setReplyAttachmentName,
    replyShowAttachment,
    setReplyShowAttachment,
    replyUploading,
    setReplyUploading,
    sending,
    setSending,
    search,
    setSearch,
    showCompose,
    setShowCompose,
    sendMode,
    setSendMode,
    composeRecipient,
    setComposeRecipient,
    composeGroupId,
    setComposeGroupId,
    composeProgram,
    setComposeProgram,
    composeBody,
    setComposeBody,
    composeAttachmentUrl,
    setComposeAttachmentUrl,
    composeAttachmentName,
    setComposeAttachmentName,
    composeShowAttachment,
    setComposeShowAttachment,
    composeUploading,
    setComposeUploading,
    contactSearch,
    setContactSearch,
    programSearch,
    setProgramSearch,
    showContactDropdown,
    setShowContactDropdown,
    showProgramDropdown,
    setShowProgramDropdown,
    mobileView,
    setMobileView,
    chatEndRef,
    replyInputRef,
  };
}