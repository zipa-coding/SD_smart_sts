import React, { useState, useEffect } from "react";
import { Teacher } from "./types";
import LoginScreen from "./components/LoginScreen";
import DashboardProgress from "./components/DashboardProgress";
import AdminPanel from "./components/AdminPanel";
import TeacherPanel from "./components/TeacherPanel";
import WaliKelasPanel from "./components/WaliKelasPanel";
import SmpIslamSmartLogo from "./components/SmpIslamSmartLogo";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { BookOpen, LogOut, Key, BarChart3, Settings, ShieldAlert, GraduationCap, PenTool, Sun, Moon, Menu, X, LayoutDashboard, Sliders } from "lucide-react";
import { isFirebaseConfigured } from "./lib/firebase";

export default function App() {
  const [currentUser, setCurrentUser] = useState<Teacher | null>(() => {
    try {
      const savedUser = sessionStorage.getItem("smp_islam_smart_user");
      const lastActive = sessionStorage.getItem("smp_islam_smart_last_active");
      if (savedUser) {
        if (lastActive) {
          const inactiveDuration = Date.now() - Number(lastActive);
          if (inactiveDuration <= 10 * 60 * 1000) {
            return JSON.parse(savedUser);
          }
        } else {
          return JSON.parse(savedUser);
        }
      }
    } catch (e) {}
    return null;
  });
  const [showInactivityModal, setShowInactivityModal] = useState<boolean>(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);
  
  // Navigation: active main view tab
  const [activeTab, setActiveTab] = useState<string>("progress");

  // Keep track of visited tabs to lazy-mount and preserve tab state for 0ms transitions
  const [visitedTabs, setVisitedTabs] = useState<{ [tab: string]: boolean }>({ progress: true });
  
  // State trigger to notify progress widgets to refetch summary info
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Responsive mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Global screen dark mode state synced with local storage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("smp_islam_smart_theme") === "dark";
  });

  useEffect(() => {
    localStorage.setItem("smp_islam_smart_theme", darkMode ? "dark" : "light");
    if (darkMode) {
      document.body.classList.add("dark");
      document.documentElement.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Track tab visits for fast DOM persistence
  useEffect(() => {
    if (activeTab && !visitedTabs[activeTab]) {
      setVisitedTabs((prev) => ({ ...prev, [activeTab]: true }));
    }
  }, [activeTab]);

  // Check if session exists on load with security inactivity verify in background
  useEffect(() => {
    const savedUser = sessionStorage.getItem("smp_islam_smart_user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        
        // Security check for long-unopened window / inactive reload
        const lastActive = sessionStorage.getItem("smp_islam_smart_last_active");
        if (lastActive) {
          const inactiveDuration = Date.now() - Number(lastActive);
          const TIMEOUT_MS = 10 * 60 * 1000; // 10 menit
          if (inactiveDuration > TIMEOUT_MS) {
            sessionStorage.removeItem("smp_islam_smart_user");
            sessionStorage.removeItem("smp_islam_smart_last_active");
            setShowInactivityModal(true);
            setCurrentUser(null);
            return;
          }
        }
        
        // Non-blocking background verification with server
        fetch("/api/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u.username, password: u.password })
        })
          .then((res) => {
            if (!res.ok) throw new Error("Sesi tidak valid");
            return res.json();
          })
          .then((verifiedUser) => {
            setCurrentUser(verifiedUser);
            sessionStorage.setItem("smp_islam_smart_user", JSON.stringify(verifiedUser));
            sessionStorage.setItem("smp_islam_smart_last_active", Date.now().toString());
          })
          .catch(() => {
            // Force re-login if credentials changed or account was deleted
            sessionStorage.removeItem("smp_islam_smart_user");
            sessionStorage.removeItem("smp_islam_smart_last_active");
            setCurrentUser(null);
          });
      } catch (e) {
        sessionStorage.removeItem("smp_islam_smart_user");
      }
    }
  }, []);

  // Live session activity & lock-out tracking hook
  useEffect(() => {
    if (!currentUser) return;

    // Save initial load timestamp
    sessionStorage.setItem("smp_islam_smart_last_active", Date.now().toString());

    const TIMEOUT_MS = 10 * 60 * 1000; // 10 menit

    const checkInactivity = () => {
      const lastActive = sessionStorage.getItem("smp_islam_smart_last_active");
      if (lastActive) {
        const inactiveDuration = Date.now() - Number(lastActive);
        if (inactiveDuration > TIMEOUT_MS) {
          // Log out for security compliance
          setCurrentUser(null);
          sessionStorage.removeItem("smp_islam_smart_user");
          sessionStorage.removeItem("smp_islam_smart_last_active");
          setShowInactivityModal(true);
        }
      }
    };

    const updateActivity = () => {
      sessionStorage.setItem("smp_islam_smart_last_active", Date.now().toString());
    };

    // Listen to various desktop & mobile user events
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Check inactivity every 20 seconds
    const interval = setInterval(checkInactivity, 20000);

    // Check when tab gets focus or visibility transitions back to active
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", checkInactivity);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", checkInactivity);
    };
  }, [currentUser]);

  const handleLoginSuccess = (user: Teacher) => {
    setCurrentUser(user);
    sessionStorage.setItem("smp_islam_smart_user", JSON.stringify(user));
    sessionStorage.setItem("smp_islam_smart_last_active", Date.now().toString());
    
    // Default tabs depending on role
    if (user.subject === "Admin") {
      setActiveTab("progress");
    } else if (user.subject !== "Admin") {
      setActiveTab("progress");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem("smp_islam_smart_user");
    sessionStorage.removeItem("smp_islam_smart_last_active");
  };

  const triggerProgressRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Render loading screen during session verification
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-6 text-center space-y-6" id="session-verification-loading">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/40"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-emerald-800 dark:border-t-emerald-500 animate-spin"></div>
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Verifikasi Keamanan Sesi</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sedang memverifikasi kredensial akun Anda secara aman dengan server SMP Islam Smart...
          </p>
        </div>
      </div>
    );
  }

  // Render Lockscreen Modal if locked
  if (showInactivityModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-950/20 backdrop-blur-md px-4 py-12" id="inactivity-lockscreen">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-rose-100 dark:border-slate-700 overflow-hidden text-center p-8 space-y-6 animate-scale-up">
          <div className="mx-auto w-20 h-20 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 animate-pulse">
            <ShieldAlert className="w-10 h-10" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">Sesi Keamanan Terkunci</h2>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-extrabold tracking-widest uppercase font-mono">
              Inactivity Auto-Lock
            </p>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Demi menjaga keamanan data akademik dan kerahasiaan nilai raport murid SMP Islam Smart, sistem ini otomatis mengunci sesi Anda apabila aplikasi tidak dibuka atau dibiarkan aktif tanpa aktivitas selama lebih dari 10 menit.
          </p>

          <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-550 dark:text-slate-400 text-left leading-relaxed">
            Silakan klik tombol di bawah untuk memverifikasi ulang akun Anda dan melanjutkan pengerjaan penginputan nilai.
          </div>

          <button
            onClick={() => setShowInactivityModal(false)}
            className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-lg text-xs font-bold tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Key className="w-4.5 h-4.5" />
            Verifikasi & Masuk Kembali
          </button>
        </div>
      </div>
    );
  }

  // If there's no active user session, redirect to Login
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Determine which navigation tabs must be shown based on user role
  const isSysAdmin = currentUser.subject === "Admin";
  const isSubjectTeacher = currentUser.subject !== "Admin" && currentUser.subject !== "";
  const isWaliKelas = currentUser.isWaliKelas;

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-100/70 text-slate-800"}`} id="applet-viewport">
      {/* Mobile Sidebar Overlay Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-[#0a0f1d] text-slate-200 flex flex-col z-50 transform transition-transform duration-300 ease-in-out no-print shrink-0 md:relative md:translate-x-0 border-r border-[#1a2948] shadow-2xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`} 
        id="app-sidebar"
      >
        {/* Sidebar Header Logo */}
        <div className="p-4 border-b border-[#1a2948] bg-[#0c1322] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md ring-1 ring-blue-500/30">
              <SmpIslamSmartLogo size="100%" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black tracking-tight text-white uppercase font-mono truncate">
                  SMART RAPORT
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[8px] font-black uppercase font-mono">
                  SMP
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-400 truncate">
                SMP Islam Smart Pangkalpinang
              </p>
            </div>
          </div>
          {/* Close button for small screens */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status System Subheader */}
        <div className="px-4 py-2.5 bg-[#090e1c] border-b border-[#1a2948] flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-mono font-bold uppercase tracking-wider text-[9px]">
              Sistem Aktif
            </span>
          </div>
          
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold text-[9px]">
            STS Ganjil
          </span>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-1">
          <div className="px-2 mb-1.5 text-[9px] text-slate-400 font-extrabold uppercase tracking-widest font-mono">
            MENU UTAMA
          </div>
          
          <button
            onClick={() => {
              setActiveTab("progress");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all duration-200 cursor-pointer ${
              activeTab === "progress"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 font-bold border border-blue-400/40"
                : "text-slate-300 hover:bg-[#131f38] hover:text-white"
            }`}
          >
            <BarChart3 className={`w-4 h-4 ${activeTab === "progress" ? "text-white" : "text-blue-400"}`} />
            <span>Dashboard Analytics</span>
          </button>

          {/* If Subject Teacher OR Admin */}
          {(isSubjectTeacher || isSysAdmin) && (
            <button
              onClick={() => {
                setActiveTab("grade_inputs");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all duration-200 cursor-pointer ${
                activeTab === "grade_inputs"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 font-bold border border-blue-400/40"
                  : "text-slate-300 hover:bg-[#131f38] hover:text-white"
              }`}
            >
              <PenTool className={`w-4 h-4 ${activeTab === "grade_inputs" ? "text-white" : "text-emerald-400"}`} />
              <span>Input Nilai Mapel</span>
            </button>
          )}

          {/* If Wali Kelas OR Admin */}
          {(isWaliKelas || isSysAdmin) && (
            <button
              onClick={() => {
                setActiveTab("walikelas_panel");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all duration-200 cursor-pointer ${
                activeTab === "walikelas_panel"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 font-bold border border-blue-400/40"
                  : "text-slate-300 hover:bg-[#131f38] hover:text-white"
              }`}
            >
              <GraduationCap className={`w-4 h-4 ${activeTab === "walikelas_panel" ? "text-white" : "text-purple-400"}`} />
              <span>Panel Wali Kelas & Rapor</span>
            </button>
          )}

          {/* If SysAdmin */}
          {isSysAdmin && (
            <>
              <div className="px-2 pt-4 mb-1.5 text-[9px] text-slate-400 font-extrabold uppercase tracking-widest font-mono">
                SISTEM & PENGATURAN
              </div>
              <button
                onClick={() => {
                  setActiveTab("admin_panel");
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all duration-200 cursor-pointer ${
                  activeTab === "admin_panel"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 font-bold border border-blue-400/40"
                    : "text-slate-300 hover:bg-[#131f38] hover:text-white"
                }`}
              >
                <Settings className={`w-4 h-4 ${activeTab === "admin_panel" ? "text-white" : "text-amber-400"}`} />
                <span>Panel Administrator</span>
              </button>
            </>
          )}
        </nav>

        {/* PWA Desktop Install Action Button in Sidebar */}
        <PWAInstallButton variant="sidebar" />

        {/* Sidebar Footer User Profile */}
        <div className="p-3.5 bg-[#0c1322] border-t border-[#1a2948] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate text-white" title={currentUser.name}>
              {currentUser.name}
            </div>
            <div className="text-[10px] text-blue-400 font-semibold truncate">
              {isSysAdmin
                ? "Administrator Utama"
                : isWaliKelas
                ? `Wali Kelas ${currentUser.kelas}`
                : `Guru ${currentUser.subject}`}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Row (Matching Screenshot Header Bar) */}
        <header className={`h-15 border-b flex items-center justify-between px-3 md:px-5 shrink-0 no-print transition-colors duration-200 ${darkMode ? "bg-[#0c1322] border-[#1a2948] text-slate-100" : "bg-white border-slate-200 text-slate-800"} z-10`} id="app-navbar">
          <div className="flex items-center gap-3">
            {/* Hamburger menu trigger for small screens */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-[#131f38] hover:text-white transition cursor-pointer"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Header Brand & Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline">
                  SMART RAPORT
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold uppercase font-mono">
                  PANGKALPINANG
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Keamanan Aktif</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Install Desktop App CTA */}
            <PWAInstallButton variant="navbar" />

            {/* Mode SMP Pill Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131f38] border border-[#1e3458] text-blue-300 text-xs font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Mode SMP STS</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer select-none border ${
                darkMode 
                  ? "bg-[#131f38] hover:bg-[#1c2c4e] text-amber-400 border-[#1a2948]" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
              title={darkMode ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* User Profile Badge (Blue highlight style from screenshot) */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold border ${
              darkMode
                ? "bg-blue-950/40 border-blue-500/30 text-blue-300"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}>
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              <div className="text-left">
                <div className="leading-tight truncate max-w-[120px]">{currentUser.name}</div>
                <div className="text-[9px] text-blue-400/80 font-mono">
                  {isSysAdmin ? "ADMIN (FULL)" : isWaliKelas ? `WALI KELAS ${currentUser.kelas}` : `GURU ${currentUser.subject}`}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold border transition select-none cursor-pointer flex items-center gap-1.5 ${
                darkMode
                  ? "text-rose-400 bg-rose-950/30 border-rose-900/60 hover:bg-rose-900/40"
                  : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
              }`}
              id="logout-button"
              title="Keluar dari Aplikasi"
            >
              <LogOut className="w-4 h-4" /> 
              <span className="hidden md:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Inner Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" id="app-workspace">
          {/* Tab view containers with persistent state */}
          <div className="tab-viewport max-w-7xl mx-auto" id="tab-viewport">
            {visitedTabs["progress"] && (
              <div className={activeTab === "progress" ? "block animate-fade-in" : "hidden"}>
                <DashboardProgress onRefreshTrigger={refreshTrigger} />
              </div>
            )}

            {visitedTabs["grade_inputs"] && (
              <div className={activeTab === "grade_inputs" ? "block animate-fade-in" : "hidden"}>
                {isSysAdmin ? (
                  <div className="space-y-4">
                    {/* For admin, let them act as a specific teacher to test! */}
                    <div className="no-print bg-[#0c1322] text-white border border-blue-500/30 p-4 rounded-2xl shadow-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Sliders className="w-4 h-4 text-blue-400" />
                        <span className="text-xs uppercase tracking-wider font-extrabold text-blue-400 font-mono">
                          Mode Pengujian Administrator
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Sebagai Administrator Utama, Anda dapat menguji penginputan nilai dan ketercapaian tujuan pembelajaran (TP) mapel Informatika di bawah ini.
                      </p>
                    </div>
                    {/* Act as IPA Teacher by default for admin in workspace */}
                    <TeacherPanel
                      user={{ id: "admin_tester", name: "Pak Admin (Penguji)", username: "admin", subject: "Informatika", isWaliKelas: false, kelas: "" }}
                      onRefreshTrigger={triggerProgressRefresh}
                    />
                  </div>
                ) : (
                  <TeacherPanel user={currentUser} onRefreshTrigger={triggerProgressRefresh} />
                )}
              </div>
            )}

            {visitedTabs["walikelas_panel"] && (
              <div className={activeTab === "walikelas_panel" ? "block animate-fade-in" : "hidden"}>
                {/* Wali Kelas dashboard integration */}
                <WaliKelasPanel user={currentUser} onRefreshTrigger={triggerProgressRefresh} />
              </div>
            )}

            {visitedTabs["admin_panel"] && isSysAdmin && (
              <div className={activeTab === "admin_panel" ? "block animate-fade-in" : "hidden"}>
                {/* Admin Database control hub */}
                <AdminPanel onRefreshTrigger={triggerProgressRefresh} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
