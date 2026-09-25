import React, { useEffect, useState, useMemo } from "react";
import { SchoolSummary } from "../types";
import AestheticClock from "./AestheticClock";
import SplineWaveChart from "./SplineWaveChart";
import {
  RefreshCw,
  BookMarked,
  Users,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Search,
  Layers,
  GraduationCap,
  PieChart,
  ShieldCheck,
  Zap,
  Filter,
  Award,
  Trophy,
  Medal,
  ChevronDown,
  ChevronUp,
  Star,
  SlidersHorizontal,
  Eye,
  BookOpen
} from "lucide-react";

interface DashboardProgressProps {
  onRefreshTrigger?: number;
}

export default function DashboardProgress({
  onRefreshTrigger,
}: DashboardProgressProps) {
  const [summary, setSummary] = useState<SchoolSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Subject filtering and search
  const [categoryFilter, setCategoryFilter] = useState<"all" | "nasional" | "islamic" | "muatan">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Student Rankings State
  const [rankingClassFilter, setRankingClassFilter] = useState<string>("all");
  const [rankingSearch, setRankingSearch] = useState<string>("");
  const [rankingSortOrder, setRankingSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/summary");
      if (!response.ok) throw new Error("Gagal memuat ringkasan data.");
      const data = await response.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungkan ke server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [onRefreshTrigger]);

  // Subject categorization helper
  const categorizedSubjects = useMemo(() => {
    if (!summary?.subjectProgress) return [];

    const islamicSubjects = ["PAI", "Bahasa Arab", "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"];
    const muatanSubjects = ["Prakarya", "Informatika"];

    return summary.subjectProgress.map(sub => {
      let category: "nasional" | "islamic" | "muatan" = "nasional";
      if (islamicSubjects.includes(sub.subject)) {
        category = "islamic";
      } else if (muatanSubjects.includes(sub.subject)) {
        category = "muatan";
      }
      return {
        ...sub,
        category
      };
    });
  }, [summary]);

  const filteredSubjects = useMemo(() => {
    return categorizedSubjects.filter(sub => {
      const matchesCategory = categoryFilter === "all" || sub.category === categoryFilter;
      const matchesSearch = sub.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            sub.teacherName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [categorizedSubjects, categoryFilter, searchQuery]);

  // Filtered and Sorted Student Rankings
  const filteredRankings = useMemo(() => {
    if (!summary?.studentRankings) return [];
    let list = [...summary.studentRankings];

    if (rankingClassFilter !== "all") {
      list = list.filter((s) => String(s.kelas).trim() === rankingClassFilter);
    }

    if (rankingSearch.trim()) {
      const q = rankingSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          String(s.nisn).toLowerCase().includes(q)
      );
    }

    if (rankingSortOrder === "asc") {
      list.sort((a, b) => {
        if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
        return a.averageScore - b.averageScore;
      });
    } else {
      list.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return b.averageScore - a.averageScore;
      });
    }

    return list;
  }, [summary?.studentRankings, rankingClassFilter, rankingSearch, rankingSortOrder]);

  const topThreePodium = useMemo(() => {
    if (!summary?.studentRankings) return [];
    let pool = [...summary.studentRankings];
    if (rankingClassFilter !== "all") {
      pool = pool.filter((s) => String(s.kelas).trim() === rankingClassFilter);
    }
    pool.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.averageScore - a.averageScore;
    });
    return pool.slice(0, 3);
  }, [summary?.studentRankings, rankingClassFilter]);

  // Overall Statistics calculations
  const stats = useMemo(() => {
    if (!summary?.subjectProgress || summary.subjectProgress.length === 0) {
      return {
        overallPercent: 0,
        completedCount: 0,
        inProgressCount: 0,
        unstartedCount: 0,
        totalGradesFilled: 0,
        totalGradesRequired: 0
      };
    }

    const totalSubjects = summary.subjectProgress.length;
    const sumPercent = summary.subjectProgress.reduce((acc, curr) => acc + curr.percent, 0);
    const overallPercent = Math.round(sumPercent / totalSubjects);

    const completedCount = summary.subjectProgress.filter(s => s.percent === 100).length;
    const inProgressCount = summary.subjectProgress.filter(s => s.percent > 0 && s.percent < 100).length;
    const unstartedCount = summary.subjectProgress.filter(s => s.percent === 0).length;

    const totalGradesFilled = summary.classProgress.reduce((acc, curr) => acc + curr.filledGrades, 0);
    const totalGradesRequired = summary.classProgress.reduce((acc, curr) => acc + curr.totalNeeded, 0);

    return {
      overallPercent,
      completedCount,
      inProgressCount,
      unstartedCount,
      totalGradesFilled,
      totalGradesRequired
    };
  }, [summary]);

  if (error) {
    return (
      <div className="p-8 bg-slate-900 border border-rose-500/30 text-slate-100 min-h-[300px] flex flex-col items-center justify-center rounded-2xl shadow-xl space-y-4" id="dashboard-error">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-white">Gagal Memuat Telemetri</h3>
          <p className="text-xs text-rose-300/80">{error}</p>
        </div>
        <button
          onClick={fetchSummary}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-emerald-950/40 transition cursor-pointer flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Hubungkan Ulang
        </button>
      </div>
    );
  }

  if (!summary && loading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[350px] p-8 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 text-center"
        id="loading-summary"
      >
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-emerald-400 border-r-teal-400 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-2 border-emerald-400/20"></div>
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white tracking-wide">Sinkronisasi Data Telemetri Rapor...</h4>
          <p className="text-xs text-emerald-400/70 font-mono">
            Menganalisis matriks progres 15 mata pelajaran & kelas...
          </p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-5 animate-fade-in" id="dashboard-progress">
      {/* Top Banner Header (Style from Screenshot) */}
      <div className="rounded-2xl bg-[#0c1322] border border-[#1a2948] p-5 md:p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            {/* Pill Badges on Top */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold font-mono">
                <BookMarked className="w-3.5 h-3.5" />
                RAPORT STS GANJIL 2026/2027
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold font-mono">
                <GraduationCap className="w-3.5 h-3.5" />
                MODE SD KURIKULUM MERDEKA
              </span>
            </div>

            {/* Main Title */}
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Dashboard Pemantauan Raport STS SD
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Pangkalpinang - Visualisasi real-time sebaran nilai 15 mata pelajaran, rasio ketuntasan TP, dan kesiapan cetak raport seluruh kelas.
            </p>
          </div>

          {/* Action Button on Right */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-900/40 border border-blue-400/40 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Perbarui Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row of 4 Metric Stat Cards (Matching Screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-grid">
        {/* Card 1: TOTAL SISWA TERDAFTAR */}
        <div className="rounded-2xl bg-[#0c1322] p-5 border border-[#1a2948] shadow-md flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                TOTAL SISWA TERDAFTAR
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white tracking-tight">
                {summary.totalStudents}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Siswa Aktif
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#1a2948]/70">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold mb-1.5">
              Rincian Per Rombel:
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {summary.classProgress.map((cp) => (
                <span
                  key={cp.kelas}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-500/30 text-blue-300 font-mono text-[10px] font-bold"
                >
                  Kelas {cp.kelas}: <span className="text-white">{cp.studentCount}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: MAPEL TUNTAS (100%) */}
        <div className="rounded-2xl bg-[#0c1322] p-5 border border-[#1a2948] shadow-md flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                MAPEL TUNTAS (100%)
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400 tracking-tight">
                {stats.completedCount}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
                {Math.round((stats.completedCount / (summary.subjectProgress.length || 1)) * 100)}%
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            Siap digunakan & dicetak tanpa kendala
          </p>
        </div>

        {/* Card 3: BELUM TUNTAS / PERLU PERHATIAN */}
        <div className="rounded-2xl bg-[#0c1322] p-5 border border-[#1a2948] shadow-md flex flex-col justify-between hover:border-amber-500/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                BELUM TUNTAS / PERHATIAN
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400 tracking-tight">
                {stats.inProgressCount + stats.unstartedCount}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold font-mono">
                {Math.round(((stats.inProgressCount + stats.unstartedCount) / (summary.subjectProgress.length || 1)) * 100)}%
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {stats.inProgressCount} sedang diisi, {stats.unstartedCount} belum dimulai
          </p>
        </div>

        {/* Card 4: TOTAL KELAS & ROMBEL */}
        <div className="rounded-2xl bg-[#0c1322] p-5 border border-[#1a2948] shadow-md flex flex-col justify-between hover:border-purple-500/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                TOTAL KELAS / LOKASI
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-400 tracking-tight">
                {summary.classProgress.length}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Rombel Aktif
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            Total {summary.totalStudents} siswa dalam {summary.classProgress.length} rombel kelas
          </p>
        </div>
      </div>

      {/* Rombel / Class Progress Breakdown Section */}
      <div className="rounded-2xl bg-[#0c1322] border border-[#1a2948] p-5 shadow-xl space-y-3" id="class-progress-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1a2948]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            <Users className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-extrabold text-white tracking-tight">
              Distribusi Siswa & Kesiapan Nilai Per Kelas
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Total {summary.totalStudents} Siswa • {summary.classProgress.length} Kelas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {summary.classProgress.map((cp) => (
            <div
              key={cp.kelas}
              className="p-4 rounded-xl bg-[#080d1a] border border-[#1a2948] hover:border-blue-500/50 transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-black font-mono">
                    KELAS {cp.kelas}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    Wali: <span className="text-slate-200 font-medium">{cp.waliKelasName}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-white font-mono">
                    {cp.studentCount}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Siswa Terdaftar
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Progres Pengisian Nilai:</span>
                  <span className="font-mono font-bold text-white">
                    {cp.percent}% ({cp.filledGrades}/{cp.totalNeeded})
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      cp.percent === 100
                        ? "bg-emerald-500"
                        : cp.percent > 0
                        ? "bg-blue-500"
                        : "bg-slate-700"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, cp.percent))}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Analytics Main Section (Matching Screenshot Wave Chart Section) */}
      <div className="rounded-2xl bg-[#0c1322] border border-[#1a2948] p-5 md:p-6 shadow-xl space-y-5" id="telemetry-overview-section">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1a2948]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm md:text-base font-extrabold text-white tracking-tight">
                Analisis Visual Progres Nilai Per Mapel & Kelas
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Pemantauan sebaran ketuntasan 15 mata pelajaran, rasio ketercapaian TP, serta intensitas penginputan nilai secara real-time.
            </p>
          </div>

          {/* Search Box in Section Header */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari mapel / guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#080d1a] border border-[#1a2948] text-slate-200 focus:outline-none focus:border-blue-500 w-full sm:w-56"
            />
          </div>
        </div>

        {/* Wave Spline Graphic Panel */}
        <div>
          <div className="flex items-center justify-between text-xs mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider font-mono">
                GRAFIK SEBARAN NILAI & KONDISI FISIK KETUNTASAN PER MAPEL
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Nilai Tuntas (100%)
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Sedang Diisi / Belum
              </span>
            </div>
          </div>

          {/* Interactive Spline Chart */}
          <SplineWaveChart 
            data={filteredSubjects} 
            overallAverage={stats.overallPercent} 
          />
        </div>
      </div>

      {/* Bottom Grid: Aesthetic Clock & Subject Breakdown List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Aesthetic Live Clock Widget (4 Cols) */}
        <div className="lg:col-span-4">
          <AestheticClock variant="card" className="h-full min-h-[220px]" />
        </div>

        {/* Right: Category Filter Chips & Progress List (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-[#0c1322] border border-[#1a2948] p-5 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Daftar Progres 15 Mata Pelajaran
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Filter berdasarkan kelompok kurikulum & status ketuntasan guru
                </p>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center p-1 rounded-xl bg-[#080d1a] border border-[#1a2948]">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                    categoryFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Semua ({summary.subjectProgress.length})
                </button>
                <button
                  onClick={() => setCategoryFilter("nasional")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                    categoryFilter === "nasional"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Nasional
                </button>
                <button
                  onClick={() => setCategoryFilter("islamic")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                    categoryFilter === "islamic"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Islamic
                </button>
                <button
                  onClick={() => setCategoryFilter("muatan")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                    categoryFilter === "muatan"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Muatan
                </button>
              </div>
            </div>

            {/* Quick mini-table list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {filteredSubjects.map((sub, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#080d1a] border border-[#1a2948] hover:border-blue-500/40 transition text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-200 truncate">{sub.subject}</div>
                    <div className="text-[10px] text-slate-400 truncate">{sub.teacherName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        sub.percent === 100
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : sub.percent > 0
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {sub.percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#1a2948] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-300">Rekapitulasi Nilai:</span>
              <span className="font-mono font-bold text-emerald-400">
                {stats.totalGradesFilled} / {stats.totalGradesRequired} Entri Nilai ({stats.overallPercent}%)
              </span>
            </div>
            <div className="text-slate-400">
              Total Siswa: <strong className="text-white font-mono">{summary.totalStudents} Siswa</strong>
            </div>
          </div>
        </div>
      </div>

      {/* STUDENT RANKING SECTION (AKUMULASI NILAI TERTINGGI KE TERENDAH) */}
      <div
        className="rounded-2xl bg-[#0c1322] border border-[#1a2948] p-6 shadow-xl space-y-6 animate-fade-in"
        id="student-ranking-section"
      >
        {/* Header & Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#1a2948]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-wide">
                  Peringkat Siswa (Leaderboard Nilai)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Akumulasi Nilai
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Urutan peringkat siswa berdasarkan akumulasi seluruh perolehan nilai mata pelajaran dari tertinggi ke terendah
              </p>
            </div>
          </div>

          {/* Filtering and Sort Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class filter tabs */}
            <div className="flex items-center bg-[#080d1a] border border-[#1a2948] p-1 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 hidden sm:inline">
                Rombel:
              </span>
              {[
                { id: "all", label: "Semua Tingkat" },
                { id: "1", label: "Kelas 1" },
                { id: "2", label: "Kelas 2" },
                { id: "3", label: "Kelas 3" },
                { id: "4", label: "Kelas 4" },
                { id: "5", label: "Kelas 5" },
                { id: "6", label: "Kelas 6" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setRankingClassFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    rankingClassFilter === c.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Sort order toggle */}
            <div className="flex items-center bg-[#080d1a] border border-[#1a2948] p-1 rounded-xl">
              <button
                onClick={() => setRankingSortOrder("desc")}
                title="Nilai Tertinggi ke Terendah"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  rankingSortOrder === "desc"
                    ? "bg-amber-600/80 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Tertinggi</span>
                <span className="text-[10px]">↓</span>
              </button>
              <button
                onClick={() => setRankingSortOrder("asc")}
                title="Nilai Terendah ke Tertinggi"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  rankingSortOrder === "asc"
                    ? "bg-amber-600/80 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Terendah</span>
                <span className="text-[10px]">↑</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={rankingSearch}
                onChange={(e) => setRankingSearch(e.target.value)}
                placeholder="Cari siswa atau NISN..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#080d1a] border border-[#1a2948] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* TOP 3 PODIUM / CHAMPION CARDS (Displayed when in desc sort) */}
        {rankingSortOrder === "desc" && topThreePodium.length > 0 && !rankingSearch && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 pb-2">
            {/* JUARA 2 (Silver) */}
            {topThreePodium[1] && (
              <div className="order-2 md:order-1 rounded-2xl bg-gradient-to-b from-slate-800/60 to-[#080d1a] border border-slate-600/40 p-4 shadow-lg flex flex-col justify-between hover:border-slate-400 transition relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-slate-400/5 rounded-full blur-xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-300/10 border border-slate-300/30 text-slate-300 text-xs font-bold flex items-center gap-1.5">
                      <span>🥈</span> Juara 2
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-blue-300 font-mono text-[10px] font-bold">
                      Kelas {topThreePodium[1].kelas}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white truncate" title={topThreePodium[1].name}>
                    {topThreePodium[1].name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    NISN: {topThreePodium[1].nisn || "-"}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">
                      Total Akumulasi
                    </span>
                    <span className="text-xl font-black text-slate-200 font-mono">
                      {topThreePodium[1].totalScore.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">
                      Rata-Rata
                    </span>
                    <span className="text-lg font-bold text-cyan-400 font-mono">
                      {topThreePodium[1].averageScore}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* JUARA 1 (Gold - Center & Elevated) */}
            {topThreePodium[0] && (
              <div className="order-1 md:order-2 rounded-2xl bg-gradient-to-b from-amber-900/30 via-[#0c162c] to-[#080d1a] border-2 border-amber-500/60 p-5 shadow-[0_0_25px_rgba(245,158,11,0.15)] flex flex-col justify-between hover:border-amber-400 transition relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black flex items-center gap-1.5 shadow-xs">
                      <span>🥇</span> Juara 1 (Terbaik)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                      Kelas {topThreePodium[0].kelas}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-amber-200 truncate" title={topThreePodium[0].name}>
                    {topThreePodium[0].name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    NISN: {topThreePodium[0].nisn || "-"}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-amber-400/80 font-mono block font-bold">
                      Total Akumulasi
                    </span>
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      {topThreePodium[0].totalScore.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-amber-400/80 font-mono block font-bold">
                      Rata-Rata
                    </span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      {topThreePodium[0].averageScore}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* JUARA 3 (Bronze) */}
            {topThreePodium[2] && (
              <div className="order-3 md:order-3 rounded-2xl bg-gradient-to-b from-amber-950/40 to-[#080d1a] border border-amber-700/40 p-4 shadow-lg flex flex-col justify-between hover:border-amber-600 transition relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-700/5 rounded-full blur-xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-700/20 border border-amber-700/40 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                      <span>🥉</span> Juara 3
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-blue-300 font-mono text-[10px] font-bold">
                      Kelas {topThreePodium[2].kelas}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white truncate" title={topThreePodium[2].name}>
                    {topThreePodium[2].name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    NISN: {topThreePodium[2].nisn || "-"}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-amber-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">
                      Total Akumulasi
                    </span>
                    <span className="text-xl font-black text-amber-300/90 font-mono">
                      {topThreePodium[2].totalScore.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">
                      Rata-Rata
                    </span>
                    <span className="text-lg font-bold text-cyan-400 font-mono">
                      {topThreePodium[2].averageScore}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FULL RANKING TABLE */}
        <div className="rounded-xl border border-[#1a2948] overflow-hidden bg-[#080d1a]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0f172a] text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-[#1a2948]">
                <tr>
                  <th className="py-3 px-4 text-center w-16">Peringkat</th>
                  <th className="py-3 px-4">Nama Siswa / NISN</th>
                  <th className="py-3 px-4 text-center">Kelas</th>
                  <th className="py-3 px-4 text-center">Capaian Mapel</th>
                  <th className="py-3 px-4 text-right">Akumulasi Nilai</th>
                  <th className="py-3 px-4 text-right">Rata-Rata</th>
                  <th className="py-3 px-4 text-center">Predikat</th>
                  <th className="py-3 px-4 text-center w-28">Rincian Mapel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2948]/70">
                {filteredRankings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      Tidak ada siswa ditemukan yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredRankings.map((student, idx) => {
                    const rankNum = rankingSortOrder === "desc" ? idx + 1 : filteredRankings.length - idx;
                    const isTop1 = rankNum === 1;
                    const isTop2 = rankNum === 2;
                    const isTop3 = rankNum === 3;
                    const isExpanded = expandedStudentId === student.studentId;

                    return (
                      <React.Fragment key={student.studentId}>
                        <tr
                          className={`hover:bg-[#0f1b36] transition ${
                            isTop1
                              ? "bg-amber-500/5 font-semibold"
                              : isTop2
                              ? "bg-slate-400/5"
                              : isTop3
                              ? "bg-amber-700/5"
                              : ""
                          }`}
                        >
                          {/* Rank Badge */}
                          <td className="py-3.5 px-4 text-center">
                            {isTop1 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                                🥇 1
                              </span>
                            ) : isTop2 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/20 text-slate-200 border border-slate-400/40 text-xs font-black">
                                🥈 2
                              </span>
                            ) : isTop3 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-300 border border-amber-700/40 text-xs font-black">
                                🥉 3
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0f172a] text-slate-400 border border-[#1a2948] text-[11px] font-mono font-bold">
                                #{rankNum}
                              </span>
                            )}
                          </td>

                          {/* Student Name & NISN */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-xs sm:text-sm">
                              {student.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              NISN: {student.nisn || "-"}
                            </div>
                          </td>

                          {/* Class */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-300 font-mono text-[10px] font-bold">
                              Kelas {student.kelas}
                            </span>
                          </td>

                          {/* Completed Subjects */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="text-[11px] font-mono font-bold text-slate-300">
                                {student.filledSubjectsCount} / {student.totalSubjectsCount}
                              </span>
                              <div className="w-16 h-1.5 bg-[#0f172a] rounded-full overflow-hidden mt-1 border border-[#1a2948]">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.round(
                                        (student.filledSubjectsCount /
                                          (student.totalSubjectsCount || 1)) *
                                          100
                                      )
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Total Score */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-sm font-black text-amber-300 font-mono">
                              {student.totalScore.toLocaleString("id-ID")}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">Poin</span>
                          </td>

                          {/* Average Score */}
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`text-sm font-black font-mono ${
                                student.averageScore > 91
                                  ? "text-emerald-400"
                                  : student.averageScore >= 80
                                  ? "text-cyan-400"
                                  : student.averageScore > 0
                                  ? "text-amber-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {student.averageScore}
                            </span>
                          </td>

                          {/* Predikat */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                student.predikat.startsWith("A")
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  : student.predikat.startsWith("B")
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                  : student.predikat.startsWith("C")
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {student.predikat}
                            </span>
                          </td>

                          {/* Action toggle detail */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() =>
                                setExpandedStudentId(
                                  isExpanded ? null : student.studentId
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                                isExpanded
                                  ? "bg-blue-600 text-white"
                                  : "bg-[#0f172a] text-slate-300 hover:text-white border border-[#1a2948] hover:border-blue-500/50"
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isExpanded ? "Tutup" : "Rincian"}</span>
                            </button>
                          </td>
                        </tr>

                        {/* EXPANDED ACCORDION: Individual Subject Scores */}
                        {isExpanded && (
                          <tr className="bg-[#060a14] border-b border-[#1a2948]">
                            <td colSpan={8} className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#1a2948]/80">
                                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Rincian Perolehan Nilai Mata Pelajaran: {student.name}</span>
                                  </span>
                                  <span className="text-slate-400 font-mono text-[10px]">
                                    Terisi: {student.filledSubjectsCount} dari {student.totalSubjectsCount} Mata Pelajaran
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                                  {[
                                    "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "PJOK", "Prakarya", "Informatika",
                                    "Bahasa Arab", "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"
                                  ].map((subName) => {
                                    const score = student.subjectScores?.[subName];
                                    const hasScore = score !== undefined && score !== null;

                                    return (
                                      <div
                                        key={subName}
                                        className="p-2 rounded-lg bg-[#0c1322] border border-[#1a2948] flex items-center justify-between text-xs"
                                      >
                                        <span className="text-[10px] text-slate-300 truncate max-w-[100px]" title={subName}>
                                          {subName}
                                        </span>
                                        <span
                                          className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                                            !hasScore
                                              ? "text-slate-600 bg-slate-900"
                                              : score > 91
                                              ? "text-emerald-400 bg-emerald-950/60 border border-emerald-500/30"
                                              : score >= 80
                                              ? "text-cyan-400 bg-cyan-950/60 border border-cyan-500/30"
                                              : "text-amber-400 bg-amber-950/60 border border-amber-500/30"
                                          }`}
                                        >
                                          {hasScore ? score : "-"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3 bg-[#0f172a] border-t border-[#1a2948] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <div>
              Menampilkan <strong className="text-white">{filteredRankings.length}</strong> dari{" "}
              <strong className="text-white">{summary.totalStudents}</strong> siswa terdaftar
              {rankingClassFilter !== "all" && ` (Filter: Kelas ${rankingClassFilter})`}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Nilai &gt; 91 (A - Sangat Baik)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Nilai 80 - 91 (B - Baik)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span> Nilai &le; 79 (C - Cukup)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
