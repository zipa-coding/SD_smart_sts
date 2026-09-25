import React from "react";
import logoUrl from "../assets/images/smp_logo_exact_match_revised_1783840969621.jpg";

interface SmpIslamSmartLogoProps {
  className?: string;
  size?: number | string;
}

export default function SmpIslamSmartLogo({ className = "", size = "100%" }: SmpIslamSmartLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="SMP Islam Smart Logo"
      className={`select-none object-cover rounded-full w-full h-full ${className}`}
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
      id="smp-islam-smart-logo"
    />
  );
}

