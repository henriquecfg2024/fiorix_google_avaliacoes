import React from "react";

interface FiorixLogoProps {
  variant?: "full" | "icon" | "combined";
  className?: string;
  size?: number | string;
  height?: number | string;
  width?: number | string;
}

export function FiorixLogo({
  variant = "full",
  className = "",
  size,
  height,
  width,
}: FiorixLogoProps) {
  if (variant === "icon") {
    return (
      <img
        src="/icon-fiorix.png"
        alt="FIORIX Gestão de Qualidade"
        className={`object-contain select-none shrink-0 ${className || "w-9 h-9"}`}
        style={size ? { width: size, height: size } : undefined}
        draggable={false}
      />
    );
  }

  if (variant === "full") {
    return (
      <img
        src="/logo-fiorix.png"
        alt="FIORIX Gestão de Qualidade"
        className={`object-contain select-none shrink-0 ${className || "h-9 w-auto"}`}
        style={{
          height: height || (size ? size : undefined),
          width: width || undefined,
        }}
        draggable={false}
      />
    );
  }

  // variant === "combined" (Icon + typography)
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src="/icon-fiorix.png"
        alt="FIORIX"
        className="w-9 h-9 shrink-0 object-contain"
        draggable={false}
      />
      <div className="flex flex-col text-left justify-center min-w-0">
        <span
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontWeight: 800,
            letterSpacing: "0.05em",
            lineHeight: 1.1,
            fontSize: "17px",
          }}
          className="text-white uppercase tracking-wider whitespace-nowrap"
        >
          FIORIX
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontWeight: 500,
            fontSize: "11px",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            marginTop: "2px",
          }}
        >
          <span style={{ color: "#E2E8F0" }}>Gestão </span>
          <span style={{ color: "#00C975" }}>de Qualidade</span>
        </span>
      </div>
    </div>
  );
}
