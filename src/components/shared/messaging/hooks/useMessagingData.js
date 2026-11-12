"use client";

import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useSyncExternalStore } from "react";

const pickMessages = (payload) => (payload?.success ? payload.messages || [] : []);
const pickContacts = (payload) => (payload?.success ? payload.contacts || [] : []);
const pickFamilies = (payload) => (payload?.success ? payload.families || [] : []);
const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);

const EMPTY_USER = {};

function subscribeVisibility(onChange) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function readVisibility() {
  return document.visibilityState === "visible";
}

function readVisibilityOnServer() {
  return true;
}

export function useMessagingData({ uid, role, user }) {
  const { user: sessionUser } = useSessionUser();
  const effectiveUser = sessionUser || EMPTY_USER;

  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    readVisibility,
    readVisibilityOnServer,
  );

  const {
    data: messages,
    loading: messagesLoading,
    refresh: refreshMessages,
  } = useApi(uid ? `/api/internal-comms?cid=${uid}` : null, {
    defaultValue: [],
    transform: pickMessages,
    deps: [uid],
    refetchInterval: pageVisible ? 3000 : 0,
  });

  const { data: allContacts } = useApi(uid ? "/api/contacts" : null, {
    defaultValue: [],
    transform: pickContacts,
    deps: [uid],
  });

  const { data: families } = useApi(uid ? "/api/families" : null, {
    defaultValue: [],
    transform: pickFamilies,
    deps: [uid],
  });

  const { data: allPrograms } = useApi(uid ? "/api/programs" : null, {
    defaultValue: [],
    transform: pickPrograms,
    deps: [uid],
  });

  const loading = !uid || messagesLoading;

  return {
    messages,
    loading,
    refreshMessages,
    allContacts,
    families,
    allPrograms,
    effectiveUser,
  };
}