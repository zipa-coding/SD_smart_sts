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
  BookMarked,
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
  Loader2,
  Settings,
  UserPlus,
  ClipboardPaste,
  Download,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";

interface AdminPanelProps {
  onRefreshTrigger: () => void;
}

export default function AdminPanel({ onRefreshTrigger }: AdminPanelProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    "teachers" | "students" | "subjects" | "tps" | "settings" | "ekskul"
  >("teachers");

  // State arrays fetched from API
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>(SUBJECT_LIST);
  const [tpsTemplates, setTpsTemplates] = useState<{
    [subject: string]: { id: string; text: string }[];
  }>({});
  const [ekskuls, setEkskuls] = useState<
    { id: string; name: string; type: "Wajib" | "Pilihan" }[]
  >([]);

  // Batch student selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // In-app Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);

  // Subject management state
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");

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
  const [signaturePosition, setSignaturePosition] = useState<"kanan" | "tengah" | "kiri">("kanan");
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
    kelas: "1",
  });

  // Batch student import state
  const [isBatchStudentModalOpen, setIsBatchStudentModalOpen] = useState(false);
  const [batchRawText, setBatchRawText] = useState("");
  const [batchDefaultClass, setBatchDefaultClass] = useState("1");
  const [autoGenerateMissingNisn, setAutoGenerateMissingNisn] = useState(true);
  const [parsedOverrides, setParsedOverrides] = useState<{
    [idx: number]: { name?: string; nisn?: string; kelas?: string; excluded?: boolean };
  }>({});
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

  // Teacher filtering & search
  const [teacherSearch, setTeacherSearch] = useState<string>("");
  const [teacherRoleFilter, setTeacherRoleFilter] = useState<"all" | "wali" | "mapel">("all");

  const filteredTeachers = React.useMemo(() => {
    return teachers.filter((t) => {
      const q = teacherSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        (t.kelas && t.kelas.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (teacherRoleFilter === "wali") return t.isWaliKelas;
      if (teacherRoleFilter === "mapel") return !t.isWaliKelas;
      return true;
    });
  }, [teachers, teacherSearch, teacherRoleFilter]);

  // Memoized live parsing of batch input with ultra-flexible column detection
  const parsedBatchStudents = React.useMemo(() => {
    if (!batchRawText.trim()) return [];
    const lines = batchRawText.split(/\r?\n/);
    const existingNisns = new Set(students.map((s) => String(s.nisn || "").trim()));
    const seenBatchNisns = new Set<string>();

    const results: {
      index: number;
      rawLine: string;
      nisn: string;
      name: string;
      kelas: string;
      isAutoNisn: boolean;
      status: "valid" | "duplicate_db" | "duplicate_batch" | "invalid_nisn" | "invalid_name";
      message: string;
      excluded: boolean;
    }[] = [];

    let autoNisnSeq = 1;
    const baseAutoPrefix = "2601";

    let lineIndex = 0;
    for (const rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;

      // Auto-skip header row
      const lower = line.toLowerCase();
      if (
        (lower.includes("nisn") && (lower.includes("nama") || lower.includes("name") || lower.includes("murid"))) ||
        (lower.includes("no") && (lower.includes("siswa") || lower.includes("nisn") || lower.includes("nama"))) ||
        lower === "nisn\tnama" ||
        lower === "no\tnama"
      ) {
        continue;
      }

      // Check if user manually excluded or modified this row
      const override = parsedOverrides[lineIndex] || {};
      if (override.excluded) {
        results.push({
          index: lineIndex,
          rawLine,
          nisn: override.nisn || "",
          name: override.name || line,
          kelas: override.kelas || batchDefaultClass,
          isAutoNisn: false,
          status: "valid",
          message: "Dilewati (Tidak Disimpan)",
          excluded: true,
        });
        lineIndex++;
        continue;
      }

      // Strip leading list numbering (e.g. "1. Ahmad", "1) Ahmad", "No. 1 Ahmad", "#1 Ahmad")
      const strippedPrefix = line.replace(/^\s*(?:no\.?\s*)?(?:\d+[\.\)\-:]|\#\d+)\s+/i, "");
      if (strippedPrefix && strippedPrefix !== line && !/^\d{8,12}$/.test(line)) {
        line = strippedPrefix;
      }

      // Delimiter detection (Tab, Semicolon, Pipe, Comma, or Dash)
      let tokens: string[] = [];
      if (line.includes("\t")) {
        tokens = line.split("\t");
      } else if (line.includes(";")) {
        tokens = line.split(";");
      } else if (line.includes("|")) {
        tokens = line.split("|");
      } else if (line.includes(",") && !/\d+,\d+/.test(line)) {
        tokens = line.split(",");
      } else if (line.includes(" - ")) {
        tokens = line.split(" - ");
      } else {
        const parts = line.split(/\s+/);
        if (parts.length >= 2 && /^\d{4,12}$/.test(parts[0])) {
          tokens = [parts[0], parts.slice(1).join(" ")];
        } else {
          tokens = [line];
        }
      }

      // Clean wrapping quotes and spaces from tokens
      tokens = tokens
        .map((t) => t.trim().replace(/^["']+|["']+$/g, ""))
        .filter((t) => t.length > 0);

      if (tokens.length === 0) continue;

      let nisn = "";
      let name = "";
      let kelas = batchDefaultClass;

      // Extract class token if present
      const classTokenIdx = tokens.findIndex((t) => /^(?:kelas|kls)?\s*([1-6])$/i.test(t));
      if (classTokenIdx !== -1) {
        const match = tokens[classTokenIdx].match(/([1-6])/);
        if (match) kelas = match[1];
        tokens.splice(classTokenIdx, 1);
      }

      if (tokens.length === 1) {
        // Just name!
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
      } else if (tokens.length >= 3) {
        if (/^\d{1,3}$/.test(tokens[0])) {
          const d1 = tokens[1].replace(/\D/g, "");
          const d2 = tokens[2].replace(/\D/g, "");
          if (d1.length >= 4) {
            nisn = d1;
            name = tokens[2];
          } else if (d2.length >= 4) {
            name = tokens[1];
            nisn = d2;
          } else {
            name = tokens[1];
            nisn = d2;
          }
        } else {
          const d0 = tokens[0].replace(/\D/g, "");
          const d1 = tokens[1].replace(/\D/g, "");
          if (d0.length >= 4) {
            nisn = d0;
            name = tokens[1];
          } else if (d1.length >= 4) {
            name = tokens[0];
            nisn = d1;
          } else {
            nisn = d0 || tokens[0];
            name = tokens[1];
          }
        }
      }

      // Apply overrides if user edited cell
      if (override.name !== undefined) name = override.name;
      if (override.nisn !== undefined) nisn = override.nisn;
      if (override.kelas !== undefined) kelas = override.kelas;

      let isAutoNisn = false;
      if (!nisn || nisn.length < 4) {
        if (autoGenerateMissingNisn) {
          let gen = "";
          do {
            const pad = String(autoNisnSeq++).padStart(4, "0");
            gen = `${baseAutoPrefix}${pad}`;
          } while (existingNisns.has(gen) || seenBatchNisns.has(gen));
          nisn = gen;
          isAutoNisn = true;
        }
      }

      // Live validation
      if (!name || name.trim() === "-" || name.trim() === "") {
        results.push({
          index: lineIndex,
          rawLine,
          nisn,
          name: "-",
          kelas,
          isAutoNisn,
          status: "invalid_name",
          message: "Nama siswa kosong",
          excluded: false,
        });
      } else if (!nisn || nisn.length < 4) {
        results.push({
          index: lineIndex,
          rawLine,
          nisn,
          name,
          kelas,
          isAutoNisn,
          status: "invalid_nisn",
          message: "NISN kosong (aktifkan Auto-NISN jika belum ada)",
          excluded: false,
        });
      } else if (existingNisns.has(nisn)) {
        results.push({
          index: lineIndex,
          rawLine,
          nisn,
          name,
          kelas,
          isAutoNisn,
          status: "duplicate_db",
          message: "NISN sudah terdaftar di database",
          excluded: false,
        });
      } else if (seenBatchNisns.has(nisn)) {
        results.push({
          index: lineIndex,
          rawLine,
          nisn,
          name,
          kelas,
          isAutoNisn,
          status: "duplicate_batch",
          message: "NISN duplikat di teks ini",
          excluded: false,
        });
      } else {
        seenBatchNisns.add(nisn);
        results.push({
          index: lineIndex,
          rawLine,
          nisn,
          name,
          kelas,
          isAutoNisn,
          status: "valid",
          message: isAutoNisn ? "Siap Disimpan (NIS Sementara)" : "Siap Disimpan",
          excluded: false,
        });
      }

      lineIndex++;
    }

    return results;
  }, [batchRawText, batchDefaultClass, autoGenerateMissingNisn, parsedOverrides, students]);

  // Helper: Paste directly from user's clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showSuccess("Papan klip (clipboard) Anda kosong. Silakan salin data siswa dari Excel atau WhatsApp terlebih dahulu.");
        return;
      }
      setBatchRawText(text);
      setParsedOverrides({});
      setBatchResult(null);
      showSuccess("Data berhasil ditempel dari clipboard!");
    } catch {
      alert("Browser memerlukan izin clipboard. Anda juga dapat menempel dengan pintasan Ctrl+V (atau Cmd+V di Mac) langsung di kotak teks.");
    }
  };

  // Helper: Title-case student names (e.g. AHMAD FAUZI -> Ahmad Fauzi)
  const handleTitleCaseNames = () => {
    if (!batchRawText.trim()) return;
    const lines = batchRawText.split(/\r?\n/);
    const converted = lines.map((l) => {
      return l.replace(/([a-zA-Z\u00C0-\u024F]+)/g, (match) => {
        const lower = match.toLowerCase();
        if (["dan", "bin", "binti"].includes(lower)) return lower;
        return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
      });
    });
    setBatchRawText(converted.join("\n"));
    setParsedOverrides({});
    showSuccess("Format huruf nama siswa berhasil dirapikan (Title Case)!");
  };

  // Helper: Fill realistic sample data
  const fillSampleBatchData = (formatType: "standard" | "names_only" = "standard") => {
    setParsedOverrides({});
    setBatchResult(null);
    if (formatType === "names_only") {
      const sample = `Ahmad Fauzi Ramadhan\nAisyah Putri Azzahra\nBilal Al-Ghifari\nFatimah Az-Zahra\nMuhammad Farhan Hakim\nZahra Nurul Izzah`;
      setBatchRawText(sample);
    } else {
      const sample = `0012984101\tAhmad Fauzi Ramadhan\t1\n0012984102\tAisyah Putri Azzahra\t1\n0012984103\tBilal Al-Ghifari\t2\n0012984104\tFatimah Az-Zahra\t3\n0012984105\tMuhammad Farhan Hakim\t4\n0012984106\tZahra Nurul Izzah\t5`;
      setBatchRawText(sample);
    }
  };

  // Helper: Download ready-to-use CSV template
  const handleDownloadTemplate = () => {
    const csvContent =
      "\uFEFF" +
      "NISN,Nama Lengkap Siswa,Kelas\n" +
      "0012984101,Ahmad Fauzi Ramadhan,1\n" +
      "0012984102,Aisyah Putri Azzahra,1\n" +
      "0012984103,Bilal Al-Ghifari,1\n" +
      "0012984104,Fatimah Az-Zahra,1\n" +
      "0012984105,Muhammad Farhan Hakim,1\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Template_Input_Siswa_SD_Islam_Smart.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showSuccess("Template file Excel/CSV berhasil diunduh!");
  };

  // Helper: Copy Excel template format to clipboard
  const handleCopyTemplateColumns = async () => {
    const tsv = "NISN\tNama Lengkap Siswa\tKelas\n0012984101\tAhmad Fauzi Ramadhan\t1\n0012984102\tAisyah Putri Azzahra\t1";
    try {
      await navigator.clipboard.writeText(tsv);
      showSuccess("Format kolom Excel berhasil disalin ke clipboard! Buka Excel lalu tekan Ctrl+V.");
    } catch {
      showSuccess("Kolom format: NISN [Tab] Nama Lengkap Siswa [Tab] Kelas");
    }
  };

  // Helper: Apply a single class to all rows in parsed table
  const handleApplyClassToAll = (targetKelas: string) => {
    const updated = { ...parsedOverrides };
    parsedBatchStudents.forEach((p) => {
      updated[p.index] = { ...updated[p.index], kelas: targetKelas };
    });
    setParsedOverrides(updated);
    showSuccess(`Semua siswa di pratinjau berhasil diubah ke Kelas ${targetKelas}!`);
  };

  // Batch submit handler
  const handleBatchStudentSubmit = async () => {
    const validStudents = parsedBatchStudents
      .filter((p) => !p.excluded && p.status === "valid")
      .map((p) => ({
        nisn: p.nisn,
        name: p.name,
        kelas: p.kelas || batchDefaultClass || "1",
        autoGenerateNisn: p.isAutoNisn,
      }));

    if (validStudents.length === 0) {
      alert("Tidak ada baris siswa yang valid untuk disimpan. Silakan periksa kembali daftar pratinjau.");
      return;
    }

    setIsSubmittingBatch(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/students/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: validStudents,
          autoGenerateMissingNisn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengimpor data siswa.");
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
      showSuccess(`Alhamdulillah! ${data.addedCount || validStudents.length} siswa berhasil disimpan ke database!`);
      setBatchRawText("");
      setParsedOverrides({});
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
    kelas: "1",
  });
  const [tpFilterClass, setTpFilterClass] = useState<string>("all");

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

  const handleDeleteEkskul = (id: string) => {
    const item = ekskuls.find((e) => e.id === id);
    setDeleteConfirm({
      title: "Hapus Ekstrakurikuler",
      message: `Apakah Anda yakin ingin menghapus ekstrakurikuler "${item ? item.name : id}"?`,
      confirmLabel: "Hapus Ekskul",
      onConfirm: async () => {
        const res = await fetch(`/api/ekskul/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menghapus.");
        setEkskuls((prev) => prev.filter((e) => e.id !== id));
        fetchAllData();
        showSuccess("Ekstrakurikuler berhasil dihapus.");
      },
    });
  };

  // Subject Management Handlers
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSubjectName.trim();
    if (!name) return;

    setError("");
    setSubjectLoading(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan mata pelajaran.");
      }

      setNewSubjectName("");
      showSuccess(`Mata pelajaran "${name}" berhasil ditambahkan!`);
      await fetchAllData();
      onRefreshTrigger();
    } catch (err: any) {
      setError(err.message || "Gagal menambah mata pelajaran.");
    } finally {
      setSubjectLoading(false);
    }
  };

  const handleDeleteSubject = (subjectName: string) => {
    setDeleteConfirm({
      title: "Hapus Mata Pelajaran",
      message: `Apakah Anda yakin ingin menghapus mata pelajaran "${subjectName}"? Seluruh template TP terkait mapel ini akan ikut dihapus.`,
      confirmLabel: "Hapus Mata Pelajaran",
      onConfirm: async () => {
        setDeletingSubject(subjectName);
        try {
          const res = await fetch(
            `/api/subjects/${encodeURIComponent(subjectName)}`,
            {
              method: "DELETE",
            },
          );
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Gagal menghapus mata pelajaran.");
          }

          setSubjectsList((prev) => prev.filter((s) => s !== subjectName));
          showSuccess(`Mata pelajaran "${subjectName}" berhasil dihapus.`);
          fetchAllData();
          onRefreshTrigger();
        } finally {
          setDeletingSubject(null);
        }
      },
    });
  };

  // Fetch all starting info
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [resT, resS, resTp, resSet, resEks, resSub] = await Promise.all([
        fetch("/api/teachers"),
        fetch("/api/students"),
        fetch("/api/tps"),
        fetch("/api/settings"),
        fetch("/api/ekskul"),
        fetch("/api/subjects"),
      ]);

      const tData = await resT.json();
      const sData = await resS.json();
      const tpData = await resTp.json();
      const setData = await resSet.json();
      const eksData = await resEks.json();
      const subData = await resSub.json();

      if (Array.isArray(tData)) setTeachers(tData);
      if (Array.isArray(sData)) setStudents(sData);
      if (Array.isArray(subData)) setSubjectsList(subData);
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
          setSignaturePosition(setData.format.signaturePosition || "kanan");
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
      setTeacherModalError("Silakan pilih kelas asuhan untuk wali kelas (Kelas 1 s/d 6).");
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

  const deleteTeacher = (id: string) => {
    if (id === "t1") {
      setError("Akun Super Admin utama tidak boleh dihapus.");
      return;
    }
    const t = teachers.find((x) => x.id === id);
    setDeleteConfirm({
      title: "Hapus Akun Guru",
      message: `Apakah Anda yakin ingin menghapus akun guru "${t ? t.name : id}"? Guru ini tidak akan dapat login lagi.`,
      confirmLabel: "Hapus Akun Guru",
      onConfirm: async () => {
        const response = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal menghapus guru.");

        setTeachers((prev) => prev.filter((x) => x.id !== id));
        fetchAllData();
        onRefreshTrigger();
        showSuccess("Guru berhasil dihapus.");
      },
    });
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
      setStudentModalError("Kelas siswa wajib dipilih (1 sampai 6).");
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
        kelas: "1",
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

  const deleteStudent = (id: string) => {
    const s = students.find((x) => x.id === id);
    setDeleteConfirm({
      title: "Hapus Siswa",
      message: `Menghapus siswa "${s ? s.name : id}" (NISN: ${s ? s.nisn : "-"}) juga akan menghapus seluruh data nilai dan catatan wali kelasnya secara permanen. Lanjutkan?`,
      confirmLabel: "Hapus Siswa",
      onConfirm: async () => {
        const response = await fetch(`/api/students/${id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal menghapus siswa.");

        setStudents((prev) => prev.filter((x) => x.id !== id));
        setSelectedStudentIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        fetchAllData();
        onRefreshTrigger();
        showSuccess("Siswa berhasil dihapus bersama relasi nilainya.");
      },
    });
  };

  const deleteBatchStudents = (idsToDelete?: string[]) => {
    const targetIds = idsToDelete || Array.from(selectedStudentIds);
    if (targetIds.length === 0) return;

    setDeleteConfirm({
      title: "Hapus Banyak Siswa Sekaligus",
      message: `Apakah Anda yakin ingin menghapus ${targetIds.length} siswa yang dipilih secara permanen beserta seluruh data nilai dan catatan wali kelas mereka?`,
      confirmLabel: `Hapus ${targetIds.length} Siswa`,
      onConfirm: async () => {
        const response = await fetch("/api/students/delete-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: targetIds }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal menghapus data siswa.");

        const deletedSet = new Set(targetIds);
        setStudents((prev) => prev.filter((s) => !deletedSet.has(s.id)));
        setSelectedStudentIds(new Set());
        fetchAllData();
        onRefreshTrigger();
        showSuccess(`${targetIds.length} siswa berhasil dihapus secara massal.`);
      },
    });
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
          kelas: tpForm.kelas || "1",
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

  const deleteTpObjective = (subject: string, tpId: string) => {
    setDeleteConfirm({
      title: "Hapus Tujuan Pembelajaran (TP)",
      message: `Apakah Anda yakin ingin menghapus template TP ini untuk mata pelajaran "${subject}"?`,
      confirmLabel: "Hapus TP",
      onConfirm: async () => {
        const response = await fetch(
          `/api/tps/${encodeURIComponent(subject)}/${tpId}`,
          {
            method: "DELETE",
          },
        );
        if (!response.ok) throw new Error("Gagal menghapus tujuan pembelajaran.");

        setTpsTemplates((prev) => {
          const updated = { ...prev };
          if (updated[subject]) {
            updated[subject] = updated[subject].filter(
              (item) => String(item.id) !== String(tpId),
            );
          }
          return updated;
        });
        fetchAllData();
        showSuccess("Tujuan Pembelajaran berhasil dihapus!");
      },
    });
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
            signaturePosition,
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
    <div className="space-y-5" id="admin-panel">
      {/* Executive Admin Header */}
      <div className="bg-[#0c1424] border border-[#1e2e4a] p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/30 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase font-mono">
                PUSAT KONTROL ADMINISTRATOR
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase font-mono tracking-wider">
                Full Access
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-medium">
              SD Islam Smart Pangkalpinang • Manajemen Master Data & Format Raport STS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#080e1c] border border-[#1a2948] text-xs font-mono font-bold text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-emerald-400">Mode Gelap Aktif</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#080e1c] border border-[#1a2948] text-xs font-mono font-bold text-blue-300">
            <span>Semester:</span>
            <span className="text-white font-extrabold">{semesterName} {tahunPelajaran}</span>
          </div>
        </div>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-500/60 rounded-xl text-xs text-rose-100 flex gap-2.5 items-start shadow-md animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-500/60 text-emerald-100 rounded-xl text-xs font-bold transition-all animate-fade-in shadow-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Interactive Quick Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5" id="admin-summary-cards">
        <div
          onClick={() => setActiveTab("teachers")}
          className={`p-4 rounded-2xl flex items-center justify-between transition cursor-pointer shadow-md ${
            activeTab === "teachers"
              ? "bg-[#11223f] border-2 border-emerald-500/70 ring-2 ring-emerald-500/20"
              : "bg-[#0c1424] border border-[#1e2e4a] hover:border-emerald-500/40 hover:bg-[#101b33]"
          }`}
          title="Klik untuk membuka Manajemen Guru"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
              Guru & Akses
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-white tabular-nums">
                {teachers.length}
              </span>
              <span className="text-[11px] text-emerald-400 font-bold">
                {teachers.filter((t) => t.isWaliKelas).length} Wali
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("students")}
          className={`p-4 rounded-2xl flex items-center justify-between transition cursor-pointer shadow-md ${
            activeTab === "students"
              ? "bg-[#11223f] border-2 border-blue-500/70 ring-2 ring-blue-500/20"
              : "bg-[#0c1424] border border-[#1e2e4a] hover:border-blue-500/40 hover:bg-[#101b33]"
          }`}
          title="Klik untuk membuka Data Siswa"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
              Siswa Terdaftar
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-white tabular-nums">
                {students.length}
              </span>
              <span className="text-[11px] text-blue-400 font-bold">
                Kelas 1 - 6
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("subjects")}
          className={`p-4 rounded-2xl flex items-center justify-between transition cursor-pointer shadow-md ${
            activeTab === "subjects"
              ? "bg-[#11223f] border-2 border-amber-500/70 ring-2 ring-amber-500/20"
              : "bg-[#0c1424] border border-[#1e2e4a] hover:border-amber-500/40 hover:bg-[#101b33]"
          }`}
          title="Klik untuk membuka Mata Pelajaran"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
              Mata Pelajaran
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-white tabular-nums">
                {subjectsList.length}
              </span>
              <span className="text-[11px] text-amber-400 font-bold">
                Kurikulum
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <BookMarked className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("ekskul")}
          className={`p-4 rounded-2xl flex items-center justify-between transition cursor-pointer shadow-md ${
            activeTab === "ekskul"
              ? "bg-[#11223f] border-2 border-purple-500/70 ring-2 ring-purple-500/20"
              : "bg-[#0c1424] border border-[#1e2e4a] hover:border-purple-500/40 hover:bg-[#101b33]"
          }`}
          title="Klik untuk membuka Ekstrakurikuler"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
              Ekstrakurikuler
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-white tabular-nums">
                {ekskuls.length}
              </span>
              <span className="text-[11px] text-purple-400 font-bold">
                Aktif
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Professional Feature Navigation Tabs Bar */}
      <div
        className="bg-[#0c1424] p-2 rounded-2xl border border-[#1e2e4a] flex items-center gap-2 overflow-x-auto shadow-md"
        id="admin-nav-tabs"
      >
        {[
          { id: "teachers", label: "Manajemen Guru", icon: Users, count: teachers.length },
          { id: "students", label: "Data Siswa & Rombel", icon: GraduationCap, count: students.length },
          { id: "subjects", label: "Mata Pelajaran", icon: BookMarked, count: subjectsList.length },
          { id: "tps", label: "Tujuan Pembelajaran (TP)", icon: BookOpen },
          { id: "ekskul", label: "Ekstrakurikuler", icon: Award, count: ekskuls.length },
          { id: "settings", label: "Pengaturan & Format Raport", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 font-bold ring-1 ring-emerald-400/40"
                  : "text-slate-300 hover:text-white hover:bg-[#131f38]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    isActive
                      ? "bg-emerald-800 text-white"
                      : "bg-[#080d19] text-slate-300 border border-[#1a2948]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TEACHERS TAB */}
      {activeTab === "teachers" && (
        <div
          className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm p-5 space-y-4 animate-fade-in"
          id="teacher-management-panel"
        >
          {/* Header & Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Daftar Guru & Hak Akses
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-[10px] font-extrabold font-mono">
                  {filteredTeachers.length} dari {teachers.length} Guru
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kelola kredensial akun guru mata pelajaran, penugasan wali kelas, dan keamanan sandi masuk.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search Teacher Input */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Cari nama/username..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-100 placeholder:text-slate-500"
                />
                {teacherSearch && (
                  <button
                    onClick={() => setTeacherSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Add Teacher Button */}
              <button
                onClick={() => {
                  setEditingTeacher(null);
                  setTeacherModalError("");
                  setTeacherForm({
                    name: "",
                    username: "",
                    password: "123",
                    subject: subjectsList[0] || "PAI",
                    isWaliKelas: false,
                    kelas: "",
                  });
                  setIsTeacherModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Tambah Guru Baru
              </button>
            </div>
          </div>

          {/* Teacher Role Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Kategori:
            </span>
            {[
              { id: "all", label: `Semua Guru (${teachers.length})` },
              {
                id: "wali",
                label: `Wali Kelas (${teachers.filter((t) => t.isWaliKelas).length})`,
              },
              {
                id: "mapel",
                label: `Guru Mapel (${teachers.filter((t) => !t.isWaliKelas).length})`,
              },
            ].map((rf) => (
              <button
                key={rf.id}
                onClick={() => setTeacherRoleFilter(rf.id as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  teacherRoleFilter === rf.id
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-600/70 font-bold"
                    : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>

          {/* High Contrast Teacher Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-300 font-bold uppercase tracking-wider border-b border-slate-800">
                  <th className="p-3 text-[11px]">Nama Lengkap & Gelar</th>
                  <th className="p-3 text-[11px]">Login Username</th>
                  <th className="p-3 text-[11px]">Status Sandi</th>
                  <th className="p-3 text-[11px]">Mata Pelajaran (Mapel)</th>
                  <th className="p-3 text-[11px]">Tugas Wali Kelas</th>
                  <th className="p-3 text-[11px] text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                      Tidak ada data guru yang cocok dengan pencarian atau filter.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 font-bold text-white">{t.name}</td>
                      <td className="p-3 font-mono text-emerald-400 font-bold">
                        {t.username}
                      </td>
                      <td className="p-3 font-mono text-slate-400 font-bold">
                        ••••••••
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            t.subject === "Admin"
                              ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
                              : "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                          }`}
                        >
                          {t.subject}
                        </span>
                      </td>
                      <td className="p-3">
                        {t.isWaliKelas ? (
                          <span className="text-purple-300 bg-purple-950/80 border border-purple-700/60 py-0.5 px-2.5 rounded-full font-bold">
                            Wali Kelas {t.kelas}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Bukan Wali</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {t.id === "t1" ? (
                          <span className="text-[10px] text-amber-400 font-bold bg-amber-950/40 border border-amber-700/60 px-2 py-0.5 rounded">
                            Super Admin
                          </span>
                        ) : (
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => startEditTeacher(t)}
                              className="p-1.5 text-sky-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="Edit Guru"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteTeacher(t.id)}
                              className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                              title="Hapus Guru"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STUDENTS TAB */}
      {activeTab === "students" && (
        <div
          className="bg-[#0c1424] rounded-2xl border border-[#1e2e4a] p-5 shadow-lg space-y-5 animate-fade-in"
          id="student-management-panel"
        >
          {/* Header & Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1e2e4a] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Daftar Siswa & Rombongan Belajar
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700/60 text-[10px] font-extrabold font-mono">
                  {students.length} Total Siswa Terdaftar
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Kelola data NISN, penetapan kelas rombel, tambah siswa baru, atau gunakan formulir copy-paste massal.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setEditingStudent(null);
                  setStudentForm({
                    name: "",
                    nisn: "",
                    kelas: "1",
                  });
                  setIsStudentModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer transition font-mono tracking-wide border border-emerald-400/30 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>+ Tambah Siswa Baru</span>
              </button>
            </div>
          </div>

          {/* QUICK BATCH COPY-PASTE HERO CARD */}
          <div className="bg-gradient-to-r from-blue-950/80 via-[#0a1428] to-emerald-950/60 border border-blue-500/40 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-400 shadow-inner mt-0.5">
                <ClipboardPaste className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Sistem Copy-Paste Siswa Massal Cepat & Praktis
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                    Sangat Direkomendasikan
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  Punya daftar siswa di <strong>Excel, Google Sheets, WhatsApp, atau Word</strong>? Cukup blok data lalu salin (copy) dan tempel (paste) ke sistem. Sistem otomatis membaca kolom NISN, Nama, dan Kelas, serta menyediakan <strong>Auto-Generate NIS sementara</strong> jika murid belum memiliki NISN!
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Deteksi Kolom Otomatis
                  </span>
                  <span className="flex items-center gap-1 text-blue-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Pratinjau & Edit Langsung
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Dukung Input Hanya Nama
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-row lg:flex-col gap-2 shrink-0">
              <button
                onClick={() => {
                  setBatchResult(null);
                  setParsedOverrides({});
                  setIsBatchStudentModalOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-950/70 cursor-pointer transition font-mono border border-blue-400/40"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>Buka Formulir Copy-Paste</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full sm:w-auto px-4 py-2 bg-[#0c1424] hover:bg-[#16233b] text-slate-300 hover:text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition border border-[#1e2e4a]"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Unduh Template CSV</span>
              </button>
            </div>
          </div>

          {/* Unified Class Filter Pills & Search */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 font-mono">
                Filter Kelas:
              </span>
              {[
                { id: "all", label: "Semua", count: students.length },
                { id: "1", label: "Kelas 1", count: students.filter((s) => String(s.kelas || "").trim() === "1").length },
                { id: "2", label: "Kelas 2", count: students.filter((s) => String(s.kelas || "").trim() === "2").length },
                { id: "3", label: "Kelas 3", count: students.filter((s) => String(s.kelas || "").trim() === "3").length },
                { id: "4", label: "Kelas 4", count: students.filter((s) => String(s.kelas || "").trim() === "4").length },
                { id: "5", label: "Kelas 5", count: students.filter((s) => String(s.kelas || "").trim() === "5").length },
                { id: "6", label: "Kelas 6", count: students.filter((s) => String(s.kelas || "").trim() === "6").length },
              ].map((tab) => {
                const isSelected = studentClassFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStudentClassFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/60 ring-1 ring-emerald-400/40"
                        : "bg-[#080d19] hover:bg-[#131f38] text-slate-300 border border-[#1e2e4a]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                        isSelected ? "bg-emerald-800 text-white" : "bg-[#0e172a] text-slate-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Cari nama atau NISN siswa..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-[#070d18] border border-[#1e2e4a] rounded-xl focus:outline-none focus:border-emerald-500 text-white placeholder-slate-500 transition font-medium"
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Batch Action Toolbar */}
          {selectedStudentIds.size > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-red-950/50 border border-red-800/70 rounded-2xl animate-fade-in shadow-lg">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shadow-md shrink-0 font-mono">
                  {selectedStudentIds.size}
                </span>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {selectedStudentIds.size} Siswa Terpilih
                  </span>
                  <span className="text-[11px] text-red-300">
                    Siswa yang dipilih dapat dihapus sekaligus dari database sekolah.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds(new Set())}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
                >
                  Batalkan Pilihan
                </button>
                <button
                  type="button"
                  onClick={() => deleteBatchStudents()}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Siswa Terpilih ({selectedStudentIds.size})
                </button>
              </div>
            </div>
          )}

          {/* Clean Up Class Action if no items individually selected */}
          {selectedStudentIds.size === 0 && filteredStudents.length > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  const targetList = filteredStudents;
                  const label = studentClassFilter === "all" ? "Semua Siswa" : `Semua Siswa Kelas ${studentClassFilter}`;
                  setDeleteConfirm({
                    title: `Hapus ${label}`,
                    message: `Apakah Anda yakin ingin menghapus seluruh ${targetList.length} siswa pada tampilan ini (${label})? Seluruh data nilai dan catatan wali kelasnya akan ikut dihapus.`,
                    confirmLabel: `Hapus ${targetList.length} Siswa`,
                    onConfirm: async () => {
                      const ids = targetList.map((s) => s.id);
                      const response = await fetch("/api/students/delete-batch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids }),
                      });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error || "Gagal menghapus siswa.");
                      const deletedSet = new Set(ids);
                      setStudents((prev) => prev.filter((s) => !deletedSet.has(s.id)));
                      fetchAllData();
                      onRefreshTrigger();
                      showSuccess(`${targetList.length} siswa berhasil dihapus.`);
                    },
                  });
                }}
                className="text-[11px] text-red-400 hover:text-red-300 font-semibold hover:underline flex items-center gap-1.5 cursor-pointer transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {studentClassFilter === "all"
                    ? "Hapus Seluruh Data Siswa Terdaftar"
                    : `Hapus Seluruh Siswa di Kelas ${studentClassFilter} (${filteredStudents.length} Siswa)`}
                </span>
              </button>
            </div>
          )}

          {/* High Contrast Students Table */}
          <div className="overflow-x-auto rounded-xl border border-[#1e2e4a]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#090f1d] text-slate-300 font-bold uppercase tracking-wider border-b border-[#1e2e4a]">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredStudents.length > 0 &&
                        filteredStudents.every((s) => selectedStudentIds.has(s.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const next = new Set(selectedStudentIds);
                          filteredStudents.forEach((s) => next.add(s.id));
                          setSelectedStudentIds(next);
                        } else {
                          const next = new Set(selectedStudentIds);
                          filteredStudents.forEach((s) => next.delete(s.id));
                          setSelectedStudentIds(next);
                        }
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-900 cursor-pointer"
                      title="Pilih semua siswa di tabel ini"
                    />
                  </th>
                  <th className="p-3 text-[11px] text-center w-12 font-mono">No</th>
                  <th className="p-3 text-[11px]">Nama Lengkap Siswa</th>
                  <th className="p-3 text-[11px]">NISN</th>
                  <th className="p-3 text-[11px]">Rombel / Kelas</th>
                  <th className="p-3 text-[11px] text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e4a] bg-[#0c1424]">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      Tidak ada data siswa yang cocok dengan filter atau pencarian saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => {
                    const isSelected = selectedStudentIds.has(s.id);
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-[#131f38] transition ${
                          isSelected ? "bg-red-950/30" : ""
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = new Set(selectedStudentIds);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              setSelectedStudentIds(next);
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-900 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center text-slate-400 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-bold text-white text-sm">{s.name}</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{s.nisn}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 bg-blue-950/70 text-blue-300 border border-blue-800/60 rounded-full text-xs font-bold font-mono">
                            Kelas {s.kelas}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => startEditStudent(s)}
                              className="p-1.5 text-sky-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="Edit Identitas Siswa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteStudent(s.id)}
                              className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBJECTS (MATA PELAJARAN) TAB */}
      {activeTab === "subjects" && (
        <div
          className="bg-[#0c1424] rounded-2xl border border-[#1e2e4a] p-5 shadow-lg space-y-5 animate-fade-in"
          id="subjects-management-panel"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1e2e4a] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Daftar & Manajemen Mata Pelajaran (Mapel)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/60 text-[10px] font-extrabold font-mono">
                  {subjectsList.length} Mata Pelajaran Kurikulum
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Kelola mata pelajaran SD Islam Smart Pangkalpinang. Tambahkan mata pelajaran baru atau hapus mata pelajaran yang tidak digunakan.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={subjectSearchQuery}
                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                placeholder="Cari mata pelajaran..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-[#070d18] border border-[#1e2e4a] rounded-xl focus:outline-none focus:border-amber-500 text-white placeholder-slate-500 transition font-medium"
              />
              {subjectSearchQuery && (
                <button
                  onClick={() => setSubjectSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Form to Add New Subject */}
          <form
            onSubmit={handleAddSubject}
            className="p-4 bg-[#080d19] border border-[#1e2e4a] rounded-2xl flex flex-col sm:flex-row gap-3 items-end shadow-md"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                Nama Mata Pelajaran Baru
              </label>
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Contoh: Seni Budaya, Bahasa Daerah, Koding & Robotik..."
                className="w-full p-2.5 bg-[#0c1424] border border-[#1e2e4a] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-amber-500 transition placeholder-slate-500 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={subjectLoading || !newSubjectName.trim()}
              className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 font-mono tracking-wide border border-amber-400/30"
            >
              <Plus className="w-4 h-4" />
              <span>{subjectLoading ? "Menyimpan..." : "Tambah Mapel"}</span>
            </button>
          </form>

          {/* Subject Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {subjectsList
              .filter((sub) =>
                sub.toLowerCase().includes(subjectSearchQuery.toLowerCase())
              )
              .map((sub, index) => {
                const assignedTeacher = teachers.find(
                  (t) => t.subject === sub
                );
                const tpsCount = tpsTemplates[sub]?.length || 0;
                const isDeleting = deletingSubject === sub;

                return (
                  <div
                    key={sub}
                    className="p-4 rounded-2xl border border-[#1e2e4a] bg-[#090f1d] hover:border-amber-500/50 hover:bg-[#0f182c] transition flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-amber-950/80 text-amber-300 flex items-center justify-center text-xs font-bold font-mono border border-amber-800/60 shrink-0">
                            {index + 1}
                          </span>
                          <h3 className="font-bold text-white text-sm">
                            {sub}
                          </h3>
                        </div>
                        <button
                          onClick={() => handleDeleteSubject(sub)}
                          disabled={isDeleting}
                          title="Hapus Mata Pelajaran"
                          className="text-rose-400 hover:text-white hover:bg-rose-950/60 p-1.5 rounded-lg transition cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 pt-2 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-[11px]">Guru Pengampu:</span>
                          <span className="font-semibold text-slate-200 truncate max-w-[150px]">
                            {assignedTeacher ? assignedTeacher.name : "Belum Ditugaskan"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-[11px]">Template TP:</span>
                          <span className="font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded text-[10px] border border-emerald-800/60">
                            {tpsCount} Capaian
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1e2e4a] flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-mono text-[10px]">
                        ID: {sub.toLowerCase().replace(/[^a-z0-9]/g, "_")}
                      </span>
                      <button
                        onClick={() => {
                          setTpForm((prev) => ({ ...prev, subject: sub }));
                          setActiveTab("tps");
                        }}
                        className="text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Kelola TP</span>
                        <span>&rarr;</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {subjectsList.filter((sub) =>
            sub.toLowerCase().includes(subjectSearchQuery.toLowerCase())
          ).length === 0 && (
            <div className="p-8 text-center bg-[#080d19] rounded-2xl border border-dashed border-[#1e2e4a]">
              <p className="text-xs text-slate-400 font-medium">
                Tidak ada mata pelajaran yang cocok dengan pencarian "{subjectSearchQuery}".
              </p>
            </div>
          )}
        </div>
      )}

      {/* TPS (MATA PELAJARAN / LEARNING OBJECTIVES TEMPLATES) TAB */}
      {activeTab === "tps" && (
        <div
          className="bg-[#0c1424] rounded-2xl border border-[#1e2e4a] p-5 shadow-lg space-y-5 animate-fade-in"
          id="tp-templates-panel"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1e2e4a] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Template Capaian & Tujuan Pembelajaran (TP)</span>
                </h2>
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider">
                  Kurikulum Merdeka
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Setiap tingkat rombel (Kelas 1 sampai 6) memiliki Capaian Pembelajaran dan TP spesifik yang dapat dinilai pada rapor.
              </p>
            </div>

            {/* Filter by class buttons */}
            <div className="flex items-center gap-1.5 bg-[#080d19] p-1 rounded-xl overflow-x-auto border border-[#1e2e4a]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 shrink-0 font-mono">
                Tingkat:
              </span>
              {[
                { id: "all", label: "Semua" },
                { id: "1", label: "Kelas 1" },
                { id: "2", label: "Kelas 2" },
                { id: "3", label: "Kelas 3" },
                { id: "4", label: "Kelas 4" },
                { id: "5", label: "Kelas 5" },
                { id: "6", label: "Kelas 6" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTpFilterClass(tab.id);
                    if (tab.id !== "all") {
                      setTpForm((prev) => ({ ...prev, kelas: tab.id }));
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                    tpFilterClass === tab.id
                      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40"
                      : "text-slate-400 hover:text-white hover:bg-[#131f38]"
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
            className="p-4 bg-[#080d19] border border-[#1e2e4a] rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end shadow-md"
          >
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Mata Pelajaran
                </label>
                <button
                  type="button"
                  onClick={() => setActiveTab("subjects")}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                  title="Buka panel input dan kelola mata pelajaran"
                >
                  <Plus className="w-3 h-3" /> Input Mapel
                </button>
              </div>
              <select
                value={tpForm.subject}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, subject: e.target.value }))
                }
                className="w-full p-2.5 bg-[#0c1424] border border-[#1e2e4a] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 transition font-medium"
              >
                {subjectsList.map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                Tingkat Kelas
              </label>
              <select
                value={tpForm.kelas}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, kelas: e.target.value }))
                }
                className="w-full p-2.5 bg-[#0c1424] border border-[#1e2e4a] rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 font-bold text-white transition"
              >
                <option value="1">Kelas 1</option>
                <option value="2">Kelas 2</option>
                <option value="3">Kelas 3</option>
                <option value="4">Kelas 4</option>
                <option value="5">Kelas 5</option>
                <option value="6">Kelas 6</option>
                <option value="all">Semua Kelas</option>
              </select>
            </div>

            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                Deskripsi Ringkas Tujuan Pembelajaran (TP)
              </label>
              <input
                type="text"
                value={tpForm.text}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="Contoh: Mengidentifikasi makna surah Al-Fatihah dan adab harian..."
                className="w-full p-2.5 bg-[#0c1424] border border-[#1e2e4a] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500 font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer font-mono tracking-wide border border-emerald-400/30"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan TP</span>
              </button>
            </div>
          </form>

          {/* Group display of subject templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {subjectsList.map((subject) => {
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
                  className="bg-[#090f1d] rounded-2xl border border-[#1e2e4a] p-4.5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-[#1e2e4a] pb-3 mb-3">
                      <span className="px-3 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs uppercase tracking-wider font-extrabold font-mono">
                        {subject}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        {items.length} TP {tpFilterClass !== "all" ? `(Kelas ${tpFilterClass})` : "Total"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-4 text-center bg-[#070d18] rounded-xl border border-dashed border-[#1e2e4a]">
                          Belum ada tujuan pembelajaran {tpFilterClass !== "all" ? `untuk Kelas ${tpFilterClass}` : ""} pada mapel ini.
                        </p>
                      ) : (
                        items.map((item) => {
                          const itemClass = String(item.kelas || "1").trim();
                          const badgeColor =
                            itemClass === "1"
                              ? "bg-amber-950/70 text-amber-300 border-amber-800/60"
                              : itemClass === "2"
                              ? "bg-sky-950/70 text-sky-300 border-sky-800/60"
                              : itemClass === "3"
                              ? "bg-blue-950/70 text-blue-300 border-blue-800/60"
                              : itemClass === "4"
                              ? "bg-purple-950/70 text-purple-300 border-purple-800/60"
                              : itemClass === "5"
                              ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/60"
                              : itemClass === "6"
                              ? "bg-rose-950/70 text-rose-300 border-rose-800/60"
                              : "bg-slate-900 text-slate-300 border-slate-700";

                          return (
                            <div
                              key={item.id}
                              className="p-3 bg-[#0c1424] rounded-xl border border-[#1e2e4a] flex items-start justify-between gap-3 text-xs hover:border-emerald-500/40 transition"
                            >
                              <div className="flex-1 space-y-1.5">
                                <p className="text-slate-100 leading-relaxed font-medium">
                                  {item.text}
                                </p>
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border font-mono ${badgeColor}`}
                                >
                                  {itemClass === "all" ? "Semua Kelas" : `Kelas ${itemClass}`}
                                </span>
                              </div>
                              <button
                                onClick={() => deleteTpObjective(subject, item.id)}
                                className="text-rose-400 hover:text-white p-1.5 rounded-lg hover:bg-rose-950/60 transition cursor-pointer shrink-0 mt-0.5"
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

      {/* EXTRACURRICULAR (EKSKUL) TAB */}
      {activeTab === "ekskul" && (
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in"
          id="ekskul-management-panel"
        >
          {/* Form to add new Ekskul */}
          <div className="lg:col-span-4 bg-[#0c1424] rounded-2xl border border-[#1e2e4a] shadow-lg p-5 h-fit space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                <span>Tambah Ekskul Baru</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Tambahkan nama kegiatan dan tentukan kategori wajib atau pilihan untuk penilaian rapor.
              </p>
            </div>

            <form onSubmit={handleAddEkskul} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                  Nama Kegiatan Ekstrakurikuler
                </label>
                <input
                  type="text"
                  required
                  value={newEkskulName}
                  onChange={(e) => setNewEkskulName(e.target.value)}
                  placeholder="Contoh: Futsal, Pramuka, Robotik, Tahfidz..."
                  className="w-full px-3.5 py-2.5 bg-[#070d18] border border-[#1e2e4a] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-purple-500 transition placeholder-slate-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                  Tipe Ekstrakurikuler
                </label>
                <select
                  value={newEkskulType}
                  onChange={(e) =>
                    setNewEkskulType(e.target.value as "Wajib" | "Pilihan")
                  }
                  className="w-full px-3.5 py-2.5 bg-[#070d18] border border-[#1e2e4a] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-purple-500 transition font-medium"
                >
                  <option value="Wajib">Wajib (Compulsory - Seperti Pramuka)</option>
                  <option value="Pilihan">Pilihan (Elective - Bakat Minat)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={ekskulLoading || !newEkskulName.trim()}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-md font-mono tracking-wide border border-purple-400/30"
              >
                <Plus className="w-4 h-4" />
                <span>{ekskulLoading ? "Menyimpan..." : "Tambahkan Ekskul"}</span>
              </button>
            </form>
          </div>

          {/* List of existing Ekskuls */}
          <div className="lg:col-span-8 bg-[#0c1424] rounded-2xl border border-[#1e2e4a] shadow-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2e4a] pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Daftar Kegiatan Ekstrakurikuler
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Kegiatan aktif yang dapat dinilai oleh Wali Kelas pada rapor peserta didik.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700/60 text-[10px] font-extrabold font-mono">
                {ekskuls.length} Kegiatan Aktif
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1e2e4a]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#090f1d] text-slate-300 font-bold uppercase tracking-wider border-b border-[#1e2e4a]">
                    <th className="py-3 px-3.5 text-[11px] w-12 text-center font-mono">No</th>
                    <th className="py-3 px-3.5 text-[11px]">Nama Ekstrakurikuler</th>
                    <th className="py-3 px-3.5 text-[11px]">Kategori</th>
                    <th className="py-3 px-3.5 text-[11px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2e4a] bg-[#0c1424]">
                  {ekskuls.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-slate-400 italic"
                      >
                        Belum ada kegiatan ekstrakurikuler. Silakan tambahkan pada formulir di sebelah kiri.
                      </td>
                    </tr>
                  ) : (
                    ekskuls.map((e, idx) => (
                      <tr
                        key={e.id}
                        className="hover:bg-[#131f38] transition"
                      >
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-400 text-center">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-white text-sm">
                          {e.name}
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                              e.type === "Wajib"
                                ? "bg-amber-950/80 text-amber-300 border-amber-800/60"
                                : "bg-sky-950/80 text-sky-300 border-sky-800/60"
                            }`}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            onClick={() => handleDeleteEkskul(e.id)}
                            className="p-1.5 hover:bg-rose-950/60 text-rose-400 hover:text-white rounded-lg transition cursor-pointer"
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

      {/* SETTINGS (PENGATURAN RAPORT) TAB */}
      {activeTab === "settings" && (
        <div
          className="bg-[#0c1424] rounded-2xl border border-[#1e2e4a] shadow-lg p-5 sm:p-6 space-y-6 max-w-5xl animate-fade-in"
          id="school-settings-panel"
        >
          {/* Header */}
          <div className="border-b border-[#1e2e4a] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Pengaturan Format & Layout Cetak Raport STS</span>
                </h2>
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider">
                  Admin Master Config
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Sesuaikan identitas penandatangan, posisi tanda tangan Kepala Sekolah (Kanan / Tengah / Kiri), ukuran kertas, tipografi, serta watermark resmi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-[#080d19] border border-[#1e2e4a] text-[11px] font-mono font-bold text-slate-300">
                Kertas Aktif: <strong className="text-emerald-400">{paperSize}</strong>
              </span>
            </div>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-6">
            {/* Bagian 1: Identitas Kepala Sekolah */}
            <div className="bg-[#080d19] p-4.5 rounded-2xl border border-[#1e2e4a] space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#1e2e4a] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>1. Identitas Penandatangan (Kepala Sekolah)</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Muncul di Kolom Tanda Tangan</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Nama Lengkap Kepala Sekolah & Gelar
                  </label>
                  <input
                    type="text"
                    required
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="Contoh: Ustadz H. Ir. Abdul Muhyi, M.Pd"
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] rounded-xl text-xs md:text-sm bg-[#0c1424] text-white focus:outline-none focus:border-emerald-500 transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    required
                    value={principalNip}
                    onChange={(e) => setPrincipalNip(e.target.value)}
                    placeholder="Contoh: 19780512 200501 1 002"
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] rounded-xl text-xs md:text-sm bg-[#0c1424] text-white focus:outline-none focus:border-emerald-500 transition font-mono font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Kustomisasi Teks & Sesi */}
            <div className="bg-[#080d19] p-4.5 rounded-2xl border border-[#1e2e4a] space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#1e2e4a] pb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-400" />
                  <span>2. Informasi Semester, Tahun Pelajaran & Tanggal Rapor</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Nama Semester
                  </label>
                  <input
                    type="text"
                    required
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                    placeholder="Contoh: Ganjil"
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] rounded-xl text-xs md:text-sm bg-[#0c1424] text-white focus:outline-none focus:border-emerald-500 transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Tahun Pelajaran
                  </label>
                  <input
                    type="text"
                    required
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    placeholder="Contoh: 2026/2027"
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] rounded-xl text-xs md:text-sm bg-[#0c1424] text-white focus:outline-none focus:border-emerald-500 transition font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Tanggal Pembagian Raport
                  </label>
                  <input
                    type="text"
                    required
                    value={tanggalRaport}
                    onChange={(e) => setTanggalRaport(e.target.value)}
                    placeholder="Contoh: 17 Juni 2026"
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] rounded-xl text-xs md:text-sm bg-[#0c1424] text-white focus:outline-none focus:border-emerald-500 transition font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 3: Tata Letak, Kertas & Posisi Tanda Tangan */}
            <div className="bg-[#080d19] p-4.5 rounded-2xl border border-[#1e2e4a] space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#1e2e4a] pb-2 flex-wrap gap-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>3. Format Dokumen, Kertas & Posisi Tanda Tangan</span>
                </h3>
                <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded font-mono font-bold">
                  Sesuai Standar F4 / A4
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Posisi Tanda Tangan Kepala Sekolah (Highlighted Feature) */}
                <div className="p-3 bg-[#0c1424] rounded-xl border-2 border-emerald-500/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider font-mono">
                      Posisi TTD Kepala Sekolah
                    </label>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                  <select
                    value={signaturePosition}
                    onChange={(e) =>
                      setSignaturePosition(
                        e.target.value as "kanan" | "tengah" | "kiri",
                      )
                    }
                    className="w-full px-3 py-2 border border-emerald-500/60 bg-[#070d18] text-white rounded-lg text-xs focus:outline-none focus:border-emerald-400 font-bold"
                  >
                    <option value="kanan">Kanan (Di Bawah Wali Kelas - Standar)</option>
                    <option value="tengah">Tengah (Di Tengah Halaman)</option>
                    <option value="kiri">Kiri (Di Bawah Orang Tua/Wali)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {signaturePosition === "kanan"
                      ? "✓ Kolom kanan sejajar di bawah tanda tangan Wali Kelas."
                      : signaturePosition === "tengah"
                      ? "✓ Tepat di tengah halaman antara Orang Tua & Wali Kelas."
                      : "✓ Kolom kiri sejajar di bawah tanda tangan Orang Tua."}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Ukuran Kertas Raport
                  </label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#1e2e4a] bg-[#0c1424] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 transition font-bold"
                  >
                    <option value="A4">A4 (Standard 21.0 x 29.7 cm)</option>
                    <option value="F4">
                      F4 / Folio (Standar Sekolah 21.5 x 33.0 cm)
                    </option>
                    <option value="Letter">
                      Letter (Standard 21.59 x 27.94 cm)
                    </option>
                    <option value="Legal">
                      Legal (Standard 21.59 x 35.56 cm)
                    </option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gunakan <strong>F4 / Folio</strong> untuk cetak fisik raport sekolah.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Jenis Font Tipografi
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#1e2e4a] bg-[#0c1424] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 transition font-medium"
                  >
                    <option value="Times New Roman">
                      Times New Roman (Formal Rapor)
                    </option>
                    <option value="Arial">Arial (Modern & Bersih)</option>
                    <option value="Georgia">Georgia (Elegan & Klasik)</option>
                    <option value="Courier New">Courier New (Monospace)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Ukuran Font Dasar
                  </label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#1e2e4a] bg-[#0c1424] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 transition font-medium"
                  >
                    <option value="10pt">Kompak (10pt)</option>
                    <option value="11pt">Standar Rapor (11pt)</option>
                    <option value="12pt">Besar (12pt)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bagian 4: Visibilitas Komponen */}
            <div className="bg-[#080d19] p-4.5 rounded-2xl border border-[#1e2e4a] space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-[#1e2e4a] pb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>4. Visibilitas Bagian & Komponen Rapor</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex items-center gap-3 p-3 bg-[#0c1424] rounded-xl border border-[#1e2e4a] cursor-pointer hover:border-emerald-500/40 transition">
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => setShowLogo(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Logo Kop Sekolah</span>
                    <span className="text-[10px] text-slate-400">Tampilkan kop resmi di atas halaman</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#0c1424] rounded-xl border border-[#1e2e4a] cursor-pointer hover:border-emerald-500/40 transition">
                  <input
                    type="checkbox"
                    checked={showSpiritual}
                    onChange={(e) => setShowSpiritual(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Sikap Spiritual (KI-1)</span>
                    <span className="text-[10px] text-slate-400">Deskripsi capaian spiritual peserta didik</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#0c1424] rounded-xl border border-[#1e2e4a] cursor-pointer hover:border-emerald-500/40 transition">
                  <input
                    type="checkbox"
                    checked={showSosial}
                    onChange={(e) => setShowSosial(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Sikap Sosial (KI-2)</span>
                    <span className="text-[10px] text-slate-400">Deskripsi interaksi sosial & adab</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#0c1424] rounded-xl border border-[#1e2e4a] cursor-pointer hover:border-emerald-500/40 transition">
                  <input
                    type="checkbox"
                    checked={showAttendance}
                    onChange={(e) => setShowAttendance(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Rekap Kehadiran Siswa</span>
                    <span className="text-[10px] text-slate-400">Jumlah Sakit, Izin, dan Tanpa Keterangan</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-[#0c1424] rounded-xl border border-[#1e2e4a] cursor-pointer hover:border-emerald-500/40 transition">
                  <input
                    type="checkbox"
                    checked={showCatatan}
                    onChange={(e) => setShowCatatan(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Catatan Wali Kelas</span>
                    <span className="text-[10px] text-slate-400">Pesan motivasi dan bimbingan wali kelas</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Bagian 5: Pengaturan Watermark */}
            <div className="bg-[#080d19] p-4.5 rounded-2xl border border-[#1e2e4a] space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-[#1e2e4a] pb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400" />
                <span>5. Watermark Cap Lambang Resmi Sekolah</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Ukuran Watermark Raport
                  </label>
                  <select
                    value={watermarkSize}
                    onChange={(e) => setWatermarkSize(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#0c1424] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value={300}>Kecil (300px)</option>
                    <option value={380}>Sedang (380px)</option>
                    <option value={440}>Standar (440px - Direkomendasikan)</option>
                    <option value={500}>Besar (500px)</option>
                    <option value={580}>Sangat Besar (580px)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                    Tingkat Transparansi (Opacity)
                  </label>
                  <select
                    value={watermarkOpacity}
                    onChange={(e) =>
                      setWatermarkOpacity(Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#0c1424] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value={0.03}>Sangat Halus (3%)</option>
                    <option value={0.05}>Tipis (5% - Direkomendasikan)</option>
                    <option value={0.075}>Standar (7.5%)</option>
                    <option value={0.1}>Sedang (10%)</option>
                    <option value={0.15}>Tebal (15%)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={settingsLoading}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer transition disabled:opacity-50 font-mono tracking-wider border border-emerald-400/30"
              >
                <Save className="w-4 h-4" />
                <span>{settingsLoading ? "Menyimpan Format..." : "Simpan Format & Pengaturan Raport"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TEACHER MODAL FORM */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0c1424] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up border border-[#1e2e4a]">
            <div className="bg-[#080d19] px-6 py-4 text-white flex items-center justify-between border-b border-[#1e2e4a]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-100 font-mono">
                  {editingTeacher ? "Edit Akun Guru" : "Tambah Guru Baru"}
                </h3>
              </div>
              <button
                onClick={() => setIsTeacherModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTeacherSubmit} className="p-6 space-y-4">
              {teacherModalError && (
                <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200 flex gap-2 items-start animate-fade-in shadow-md">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span className="font-medium">{teacherModalError}</span>
                </div>
              )}

              {/* Petunjuk Guru Multi-Mapel */}
              <div className="bg-emerald-950/40 border-l-4 border-emerald-500 p-3 rounded-r-xl text-xs text-emerald-200 leading-relaxed space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px] font-mono text-emerald-300">
                  Panduan Guru Multi-Mapel:
                </p>
                <p className="text-slate-300 text-[11px]">
                  Nama lengkap diperbolehkan sama persis. Jika guru mengampu
                  beberapa mata pelajaran sekaligus, silakan buat akun tambahan
                  untuk tiap mapel dengan{" "}
                  <strong className="text-emerald-300">Login Username berbeda</strong> (contoh:{" "}
                  <code className="bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    budi_ipa
                  </code>{" "}
                  dan{" "}
                  <code className="bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    budi_ips
                  </code>
                  ).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 font-mono uppercase tracking-wider">
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
                  className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#070b14] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                  id="teacher-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5 font-mono uppercase tracking-wider">
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
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#070b14] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 font-mono placeholder:text-slate-500"
                    id="teacher-username-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5 font-mono uppercase tracking-wider">
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
                    className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#070b14] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                    id="teacher-password-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                    Mata Pelajaran yang Diampu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTeacherModalOpen(false);
                      setActiveTab("subjects");
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    title="Buka panel untuk menambah atau menghapus mata pelajaran"
                  >
                    + Input Mapel Baru
                  </button>
                </div>
                <select
                  value={teacherForm.subject}
                  onChange={(e) =>
                    setTeacherForm((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#070b14] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 font-medium"
                  id="teacher-subject-select"
                >
                  {subjectsList.map((sub, i) => (
                    <option key={i} value={sub}>
                      {sub}
                    </option>
                  ))}
                  <option value="Admin">Hanya Admin</option>
                </select>
              </div>

              <div className="pt-2 border-t border-[#1e2e4a]">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs md:text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={teacherForm.isWaliKelas}
                    onChange={(e) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        isWaliKelas: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-slate-700 bg-[#070b14] text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">Tugaskan sebagai Wali Kelas</span>
                </label>
              </div>

              {teacherForm.isWaliKelas && (
                <div className="bg-[#070b14] p-3.5 rounded-xl border border-[#1e2e4a] animate-fade-in space-y-1.5">
                  <label className="block text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
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
                    className="w-full px-3 py-2 bg-[#0c1424] border border-[#1e2e4a] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    <option value="1">Kelas 1</option>
                    <option value="2">Kelas 2</option>
                    <option value="3">Kelas 3</option>
                    <option value="4">Kelas 4</option>
                    <option value="5">Kelas 5</option>
                    <option value="6">Kelas 6</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmittingTeacher}
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="w-1/2 py-2.5 border border-[#1e2e4a] text-slate-300 hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTeacher}
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition disabled:opacity-60 shadow-lg shadow-emerald-950/50"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0c1424] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up border border-[#1e2e4a]">
            <div className="bg-[#080d19] px-6 py-4 text-white flex items-center justify-between border-b border-[#1e2e4a]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-100 font-mono">
                  {editingStudent ? "Edit Identitas Siswa" : "Tambah Siswa Baru"}
                </h3>
              </div>
              <button
                onClick={() => setIsStudentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStudentSubmit} className="p-6 space-y-4">
              {studentModalError && (
                <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200 flex gap-2 items-start animate-fade-in shadow-md">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span className="font-semibold">{studentModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 font-mono uppercase tracking-wider">
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
                  className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#070b14] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                  id="student-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 font-mono uppercase tracking-wider">
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
                  className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#070b14] rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 font-mono placeholder:text-slate-500"
                  id="student-nisn-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 font-mono uppercase tracking-wider">
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
                  className="w-full px-3.5 py-2.5 border border-[#1e2e4a] bg-[#070b14] text-white rounded-xl text-xs md:text-sm focus:outline-none focus:border-emerald-500 font-medium"
                  id="student-class-select"
                >
                  <option value="1">Kelas 1</option>
                  <option value="2">Kelas 2</option>
                  <option value="3">Kelas 3</option>
                  <option value="4">Kelas 4</option>
                  <option value="5">Kelas 5</option>
                  <option value="6">Kelas 6</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmittingStudent}
                  onClick={() => setIsStudentModalOpen(false)}
                  className="w-1/2 py-2.5 border border-[#1e2e4a] text-slate-300 hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStudent}
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition disabled:opacity-60 shadow-lg shadow-emerald-950/50"
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0c1424] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-scale-up my-4 border border-[#1e2e4a] flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-[#080d19] px-5 sm:px-6 py-4 text-white flex items-center justify-between border-b border-[#1e2e4a] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-sm">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider text-slate-100 font-mono flex items-center gap-2">
                    <span>Input Siswa Cepat (Sistem Copy-Paste)</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-sans font-bold">
                      Praktis & Instan
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-normal">
                    Salin (copy) data siswa dari Excel, Sheets, Word, atau chat WhatsApp & tempel langsung di sini
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsBatchStudentModalOpen(false);
                  setBatchResult(null);
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Batch Result Banner */}
              {batchResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-fade-in shadow-md ${
                    batchResult.success
                      ? "bg-emerald-950/70 border-emerald-500/70 text-emerald-200"
                      : "bg-red-950/70 border-red-500/70 text-red-200"
                  }`}
                >
                  {batchResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1.5 flex-1">
                    <p className="font-bold text-white text-sm">
                      {batchResult.success
                        ? `Alhamdulillah! Berhasil menambahkan ${batchResult.addedCount} siswa baru ke dalam sistem.`
                        : "Gagal menyimpan data siswa."}
                    </p>
                    {batchResult.duplicatesCount > 0 && (
                      <p className="text-xs text-amber-300 font-medium">
                        Catatan: {batchResult.duplicatesCount} siswa dilewati karena NISN sudah pernah terdaftar di database.
                      </p>
                    )}
                    {batchResult.errors.length > 0 && (
                      <div className="text-xs text-red-300 space-y-0.5 pt-1">
                        {batchResult.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="bg-[#070b14] border border-[#1e2e4a] rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* One-click Paste from Clipboard button */}
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-blue-950/60 font-mono"
                      title="Tempel teks langsung dari clipboard komputer / HP Anda"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>Tempel Clipboard (Paste)</span>
                    </button>

                    {/* Format Title-Case button */}
                    {batchRawText.trim() && (
                      <button
                        type="button"
                        onClick={handleTitleCaseNames}
                        className="px-3 py-1.5 bg-[#0c1424] hover:bg-[#16233b] border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                        title="Rapikan huruf kapital pada nama siswa (Title Case)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Rapikan Huruf Nama</span>
                      </button>
                    )}

                    {/* Sample Fill Buttons */}
                    <button
                      type="button"
                      onClick={() => fillSampleBatchData("standard")}
                      className="px-2.5 py-1.5 bg-[#0c1424] border border-[#1e2e4a] hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition"
                      title="Isi contoh format standar (NISN, Nama, Kelas)"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Contoh Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fillSampleBatchData("names_only")}
                      className="px-2.5 py-1.5 bg-[#0c1424] border border-[#1e2e4a] hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition"
                      title="Isi contoh format hanya daftar nama siswa (satu per baris)"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Contoh Hanya Nama</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyTemplateColumns}
                      className="px-2.5 py-1.5 bg-[#0c1424] border border-[#1e2e4a] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer transition"
                      title="Salin judul kolom Excel ke clipboard"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Salin Header</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="px-2.5 py-1.5 bg-[#0c1424] border border-[#1e2e4a] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer transition"
                      title="Unduh template Excel / CSV siap pakai"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>Unduh CSV</span>
                    </button>
                    {batchRawText && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchRawText("");
                          setParsedOverrides({});
                          setBatchResult(null);
                        }}
                        className="px-2.5 py-1.5 bg-red-950/40 border border-red-500/40 hover:bg-red-900/50 text-red-300 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>Bersihkan</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Configurations Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-[#1e2e4a] items-center">
                  <div className="sm:col-span-5 flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-200 font-mono shrink-0">
                      Kelas Default:
                    </label>
                    <select
                      value={batchDefaultClass}
                      onChange={(e) => setBatchDefaultClass(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-[#1e2e4a] rounded-lg bg-[#0c1424] font-bold text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      <option value="1">Kelas 1</option>
                      <option value="2">Kelas 2</option>
                      <option value="3">Kelas 3</option>
                      <option value="4">Kelas 4</option>
                      <option value="5">Kelas 5</option>
                      <option value="6">Kelas 6</option>
                    </select>
                    {parsedBatchStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleApplyClassToAll(batchDefaultClass)}
                        className="px-2 py-1 text-[11px] bg-[#0c1424] hover:bg-[#16233b] border border-blue-500/40 text-blue-300 rounded-lg font-semibold cursor-pointer transition whitespace-nowrap"
                        title="Terapkan kelas terpilih ke semua baris siswa di bawah"
                      >
                        Terapkan ke Semua
                      </button>
                    )}
                  </div>

                  <div className="sm:col-span-7">
                    <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoGenerateMissingNisn}
                        onChange={(e) => setAutoGenerateMissingNisn(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-[#0c1424] text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-medium text-slate-300">
                        Buat <strong className="text-emerald-300">NIS/NISN sementara otomatis</strong> jika kolom NISN kosong
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Textarea Input Container */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                    Kotak Tempel (Paste) Teks Siswa:
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Dukung tab, koma, titik koma, strip (-), atau hanya nama per baris
                  </span>
                </div>
                <textarea
                  value={batchRawText}
                  onChange={(e) => {
                    setBatchRawText(e.target.value);
                    if (batchResult) setBatchResult(null);
                  }}
                  rows={5}
                  placeholder={`Contoh tempel (paste) langsung dari Excel:\n0012984101\tAhmad Fauzi Ramadhan\t1\n0012984102\tAisyah Putri Azzahra\t1\n\nAtau cukup tempel daftar nama saja (satu per baris):\nMuhammad Rizky Pratama\nSiti Nurhaliza\nFarhan Al-Ghifari`}
                  className="w-full p-3.5 border border-[#1e2e4a] rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y bg-[#070b14] text-white placeholder:text-slate-500 transition leading-relaxed shadow-inner"
                ></textarea>
              </div>

              {/* Parsing Telemetry Summary & Interactive Editable Table */}
              {batchRawText.trim() && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-[#070b14] text-slate-300 border border-[#1e2e4a] font-bold text-xs">
                        Total Baris: {parsedBatchStudents.length}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 font-bold text-xs">
                        Siap Disimpan: {parsedBatchStudents.filter((p) => !p.excluded && p.status === "valid").length}
                      </span>
                      {parsedBatchStudents.some((p) => p.isAutoNisn) && (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-500/50 font-bold text-xs">
                          NIS Otomatis: {parsedBatchStudents.filter((p) => p.isAutoNisn).length}
                        </span>
                      )}
                      {parsedBatchStudents.some((p) => p.status !== "valid") && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-500/50 font-bold text-xs">
                          Perlu Perhatian / Duplikat: {parsedBatchStudents.filter((p) => p.status !== "valid").length}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      * Kolom NISN, Nama, dan Kelas dapat diedit langsung pada tabel di bawah
                    </span>
                  </div>

                  {/* Interactive Table */}
                  <div className="border border-[#1e2e4a] rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#080d19] sticky top-0 border-b border-[#1e2e4a] z-10">
                        <tr>
                          <th className="p-2.5 font-bold text-slate-300 w-10 text-center font-mono">No</th>
                          <th className="p-2.5 font-bold text-slate-300 w-36 font-mono">NISN / NIS</th>
                          <th className="p-2.5 font-bold text-slate-300">Nama Siswa</th>
                          <th className="p-2.5 font-bold text-slate-300 w-28">Kelas</th>
                          <th className="p-2.5 font-bold text-slate-300 text-center w-36">Status</th>
                          <th className="p-2.5 font-bold text-slate-300 text-center w-12">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2e4a]">
                        {parsedBatchStudents.map((item, idx) => (
                          <tr
                            key={idx}
                            className={`transition ${
                              item.excluded
                                ? "bg-slate-900/30 opacity-40"
                                : item.status === "valid"
                                ? "bg-emerald-950/15 hover:bg-emerald-950/30"
                                : "bg-red-950/15 hover:bg-red-950/30"
                            }`}
                          >
                            <td className="p-2 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            {/* Editable NISN Input */}
                            <td className="p-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={item.nisn}
                                  onChange={(e) => {
                                    setParsedOverrides((prev) => ({
                                      ...prev,
                                      [item.index]: {
                                        ...prev[item.index],
                                        nisn: e.target.value.replace(/\D/g, ""),
                                      },
                                    }));
                                  }}
                                  placeholder="NISN"
                                  className="w-full px-2 py-1 bg-[#070b14] border border-[#1e2e4a] rounded text-xs text-white font-mono focus:outline-none focus:border-blue-500 font-bold"
                                />
                                {item.isAutoNisn && (
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-blue-400 font-mono font-bold bg-blue-950 px-1 rounded pointer-events-none">
                                    Auto
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Editable Name Input */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  setParsedOverrides((prev) => ({
                                    ...prev,
                                    [item.index]: {
                                      ...prev[item.index],
                                      name: e.target.value,
                                    },
                                  }));
                                }}
                                placeholder="Nama lengkap siswa..."
                                className="w-full px-2.5 py-1 bg-[#070b14] border border-[#1e2e4a] rounded text-xs text-white font-medium focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            {/* Editable Class Select */}
                            <td className="p-2 font-mono">
                              <select
                                value={item.kelas}
                                onChange={(e) => {
                                  setParsedOverrides((prev) => ({
                                    ...prev,
                                    [item.index]: {
                                      ...prev[item.index],
                                      kelas: e.target.value,
                                    },
                                  }));
                                }}
                                className="w-full px-2 py-1 bg-[#070b14] border border-[#1e2e4a] rounded text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                              >
                                <option value="1">Kelas 1</option>
                                <option value="2">Kelas 2</option>
                                <option value="3">Kelas 3</option>
                                <option value="4">Kelas 4</option>
                                <option value="5">Kelas 5</option>
                                <option value="6">Kelas 6</option>
                              </select>
                            </td>
                            {/* Status Indicator */}
                            <td className="p-2 text-center">
                              {item.excluded ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                                  Dilewati
                                </span>
                              ) : item.status === "valid" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold font-mono">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>{item.isAutoNisn ? "Valid (Auto)" : "Siap Simpan"}</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/50 text-[10px] font-bold"
                                  title={item.message}
                                >
                                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span className="truncate max-w-[90px]">{item.message}</span>
                                </span>
                              )}
                            </td>
                            {/* Exclude / Delete Row Action */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setParsedOverrides((prev) => ({
                                    ...prev,
                                    [item.index]: {
                                      ...prev[item.index],
                                      excluded: !item.excluded,
                                    },
                                  }));
                                }}
                                className={`p-1 rounded cursor-pointer transition ${
                                  item.excluded
                                    ? "text-slate-500 hover:text-emerald-400"
                                    : "text-slate-400 hover:text-red-400"
                                }`}
                                title={item.excluded ? "Batal lewati baris ini" : "Lewati/hapus baris ini dari penyimpanan"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-[#080d19] px-5 sm:px-6 py-4 border-t border-[#1e2e4a] flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400 font-mono">
                {parsedBatchStudents.filter((p) => !p.excluded && p.status === "valid").length > 0 ? (
                  <span>
                    Siap disimpan: <strong className="text-emerald-400">{parsedBatchStudents.filter((p) => !p.excluded && p.status === "valid").length}</strong> dari total {parsedBatchStudents.length} siswa
                  </span>
                ) : (
                  <span>Silakan tempel data siswa terlebih dahulu</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={isSubmittingBatch}
                  onClick={() => {
                    setIsBatchStudentModalOpen(false);
                    setBatchResult(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 border border-[#1e2e4a] text-slate-300 hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={
                    isSubmittingBatch ||
                    parsedBatchStudents.filter((p) => !p.excluded && p.status === "valid").length === 0
                  }
                  onClick={handleBatchStudentSubmit}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-40 shadow-lg shadow-emerald-950/70 border border-emerald-400/30"
                >
                  {isSubmittingBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        Simpan Semua (
                        {parsedBatchStudents.filter((p) => !p.excluded && p.status === "valid").length} Siswa)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0c1424] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1e2e4a] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 mt-0.5 shadow-sm">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  {deleteConfirm.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {deleteConfirm.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteConfirmLoading}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Data yang dihapus akan langsung hilang dari website dan database.</span>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#1e2e4a]">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteConfirmLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleteConfirmLoading(true);
                  try {
                    await deleteConfirm.onConfirm();
                    setDeleteConfirm(null);
                  } catch (err: any) {
                    setError(err.message || "Gagal menghapus data.");
                  } finally {
                    setDeleteConfirmLoading(false);
                  }
                }}
                disabled={deleteConfirmLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl shadow-lg shadow-red-950/50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleteConfirmLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteConfirm.confirmLabel || "Ya, Hapus"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
