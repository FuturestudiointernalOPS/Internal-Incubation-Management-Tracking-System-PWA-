"use client";

export default function AppCard({
  children,
  className = "",
  padding = "md",
  hover = false,
  border = true,
  onClick,
}) {
  const padMap = { sm: "p-4", md: "p-6", lg: "p-8", xl: "p-10" };
  return (
    <div
      onClick={onClick}
      className={`
        rounded-[14px]
        ${border ? "border" : "border-0"}
        ${padMap[padding] || padMap.md}
        ${hover ? "hover:bg-[var(--surface-2)] cursor-pointer transition-all" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border-primary)",
      }}
    >
      {children}
    </div>
  );
}
