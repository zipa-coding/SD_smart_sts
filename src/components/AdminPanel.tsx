import React, { useState, useEffect } from "react";
import { Teacher, Student, SUBJECT_LIST } from "../types";
import {
  Users,
  GraduationCap,
  Plus,
  Trash2,
  Edit,
  Key,
  Save,
  BookOpen,
  CalendarDays,
  UserCheck,
  X,
  AlertCircle,
  Award,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Search,
  FileText,
  Copy,
} from "lucide-react";

interface AdminPanelProps {
  onRefreshTrigger: () => void;
}

export default function AdminPanel({ onRefreshTrigger }: AdminPanelProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    "teachers" | "students" | "tps" | "settings" | "ekskul"
  >("teachers");

  // State arrays fetched from API
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tpsTemplates, setTpsTemplates] = useState<{
    [subject: string]: { id: string; text: string }[];
  }>({});
  const [ekskuls, setEkskuls] = useState<
    { id: string; name: string; type: "Wajib" | "Pilihan" }[]
  >([]);

  // Principal settings state
  const [principalName, setPrincipalName] = useState(
    "Ustadz H. Ir. Abdul Muhyi, M.Pd",
  );
  const [principalNip, setPrincipalNip] = useState("19780512 200501 1 002");
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Raport formatting settings state
  const [semesterName, setSemesterName] = useState("Ganjil");
  const [tahunPelajaran, setTahunPelajaran] = useState("2026/2027");
  const [fontSize, setFontSize] = useState("11pt");
  const [showLogo, setShowLogo] = useState(false);
  const [showSpiritual, setShowSpiritual] = useState(true);
  const [showSosial, setShowSosial] = useState(true);
  const [showAttendance, setShowAttendance] = useState(true);
  const [showCatatan, setShowCatatan] = useState(true);
  const [fontFamily, setFontFamily] = useState("Times New Roman");
  const [paperSize, setPaperSize] = useState("A4");
  const [tanggalRaport, setTanggalRaport] = useState("17 Juni 2026");
  const [watermarkSize, setWatermarkSize] = useState(440);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.05);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modals / Form States
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherModalError, setTeacherModalError] = useState("");
  const [isSubmittingTeacher, setIsSubmittingTeacher] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: "",
    username: "",
    password: "",
    subject: "IPA",
    isWaliKelas: false,
    kelas: "",
  });

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentModalError, setStudentModalError] = useState("");
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: "",
    nisn: "",
    kelas: "7",
  });

  // Batch student import state
  const [isBatchStudentModalOpen, setIsBatchStudentModalOpen] = useState(false);
  const [batchRawText, setBatchRawText] = useState("");
  const [batchDefaultClass, setBatchDefaultClass] = useState("7");
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    success: boolean;
    addedCount: number;
    duplicatesCount: number;
    duplicates: string[];
    errors: string[];
  } | null>(null);

  // Student filtering & search
  const [studentClassFilter, setStudentClassFilter] = useState<string>("all");
  const [studentSearch, setStudentSearch] = useState<string>("");

  // Memoized live parsing of batch input
  const parsedBatchStudents = React.useMemo(() => {
    if (!batchRawText.trim()) return [];
    const lines = batchRawText.split(/\r?\n/);
    const existingNisns = new Set(students.map((s) => String(s.nisn || "").trim()));
    const seenBatchNisns = new Set<string>();

    const results: {
      rawLine: string;
      nisn: string;
      name: string;
      kelas: string;
      status: "valid" | "duplicate_db" | "duplicate_batch" | "invalid_nisn" | "invalid_name";
      message: string;
    }[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Check if header row
      const lower = line.toLowerCase();
      if (
        (lower.includes("nisn") && (lower.includes("nama") || lower.includes("name"))) ||
        (lower.includes("no") && lower.includes("siswa"))
      ) {
        continue;
      }

      // Delimiter detection
      let tokens: string[] = [];
      if (line.includes("\t")) {
        tokens = line.split("\t");
      } else if (line.includes(";")) {
        tokens = line.split(";");
      } else if (line.includes("|")) {
        tokens = line.split("|");
      } else if (line.includes(",")) {
        tokens = line.split(",");
      } else {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          tokens = [parts[0], parts.slice(1).join(" ")];
        } else {
          tokens = [line];
        }
      }

      tokens = tokens.map((t) => t.trim()).filter((t) => t.length > 0);
      if (tokens.length === 0) continue;

      let nisn = "";
      let name = "";
      let kelas = batchDefaultClass;

      if (tokens.length === 1) {
        name = tokens[0];
      } else if (tokens.length === 2) {
        const d0 = tokens[0].replace(/\D/g, "");
        const d1 = tokens[1].replace(/\D/g, "");
        if (d0.length >= 4 && d1.length < 4) {
          nisn = d0;
          name = tokens[1];
        } else if (d1.length >= 4 && d0.length < 4) {
          nisn = d1;
          name = tokens[0];
        } else {
          nisn = d0 || tokens[0];
          name = tokens[1];
        }
      } else if (tokens.length === 3) {
        if (/^\d{1,3}$/.test(tokens[0]) && tokens[1].replace(/\D/g, "").length >= 4) {
          nisn = tokens[1].replace(/\D/g, "");
          name = tokens[2];
        } else {
          nisn = tokens[0].replace(/\D/g, "");
          name = tokens[1];
          const k = tokens[2].replace(/\D/g, "");
          if (["7", "8", "9"].includes(k)) kelas = k;
          else kelas = tokens[2];
        }
      } else if (tokens.length >= 4) {
        nisn = tokens[1].replace(/\D/g, "");
        name = tokens[2];
        const k = tokens[3].replace(/\D/g, "");
        if (["7", "8", "9"].includes(k)) kelas = k;
        else kelas = tokens[3];
      }

      // Live validation
      if (!name) {
        results.push({
          rawLine,
          nisn,
          name: "-",
          kelas,
          status: "invalid_name",
          message: "Nama siswa kosong",
        });
      } else if (!nisn || nisn.length < 4) {
        results.push({
          rawLine,
          nisn,
          name,
          kelas,
          status: "invalid_nisn",
          message: "NISN tidak valid (min. 4 angka)",
        });
      } else if (existingNisns.has(nisn)) {
        results.push({
          rawLine,
          nisn,
          name,
          kelas,
          status: "duplicate_db",
          message: "NISN sudah ada di database",
        });
      } else if (seenBatchNisns.has(nisn)) {
        results.push({
          rawLine,
          nisn,
          name,
          kelas,
          status: "duplicate_batch",
          message: "NISN duplikat di teks ini",
        });
      } else {
        seenBatchNisns.add(nisn);
        results.push({
          rawLine,
          nisn,
          name,
          kelas,
          status: "valid",
          message: "Siap disimpan",
        });
      }
    }

    return results;
  }, [batchRawText, batchDefaultClass, students]);

  const fillSampleBatchData = () => {
    const sample = `0012984101\tAhmad Fauzi Ramadhan\t7
0012984102\tAisyah Putri Azzahra\t7
0012984103\tBilal Al-Ghifari\t7
0012984104\tFatimah Az-Zahra\t8
0012984105\tMuhammad Farhan Hakim\t8
0012984106\tZahra Nurul Izzah\t9`;
    setBatchRawText(sample);
  };

  const handleBatchStudentSubmit = async () => {
    const validStudents = parsedBatchStudents
      .filter((p) => p.status === "valid")
      .map((p) => ({
        nisn: p.nisn,
        name: p.name,
        kelas: p.kelas || batchDefaultClass || "7",
      }));

    if (validStudents.length === 0) {
      alert("Tidak ada baris siswa yang valid untuk disimpan.");
      return;
    }

    setIsSubmittingBatch(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/students/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: validStudents }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengimpor siswa.");
      }

      setBatchResult({
        success: true,
        addedCount: data.addedCount || validStudents.length,
        duplicatesCount: data.duplicatesCount || 0,
        duplicates: data.duplicates || [],
        errors: data.errors || [],
      });

      await fetchAllData();
      onRefreshTrigger();
      showSuccess(`Berhasil menginput ${data.addedCount || validStudents.length} siswa baru sekaligus!`);
      setBatchRawText("");
    } catch (err: any) {
      setBatchResult({
        success: false,
        addedCount: 0,
        duplicatesCount: 0,
        duplicates: [],
        errors: [err.message || "Gagal menginput siswa."],
      });
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const filteredStudents = React.useMemo(() => {
    return students.filter((s) => {
      const matchClass =
        studentClassFilter === "all" ||
        String(s.kelas).trim() === studentClassFilter;
      const q = studentSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        String(s.nisn).includes(q);
      return matchClass && matchSearch;
    });
  }, [students, studentClassFilter, studentSearch]);

  const [tpForm, setTpForm] = useState({
    subject: "IPA",
    text: "",
    kelas: "7",
  });
  const [tpFilterClass, setTpFilterClass] = useState<"all" | "7" | "8" | "9">("all");

  const [newEkskulName, setNewEkskulName] = useState("");
  const [newEkskulType, setNewEkskulType] = useState<"Wajib" | "Pilihan">(
    "Pilihan",
  );
  const [ekskulLoading, setEkskulLoading] = useState(false);

  const handleAddEkskul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEkskulName.trim()) return;
    setError("");
    setEkskulLoading(true);
    try {
      const res = await fetch("/api/ekskul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEkskulName.trim(),
          type: newEkskulType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah ekskul.");
      setNewEkskulName("");
      setNewEkskulType("Pilihan");
      await fetchAllData();
      showSuccess("Ekstrakurikuler berhasil ditambahkan!");
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan.");
    } finally {
      setEkskulLoading(false);
    }
  };

  const handleDeleteEkskul = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus ekstrakurikuler ini?"))
      return;
    setError("");
    try {
      const res = await fetch(`/api/ekskul/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus.");
      await fetchAllData();
      showSuccess("Ekstrakurikuler berhasil dihapus.");
    } catch (err: any) {
      setError(err.message || "Gagal menghapus.");
    }
  };

  // Fetch all starting info
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [resT, resS, resTp, resSet, resEks] = await Promise.all([
        fetch("/api/teachers"),
        fetch("/api/students"),
        fetch("/api/tps"),
        fetch("/api/settings"),
        fetch("/api/ekskul"),
      ]);

      const tData = await resT.json();
      const sData = await resS.json();
      const tpData = await resTp.json();
      const setData = await resSet.json();
      const eksData = await resEks.json();

      if (Array.isArray(tData)) setTeachers(tData);
      if (Array.isArray(sData)) setStudents(sData);
      if (tpData && typeof tpData === "object" && !Array.isArray(tpData)) setTpsTemplates(tpData);
      if (Array.isArray(eksData)) setEkskuls(eksData);
      if (setData && typeof setData === "object") {
        if (setData.principalName) {
          setPrincipalName(setData.principalName);
        }
        if (setData.principalNip) {
          setPrincipalNip(setData.principalNip);
        }
        if (setData.format) {
          setSemesterName(setData.format.semesterName || "Ganjil");
          setTahunPelajaran(setData.format.tahunPelajaran || "2026/2027");
          setFontSize(setData.format.fontSize || "11pt");
          setShowLogo(setData.format.showLogo || false);
          setShowSpiritual(
            setData.format.showSpiritual !== undefined
              ? setData.format.showSpiritual
              : true,
          );
          setShowSosial(
            setData.format.showSosial !== undefined
              ? setData.format.showSosial
              : true,
          );
          setShowAttendance(
            setData.format.showAttendance !== undefined
              ? setData.format.showAttendance
              : true,
          );
          setShowCatatan(
            setData.format.showCatatan !== undefined
              ? setData.format.showCatatan
              : true,
          );
          setFontFamily(setData.format.fontFamily || "Times New Roman");
          setPaperSize(setData.format.paperSize || "A4");
          setTanggalRaport(setData.format.tanggalRaport || "17 Juni 2026");
          setWatermarkSize(
            setData.format.watermarkSize !== undefined
              ? Number(setData.format.watermarkSize)
              : 440,
          );
          setWatermarkOpacity(
            setData.format.watermarkOpacity !== undefined
              ? Number(setData.format.watermarkOpacity)
              : 0.05,
          );
        }
      }
    } catch (err) {
      setError("Gagal memuat database dari server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [activeTab]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // TEACHER CRUD
  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherModalError("");
    setError("");

    const payload = {
      ...teacherForm,
      name: teacherForm.name.trim(),
      username: teacherForm.username.trim().toLowerCase(),
      password: teacherForm.password.trim(),
      subject: teacherForm.subject.trim(),
      kelas: teacherForm.isWaliKelas ? teacherForm.kelas : "",
    };

    if (!payload.name) {
      setTeacherModalError("Nama lengkap guru wajib diisi.");
      return;
    }
    if (!payload.username) {
      setTeacherModalError("Login username guru wajib diisi.");
      return;
    }
    if (!payload.password) {
      setTeacherModalError("Kata sandi akun guru wajib diisi.");
      return;
    }
    if (!payload.subject) {
      setTeacherModalError("Mata pelajaran guru wajib dipilih.");
      return;
    }
    if (payload.isWaliKelas && !payload.kelas) {
      setTeacherModalError("Silakan pilih kelas asuhan untuk wali kelas (Kelas 7, 8, atau 9).");
      return;
    }

    setIsSubmittingTeacher(true);
    try {
      const url = editingTeacher
        ? `/api/teachers/${editingTeacher.id}`
        : "/api/teachers";
      const method = editingTeacher ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan rincian guru.");
      }

      await fetchAllData();
      onRefreshTrigger();
      setIsTeacherModalOpen(false);
      setEditingTeacher(null);
      setTeacherModalError("");
      setTeacherForm({
        name: "",
        username: "",
        password: "",
        subject: "IPA",
        isWaliKelas: false,
        kelas: "",
      });
      showSuccess(
        editingTeacher
          ? "Data guru berhasil diperbarui!"
          : "Guru baru berhasil ditambahkan!",
      );
    } catch (err: any) {
      setTeacherModalError(err.message || "Terjadi kesalahan saat menyimpan data guru.");
      setError(err.message || "Terjadi kesalahan saat menyimpan data guru.");
    } finally {
      setIsSubmittingTeacher(false);
    }
  };

  const startEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setTeacherModalError("");
    setTeacherForm({
      name: t.name,
      username: t.username,
      password: t.password || "123",
      subject: t.subject,
      isWaliKelas: t.isWaliKelas,
      kelas: t.kelas || "",
    });
    setIsTeacherModalOpen(true);
  };

  const deleteTeacher = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus akun guru ini?")) return;
    setError("");

    try {
      const response = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghapus guru.");

      await fetchAllData();
      onRefreshTrigger();
      showSuccess("Guru berhasil dihapus.");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    }
  };

  // STUDENT CRUD
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentModalError("");
    setError("");

    const payload = {
      ...studentForm,
      name: studentForm.name.trim(),
      nisn: studentForm.nisn.trim().replace(/\D/g, ""),
      kelas: studentForm.kelas.trim(),
    };

    if (!payload.name) {
      setStudentModalError("Nama lengkap siswa wajib diisi.");
      return;
    }
    if (!payload.nisn) {
      setStudentModalError("NISN siswa wajib diisi (numerik angka).");
      return;
    }
    if (!payload.kelas) {
      setStudentModalError("Kelas siswa wajib dipilih (7, 8, atau 9).");
      return;
    }

    setIsSubmittingStudent(true);
    try {
      const url = editingStudent
        ? `/api/students/${editingStudent.id}`
        : "/api/students";
      const method = editingStudent ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan rincian siswa.");
      }

      await fetchAllData();
      onRefreshTrigger();
      setIsStudentModalOpen(false);
      setEditingStudent(null);
      setStudentModalError("");
      setStudentForm({
        name: "",
        nisn: "",
        kelas: "7",
      });
      showSuccess(
        editingStudent
          ? "Data siswa berhasil diperbarui!"
          : "Siswa baru berhasil ditambahkan!",
      );
    } catch (err: any) {
      setStudentModalError(err.message || "Terjadi kesalahan saat menyimpan data siswa.");
      setError(err.message || "Terjadi kesalahan saat menyimpan data siswa.");
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const startEditStudent = (s: Student) => {
    setEditingStudent(s);
    setStudentModalError("");
    setStudentForm({
      name: s.name,
      nisn: s.nisn,
      kelas: s.kelas,
    });
    setIsStudentModalOpen(true);
  };

  const deleteStudent = async (id: string) => {
    if (
      !confirm(
        "Menghapus siswa ini juga akan menghapus seluruh data nilai dan catatan wali kelasnya. Lanjutkan?",
      )
    )
      return;
    setError("");

    try {
      const response = await fetch(`/api/students/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghapus siswa.");

      await fetchAllData();
      onRefreshTrigger();
      showSuccess("Siswa dihapus bersama relasi nilainya.");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    }
  };

  // Objectives (TP) Adding
  const addTpObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpForm.text) return;
    setError("");

    try {
      const response = await fetch("/api/tps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: tpForm.subject,
          tpText: tpForm.text,
          kelas: tpForm.kelas || "7",
        }),
      });

      if (!response.ok) throw new Error("Gagal menambah Tujuan Pembelajaran.");

      setTpForm((prev) => ({ ...prev, text: "" }));
      await fetchAllData();
      showSuccess(`Tujuan Pembelajaran untuk Kelas ${tpForm.kelas} berhasil ditambahkan!`);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    }
  };

  const deleteTpObjective = async (subject: string, tpId: string) => {
    if (!confirm("Hapus Tujuan Pembelajaran (TP) template ini?")) return;
    setError("");

    try {
      const response = await fetch(`/api/tps/${subject}/${tpId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Gagal menghapus tujuan pembelajaran.");

      await fetchAllData();
      showSuccess("Tujuan Pembelajaran berhasil dihapus!");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSettingsLoading(true);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principalName,
          principalNip,
          format: {
            semesterName,
            tahunPelajaran,
            fontSize,
            showLogo,
            showSpiritual,
            showSosial,
            showAttendance,
            showCatatan,
            fontFamily,
            paperSize,
            tanggalRaport,
            watermarkSize,
            watermarkOpacity,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Gagal menyimpan rincian kepala sekolah.",
        );

      showSuccess("Rincian Kepala Sekolah berhasil diperbarui!");
      onRefreshTrigger();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div className="space-y-4" id="admin-panel">
      {/* Messages */}
      {error && (
        <div className="p-2.5 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-700 flex gap-2 items-start shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-green-50 border-l-4 border-green-500 text-green-800 rounded text-xs font-bold transition-all animate-fade-in shadow-2xs">
          🎉 {successMsg}
        </div>
      )}

      {/* Admin Tab Headers */}
      <div
        className="flex border-b border-slate-200 gap-1 overflow-x-auto"
        id="admin-nav-tabs"
      >
        <button
          onClick={() => setActiveTab("teachers")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "teachers" ? "border-emerald-850 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-805"}`}
        >
          <Users className="w-3.5 h-3.5" /> Manajemen Guru
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "students" ? "border-emerald-850 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-805"}`}
        >
          <GraduationCap className="w-3.5 h-3.5" /> Manajemen Siswa
        </button>
        <button
          onClick={() => setActiveTab("tps")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "tps" ? "border-emerald-850 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-805"}`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Template TP (Mata Pelajaran)
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "settings" ? "border-emerald-850 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-805"}`}
        >
          <UserCheck className="w-3.5 h-3.5" /> Pengaturan Raport
        </button>
        <button
          onClick={() => setActiveTab("ekskul")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "ekskul" ? "border-emerald-850 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-805"}`}
        >
          <Award className="w-3.5 h-3.5" /> Manajemen Ekskul
        </button>
      </div>

      {/* TEACHERS TAB */}
      {activeTab === "teachers" && (
        <div
          className="bg-white rounded-lg border border-slate-205 shadow-sm p-4"
          id="teacher-management-panel"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Guru & Hak Akses
              </h2>
              <p className="text-[10px] text-slate-400">
                Kelola akun guru mata pelajaran, hak wali kelas, dan sandi
                sistem keamanan masuk
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTeacher(null);
                setTeacherModalError("");
                setTeacherForm({
                  name: "",
                  username: "",
                  password: "123",
                  subject: SUBJECT_LIST[0] || "PAI",
                  isWaliKelas: false,
                  kelas: "",
                });
                setIsTeacherModalOpen(true);
              }}
              className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs font-bold rounded flex items-center gap-1 shadow-xs cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Guru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    Nama Guru
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    Login Username
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    Keamanan Sandi
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    Mata Pelajaran (Mapel)
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    Tugas Wali Kelas
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/30">
                    <td className="p-3 font-bold text-gray-850">{t.name}</td>
                    <td className="p-3 font-mono text-emerald-800">
                      {t.username}
                    </td>
                    <td className="p-3 font-mono text-gray-400 font-bold">
                      &#8226;&#8226;&#8226;&#8226;&#8226;&#8226;
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${t.subject === "Admin" ? "bg-red-150 text-red-800" : "bg-emerald-100 text-emerald-900"}`}
                      >
                        {t.subject}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {t.isWaliKelas ? (
                        <span className="text-green-700 bg-green-50 border border-green-200 py-0.5 px-2.5 rounded-full font-semibold">
                          Wali Kelas {t.kelas}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Bukan Wali</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {t.id === "t1" ? (
                        <span className="text-2xs text-gray-400 italic bg-gray-50 p-1 rounded">
                          Utama
                        </span>
                      ) : (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => startEditTeacher(t)}
                            className="p-1 text-sky-650 hover:bg-sky-50 rounded transition cursor-pointer"
                            title="Edit Guru"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTeacher(t.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STUDENTS TAB */}
      {activeTab === "students" && (
        <div
          className="bg-white rounded-lg border border-slate-200 shadow-sm p-4"
          id="student-management-panel"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar & Manajemen Siswa SMP
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold font-mono">
                  {students.length} Total Siswa
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Kelola data siswa, NISN, dan pembagian kelas siswa secara individual atau massal
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBatchResult(null);
                  setIsBatchStudentModalOpen(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition"
              >
                <FileSpreadsheet className="w-4 h-4" /> Input Banyak Siswa Sekaligus
              </button>
              <button
                onClick={() => {
                  setEditingStudent(null);
                  setStudentForm({
                    name: "",
                    nisn: "",
                    kelas: "7",
                  });
                  setIsStudentModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 active:bg-black text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Satu Siswa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {/* Total Siswa Card */}
            <div
              onClick={() => setStudentClassFilter("all")}
              className={`p-2.5 rounded-lg border transition cursor-pointer ${
                studentClassFilter === "all"
                  ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-emerald-900 text-xs font-black block">
                    Semua Siswa
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                    Total Terdaftar
                  </span>
                </div>
                <span className="text-base font-black text-emerald-800 font-mono">
                  {students.length}
                </span>
              </div>
            </div>

            {/* Quick Filter Info Cards for Classes 7, 8, 9 */}
            {["7", "8", "9"].map((cls) => {
              const count = students.filter(
                (s) => String(s.kelas || "").trim() === cls
              ).length;
              const isSelected = studentClassFilter === cls;
              return (
                <div
                  key={cls}
                  onClick={() => setStudentClassFilter(isSelected ? "all" : cls)}
                  className={`p-2.5 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 border-blue-400 ring-2 ring-blue-200"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-blue-900 text-xs font-black block">
                        Kelas {cls}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                        Siswa Terdaftar
                      </span>
                    </div>
                    <span className="text-base font-black text-slate-800 font-mono">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-3">
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
              {[
                { id: "all", label: `Semua (${students.length})` },
                { id: "7", label: `Kelas 7 (${students.filter(s => String(s.kelas).trim() === "7").length})` },
                { id: "8", label: `Kelas 8 (${students.filter(s => String(s.kelas).trim() === "8").length})` },
                { id: "9", label: `Kelas 9 (${students.filter(s => String(s.kelas).trim() === "9").length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStudentClassFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer shrink-0 ${
                    studentClassFilter === tab.id
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Cari nama atau NISN..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider w-12 text-center">
                    No
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    Nama Siswa
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    NISN Siswa
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider">
                    Kelas
                  </th>
                  <th className="p-3 font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 text-xs">
                      Tidak ada data siswa yang cocok dengan filter atau pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="p-3 text-center text-gray-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-bold text-gray-800">{s.name}</td>
                      <td className="p-3 font-mono text-gray-500">{s.nisn}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-850 border border-emerald-200 rounded text-xs font-bold font-mono">
                          Kelas {s.kelas}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => startEditStudent(s)}
                            className="p-1 text-sky-650 hover:bg-sky-50 rounded transition cursor-pointer"
                            title="Edit Siswa"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteStudent(s.id)}
                            className="p-1 text-red-650 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TPS (MATA PELAJARAN / LEARNING OBJECTIVES TEMPLATES) TAB */}
      {activeTab === "tps" && (
        <div
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6 animate-fade-in"
          id="tp-templates-panel"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>Template Capaian / Tujuan Pembelajaran (TP)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Berdasarkan Kelas
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Setiap tingkat rombel (Kelas 7, 8, dan 9) memiliki Capaian Pembelajaran dan TP spesifik sesuai Kurikulum Merdeka.
              </p>
            </div>

            {/* Filter by class buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                Filter:
              </span>
              {[
                { id: "all", label: "Semua Tingkat" },
                { id: "7", label: "Kelas 7" },
                { id: "8", label: "Kelas 8" },
                { id: "9", label: "Kelas 9" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTpFilterClass(tab.id as any);
                    if (tab.id !== "all") {
                      setTpForm((prev) => ({ ...prev, kelas: tab.id }));
                    }
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                    tpFilterClass === tab.id
                      ? "bg-white text-emerald-850 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form to add new TP with class selector */}
          <form
            onSubmit={addTpObjective}
            className="p-4 bg-emerald-50/70 border border-emerald-150 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end shadow-3xs"
          >
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-1.5">
                Mata Pelajaran
              </label>
              <select
                value={tpForm.subject}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, subject: e.target.value }))
                }
                className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 transition"
              >
                {SUBJECT_LIST.map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-1.5">
                Tingkat Kelas
              </label>
              <select
                value={tpForm.kelas}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, kelas: e.target.value }))
                }
                className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 font-bold text-slate-800 transition"
              >
                <option value="7">Kelas 7</option>
                <option value="8">Kelas 8</option>
                <option value="9">Kelas 9</option>
                <option value="all">Semua Kelas</option>
              </select>
            </div>

            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-1.5">
                Deskripsi Ringkas Tujuan Pembelajaran (TP)
              </label>
              <input
                type="text"
                value={tpForm.text}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="Contoh: Mengidentifikasi rumus kuadratik dan diagram koordinat..."
                className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 transition"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Simpan TP
              </button>
            </div>
          </form>

          {/* Group display of subject templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {SUBJECT_LIST.map((subject) => {
              const allItems = tpsTemplates[subject] || [];
              const items =
                tpFilterClass === "all"
                  ? allItems
                  : allItems.filter(
                      (item: any) =>
                        String(item.kelas || "").trim() === tpFilterClass
                    );

              return (
                <div
                  key={subject}
                  className="bg-white rounded-xl border border-gray-150 p-4 shadow-3xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5 mb-3">
                      <span className="px-3 py-1 bg-emerald-800 text-white rounded text-2xs uppercase tracking-wider font-bold">
                        {subject}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-semibold">
                        {items.length} TP {tpFilterClass !== "all" ? `(Kelas ${tpFilterClass})` : "Total"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-2xs text-gray-450 italic py-3 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                          Belum ada tujuan pembelajaran {tpFilterClass !== "all" ? `untuk Kelas ${tpFilterClass}` : ""} pada mapel ini.
                        </p>
                      ) : (
                        items.map((item) => {
                          const itemClass = String(item.kelas || "7").trim();
                          const badgeColor =
                            itemClass === "7"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : itemClass === "8"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : itemClass === "9"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-700 border-slate-200";

                          return (
                            <div
                              key={item.id}
                              className="p-2.5 bg-gray-50/60 rounded-lg border border-gray-150 flex items-start justify-between gap-3 text-xs hover:bg-emerald-50/20 hover:border-emerald-200 transition"
                            >
                              <div className="flex-1 space-y-1">
                                <p className="text-gray-800 leading-relaxed text-justify">
                                  {item.text}
                                </p>
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${badgeColor}`}
                                >
                                  {itemClass === "all" ? "Semua Kelas" : `Kelas ${itemClass}`}
                                </span>
                              </div>
                              <button
                                onClick={() => deleteTpObjective(subject, item.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer shrink-0 mt-0.5"
                                title="Hapus TP"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SETTINGS (PENGATURAN RAPORT) TAB */}
      {activeTab === "settings" && (
        <div
          className="bg-white rounded-xl border border-gray-150 shadow-sm p-6 max-w-2xl animate-fade-in"
          id="school-settings-panel"
        >
          <div className="mb-6">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span>Pengaturan Format & Atribut Raport</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Akses Admin
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 mt-1">
              Sesuaikan identitas, tampilan, font, ukuran, serta bagian-bagian
              format yang ingin ditampilkan pada cetak raport siswa.
            </p>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-6">
            {/* Bagian 1: Identitas Kepala Sekolah */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                1. Identitas Penandatangan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Nama Kepala Sekolah & Gelar
                  </label>
                  <input
                    type="text"
                    required
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="Contoh: Ustadz H. Ir. Abdul Muhyi, M.Pd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    required
                    value={principalNip}
                    onChange={(e) => setPrincipalNip(e.target.value)}
                    placeholder="Contoh: 19780512 200501 1 002"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Kustomisasi Teks & Sesi */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                2. Informasi Semester, Tahun Pelajaran & Tanggal Rapor
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Nama Semester
                  </label>
                  <input
                    type="text"
                    required
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                    placeholder="Contoh: Ganjil"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Tahun Pelajaran
                  </label>
                  <input
                    type="text"
                    required
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    placeholder="Contoh: 2026/2027"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Tanggal Pembagian Raport
                  </label>
                  <input
                    type="text"
                    required
                    value={tanggalRaport}
                    onChange={(e) => setTanggalRaport(e.target.value)}
                    placeholder="Contoh: 17 Juni 2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 3: Tata Letak & Gaya */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                3. Gaya & Desain Cetak
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Jenis Font Word/Cetak
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  >
                    <option value="Times New Roman">
                      Times New Roman (Formal)
                    </option>
                    <option value="Arial">Arial (Modern & Bersih)</option>
                    <option value="Georgia">Georgia (Elegan & Klasik)</option>
                    <option value="Courier New">Courier New (Monospace)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Ukuran Font Dasar
                  </label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  >
                    <option value="10pt">Sangat Kecil (10pt)</option>
                    <option value="11pt">Standar (11pt)</option>
                    <option value="12pt">Besar (12pt)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Ukuran Kertas Raport
                  </label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  >
                    <option value="A4">A4 (Standard 21.0 x 29.7 cm)</option>
                    <option value="F4">
                      F4 / Folio (Sekolah 21.5 x 33.0 cm)
                    </option>
                    <option value="Letter">
                      Letter (Standard 21.59 x 27.94 cm)
                    </option>
                    <option value="Legal">
                      Legal (Standard 21.59 x 35.56 cm)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bagian 4: Visibilitas Komponen */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                4. Visibilitas Elemen Raport
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => setShowLogo(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Logo Kop Sekolah</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={showSpiritual}
                    onChange={(e) => setShowSpiritual(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Aspek Sikap Spiritual</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={showSosial}
                    onChange={(e) => setShowSosial(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Aspek Sikap Sosial</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={showAttendance}
                    onChange={(e) => setShowAttendance(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Presensi Kehadiran</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition text-nowrap">
                  <input
                    type="checkbox"
                    checked={showCatatan}
                    onChange={(e) => setShowCatatan(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Catatan Wali Kelas</span>
                </label>
              </div>
            </div>

            {/* Bagian 5: Pengaturan Watermark */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                5. Pengaturan Watermark
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Ukuran Watermark Raport
                  </label>
                  <select
                    value={watermarkSize}
                    onChange={(e) => setWatermarkSize(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value={300}>Kecil (300px)</option>
                    <option value={380}>Sedang (380px)</option>
                    <option value={440}>Standar (440px)</option>
                    <option value={500}>Besar (500px)</option>
                    <option value={580}>Sangat Besar (580px)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Transparansi Watermark
                  </label>
                  <select
                    value={watermarkOpacity}
                    onChange={(e) =>
                      setWatermarkOpacity(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value={0.03}>Sangat Tipis (3%)</option>
                    <option value={0.05}>Tipis (5%)</option>
                    <option value={0.075}>Standar (7.5%)</option>
                    <option value={0.1}>Sedang (10%)</option>
                    <option value={0.15}>Tebal (15%)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={settingsLoading}
                className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {settingsLoading ? "Saving..." : "Simpan Format Raport"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EXTRACURRICULAR (EKSKUL) TAB */}
      {activeTab === "ekskul" && (
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in"
          id="ekskul-management-panel"
        >
          {/* Form to add new Ekskul */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-fit">
            <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-800" />
              <span>Tambah Ekskul Baru</span>
            </h2>
            <p className="text-[10px] text-slate-400 mb-4">
              Tambahkan nama dan tentukan tipe kegiatan ekstrakurikuler baru ke
              dalam daftar sekolah.
            </p>

            <form onSubmit={handleAddEkskul} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Nama Kegiatan
                </label>
                <input
                  type="text"
                  required
                  value={newEkskulName}
                  onChange={(e) => setNewEkskulName(e.target.value)}
                  placeholder="Contoh: Futsal, Voli, Pramuka"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Tipe Ekstrakurikuler
                </label>
                <select
                  value={newEkskulType}
                  onChange={(e) =>
                    setNewEkskulType(e.target.value as "Wajib" | "Pilihan")
                  }
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                >
                  <option value="Wajib">Wajib (Compulsory)</option>
                  <option value="Pilihan">Pilihan (Elective)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={ekskulLoading || !newEkskulName.trim()}
                className="w-full py-2 bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-xs rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                {ekskulLoading ? "Menyimpan..." : "Tambahkan Ekskul"}
              </button>
            </form>
          </div>

          {/* List of existing Ekskuls */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Kegiatan Ekstrakurikuler ({ekskuls.length})
              </h2>
              <p className="text-[10px] text-slate-400">
                Daftar kegiatan ekstrakurikuler yang aktif dan dapat dinilai
                oleh Wali Kelas pada rapor siswa.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-550 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3 text-[10px]">No</th>
                    <th className="py-2.5 px-3 text-[10px]">
                      Nama Ekstrakurikuler
                    </th>
                    <th className="py-2.5 px-3 text-[10px]">Tipe</th>
                    <th className="py-2.5 px-3 text-[10px] text-center">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ekskuls.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-400 italic"
                      >
                        Belum ada kegiatan ekstrakurikuler. Silakan tambahkan di
                        form sebelah kiri.
                      </td>
                    </tr>
                  ) : (
                    ekskuls.map((e, idx) => (
                      <tr
                        key={e.id}
                        className="hover:bg-slate-50/50 transition"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-405">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {e.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${e.type === "Wajib" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-sky-100 text-sky-800 border border-sky-200"}`}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteEkskul(e.id)}
                            className="p-1 hover:bg-red-50 text-red-500 rounded transition cursor-pointer"
                            title="Hapus Ekstrakurikuler"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER MODAL FORM */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-up">
            <div className="bg-emerald-800 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide">
                {editingTeacher ? "Edit Akun Guru" : "Tambah Guru Baru"}
              </h3>
              <button
                onClick={() => setIsTeacherModalOpen(false)}
                className="text-white/85 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTeacherSubmit} className="p-6 space-y-4">
              {teacherModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex gap-2 items-start animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span className="font-semibold">{teacherModalError}</span>
                </div>
              )}

              {/* Petunjuk Guru Multi-Mapel */}
              <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 rounded-r-lg text-2xs md:text-xs text-emerald-800 leading-relaxed space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px]">
                  Panduan Guru Multi-Mapel:
                </p>
                <p>
                  Nama lengkap diperbolehkan sama persis. Jika guru mengampu
                  beberapa mata pelajaran sekaligus, silakan buat akun tambahan
                  untuk tiap mapel dengan{" "}
                  <strong>Login Username yang berbeda</strong> (contoh:{" "}
                  <code className="bg-emerald-100/80 px-1 rounded">
                    budi_ipa
                  </code>{" "}
                  dan{" "}
                  <code className="bg-emerald-100/80 px-1 rounded">
                    budi_ips
                  </code>
                  ).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                  Nama Lengkap & Gelar
                </label>
                <input
                  type="text"
                  required
                  value={teacherForm.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setTeacherForm((prev) => {
                      const updated = { ...prev, name: newName };
                      // If adding new teacher and username is still empty or default, suggest clean username
                      if (!editingTeacher && (!prev.username || prev.username === "")) {
                        const clean = newName
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, "")
                          .substring(0, 12);
                        if (clean) updated.username = clean;
                      }
                      return updated;
                    });
                  }}
                  placeholder="Contoh: Dr. H. Slamet, M.Pd"
                  className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                  id="teacher-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                    Login Username
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherForm.username}
                    onChange={(e) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                      }))
                    }
                    placeholder="nama_panggil"
                    className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white font-mono text-xs"
                    id="teacher-username-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                    Masuk/PIN Sandi
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherForm.password}
                    onChange={(e) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="Sandi Akun"
                    className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                    id="teacher-password-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                  Mata Pelajaran yang Diampu
                </label>
                <select
                  value={teacherForm.subject}
                  onChange={(e) =>
                    setTeacherForm((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                  id="teacher-subject-select"
                >
                  {SUBJECT_LIST.map((sub, i) => (
                    <option key={i} value={sub}>
                      {sub}
                    </option>
                  ))}
                  <option value="Admin">Hanya Admin</option>
                </select>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={teacherForm.isWaliKelas}
                    onChange={(e) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        isWaliKelas: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300 text-emerald-800 focus:ring-emerald-500"
                  />
                  <span>Tugaskan sebagai Wali Kelas</span>
                </label>
              </div>

              {teacherForm.isWaliKelas && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-150 animate-fade-in">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Kelas yang Diajar & Asuh
                  </label>
                  <select
                    value={teacherForm.kelas}
                    onChange={(e) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        kelas: e.target.value,
                      }))
                    }
                    className="w-full p-2 bg-white border border-gray-250 rounded text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={isSubmittingTeacher}
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="w-1/2 py-2.5 border border-gray-250 text-gray-650 hover:bg-gray-50 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTeacher}
                  className="w-1/2 py-2.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                >
                  {isSubmittingTeacher ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT MODAL FORM */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-up">
            <div className="bg-emerald-800 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide">
                {editingStudent ? "Edit Identitas Siswa" : "Tambah Siswa Baru"}
              </h3>
              <button
                onClick={() => setIsStudentModalOpen(false)}
                className="text-white/85 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStudentSubmit} className="p-6 space-y-4">
              {studentModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex gap-2 items-start animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span className="font-semibold">{studentModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={studentForm.name}
                  onChange={(e) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Contoh: Muhammad Al-Farabi"
                  className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                  id="student-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                  NISN Siswa (Nomor Induk Nasional)
                </label>
                <input
                  type="text"
                  required
                  value={studentForm.nisn}
                  onChange={(e) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      nisn: e.target.value,
                    }))
                  }
                  placeholder="Contoh: 0134988712"
                  className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                  id="student-nisn-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                  Kelas / Rombongan Belajar
                </label>
                <select
                  value={studentForm.kelas}
                  onChange={(e) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      kelas: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                  id="student-class-select"
                >
                  <option value="7">Kelas 7</option>
                  <option value="8">Kelas 8</option>
                  <option value="9">Kelas 9</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={isSubmittingStudent}
                  onClick={() => setIsStudentModalOpen(false)}
                  className="w-1/2 py-2.5 border border-gray-250 text-gray-650 hover:bg-gray-50 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStudent}
                  className="w-1/2 py-2.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                >
                  {isSubmittingStudent ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH STUDENT IMPORT MODAL */}
      {isBatchStudentModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-scale-up my-6">
            {/* Modal Header */}
            <div className="bg-emerald-850 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-700/60 border border-emerald-500/40 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wide">
                    Input Siswa Secara Massal (Banyak Sekaligus)
                  </h3>
                  <p className="text-[11px] text-emerald-200 font-normal">
                    Salin & tempel baris dari Excel, Google Sheets, atau CSV tanpa perlu input satu per satu
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsBatchStudentModalOpen(false);
                  setBatchResult(null);
                }}
                className="text-white/80 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Batch Result Banner */}
              {batchResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    batchResult.success
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "bg-red-50 border-red-300 text-red-900"
                  }`}
                >
                  {batchResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold">
                      {batchResult.success
                        ? `Alhamdulillah! Berhasil menambahkan ${batchResult.addedCount} siswa baru ke sistem.`
                        : "Gagal menyimpan data siswa massal."}
                    </p>
                    {batchResult.duplicatesCount > 0 && (
                      <p className="text-[11px] text-amber-800 font-medium">
                        Catatan: {batchResult.duplicatesCount} siswa dilewati karena NISN sudah terdaftar.
                      </p>
                    )}
                    {batchResult.errors.length > 0 && (
                      <div className="text-[11px] text-red-700">
                        {batchResult.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guide and Controls Toolbar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">
                      Kelas Default:
                    </label>
                    <select
                      value={batchDefaultClass}
                      onChange={(e) => setBatchDefaultClass(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="7">Kelas 7</option>
                      <option value="8">Kelas 8</option>
                      <option value="9">Kelas 9</option>
                    </select>
                    <span className="text-[10px] text-slate-400">
                      (Digunakan bila kolom kelas tidak diisi di teks)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fillSampleBatchData}
                      className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" /> Isi Contoh Format
                    </button>
                    {batchRawText && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchRawText("");
                          setBatchResult(null);
                        }}
                        className="px-2.5 py-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" /> Bersihkan
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">
                    Format yang Didukung (Bisa langsung blok & copy dari Excel / Spreadsheet):
                  </span>
                  <div className="font-mono text-[10px] text-slate-600 space-y-0.5">
                    <div>Format 1: <strong className="text-emerald-700">NISN [Tab/Koma] Nama Lengkap Siswa [Tab/Koma] Kelas</strong></div>
                    <div>Format 2: <strong className="text-emerald-700">NISN [Tab/Koma] Nama Lengkap Siswa</strong> (Kelas otomatis ikut Kelas Default)</div>
                  </div>
                </div>
              </div>

              {/* Textarea Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tempelkan (Paste) Teks Data Siswa Di Bawah Ini:
                </label>
                <textarea
                  value={batchRawText}
                  onChange={(e) => {
                    setBatchRawText(e.target.value);
                    if (batchResult) setBatchResult(null);
                  }}
                  rows={6}
                  placeholder={`Contoh tempel (paste):&#10;0012984101\tAhmad Fauzi Ramadhan\t7&#10;0012984102\tAisyah Putri Azzahra\t7&#10;0012984103\tBilal Al-Ghifari\t8`}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-600 focus:bg-white resize-y shadow-inner bg-slate-50/50"
                ></textarea>
              </div>

              {/* Parsing Telemetry Summary */}
              {batchRawText.trim() && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                        Total Baris: {parsedBatchStudents.length}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                        Siap Disimpan: {parsedBatchStudents.filter((p) => p.status === "valid").length}
                      </span>
                      {parsedBatchStudents.some((p) => p.status !== "valid") && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                          Bermasalah / Duplikat: {parsedBatchStudents.filter((p) => p.status !== "valid").length}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Pratinjau Data Sebelum Disimpan
                    </span>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2 font-bold text-slate-600 w-10 text-center">No</th>
                          <th className="p-2 font-bold text-slate-600">NISN</th>
                          <th className="p-2 font-bold text-slate-600">Nama Siswa</th>
                          <th className="p-2 font-bold text-slate-600">Kelas</th>
                          <th className="p-2 font-bold text-slate-600 text-right">Status Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {parsedBatchStudents.map((item, idx) => (
                          <tr
                            key={idx}
                            className={
                              item.status === "valid"
                                ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                                : "bg-red-50/30 hover:bg-red-50/60"
                            }
                          >
                            <td className="p-2 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-700">
                              {item.nisn || "-"}
                            </td>
                            <td className="p-2 font-semibold text-slate-800 truncate max-w-[200px]">
                              {item.name}
                            </td>
                            <td className="p-2 font-mono">
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                                Kelas {item.kelas}
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              {item.status === "valid" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Siap Disimpan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  <AlertCircle className="w-3 h-3 text-amber-600" /> {item.message}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSubmittingBatch}
                  onClick={() => {
                    setIsBatchStudentModalOpen(false);
                    setBatchResult(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={
                    isSubmittingBatch ||
                    parsedBatchStudents.filter((p) => p.status === "valid").length === 0
                  }
                  onClick={handleBatchStudentSubmit}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-40 shadow-sm"
                >
                  {isSubmittingBatch ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        Simpan Semua Siswa Valid (
                        {parsedBatchStudents.filter((p) => p.status === "valid").length} Siswa)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
