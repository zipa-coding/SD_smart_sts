import React, { useState, useEffect } from "react";
import { LogIn, ShieldAlert, Key, User, School, BookOpen, CheckCircle2 } from "lucide-react";
import { Teacher } from "../types";
import SmpIslamSmartLogo from "./SmpIslamSmartLogo";
import { PWAInstallButton } from "./PWAInstallButton";

interface LoginScreenProps {
  onLoginSuccess: (user: Teacher) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetch("/api/teachers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Filter out Admin from suggestions
          setTeachers(data.filter((t) => t.subject !== "Admin"));
        }
      })
      .catch((err) => console.error("Gagal memuat daftar guru untuk rekomendasi", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username dan kata sandi harus diisi.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan saat masuk.");
      }

      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungkan ke server.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSuggestions = username.trim()
    ? teachers
        .filter((t) => {
          const query = username.toLowerCase();
          return (
            t.name.toLowerCase().includes(query) ||
            t.username.toLowerCase().includes(query)
          );
        })
        .slice(0, 5)
    : [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b14] px-4 py-10 relative overflow-hidden" id="login-container">
      {/* Refined Deep Ambient Glows */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-blue-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-emerald-900/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0d1527] rounded-2xl shadow-2xl border border-[#1e2e4a] overflow-hidden relative z-10" id="login-card">
        {/* Header Section */}
        <div className="bg-gradient-to-b from-[#111c34] to-[#0d1527] px-6 pt-8 pb-6 text-center text-white relative border-b border-[#1e2e4a]">
          <div className="mx-auto w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 p-1.5 shadow-lg ring-1 ring-blue-400/20">
            <SmpIslamSmartLogo size="100%" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-300 text-[11px] font-semibold tracking-wide mb-2.5">
            <School className="w-3.5 h-3.5 text-blue-400" />
            <span>SMP ISLAM SMART PANGKALPINANG</span>
          </div>

          <h1 className="text-lg font-extrabold tracking-tight text-white uppercase">
            PORTAL RAPORT STS
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Sistem Penilaian Sumatif Tengah Semester • 2026/2027
          </p>
        </div>

        <div className="p-6 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2.5" id="login-error">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Nama Pengguna (Username)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  placeholder="Masukkan username..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#080d19] border border-[#1e2e4a] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition font-medium"
                  id="username-input"
                  autoComplete="off"
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#0a101f] border border-[#1e2e4a] rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-[#15233c]">
                    <div className="p-2 text-[10px] font-bold text-slate-400 bg-[#070c18] uppercase tracking-wider font-mono">
                      Pilihan Cepat Pengguna
                    </div>
                    {filteredSuggestions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setUsername(t.username);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-[#121e36] transition flex flex-col gap-0.5 cursor-pointer text-slate-200"
                      >
                        <span className="text-xs font-bold text-blue-300">{t.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-300 bg-[#0d1627] border border-[#1e2e4a] px-1.5 py-0.5 rounded font-medium">
                            {t.username}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            • Mapel {t.subject} {t.isWaliKelas ? `(Kelas ${t.kelas})` : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Key className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#080d19] border border-[#1e2e4a] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition font-medium"
                  id="password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold font-mono tracking-wider shadow-lg shadow-blue-950/60 border border-blue-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 mt-2"
              id="login-button"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  MASUK KE SISTEM
                </>
              )}
            </button>
          </form>

          {/* PWA Install Button for Fast Laptop Access */}
          <PWAInstallButton variant="login" />
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-slate-500 font-medium">
        SMP Islam Smart Pangkalpinang &bull; Tahun Ajaran 2026/2027
      </div>
    </div>
  );
}
