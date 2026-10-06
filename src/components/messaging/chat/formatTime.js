"use client";

export function formatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  if (isToday) return `${hour}:${minute}`;
  return `${date.getDate()}/${date.getMonth() + 1}`;
}
