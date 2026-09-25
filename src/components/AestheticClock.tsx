import React, { useState, useEffect } from "react";
import { Clock, Calendar, Globe, Award } from "lucide-react";

interface AestheticClockProps {
  variant?: "card" | "compact" | "minimal";
  className?: string;
}

export default function AestheticClock({
  variant = "card",
  className = "",
}: AestheticClockProps) {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  const days = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jum'at",
    "Sabtu",
  ];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const dayName = days[time.getDay()];
  const dayDate = time.getDate();
  const monthName = months[time.getMonth()];
  const fullYear = time.getFullYear();

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 dark:bg-slate-950/90 border border-emerald-500/20 text-emerald-300 shadow-xs backdrop-blur-xs select-none ${className}`}
        id="navbar-live-clock"
      >
        <div className="flex items-center gap-1 text-[11px] font-mono font-bold tracking-wider">
          <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-white font-semibold">{hours}</span>
          <span className="text-emerald-400 animate-pulse font-bold">:</span>
          <span className="text-white font-semibold">{minutes}</span>
          <span className="text-emerald-400 animate-pulse font-bold">:</span>
          <span className="text-emerald-400 font-mono text-[10px]">{seconds}</span>
          <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 ml-0.5 font-sans">
            WIB
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-1 text-[10px] text-slate-300 pl-2 border-l border-slate-700/60 font-sans">
          <Calendar className="w-3 h-3 text-emerald-400/70" />
          <span>{`${dayName}, ${dayDate} ${monthName}`}</span>
        </div>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={`font-mono text-xs text-emerald-400 flex items-center gap-1.5 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span className="font-bold tracking-widest">{hours}:{minutes}:{seconds}</span>
        <span className="text-[10px] text-slate-400">WIB</span>
      </div>
    );
  }

  // Card Variant (Futuristic high-tech aesthetic dashboard widget)
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/90 p-5 text-white border border-emerald-500/30 shadow-lg shadow-emerald-950/30 ${className}`}
      id="aesthetic-clock-card"
    >
      {/* Background Cyber Grid / Ambient Glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
      <div className="absolute bottom-0 left-0 w-28 h-28 bg-teal-500/10 rounded-full blur-xl pointer-events-none -ml-8 -mb-8"></div>
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
        {/* Header with live badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400/90 font-mono">
              Waktu Real-Time
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>LIVE (UTC+7)</span>
          </div>
        </div>

        {/* Big Futuristic Digital Time Display */}
        <div className="flex items-baseline gap-1 my-1">
          <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_12px_rgba(16,185,129,0.35)] flex items-center">
            <span>{hours}</span>
            <span className="text-emerald-400 animate-pulse mx-0.5">:</span>
            <span>{minutes}</span>
            <span className="text-emerald-400 animate-pulse mx-0.5">:</span>
            <span className="text-emerald-300 text-2xl sm:text-3xl">{seconds}</span>
          </div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono ml-1.5">
            WIB
          </span>
        </div>

        {/* Date and Calendar Footer */}
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{`${dayName}, ${dayDate} ${monthName} ${fullYear}`}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-blue-400 font-mono">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>STS 2026/2027</span>
          </div>
        </div>
      </div>
    </div>
  );
}
