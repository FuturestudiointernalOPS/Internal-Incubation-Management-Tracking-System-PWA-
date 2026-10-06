"use client";

import { useMemo } from "react";

export function useFilteredData({
  contacts,
  availablePrograms,
  contactSearch,
  programSearch,
  composeRecipient,
}) {
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (!contactSearch) return true;
      const normalizedQuery = contactSearch.toLowerCase();
      return (
        (contact.name || "").toLowerCase().includes(normalizedQuery) ||
        (contact.email || "").toLowerCase().includes(normalizedQuery) ||
        (contact.role || "").toLowerCase().includes(normalizedQuery) ||
        (contact.group_name || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [contacts, contactSearch]);

  const filteredPrograms = useMemo(() => {
    return availablePrograms.filter((program) => {
      if (!programSearch) return true;
      return (program.name || "").toLowerCase().includes(programSearch.toLowerCase());
    });
  }, [availablePrograms, programSearch]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => (contact.cid || contact.id) === composeRecipient),
    [contacts, composeRecipient],
  );

  return {
    filteredContacts,
    filteredPrograms,
    selectedContact,
  };
}