import React from "react";

interface FiorixLogoIconProps {
  className?: string;
  size?: number | string;
}

export function FiorixLogoIcon({ className = "w-9 h-9", size }: FiorixLogoIconProps) {
  return (
    <img
      src="/icon-fiorix.png"
      alt="FIORIX Gestão & Qualidade"
      className={`object-contain select-none shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      draggable={false}
    />
  );
}
