import React, { useState, useMemo } from "react";
import { SubjectProgress } from "../types";
import { TrendingUp, CheckCircle2, Clock, AlertCircle, ArrowUpRight } from "lucide-react";

interface SplineWaveChartProps {
  data: SubjectProgress[];
  overallAverage: number;
}

export default function SplineWaveChart({ data, overallAverage }: SplineWaveChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "highest" | "lowest">("default");

  // Sorted or original data list
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const list = [...data];
    if (sortBy === "highest") {
      return list.sort((a, b) => b.percent - a.percent);
    }
    if (sortBy === "lowest") {
      return list.sort((a, b) => a.percent - b.percent);
    }
    return list;
  }, [data, sortBy]);

  // Dimensions for SVG Coordinate Space
  const svgWidth = 840;
  const svgHeight = 260;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 30;
  const paddingBottom = 40;

  const innerWidth = svgWidth - paddingLeft - paddingRight;
  const innerHeight = svgHeight - paddingTop - paddingBottom;
  const baselineY = svgHeight - paddingBottom;

  // Calculate coordinates for points
  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    return chartData.map((item, index) => {
      const x = chartData.length === 1 
        ? paddingLeft + innerWidth / 2 
        : paddingLeft + (index / (chartData.length - 1)) * innerWidth;
      const y = paddingTop + (1 - Math.max(0, Math.min(100, item.percent)) / 100) * innerHeight;
      return { x, y, item, index };
    });
  }, [chartData, innerWidth, innerHeight, paddingLeft, paddingTop]);

  // Generate Smooth Cubic Bezier Spline Path (Catmull-Rom formulation)
  const { splinePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { splinePath: "", areaPath: "" };
    if (points.length === 1) {
      const p = points[0];
      return {
        splinePath: `M ${p.x - 20},${p.y} L ${p.x + 20},${p.y}`,
        areaPath: `M ${p.x - 20},${p.y} L ${p.x + 20},${p.y} L ${p.x + 20},${baselineY} L ${p.x - 20},${baselineY} Z`
      };
    }

    let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      const tension = 5.5; // Smooth curvature factor
      const cp1x = p1.x + (p2.x - p0.x) / tension;
      const cp1y = p1.y + (p2.y - p0.y) / tension;

      const cp2x = p2.x - (p3.x - p1.x) / tension;
      const cp2y = p2.y - (p3.y - p1.y) / tension;

      d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }

    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const area = `${d} L ${lastPoint.x.toFixed(2)},${baselineY} L ${firstPoint.x.toFixed(2)},${baselineY} Z`;

    return { splinePath: d, areaPath: area };
  }, [points, baselineY]);

  // Average Line Y Coordinate
  const avgY = paddingTop + (1 - Math.max(0, Math.min(100, overallAverage)) / 100) * innerHeight;

  const activePoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  return (
    <div className="space-y-4" id="spline-wave-chart-container">
      {/* Chart Control Toolbar & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
            <span className="w-3 h-1 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"></span>
            Gelombang Progres
          </span>
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-amber-400"></span>
            Rata-rata ({overallAverage}%)
          </span>
        </div>

        {/* Sort Filter Toggle */}
        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
          <button
            onClick={() => setSortBy("default")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
              sortBy === "default"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Urutan Mapel
          </button>
          <button
            onClick={() => setSortBy("highest")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
              sortBy === "highest"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Tertinggi
          </button>
          <button
            onClick={() => setSortBy("lowest")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
              sortBy === "lowest"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Terendah
          </button>
        </div>
      </div>

      {/* Main Wave SVG Graphic Canvas */}
      <div className="relative p-3 sm:p-4 rounded-2xl bg-slate-900/95 dark:bg-[#0d1527] border border-emerald-500/25 shadow-xl overflow-hidden group">
        {/* Soft Background Ambient Grid Glows */}
        <div className="absolute top-0 right-1/4 w-80 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-80 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          style={{ minHeight: "210px" }}
        >
          <defs>
            {/* Wave Area Fill Gradient */}
            <linearGradient id="waveAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="45%" stopColor="#0d9488" stopOpacity="0.2" />
              <stop offset="85%" stopColor="#0284c7" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            {/* Wave Stroke Line Gradient */}
            <linearGradient id="waveStrokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="35%" stopColor="#2dd4bf" />
              <stop offset="70%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>

            {/* Glow Filter for the wave line */}
            <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Active Point Halo Filter */}
            <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal Grid Guide Lines (0%, 25%, 50%, 75%, 100%) */}
          {[0, 25, 50, 75, 100].map((level) => {
            const y = paddingTop + (1 - level / 100) * innerHeight;
            return (
              <g key={level} className="text-slate-500 dark:text-slate-600">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray={level === 0 ? "none" : "3,4"}
                  opacity={level === 0 ? 0.35 : 0.15}
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fill="currentColor"
                  opacity={0.7}
                >
                  {level}%
                </text>
              </g>
            );
          })}

          {/* Average Line (Dashed Orange/Amber) */}
          {overallAverage > 0 && (
            <g className="transition-all duration-300">
              <line
                x1={paddingLeft}
                y1={avgY}
                x2={svgWidth - paddingRight}
                y2={avgY}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                opacity={0.75}
              />
              <rect
                x={svgWidth - paddingRight - 68}
                y={avgY - 9}
                width="64"
                height="16"
                rx="4"
                fill="#78350f"
                opacity={0.9}
              />
              <text
                x={svgWidth - paddingRight - 36}
                y={avgY + 2.5}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#fef3c7"
              >
                Avg {overallAverage}%
              </text>
            </g>
          )}

          {/* Glowing Area Fill Under Wave */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#waveAreaGradient)"
              className="transition-all duration-500"
            />
          )}

          {/* Main Smooth Waving Line */}
          {splinePath && (
            <path
              d={splinePath}
              fill="none"
              stroke="url(#waveStrokeGradient)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#waveGlow)"
              className="transition-all duration-500"
            />
          )}

          {/* Active Hover Vertical Crosshair */}
          {activePoint && (
            <g className="transition-all duration-150 pointer-events-none">
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={baselineY}
                stroke="#2dd4bf"
                strokeWidth="1.5"
                strokeDasharray="2,2"
                opacity={0.8}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="9"
                fill="#2dd4bf"
                fillOpacity="0.25"
                filter="url(#pointGlow)"
              />
            </g>
          )}

          {/* Interactive Data Point Nodes along the wave */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const isComplete = pt.item.percent === 100;
            const isStarted = pt.item.percent > 0;

            const pointFill = isComplete 
              ? "#10b981" 
              : isStarted 
              ? "#06b6d4" 
              : "#64748b";

            const pointStroke = isComplete
              ? "#a7f3d0"
              : isStarted
              ? "#67e8f9"
              : "#cbd5e1";

            // Subject label abbreviation
            const label = pt.item.subject.length > 5 
              ? pt.item.subject.substring(0, 4) + "."
              : pt.item.subject;

            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
              >
                {/* Invisible large hit area for touch/hover */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="16"
                  fill="transparent"
                />

                {/* Pulsing halo if 100% complete */}
                {isComplete && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? "11" : "7"}
                    fill="#10b981"
                    fillOpacity="0.25"
                    className="transition-all duration-300"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "6.5" : "4.5"}
                  fill={pointFill}
                  stroke={pointStroke}
                  strokeWidth={isHovered ? "2.5" : "1.8"}
                  className="transition-all duration-200"
                />

                {/* X-Axis Subject Label */}
                <text
                  x={pt.x}
                  y={baselineY + 16}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight={isHovered ? "bold" : "500"}
                  fill={isHovered ? "#38bdf8" : "#94a3b8"}
                  className="transition-colors duration-150 select-none"
                >
                  {label}
                </text>

                {/* Percentage on top of node if hovered or key points */}
                <text
                  x={pt.x}
                  y={pt.y - (isHovered ? 12 : 9)}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill={isComplete ? "#34d399" : isHovered ? "#38bdf8" : "#94a3b8"}
                  opacity={isHovered || isComplete ? 1 : 0.75}
                  className="transition-all duration-150 select-none"
                >
                  {pt.item.percent}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Detailed Hover Info Card */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none transition-all duration-150 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-xl p-3 shadow-2xl text-white min-w-[200px]"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: activePoint.y < 90 ? "45%" : "12%",
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5 mb-1.5">
              <span className="font-bold text-xs text-emerald-300">
                {activePoint.item.subject}
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  activePoint.item.percent === 100
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                    : activePoint.item.percent > 0
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-700"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {activePoint.item.percent}%
              </span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span>Pengampu:</span>
                <span className="font-medium text-white truncate max-w-[120px]">
                  {activePoint.item.teacherName || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Data Siswa:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {activePoint.item.completed} / {activePoint.item.total} Siswa
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Status:</span>
                <span className="font-semibold text-[10px]">
                  {activePoint.item.percent === 100 ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Tuntas 100%
                    </span>
                  ) : activePoint.item.percent > 0 ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Dalam Proses
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Belum Dimulai
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
