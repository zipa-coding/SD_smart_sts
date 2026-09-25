import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, MonitorDown, Laptop, Check, X, Smartphone, Globe } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'login' | 'banner' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'navbar' }) => {
  const { isInstallable, isInstalled, isStandalone, isIOS, install, deferredPrompt } = usePWAInstall();
  const [showManualGuide, setShowManualGuide] = useState(false);

  // If already installed and running inside the standalone app window
  if (isStandalone) {
    if (variant === 'sidebar') {
      return (
        <div className="mx-2 mb-2 p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-[10px] text-emerald-300 font-mono">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">Aplikasi Desktop Aktif</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowManualGuide(true);
    }
  };

  if (variant === 'sidebar') {
    return (
      <>
        <div className="px-2 mb-2">
          <button
            onClick={handleInstallClick}
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-950/60 border border-blue-400/40 transition cursor-pointer group"
            title="Download & Pasang Aplikasi di Laptop"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Laptop className="w-4 h-4 text-amber-300 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate font-semibold">Download Aplikasi</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono uppercase font-bold shrink-0">
              PC / App
            </span>
          </button>
        </div>

        {showManualGuide && <PWAInstallModal onClose={() => setShowManualGuide(false)} />}
      </>
    );
  }

  if (variant === 'login') {
    return (
      <>
        <div className="mt-4 pt-4 border-t border-[#1e2e4a] flex flex-col items-center">
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full py-2.5 px-4 rounded-xl bg-[#111d35] hover:bg-[#162544] border border-blue-500/40 text-blue-300 hover:text-white transition flex items-center justify-center gap-2.5 text-xs font-bold font-mono shadow-md cursor-pointer"
          >
            <Laptop className="w-4 h-4 text-blue-400" />
            <span>DOWNLOAD / PASANG DI LAPTOP</span>
            <span className="ml-auto px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[9px]">
              Offline Ready
            </span>
          </button>
        </div>

        {showManualGuide && <PWAInstallModal onClose={() => setShowManualGuide(false)} />}
      </>
    );
  }

  // Default navbar badge / button
  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-950/40 border border-blue-400/40 transition cursor-pointer select-none shrink-0"
        title="Download & Pasang Aplikasi Raport di Laptop / Komputer"
      >
        <MonitorDown className="w-4 h-4 text-amber-300 shrink-0" />
        <span className="hidden sm:inline">Pasang di Laptop</span>
        <span className="sm:hidden">Install</span>
      </button>

      {showManualGuide && <PWAInstallModal onClose={() => setShowManualGuide(false)} />}
    </>
  );
};

// Modal Petunjuk Pemasangan di Laptop / HP
export const PWAInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in no-print">
      <div className="w-full max-w-lg bg-[#0c1322] border border-[#1a2948] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-[#090e1c] border-b border-[#1a2948] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase font-mono tracking-tight text-white">
                Download & Pasang di Laptop (PWA)
              </h3>
              <p className="text-xs text-slate-400">
                Aplikasi Raport SMP Islam Smart langsung di desktop Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Instructions */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-blue-200 leading-relaxed">
            <strong className="text-blue-300 block mb-1">Keunggulan Aplikasi Terpasang di Laptop:</strong>
            • Ikon aplikasi muncul di Desktop & Taskbar laptop.<br />
            • Buka langsung dalam jendela mandiri (*standalone window*) tanpa tab browser.<br />
            • Pemuatan halaman super cepat (*instant launch*).
          </div>

          <div className="space-y-3">
            <div className="font-bold text-slate-200 text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <span>Cara Pasang di Laptop (Google Chrome / Microsoft Edge):</span>
            </div>

            <div className="bg-[#10192e] p-3.5 rounded-xl border border-[#1e2f4f] space-y-2.5 text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                <span>
                  Buka website raport ini di browser <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                <span>
                  Lihat ke <strong>bilah alamat (Address Bar URL)</strong> di kanan atas browser, klik ikon <strong>Install / Download <MonitorDown className="w-3.5 h-3.5 inline mx-1 text-blue-400" /></strong> atau buka menu <strong>titik tiga (⋮)</strong> &gt; pilih <strong>"Install Raport STS SMP Islam Smart..."</strong>
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                <span>
                  Klik <strong>Install / Pasang</strong>. Aplikasi akan otomatis terpasang dan icon pintasan akan muncul di layar desktop komputer Anda.
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="font-bold text-slate-200 text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Untuk Pengguna HP Android / iPhone:</span>
            </div>

            <div className="bg-[#10192e] p-3.5 rounded-xl border border-[#1e2f4f] space-y-2 text-slate-300">
              <p>
                • <strong>Android (Chrome)</strong>: Ketuk menu titik tiga (⋮) &gt; pilih <strong>"Tambahkan ke Layar Utama"</strong> (*Add to Home Screen*).
              </p>
              <p>
                • <strong>iPhone/iPad (Safari)</strong>: Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah &gt; pilih <strong>"Tambah ke Layar Utama"</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#090e1c] border-t border-[#1a2948] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition cursor-pointer"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
