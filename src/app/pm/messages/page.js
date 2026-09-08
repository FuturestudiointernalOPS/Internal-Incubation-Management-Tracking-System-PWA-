"use client";

import React, { useState, useEffect } from "react";
import MessagingChat from "@/components/messaging/MessagingChat";

export default function PmMessages() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  return (
    <>
      <MessagingChat role="program_manager" />
    </>
  );
}
