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
          if (["1", "2", "3", "4", "5", "6"].includes(k)) kelas = k;
          else kelas = tokens[2];
        }
      } else if (tokens.length >= 4) {
        nisn = tokens[1].replace(/\D/g, "");
        name = tokens[2];
        const k = tokens[3].replace(/\D/g, "");
        if (["1", "2", "3", "4", "5", "6"].includes(k)) kelas = k;
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
    const sample = `0012984101\tAhmad Fauzi Ramadhan\t1
0012984102\tAisyah Putri Azzahra\t1
0012984103\tBilal Al-Ghifari\t2
0012984104\tFatimah Az-Zahra\t3
0012984105\tMuhammad Farhan Hakim\t4
0012984106\tZahra Nurul Izzah\t5`;
    setBatchRawText(sample);
  };

  const handleBatchStudentSubmit = async () => {
    const validStudents = parsedBatchStudents
      .filter((p) => p.status === "valid")
      .map((p) => ({
        nisn: p.nisn,
        name: p.name,
        kelas: p.kelas || batchDefaultClass || "1",
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

  const handleDeleteSubject = async (subjectName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus mata pelajaran "${subjectName}"? Seluruh template TP terkait mapel ini akan ikut dihapus.`)) {
      return;
    }
    setError("");
    setDeletingSubject(subjectName);
    try {
      const res = await fetch(`/api/subjects/${encodeURIComponent(subjectName)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus mata pelajaran.");
      }

      showSuccess(`Mata pelajaran "${subjectName}" berhasil dihapus.`);
      await fetchAllData();
      onRefreshTrigger();
    } catch (err: any) {
      setError(err.message || "Gagal menghapus mata pelajaran.");
    } finally {
      setDeletingSubject(null);
    }
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
        className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto"
        id="admin-nav-tabs"
      >
        <button
          onClick={() => setActiveTab("teachers")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "teachers" ? "border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          <Users className="w-3.5 h-3.5" /> Manajemen Guru
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeTab === "students" ? "border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          <GraduationCap className="w-3.5 h-3.5" /> Manajemen Siswa
        </button>
        <button
          onClick={() => setActiveTab("subjects")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeTab === "subjects" ? "border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          <BookMarked className="w-3.5 h-3.5" />
          <span>Kelola Mapel</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            {subjectsList.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("tps")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeTab === "tps" ? "border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Template TP (Mata Pelajaran)
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "settings" ? "border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          <UserCheck className="w-3.5 h-3.5" /> Pengaturan Raport
        </button>
        <button
          onClick={() => setActiveTab("ekskul")}
          className={`py-1.5 px-3.5 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "ekskul" ? "border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          <Award className="w-3.5 h-3.5" /> Manajemen Ekskul
        </button>
      </div>

      {/* TEACHERS TAB */}
      {activeTab === "teachers" && (
        <div
          className="bg-white dark:bg-slate-900 rounded-lg border border-slate-205 dark:border-slate-800 shadow-sm p-4"
          id="teacher-management-panel"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Daftar Guru & Hak Akses
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-400">
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
                  subject: subjectsList[0] || "PAI",
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
            <table className="w-full text-left text-xs md:text-sm border-collapse text-gray-700 dark:text-slate-200">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800">
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Nama Guru
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Login Username
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Keamanan Sandi
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Mata Pelajaran (Mapel)
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Tugas Wali Kelas
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/30 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-gray-850 dark:text-slate-100">{t.name}</td>
                    <td className="p-3 font-mono text-emerald-800 dark:text-emerald-400 font-bold">
                      {t.username}
                    </td>
                    <td className="p-3 font-mono text-gray-400 dark:text-slate-500 font-bold">
                      &#8226;&#8226;&#8226;&#8226;&#8226;&#8226;
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${t.subject === "Admin" ? "bg-red-150 dark:bg-rose-950/60 text-red-800 dark:text-rose-300 border-red-200 dark:border-rose-800/60" : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"}`}
                      >
                        {t.subject}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {t.isWaliKelas ? (
                        <span className="text-green-700 dark:text-emerald-300 bg-green-50 dark:bg-emerald-950/60 border border-green-200 dark:border-emerald-700/60 py-0.5 px-2.5 rounded-full font-semibold">
                          Wali Kelas {t.kelas}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-slate-500 italic">Bukan Wali</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {t.id === "t1" ? (
                        <span className="text-2xs text-gray-400 dark:text-slate-400 italic bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-1 rounded">
                          Utama
                        </span>
                      ) : (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => startEditTeacher(t)}
                            className="p-1 text-sky-650 hover:bg-sky-50 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                            title="Edit Guru"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTeacher(t.id)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded transition cursor-pointer"
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
          className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-4"
          id="student-management-panel"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daftar & Manajemen Siswa SD
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-extrabold font-mono">
                  {students.length} Total Siswa
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-400">
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
                    kelas: "1",
                  });
                  setIsStudentModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 active:bg-black text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Satu Siswa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-4">
            {/* Total Siswa Card */}
            <div
              onClick={() => setStudentClassFilter("all")}
              className={`p-2.5 rounded-lg border transition cursor-pointer ${
                studentClassFilter === "all"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-700/40"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-emerald-900 dark:text-emerald-300 text-xs font-black block">
                    Semua Siswa
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                    Total Terdaftar
                  </span>
                </div>
                <span className="text-base font-black text-emerald-800 dark:text-emerald-400 font-mono">
                  {students.length}
                </span>
              </div>
            </div>

            {/* Quick Filter Info Cards for Classes 1 through 6 */}
            {["1", "2", "3", "4", "5", "6"].map((cls) => {
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
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-700/40"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-blue-900 dark:text-blue-300 text-xs font-black block">
                        Kelas {cls}
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                        Siswa Terdaftar
                      </span>
                    </div>
                    <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
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
                { id: "1", label: `Kelas 1 (${students.filter(s => String(s.kelas).trim() === "1").length})` },
                { id: "2", label: `Kelas 2 (${students.filter(s => String(s.kelas).trim() === "2").length})` },
                { id: "3", label: `Kelas 3 (${students.filter(s => String(s.kelas).trim() === "3").length})` },
                { id: "4", label: `Kelas 4 (${students.filter(s => String(s.kelas).trim() === "4").length})` },
                { id: "5", label: `Kelas 5 (${students.filter(s => String(s.kelas).trim() === "5").length})` },
                { id: "6", label: `Kelas 6 (${students.filter(s => String(s.kelas).trim() === "6").length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStudentClassFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer shrink-0 ${
                    studentClassFilter === tab.id
                      ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-transparent dark:border-slate-700/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Cari nama atau NISN..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse text-gray-700 dark:text-slate-200">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800">
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-12 text-center">
                    No
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Nama Siswa
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    NISN Siswa
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Kelas
                  </th>
                  <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 dark:text-slate-500 text-xs">
                      Tidak ada data siswa yang cocok dengan filter atau pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center text-gray-400 dark:text-slate-500 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-bold text-gray-800 dark:text-slate-100">{s.name}</td>
                      <td className="p-3 font-mono text-gray-500 dark:text-slate-400">{s.nisn}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-850 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded text-xs font-bold font-mono">
                          Kelas {s.kelas}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => startEditStudent(s)}
                            className="p-1 text-sky-650 hover:bg-sky-50 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                            title="Edit Siswa"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteStudent(s.id)}
                            className="p-1 text-red-650 hover:bg-red-50 dark:hover:bg-slate-800 rounded transition cursor-pointer"
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

      {/* SUBJECTS (MATA PELAJARAN) TAB */}
      {activeTab === "subjects" && (
        <div
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 space-y-6 animate-fade-in"
          id="subjects-management-panel"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Daftar & Manajemen Mata Pelajaran (Mapel)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-extrabold font-mono">
                  {subjectsList.length} Mata Pelajaran
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                Kelola mata pelajaran SD Islam Smart Pangkalpinang. Tambahkan mata pelajaran baru atau hapus mata pelajaran yang tidak digunakan.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={subjectSearchQuery}
                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                placeholder="Cari mata pelajaran..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {subjectSearchQuery && (
                <button
                  onClick={() => setSubjectSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Form to Add New Subject */}
          <form
            onSubmit={handleAddSubject}
            className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-800/50 rounded-xl flex flex-col sm:flex-row gap-3 items-end shadow-3xs"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-1.5">
                Nama Mata Pelajaran Baru
              </label>
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Contoh: Seni Budaya, Bahasa Daerah, Koding & Robotik..."
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={subjectLoading || !newSubjectName.trim()}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Plus className="w-4 h-4" />
              {subjectLoading ? "Menyimpan..." : "Tambah Mapel"}
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
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-emerald-300 dark:hover:border-emerald-600/60 hover:shadow-xs transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xs font-bold font-mono border border-emerald-200 dark:border-emerald-800/60">
                            {index + 1}
                          </span>
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {sub}
                          </h3>
                        </div>
                        <button
                          onClick={() => handleDeleteSubject(sub)}
                          disabled={isDeleting}
                          title="Hapus Mata Pelajaran"
                          className="text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-slate-800 p-1.5 rounded-lg transition cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1.5 pt-2 text-xs">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span className="text-[11px]">Guru Pengampu:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                            {assignedTeacher ? assignedTeacher.name : "Belum Ditugaskan"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span className="text-[11px]">Template TP:</span>
                          <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded text-[10px] border border-emerald-100 dark:border-emerald-800/60">
                            {tpsCount} Capaian
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                        ID: {sub.toLowerCase().replace(/[^a-z0-9]/g, "_")}
                      </span>
                      <button
                        onClick={() => {
                          setTpForm((prev) => ({ ...prev, subject: sub }));
                          setActiveTab("tps");
                        }}
                        className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold hover:underline cursor-pointer"
                      >
                        Lihat TP &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {subjectsList.filter((sub) =>
            sub.toLowerCase().includes(subjectSearchQuery.toLowerCase())
          ).length === 0 && (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Tidak ada mata pelajaran yang cocok dengan pencarian "{subjectSearchQuery}".
              </p>
            </div>
          )}
        </div>
      )}

      {/* TPS (MATA PELAJARAN / LEARNING OBJECTIVES TEMPLATES) TAB */}
      {activeTab === "tps" && (
        <div
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 space-y-6 animate-fade-in"
          id="tp-templates-panel"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <span>Template Capaian / Tujuan Pembelajaran (TP)</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Berdasarkan Kelas
                </span>
              </h2>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                Setiap tingkat rombel (Kelas 1 sampai 6) memiliki Capaian Pembelajaran dan TP spesifik sesuai Kurikulum Merdeka.
              </p>
            </div>

            {/* Filter by class buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg overflow-x-auto border border-transparent dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 shrink-0">
                Filter:
              </span>
              {[
                { id: "all", label: "Semua Tingkat" },
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
                  className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer shrink-0 ${
                    tpFilterClass === tab.id
                      ? "bg-white dark:bg-emerald-900/60 text-emerald-850 dark:text-emerald-300 shadow-xs border dark:border-emerald-500/40"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
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
            className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-800/50 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end shadow-3xs"
          >
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                  Mata Pelajaran
                </label>
                <button
                  type="button"
                  onClick={() => setActiveTab("subjects")}
                  className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                  title="Buka panel input dan kelola mata pelajaran"
                >
                  <Plus className="w-3 h-3" /> Input/Hapus Mapel
                </button>
              </div>
              <select
                value={tpForm.subject}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, subject: e.target.value }))
                }
                className="w-full p-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
              >
                {subjectsList.map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-1.5">
                Tingkat Kelas
              </label>
              <select
                value={tpForm.kelas}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, kelas: e.target.value }))
                }
                className="w-full p-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 font-bold text-slate-800 dark:text-slate-100 transition"
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
              <label className="block text-xs font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-1.5">
                Deskripsi Ringkas Tujuan Pembelajaran (TP)
              </label>
              <input
                type="text"
                value={tpForm.text}
                onChange={(e) =>
                  setTpForm((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="Contoh: Mengidentifikasi rumus kuadratik dan diagram koordinat..."
                className="w-full p-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                  className="bg-white dark:bg-slate-850 rounded-xl border border-gray-150 dark:border-slate-800 p-4 shadow-3xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2.5 mb-3">
                      <span className="px-3 py-1 bg-emerald-800 dark:bg-emerald-900 text-white rounded text-2xs uppercase tracking-wider font-bold border dark:border-emerald-700/50">
                        {subject}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                        {items.length} TP {tpFilterClass !== "all" ? `(Kelas ${tpFilterClass})` : "Total"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-2xs text-gray-450 dark:text-slate-500 italic py-3 text-center bg-gray-50/50 dark:bg-slate-900/60 rounded-lg border border-dashed border-gray-200 dark:border-slate-800">
                          Belum ada tujuan pembelajaran {tpFilterClass !== "all" ? `untuk Kelas ${tpFilterClass}` : ""} pada mapel ini.
                        </p>
                      ) : (
                        items.map((item) => {
                          const itemClass = String(item.kelas || "1").trim();
                          const badgeColor =
                            itemClass === "1"
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/60"
                              : itemClass === "2"
                              ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700/60"
                              : itemClass === "3"
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/60"
                              : itemClass === "4"
                              ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/60"
                              : itemClass === "5"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/60"
                              : itemClass === "6"
                              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700/60"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

                          return (
                            <div
                              key={item.id}
                              className="p-2.5 bg-gray-50/60 dark:bg-slate-900/60 rounded-lg border border-gray-150 dark:border-slate-800 flex items-start justify-between gap-3 text-xs hover:bg-emerald-50/20 dark:hover:bg-slate-800/80 transition"
                            >
                              <div className="flex-1 space-y-1">
                                <p className="text-gray-800 dark:text-slate-200 leading-relaxed text-justify">
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
                                className="text-red-500 hover:text-red-700 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-slate-800 transition cursor-pointer shrink-0 mt-0.5"
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
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-800 shadow-sm p-6 max-w-2xl animate-fade-in"
          id="school-settings-panel"
        >
          <div className="mb-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <span>Pengaturan Format & Atribut Raport</span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Akses Admin
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">
              Sesuaikan identitas, tampilan, font, ukuran, serta bagian-bagian
              format yang ingin ditampilkan pada cetak raport siswa.
            </p>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-6">
            {/* Bagian 1: Identitas Kepala Sekolah */}
            <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-1">
                1. Identitas Penandatangan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Kepala Sekolah & Gelar
                  </label>
                  <input
                    type="text"
                    required
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="Contoh: Ustadz H. Ir. Abdul Muhyi, M.Pd"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    required
                    value={principalNip}
                    onChange={(e) => setPrincipalNip(e.target.value)}
                    placeholder="Contoh: 19780512 200501 1 002"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Kustomisasi Teks & Sesi */}
            <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-1">
                2. Informasi Semester, Tahun Pelajaran & Tanggal Rapor
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Semester
                  </label>
                  <input
                    type="text"
                    required
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                    placeholder="Contoh: Ganjil"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Tahun Pelajaran
                  </label>
                  <input
                    type="text"
                    required
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    placeholder="Contoh: 2026/2027"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Tanggal Pembagian Raport
                  </label>
                  <input
                    type="text"
                    required
                    value={tanggalRaport}
                    onChange={(e) => setTanggalRaport(e.target.value)}
                    placeholder="Contoh: 17 Juni 2026"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 3: Tata Letak & Gaya */}
            <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-1">
                3. Gaya & Desain Cetak
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Jenis Font Word/Cetak
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
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
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Ukuran Font Dasar
                  </label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
                  >
                    <option value="10pt">Sangat Kecil (10pt)</option>
                    <option value="11pt">Standar (11pt)</option>
                    <option value="12pt">Besar (12pt)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Ukuran Kertas Raport
                  </label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition"
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
            <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-1">
                4. Visibilitas Elemen Raport
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 dark:text-slate-300">
                <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => setShowLogo(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Logo Kop Sekolah</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={showSpiritual}
                    onChange={(e) => setShowSpiritual(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Aspek Sikap Spiritual</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={showSosial}
                    onChange={(e) => setShowSosial(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Aspek Sikap Sosial</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={showAttendance}
                    onChange={(e) => setShowAttendance(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                  />
                  <span>Tampilkan Presensi Kehadiran</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition text-nowrap">
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
            <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-1">
                5. Pengaturan Watermark
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Ukuran Watermark Raport
                  </label>
                  <select
                    value={watermarkSize}
                    onChange={(e) => setWatermarkSize(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value={300}>Kecil (300px)</option>
                    <option value={380}>Sedang (380px)</option>
                    <option value={440}>Standar (440px)</option>
                    <option value={500}>Besar (500px)</option>
                    <option value={580}>Sangat Besar (580px)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Transparansi Watermark
                  </label>
                  <select
                    value={watermarkOpacity}
                    onChange={(e) =>
                      setWatermarkOpacity(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
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
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-fit">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
              <span>Tambah Ekskul Baru</span>
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mb-4">
              Tambahkan nama dan tentukan tipe kegiatan ekstrakurikuler baru ke
              dalam daftar sekolah.
            </p>

            <form onSubmit={handleAddEkskul} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Nama Kegiatan
                </label>
                <input
                  type="text"
                  required
                  value={newEkskulName}
                  onChange={(e) => setNewEkskulName(e.target.value)}
                  placeholder="Contoh: Futsal, Voli, Pramuka"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Tipe Ekstrakurikuler
                </label>
                <select
                  value={newEkskulType}
                  onChange={(e) =>
                    setNewEkskulType(e.target.value as "Wajib" | "Pilihan")
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
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
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Daftar Kegiatan Ekstrakurikuler ({ekskuls.length})
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-400">
                Daftar kegiatan ekstrakurikuler yang aktif dan dapat dinilai
                oleh Wali Kelas pada rapor siswa.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse text-slate-800 dark:text-slate-200">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ekskuls.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-400 dark:text-slate-500 italic"
                      >
                        Belum ada kegiatan ekstrakurikuler. Silakan tambahkan di
                        form sebelah kiri.
                      </td>
                    </tr>
                  ) : (
                    ekskuls.map((e, idx) => (
                      <tr
                        key={e.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-405 dark:text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                          {e.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${e.type === "Wajib" ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700/60" : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-700/60"}`}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteEkskul(e.id)}
                            className="p-1 hover:bg-red-50 dark:hover:bg-slate-800 text-red-500 dark:text-red-400 rounded transition cursor-pointer"
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
            <div className="bg-emerald-800 dark:bg-emerald-950 px-6 py-4 text-white flex items-center justify-between border-b dark:border-emerald-800/40">
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
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg text-xs text-red-700 dark:text-red-300 flex gap-2 items-start animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <span className="font-semibold">{teacherModalError}</span>
                </div>
              )}

              {/* Petunjuk Guru Multi-Mapel */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600 dark:border-emerald-500 p-3 rounded-r-lg text-2xs md:text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px]">
                  Panduan Guru Multi-Mapel:
                </p>
                <p>
                  Nama lengkap diperbolehkan sama persis. Jika guru mengampu
                  beberapa mata pelajaran sekaligus, silakan buat akun tambahan
                  untuk tiap mapel dengan{" "}
                  <strong>Login Username yang berbeda</strong> (contoh:{" "}
                  <code className="bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-1 rounded">
                    budi_ipa
                  </code>{" "}
                  dan{" "}
                  <code className="bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-1 rounded">
                    budi_ips
                  </code>
                  ).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 dark:text-slate-300 mb-1.5">
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
                  className="w-full px-3 py-2 border border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  id="teacher-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-750 dark:text-slate-300 mb-1.5">
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
                    className="w-full px-3 py-2 border border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 font-mono text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    id="teacher-username-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-750 dark:text-slate-300 mb-1.5">
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
                    className="w-full px-3 py-2 border border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    id="teacher-password-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-750 dark:text-slate-300">
                    Mata Pelajaran yang Diampu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTeacherModalOpen(false);
                      setActiveTab("subjects");
                    }}
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
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
                  className="w-full px-3 py-2 border border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
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

              <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm text-gray-800 dark:text-slate-200">
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
                <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-lg border border-gray-150 dark:border-slate-700 animate-fade-in">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
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
                    className="w-full p-2 bg-white dark:bg-slate-950 border border-gray-250 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={isSubmittingTeacher}
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="w-1/2 py-2.5 border border-gray-250 dark:border-slate-700 text-gray-650 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
            <div className="bg-emerald-800 dark:bg-emerald-950 px-6 py-4 text-white flex items-center justify-between border-b dark:border-emerald-800/40">
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
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg text-xs text-red-700 dark:text-red-300 flex gap-2 items-start animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <span className="font-semibold">{studentModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-750 dark:text-slate-300 mb-1.5">
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
                  className="w-full px-3 py-2 border border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  id="student-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 dark:text-slate-300 mb-1.5">
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
                  className="w-full px-3 py-2 border border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  id="student-nisn-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 dark:text-slate-300 mb-1.5">
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
                  className="w-full px-3 py-2 border border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={isSubmittingStudent}
                  onClick={() => setIsStudentModalOpen(false)}
                  className="w-1/2 py-2.5 border border-gray-250 dark:border-slate-700 text-gray-650 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-scale-up my-6 border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="bg-emerald-850 dark:bg-emerald-950 px-6 py-4 text-white flex items-center justify-between border-b dark:border-emerald-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-700/60 dark:bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center">
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
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
                      : "bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200"
                  }`}
                >
                  {batchResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold">
                      {batchResult.success
                        ? `Alhamdulillah! Berhasil menambahkan ${batchResult.addedCount} siswa baru ke sistem.`
                        : "Gagal menyimpan data siswa massal."}
                    </p>
                    {batchResult.duplicatesCount > 0 && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                        Catatan: {batchResult.duplicatesCount} siswa dilewati karena NISN sudah terdaftar.
                      </p>
                    )}
                    {batchResult.errors.length > 0 && (
                      <div className="text-[11px] text-red-700 dark:text-red-300">
                        {batchResult.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guide and Controls Toolbar */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Kelas Default:
                    </label>
                    <select
                      value={batchDefaultClass}
                      onChange={(e) => setBatchDefaultClass(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="1">Kelas 1</option>
                      <option value="2">Kelas 2</option>
                      <option value="3">Kelas 3</option>
                      <option value="4">Kelas 4</option>
                      <option value="5">Kelas 5</option>
                      <option value="6">Kelas 6</option>
                    </select>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400">
                      (Digunakan bila kolom kelas tidak diisi di teks)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fillSampleBatchData}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Isi Contoh Format
                    </button>
                    {batchRawText && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchRawText("");
                          setBatchResult(null);
                        }}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" /> Bersihkan
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-200 block mb-0.5">
                    Format yang Didukung (Bisa langsung blok & copy dari Excel / Spreadsheet):
                  </span>
                  <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5">
                    <div>Format 1: <strong className="text-emerald-700 dark:text-emerald-400">NISN [Tab/Koma] Nama Lengkap Siswa [Tab/Koma] Kelas</strong></div>
                    <div>Format 2: <strong className="text-emerald-700 dark:text-emerald-400">NISN [Tab/Koma] Nama Lengkap Siswa</strong> (Kelas otomatis ikut Kelas Default)</div>
                  </div>
                </div>
              </div>

              {/* Textarea Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tempelkan (Paste) Teks Data Siswa Di Bawah Ini:
                </label>
                <textarea
                  value={batchRawText}
                  onChange={(e) => {
                    setBatchRawText(e.target.value);
                    if (batchResult) setBatchResult(null);
                  }}
                  rows={6}
                  placeholder={`Contoh tempel (paste):&#10;0012984101\tAhmad Fauzi Ramadhan\t1&#10;0012984102\tAisyah Putri Azzahra\t1&#10;0012984103\tBilal Al-Ghifari\t2`}
                  className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 resize-y shadow-inner bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                ></textarea>
              </div>

              {/* Parsing Telemetry Summary */}
              {batchRawText.trim() && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border dark:border-slate-700 font-bold text-[11px]">
                        Total Baris: {parsedBatchStudents.length}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-[11px]">
                        Siap Disimpan: {parsedBatchStudents.filter((p) => p.status === "valid").length}
                      </span>
                      {parsedBatchStudents.some((p) => p.status !== "valid") && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold text-[11px]">
                          Bermasalah / Duplikat: {parsedBatchStudents.filter((p) => p.status !== "valid").length}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400">
                      Pratinjau Data Sebelum Disimpan
                    </span>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-950 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2 font-bold text-slate-600 dark:text-slate-300 w-10 text-center">No</th>
                          <th className="p-2 font-bold text-slate-600 dark:text-slate-300">NISN</th>
                          <th className="p-2 font-bold text-slate-600 dark:text-slate-300">Nama Siswa</th>
                          <th className="p-2 font-bold text-slate-600 dark:text-slate-300">Kelas</th>
                          <th className="p-2 font-bold text-slate-600 dark:text-slate-300 text-right">Status Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                        {parsedBatchStudents.map((item, idx) => (
                          <tr
                            key={idx}
                            className={
                              item.status === "valid"
                                ? "bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40"
                                : "bg-red-50/30 dark:bg-red-950/20 hover:bg-red-50/60 dark:hover:bg-red-950/40"
                            }
                          >
                            <td className="p-2 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {item.nisn || "-"}
                            </td>
                            <td className="p-2 font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
                              {item.name}
                            </td>
                            <td className="p-2 font-mono">
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold text-[10px]">
                                Kelas {item.kelas}
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              {item.status === "valid" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Siap Disimpan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[10px] font-bold">
                                  <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> {item.message}
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
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmittingBatch}
                  onClick={() => {
                    setIsBatchStudentModalOpen(false);
                    setBatchResult(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
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
