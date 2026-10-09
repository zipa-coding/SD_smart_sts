import React, { useState, useEffect, useMemo } from "react";
import {
  Teacher,
  Student,
  Grade,
  TPItem,
  getTeacherAssignedSubjects,
  normalizeSubjectKey,
  matchTpClass,
  getSubjectTps,
  isKeislamanSubject,
} from "../types";
import {
  BookOpen,
  User,
  ClipboardPlus,
  CheckCircle,
  Save,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  X,
  Award,
  ChevronRight,
} from "lucide-react";

interface TeacherPanelProps {
  user: Teacher;
  onRefreshTrigger: () => void;
  refreshTrigger?: number;
}

const KEISLAMAN_SUB_SUBJECTS = [
  {
    id: "Tahsin ABaTaTsa",
    label: "Tahsin ABaTaTsa",
    short: "Tahsin",
    description: "Kaidah membaca, makhorijul huruf, dan kelancaran tilawah",
  },
  {
    id: "Tahfizh Al-Qur’an",
    label: "Tahfizh Al-Qur’an",
    short: "Tahfidz",
    description: "Hafalan surat-surat pendek juz 30 & mutqin hafalan",
  },
  {
    id: "Do’a Harian dan Hadits",
    label: "Do’a Harian dan Hadits",
    short: "Doa & Hadist",
    description: "Hafalan doa-doa harian & matan hadits pilihan",
  },
  {
    id: "Wudhu dan Sholat",
    label: "Wudhu dan Sholat",
    short: "Wudhu & Sholat",
    description: "Praktik tata cara thaharah, wudhu, gerakan dan bacaan sholat",
  },
  {
    id: "Sirah",
    label: "Sirah Nabawiyah",
    short: "Sirah",
    description: "Sejarah perjuangan hidup Nabi Muhammad SAW & para sahabat",
  },
] as const;

export default function TeacherPanel({
  user,
  onRefreshTrigger,
  refreshTrigger,
}: TeacherPanelProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [allTpObj, setAllTpObj] = useState<{ [subject: string]: any[] }>({});
  const [allNotes, setAllNotes] = useState<{ [studentId: string]: any }>({});
  const [ekskulList, setEkskulList] = useState<any[]>([]);

  // Extract all subjects assigned to this teacher (multi-mapel, Keislaman, or single subject)
  const assignedSubjects = useMemo(() => {
    return getTeacherAssignedSubjects(user);
  }, [user]);

  // Determine if this teacher is assigned to Keislaman
  const isKeislamanTeacher = useMemo(() => {
    return (
      user.subject === "Keislaman" ||
      user.subject === "Pendidikan Keislaman" ||
      user.subject === "Agama Islam / Keislaman" ||
      (Array.isArray(user.subjects) &&
        user.subjects.some((s) => s.toLowerCase().includes("keislaman"))) ||
      KEISLAMAN_SUB_SUBJECTS.some(
        (k) => k.id === user.subject || normalizeSubjectKey(k.id) === normalizeSubjectKey(user.subject)
      ) ||
      (user.subject && (user.subject.toLowerCase().includes("sirah") || user.subject.toLowerCase().includes("siroh"))) ||
      (Array.isArray(user.subjects) &&
        user.subjects.some((s) => s.toLowerCase().includes("sirah") || s.toLowerCase().includes("siroh"))) ||
      user.subject === "Admin"
    );
  }, [user]);

  // Current active subject being graded
  const [activeSubject, setActiveSubject] = useState<string>(() => {
    const list = getTeacherAssignedSubjects(user);
    if (list.length > 0) return list[0];
    if (user.subject === "Keislaman" || user.subject === "Admin") {
      return "Tahsin ABaTaTsa";
    }
    return user.subject || "PAI";
  });

  // Ensure activeSubject stays valid when assignedSubjects change
  useEffect(() => {
    if (assignedSubjects.length > 0 && !assignedSubjects.includes(activeSubject)) {
      setActiveSubject(assignedSubjects[0]);
    }
  }, [assignedSubjects, activeSubject]);

  // Extract all assigned ekskuls for this teacher (supports multiple ekskuls)
  const assignedEkskuls = useMemo(() => {
    const list: string[] = [];
    if (user.subject === "Admin") {
      return ekskulList.map((e) => e.name);
    }
    if (Array.isArray(user.ekskulNames) && user.ekskulNames.length > 0) {
      user.ekskulNames.forEach((n) => {
        const tr = String(n || "").trim();
        if (tr && !list.includes(tr)) list.push(tr);
      });
    }
    if (user.ekskulName) {
      String(user.ekskulName).split(",").forEach((n) => {
        const tr = String(n || "").trim();
        const clean = tr === "Futsal Kids" ? "Futsal" : tr;
        if (clean && !list.includes(clean)) list.push(clean);
      });
    }
    ekskulList.forEach((e) => {
      if (e.teacherId && (e.teacherId === user.id || String(e.teacherId) === String(user.id))) {
        if (!list.includes(e.name)) list.push(e.name);
      }
    });
    return list.length > 0 ? list : (user.isEkskulTeacher ? [user.ekskulName || "Pramuka"] : []);
  }, [user, ekskulList]);

  // Current ekskul being handled if user is an ekskul teacher
  const [selectedEkskulName, setSelectedEkskulName] = useState<string>(() => {
    const raw = user.ekskulName || "Pramuka";
    return raw === "Futsal Kids" ? "Futsal" : raw;
  });

  const currentEkskul = selectedEkskulName || (assignedEkskuls.length > 0 ? assignedEkskuls[0] : (user.ekskulName || "Pramuka"));

  useEffect(() => {
    if (assignedEkskuls.length > 0 && !assignedEkskuls.includes(selectedEkskulName)) {
      setSelectedEkskulName(assignedEkskuls[0]);
    }
  }, [assignedEkskuls, selectedEkskulName]);

  // View state tab: grades (pengisian nilai), tps (kelola TP), or ekskul (pengisian nilai ekskul)
  const [activeViewTab, setActiveViewTab] = useState<"grades" | "tps" | "ekskul">(() => {
    if (user.isEkskulTeacher && (user.subject === "Pembina Ekskul" || user.subject === "Pelatih Ekskul" || user.subject === "Ekskul")) {
      return "ekskul";
    }
    return "grades";
  });

  // Class selection state (1, 2, 3, 4, 5, 6) - defaults to teacher's class if wali kelas
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (user.isWaliKelas && user.kelas && ["1", "2", "3", "4", "5", "6"].includes(String(user.kelas).trim())) {
      return String(user.kelas).trim();
    }
    return "1";
  });
  // Student selection state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form states for subject grades
  const [score, setScore] = useState<string>("");
  const [usaha, setUsaha] = useState<string>("B");
  const [proses, setProses] = useState<string>("B");
  const [capaian, setCapaian] = useState<string>("B");
  const [tpAchievements, setTpAchievements] = useState<{
    [tpId: string]: boolean;
  }>({});

  const [customDescription, setCustomDescription] = useState<string>("");
  const [isCustomDescActive, setIsCustomDescActive] = useState<boolean>(false);

  // Form states for ekskul grading
  const [ekskulUsaha, setEkskulUsaha] = useState<string>("B");
  const [ekskulProses, setEkskulProses] = useState<string>("B");
  const [ekskulCapaian, setEkskulCapaian] = useState<string>("B");
  const [ekskulDescription, setEkskulDescription] = useState<string>("");
  const [ekskulSaveLoading, setEkskulSaveLoading] = useState<boolean>(false);

  // Manage TP template state for teacher
  const [newTpText, setNewTpText] = useState("");
  const [tpSubmitLoading, setTpSubmitLoading] = useState(false);
  const [editingTpId, setEditingTpId] = useState<string | null>(null);
  const [editingTpText, setEditingTpText] = useState("");
  const [editingTpLoading, setEditingTpLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter TP templates specifically for activeSubject and selectedClass
  const tpTemplates = useMemo(() => {
    const allSubjectTps = getSubjectTps(allTpObj, activeSubject);
    return allSubjectTps.filter(
      (t: any) => t && t.id && matchTpClass(t.kelas, selectedClass)
    );
  }, [allTpObj, activeSubject, selectedClass]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [resS, resG, resTp, resN, resEks] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/grades"),
        fetch("/api/tps"),
        fetch("/api/walikelas/notes"),
        fetch("/api/ekskul"),
      ]);

      const sData = await resS.json();
      const gData = await resG.json();
      const tpData = await resTp.json();
      const nData = await resN.json();
      const eksData = await resEks.json();

      const sArr = Array.isArray(sData) ? sData : [];
      const gArr = Array.isArray(gData) ? gData : [];
      const tpObj = tpData && typeof tpData === "object" ? tpData : {};
      const nObj = nData && typeof nData === "object" ? nData : {};
      const eksArr = Array.isArray(eksData) ? eksData : [];

      setStudents(sArr);
      setGrades(gArr);
      setAllTpObj(tpObj);
      setAllNotes(nObj);
      setEkskulList(eksArr);

      // Filter TP templates for activeSubject & selectedClass
      const allSubjectTps = getSubjectTps(tpObj, activeSubject);
      const classTps = allSubjectTps.filter(
        (t: any) => t && t.id && matchTpClass(t.kelas, selectedClass)
      );

      // Auto-select first student in this class if available
      const classStudents = sArr.filter(
        (s: Student) => s.kelas === selectedClass,
      );
      if (classStudents.length > 0) {
        const studentToSelect = selectedStudent
          ? classStudents.find((s) => s.id === selectedStudent.id) || classStudents[0]
          : classStudents[0];
        handleStudentSelect(studentToSelect, gArr, classTps, activeSubject, nObj);
      } else {
        setSelectedStudent(null);
        setScore("");
        setTpAchievements({});
        setUsaha("B");
        setProses("B");
        setCapaian("B");
        setCustomDescription("");
        setIsCustomDescActive(false);
      }
    } catch (err) {
      setError("Gagal memuat sinkronisasi data dari server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass, activeSubject, selectedEkskulName, refreshTrigger]);

  // Helper function to generate narrative description based on Kurikulum Merdeka standards
  const generateNarrativeDescription = (
    student: Student | null,
    subjectName: string,
    templates: { id: string; text: string }[],
    achievements: { [tpId: string]: boolean },
  ) => {
    if (!student) return "";
    const name = student.name ? student.name.trim() : "Siswa";

    const safeTemplates = Array.isArray(templates)
      ? templates.filter((tp) => tp && tp.id && tp.text)
      : [];

    if (safeTemplates.length === 0) return "";

    const achieved = safeTemplates
      .filter((tp) => achievements[tp.id] !== false)
      .map((tp) => tp.text.trim())
      .filter(Boolean);
    const needImprovement = safeTemplates
      .filter((tp) => achievements[tp.id] === false)
      .map((tp) => tp.text.trim())
      .filter(Boolean);

    const joinItems = (items: string[]) => {
      const cleaned = items.map((i) => i.trim().replace(/\.+$/, ""));
      if (cleaned.length === 0) return "";
      if (cleaned.length === 1) return cleaned[0];
      if (cleaned.length === 2) return `${cleaned[0]} dan ${cleaned[1]}`;
      return `${cleaned.slice(0, -1).join(", ")}, dan ${cleaned[cleaned.length - 1]}`;
    };

    let text = "";

    if (achieved.length > 0 && needImprovement.length === 0) {
      text = `Alhamdulillah, ananda ${name} dalam pembelajaran ${subjectName || "mata pelajaran ini"} menunjukkan penguasaan yang optimal dalam ${joinItems(achieved)}. Pertahankan prestasimu, teruslah bertumbuh dengan rendah hati, dan yakinlah setiap ikhtiar baikmu hari ini akan membuka pintu masa depan yang indah.`;
    } else if (achieved.length > 0 && needImprovement.length > 0) {
      text = `Alhamdulillah, ananda ${name} dalam pembelajaran ${subjectName || "mata pelajaran ini"} menunjukkan penguasaan yang optimal dalam ${joinItems(achieved)}. Namun masih memerlukan bimbingan dan pendampingan lebih lanjut dalam ${joinItems(needImprovement)}. Tetaplah bersemangat, jangan pernah lelah untuk mencoba karena setiap proses belajarmu sangatlah berharga.`;
    } else if (needImprovement.length > 0) {
      text = `Ananda ${name} dalam pembelajaran ${subjectName || "mata pelajaran ini"} masih memerlukan bimbingan dan pendampingan lebih lanjut dalam ${joinItems(needImprovement)}. Jangan berkecil hati, percayalah pada kemampuan dirimu; dengan kesabaran, doa, dan usaha yang tekun, ananda pasti mampu meraih hal yang lebih baik.`;
    }

    return text;
  };

  const handleStudentSelect = (
    student: Student,
    allGrades: Grade[] = grades,
    templates: { id: string; text: string }[] = tpTemplates,
    subj: string = activeSubject,
    notesMap: { [studentId: string]: any } = allNotes,
  ) => {
    try {
      setSelectedStudent(student);
      setSuccess("");
      setError("");

      const safeGrades = Array.isArray(allGrades) ? allGrades : [];
      const safeTemplates = Array.isArray(templates) ? templates : [];

      // Look up if this student already has a grade for this activeSubject
      const lowerSubj = subj.trim().toLowerCase();
      const existingGrade = safeGrades.find(
        (g) =>
          g &&
          g.studentId === student?.id &&
          g.subject &&
          g.subject.trim().toLowerCase() === lowerSubj,
      );

      if (existingGrade) {
        setScore(
          String(
            existingGrade.score !== undefined && existingGrade.score !== null
              ? existingGrade.score
              : "",
          ),
        );
        setUsaha(existingGrade.usaha || "B");
        setProses(existingGrade.proses || "B");
        setCapaian(existingGrade.capaian || "B");

        // Build active checked states
        const achievedMap: { [tpId: string]: boolean } = {};
        safeTemplates.forEach((tmpl) => {
          if (tmpl && tmpl.id) {
            const found = Array.isArray(existingGrade.tps)
              ? existingGrade.tps.find((t: any) => t && t.id === tmpl.id)
              : null;
            achievedMap[tmpl.id] = found ? !!found.achieved : true;
          }
        });
        setTpAchievements(achievedMap);

        if (existingGrade.deskripsi && existingGrade.deskripsi.trim() !== "") {
          setCustomDescription(existingGrade.deskripsi.trim());
          setIsCustomDescActive(true);
        } else if ((existingGrade as any).description && String((existingGrade as any).description).trim() !== "") {
          setCustomDescription(String((existingGrade as any).description).trim());
          setIsCustomDescActive(true);
        } else if (!isKeislamanSubject(subj) && safeTemplates.length > 0) {
          const auto = generateNarrativeDescription(
            student,
            subj,
            safeTemplates,
            achievedMap,
          );
          setCustomDescription(auto);
          setIsCustomDescActive(false);
        } else {
          setCustomDescription("");
          setIsCustomDescActive(true);
        }
      } else {
        // Clear forms for new entries
        setScore("");
        setUsaha("B");
        setProses("B");
        setCapaian("B");

        const defaultMap: { [tpId: string]: boolean } = {};
        safeTemplates.forEach((t) => {
          if (t && t.id) {
            defaultMap[t.id] = true; // default achieved
          }
        });
        setTpAchievements(defaultMap);

        if (!isKeislamanSubject(subj) && safeTemplates.length > 0) {
          const auto = generateNarrativeDescription(
            student,
            subj,
            safeTemplates,
            defaultMap,
          );
          setCustomDescription(auto);
          setIsCustomDescActive(false);
        } else {
          setCustomDescription("");
          setIsCustomDescActive(true);
        }
      }

      // Load ekskul grade for this student
      const currentEkskul = selectedEkskulName || user.ekskulName || "Pramuka";
      const studentNote = notesMap[student.id];
      const studentEkskuls = Array.isArray(studentNote?.ekskul) ? studentNote.ekskul : [];
      const foundEks = studentEkskuls.find(
        (e: any) => e && (e.name === currentEkskul || e.ekskulName === currentEkskul)
      );

      const normalizeGrade = (val: any, fallback = "B") => {
        if (!val) return fallback;
        const s = String(val).trim().toUpperCase();
        if (s === "A" || s === "SANGAT BAIK") return "A";
        if (s === "B" || s === "BAIK") return "B";
        if (s === "C" || s === "CUKUP") return "C";
        if (s === "D" || s === "KURANG") return "D";
        if (s.startsWith("A")) return "A";
        if (s.startsWith("B")) return "B";
        if (s.startsWith("C")) return "C";
        if (s.startsWith("D")) return "D";
        return fallback;
      };

      if (foundEks) {
        const cap = normalizeGrade(foundEks.capaian || foundEks.predicate);
        setEkskulUsaha(normalizeGrade(foundEks.usaha, cap));
        setEkskulProses(normalizeGrade(foundEks.proses, cap));
        setEkskulCapaian(cap);
        setEkskulDescription(foundEks.description || foundEks.deskripsi || "");
      } else {
        setEkskulUsaha("B");
        setEkskulProses("B");
        setEkskulCapaian("B");
        setEkskulDescription(`Aktif dan bersemangat mengikuti latihan serta kegiatan ${currentEkskul} dengan baik.`);
      }
    } catch (e: any) {
      console.error("Error in handleStudentSelect:", e);
      setError("Terjadi kesalahan memproses data siswa terpilih.");
    }
  };

  // Switch subject seamlessly (Multi-Mapel & Keislaman unified switching)
  const handleSwitchSubject = (subId: string) => {
    setActiveSubject(subId);
    setSuccess("");
    setError("");

    const allSubjectTps = getSubjectTps(allTpObj, subId);
    const classTps = allSubjectTps.filter(
      (t: any) => t && t.id && matchTpClass(t.kelas, selectedClass)
    );

    if (selectedStudent) {
      handleStudentSelect(selectedStudent, grades, classTps, subId, allNotes);
    }
  };

  const handleSwitchKeislamanSub = handleSwitchSubject;

  // Helper with numeric-to-predicate mapping for default selections
  const handleScoreChange = (val: string) => {
    setScore(val);
    const num = Number(val);
    if (!isNaN(num) && val.trim() !== "") {
      let defaultGrade = "C";
      if (num > 91) defaultGrade = "A";
      else if (num >= 80) defaultGrade = "B";
      else defaultGrade = "C";

      setUsaha(defaultGrade);
      setProses(defaultGrade);
      setCapaian(defaultGrade);
    }
  };

  // Switch achievement status of some TP and automatically synchronize description
  const toggleTp = (id: string) => {
    const nextAchieved = !tpAchievements[id];
    const nextMap = {
      ...tpAchievements,
      [id]: nextAchieved,
    };
    setTpAchievements(nextMap);

    // Only auto-generate description if teacher has NOT written/edited a custom manual description and not a Keislaman subject
    if (!isCustomDescActive && !isKeislamanSubject(activeSubject) && selectedStudent && tpTemplates.length > 0) {
      const updatedDesc = generateNarrativeDescription(
        selectedStudent,
        activeSubject,
        tpTemplates,
        nextMap,
      );
      setCustomDescription(updatedDesc);
    }
  };

  // Bulk set all TPs status (Semua Optimal atau Semua Butuh Bimbingan)
  const setAllTpStatus = (achieved: boolean) => {
    const nextMap: { [tpId: string]: boolean } = {};
    tpTemplates.forEach((t) => {
      if (t && t.id) nextMap[t.id] = achieved;
    });
    setTpAchievements(nextMap);

    // Only auto-generate description if teacher has NOT written/edited a custom manual description and not a Keislaman subject
    if (!isCustomDescActive && !isKeislamanSubject(activeSubject) && selectedStudent && tpTemplates.length > 0) {
      const updatedDesc = generateNarrativeDescription(
        selectedStudent,
        activeSubject,
        tpTemplates,
        nextMap,
      );
      setCustomDescription(updatedDesc);
    }
  };

  // Sync / regenerate description from current TP status
  const handleRegenerateFromTp = () => {
    if (!selectedStudent) return;
    if (tpTemplates.length === 0) {
      setError("Belum ada Tujuan Pembelajaran (TP) untuk kelas ini.");
      return;
    }
    const updatedDesc = generateNarrativeDescription(
      selectedStudent,
      activeSubject,
      tpTemplates,
      tpAchievements,
    );
    setCustomDescription(updatedDesc);
    setSuccess("Deskripsi berhasil diperbarui otomatis dari ceklist TP.");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setError("");
    setSuccess("");

    const parsedScore = Number(score);
    if (
      isNaN(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > 100 ||
      score.trim() === ""
    ) {
      setError("Masukkan nilai numerik valid antara 0 sampai 100.");
      return;
    }

    setSaveLoading(true);

    const safeTemplates = Array.isArray(tpTemplates) ? tpTemplates : [];
    const formattedTps: TPItem[] = safeTemplates.map((tp) => ({
      id: tp.id,
      text: tp.text,
      achieved: tpAchievements[tp.id] ?? true,
    }));

    const finalDescription = customDescription.trim();

    try {
      const response = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          subject: activeSubject,
          score: parsedScore,
          tps: formattedTps,
          usaha,
          proses,
          capaian,
          deskripsi: finalDescription,
          teacherName: user.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan nilai.");

      setSuccess(
        `Nilai ${activeSubject} untuk ${selectedStudent.name} berhasil disimpan!`,
      );
      onRefreshTrigger();

      // Refresh grades silently
      const getGrades = await fetch("/api/grades");
      const updatedGrades = await getGrades.json();
      setGrades(updatedGrades);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Save Ekskul Grade directly by Ekskul Teacher
  const handleSaveEkskul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setError("");
    setSuccess("");

    const ekskulName = selectedEkskulName || user.ekskulName || "Pramuka";
    const foundEks = ekskulList.find((e) => e.name === ekskulName);

    setEkskulSaveLoading(true);
    try {
      const response = await fetch("/api/ekskul/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          ekskulName,
          type: foundEks ? foundEks.type : "Pilihan",
          usaha: ekskulUsaha,
          proses: ekskulProses,
          capaian: ekskulCapaian,
          predicate: ekskulCapaian,
          description: ekskulDescription.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan nilai ekskul.");

      setSuccess(`Nilai ekskul ${ekskulName} untuk ${selectedStudent.name} berhasil disimpan!`);
      onRefreshTrigger();

      // Refresh notes silently
      const resN = await fetch("/api/walikelas/notes");
      const updatedNotes = await resN.json();
      setAllNotes(updatedNotes);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan nilai ekskul.");
    } finally {
      setEkskulSaveLoading(false);
    }
  };

  // Add TP template directly by the teacher
  const handleAddLocalTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTpText.trim()) return;
    setError("");
    setSuccess("");
    setTpSubmitLoading(true);

    const textToSave = newTpText.trim();
    const tempId = "tp_" + Date.now();
    const newCreatedTp = {
      id: tempId,
      text: textToSave,
      kelas: selectedClass,
    };

    // Optimistically update allTpObj immediately for activeSubject ONLY
    setAllTpObj((prev) => {
      const next = { ...prev };
      const key = activeSubject;
      const currentList = Array.isArray(next[key]) ? [...next[key]] : [];
      if (!currentList.some((x: any) => x.id === tempId)) {
        currentList.push(newCreatedTp);
      }
      next[key] = currentList;
      return next;
    });

    try {
      const response = await fetch("/api/tps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: activeSubject,
          tpText: textToSave,
          kelas: selectedClass,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan TP.");

      setNewTpText("");
      setSuccess(`Tujuan Pembelajaran ${activeSubject} Kelas ${selectedClass} berhasil disimpan!`);
      onRefreshTrigger();

      // Reload TP templates to get canonical state
      const resTp = await fetch("/api/tps");
      const tpData = await resTp.json();
      if (tpData && typeof tpData === "object") {
        setAllTpObj(tpData);
      }

      setTpAchievements((prev) => ({
        ...prev,
        [data.id || tempId]: true,
      }));
    } catch (err: any) {
      setError(err.message || "Gagal menambahkan TP.");
      // Rollback optimistic add if failed
      setAllTpObj((prev) => {
        const next = { ...prev };
        if (Array.isArray(next[activeSubject])) {
          next[activeSubject] = next[activeSubject].filter((x: any) => x.id !== tempId);
        }
        return next;
      });
    } finally {
      setTpSubmitLoading(false);
    }
  };

  // Edit TP template by teacher
  const handleSaveEditLocalTp = async (tpId: string) => {
    if (!editingTpText.trim()) return;
    setError("");
    setSuccess("");
    setEditingTpLoading(true);

    const nextText = editingTpText.trim();

    // Optimistic update
    setAllTpObj((prev) => {
      const updated: typeof prev = {};
      for (const key of Object.keys(prev)) {
        if (Array.isArray(prev[key])) {
          updated[key] = prev[key].map((item: any) => {
            if (String(item.id).trim() === String(tpId).trim()) {
              return { ...item, text: nextText };
            }
            return item;
          });
        }
      }
      return updated;
    });

    try {
      const response = await fetch(`/api/tps/${encodeURIComponent(activeSubject)}/${encodeURIComponent(tpId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nextText, kelas: selectedClass }),
      });

      if (!response.ok) {
        // Fallback: delete and re-create if PUT not supported by an older client
        await fetch(`/api/tps/${encodeURIComponent(activeSubject)}/${encodeURIComponent(tpId)}`, { method: "DELETE" }).catch(() => null);
        await fetch("/api/tps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: activeSubject, tpText: nextText, kelas: selectedClass }),
        }).catch(() => null);
      }

      setSuccess("Tujuan Pembelajaran berhasil diperbarui.");
      setEditingTpId(null);
      setEditingTpText("");
      onRefreshTrigger();

      const resTp = await fetch("/api/tps");
      const tpData = await resTp.json();
      if (tpData && typeof tpData === "object") {
        setAllTpObj(tpData);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memperbarui TP.");
      await fetchData();
    } finally {
      setEditingTpLoading(false);
    }
  };

  // Delete TP template by teacher
  const handleDeleteLocalTp = async (tpId: string) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus Tujuan Pembelajaran (${activeSubject}) ini?`,
      )
    )
      return;
    setError("");
    setSuccess("");

    // Optimistic UI removal
    setAllTpObj((prev) => {
      const updated: typeof prev = {};
      for (const key of Object.keys(prev)) {
        if (Array.isArray(prev[key])) {
          updated[key] = prev[key].filter(
            (item: any) => String(item.id).trim() !== String(tpId).trim(),
          );
        }
      }
      return updated;
    });

    try {
      const response = await fetch(`/api/tps/${encodeURIComponent(activeSubject)}/${encodeURIComponent(tpId)}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal menghapus TP.");

      setSuccess("Tujuan Pembelajaran berhasil dihapus.");
      onRefreshTrigger();

      const resTp = await fetch("/api/tps");
      const tpData = await resTp.json();
      if (tpData && typeof tpData === "object") {
        setAllTpObj(tpData);
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghapus TP.");
      await fetchData();
    }
  };

  // Helper arrays
  const safeStudents = Array.isArray(students) ? students : [];
  const classStudents = safeStudents.filter(
    (s) => s && s.kelas === selectedClass,
  );

  const filledSubjectCount = Array.isArray(grades)
    ? classStudents.filter((s) =>
        grades.some(
          (g) =>
            g &&
            g.studentId === s.id &&
            (g.subject === activeSubject ||
              normalizeSubjectKey(g.subject) === normalizeSubjectKey(activeSubject)),
        ),
      ).length
    : 0;

  const filledEkskulCount = classStudents.filter((s) => {
    const studentNote = allNotes[s.id];
    const sEkskuls = Array.isArray(studentNote?.ekskul) ? studentNote.ekskul : [];
    return sEkskuls.some((e: any) => e.name === currentEkskul || e.ekskulName === currentEkskul);
  }).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" id="teacher-panel">
      {/* Selector sidebar (Classes and Students list) */}
      <div className="lg:col-span-1 bg-white rounded-lg border border-slate-200 shadow-sm p-3 h-fit space-y-3.5">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            Pilih Kelas:
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-1.5" id="class-button-selectors">
            {["1", "2", "3", "4", "5", "6"].map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`py-1 px-1.5 rounded text-xs font-bold transition cursor-pointer text-center ${selectedClass === cls ? "bg-emerald-800 text-white shadow-2xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
              >
                Kelas {cls}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
          <h3 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-500">
            Daftar Siswa ({classStudents.length})
          </h3>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">
            {activeViewTab === "ekskul"
              ? `Ekskul: ${filledEkskulCount}/${classStudents.length}`
              : `Terisi: ${filledSubjectCount}/${classStudents.length}`}
          </span>
        </div>

        <div
          className="space-y-1 max-h-[380px] overflow-y-auto pr-1"
          id="student-vertical-list"
        >
          {loading ? (
            <div className="p-3 text-center text-xs text-slate-400 italic">
              Memuat daftar siswa...
            </div>
          ) : classStudents.length === 0 ? (
            <p className="text-xs text-slate-450 italic text-center py-3">
              Belum ada siswa di kelas ini.
            </p>
          ) : (
            classStudents.map((s) => {
              const isFilledSubject =
                Array.isArray(grades) &&
                grades.some(
                  (g) =>
                    g &&
                    g.studentId === s.id &&
                    (g.subject === activeSubject ||
                      normalizeSubjectKey(g.subject) === normalizeSubjectKey(activeSubject)),
                );

              const studentNote = allNotes[s.id];
              const sEkskuls = Array.isArray(studentNote?.ekskul) ? studentNote.ekskul : [];
              const isFilledEkskul = sEkskuls.some(
                (e: any) => e.name === currentEkskul || e.ekskulName === currentEkskul
              );

              const isFilled = activeViewTab === "ekskul" ? isFilledEkskul : isFilledSubject;
              const isSelected = selectedStudent?.id === s.id;

              const multiFilledCount = assignedSubjects.filter((sub) =>
                grades.some(
                  (g) =>
                    g &&
                    g.studentId === s.id &&
                    (g.subject === sub ||
                      normalizeSubjectKey(g.subject) === normalizeSubjectKey(sub)),
                )
              ).length;

              return (
                <button
                  key={s.id}
                  onClick={() => handleStudentSelect(s, grades, tpTemplates, activeSubject, allNotes)}
                  className={`w-full p-2 rounded text-left text-xs transition flex items-center justify-between gap-2 border cursor-pointer ${isSelected ? "bg-emerald-50/70 border-emerald-400 font-bold text-emerald-900" : "bg-white border-slate-150 text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="truncate">{s.name || "N/A"}</span>
                  {activeViewTab === "ekskul" ? (
                    isFilled ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        Selesai ✓
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-400 text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0">
                        Kosong
                      </span>
                    )
                  ) : assignedSubjects.length > 1 ? (
                    multiFilledCount === assignedSubjects.length ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        Lengkap ({assignedSubjects.length}) ✓
                      </span>
                    ) : multiFilledCount > 0 ? (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        {multiFilledCount}/{assignedSubjects.length} Mapel
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-400 text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0">
                        0/{assignedSubjects.length}
                      </span>
                    )
                  ) : isFilled ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                      Selesai ✓
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-400 text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0">
                      Kosong
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main interactive panel */}
      <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        {/* Navigation Tab Headers */}
        <div
          className="flex border-b border-slate-200 gap-1 mb-4 flex-wrap"
          id="teacher-view-tabs"
        >
          <button
            onClick={() => setActiveViewTab("grades")}
            className={`py-1.5 px-3 uppercase tracking-wider text-[10px] font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeViewTab === "grades" ? "border-emerald-800 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <ClipboardPlus className="w-3.5 h-3.5" /> Pengisian Nilai Raport
          </button>
          <button
            onClick={() => setActiveViewTab("tps")}
            className={`py-1.5 px-3 uppercase tracking-wider text-[10px] font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeViewTab === "tps" ? "border-emerald-800 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Kelola TP ({activeSubject})
          </button>

          {/* Ekskul Tab (Shown for Ekskul Teachers or Admin) */}
          {(Boolean(user.isEkskulTeacher) || assignedEkskuls.length > 0 || user.subject === "Pembina Ekskul" || user.subject === "Pelatih Ekskul" || user.subject === "Admin") && (
            <button
              onClick={() => setActiveViewTab("ekskul")}
              className={`py-1.5 px-3 uppercase tracking-wider text-[10px] font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeViewTab === "ekskul" ? "border-amber-600 text-amber-900 bg-amber-50/60 font-black" : "border-transparent text-amber-700 hover:text-amber-900"}`}
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>Nilai Ekskul: {currentEkskul} {assignedEkskuls.length > 1 && `(${assignedEkskuls.length})`}</span>
            </button>
          )}
        </div>

        {/* TOP STATUS BAR & KEISLAMAN UNIFIED BAR */}
        <div className="pb-2.5 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[10px] uppercase tracking-wider font-extrabold">
              {activeViewTab === "ekskul" ? `Pembina Ekskul: ${currentEkskul}` : `Mapel: ${activeSubject}`}
            </span>
            <span className="text-[11px] text-slate-500 italic">
              Pengampu: {user.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* If Admin, let them switch ekskul in ekskul tab */}
            {activeViewTab === "ekskul" && user.subject === "Admin" && ekskulList.length > 0 && (
              <select
                value={selectedEkskulName}
                onChange={(e) => setSelectedEkskulName(e.target.value)}
                className="text-xs bg-amber-50 border border-amber-300 text-amber-950 font-bold rounded px-2 py-1 focus:outline-none"
              >
                {ekskulList.map((eks) => (
                  <option key={eks.id} value={eks.name}>
                    ⚽ {eks.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchData}
              className="p-1 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-bold rounded transition text-slate-600 cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Sinkronkan DB
            </button>
          </div>
        </div>

        {/* MULTI-EKSKUL NAVIGATION SWITCHER BAR (UNTUK GURU PEMBINA BEBERAPA EKSKUL SEKALIGUS) */}
        {assignedEkskuls.length > 1 && activeViewTab === "ekskul" && (
          <div className="mb-4 bg-gradient-to-r from-amber-900 via-yellow-900 to-amber-950 p-3.5 rounded-xl shadow-md border border-amber-600/50 text-white animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-amber-700/80">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Ekstrakurikuler Yang Dibina ({user.name})</span>
                </h4>
                <p className="text-[10px] text-amber-200/80 leading-tight mt-0.5">
                  Anda membina {assignedEkskuls.length} ekskul: {assignedEkskuls.join(", ")}. Klik salah satu ekskul di bawah untuk menginput nilai dan deskripsi rapor siswa.
                </p>
              </div>

              {selectedStudent && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-[10px] text-amber-300 font-medium">Status {selectedStudent.name.split(" ")[0]}:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 border border-amber-500/50 text-amber-300">
                    {assignedEkskuls.filter((eks) => {
                      const studentNote = allNotes[selectedStudent.id];
                      const sEks = Array.isArray(studentNote?.ekskul) ? studentNote.ekskul : [];
                      return sEks.some((e: any) => e.name === eks || e.ekskulName === eks);
                    }).length} / {assignedEkskuls.length} Ekskul Terisi
                  </span>
                </div>
              )}
            </div>

            {/* Sub-Ekskul Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" id="multi-ekskul-selectors">
              {assignedEkskuls.map((eks) => {
                const isCurrentActive = currentEkskul === eks;
                const isFilledForStudent =
                  selectedStudent &&
                  (() => {
                    const studentNote = allNotes[selectedStudent.id];
                    const sEks = Array.isArray(studentNote?.ekskul) ? studentNote.ekskul : [];
                    return sEks.some((e: any) => e.name === eks || e.ekskulName === eks);
                  })();

                return (
                  <button
                    key={eks}
                    type="button"
                    onClick={() => setSelectedEkskulName(eks)}
                    className={`p-2.5 rounded-lg text-left transition cursor-pointer flex flex-col justify-between gap-1 border ${
                      isCurrentActive
                        ? "bg-amber-500/30 border-amber-400 text-white shadow-md ring-2 ring-amber-400/50"
                        : "bg-amber-950/40 border-amber-700/40 text-amber-200 hover:bg-amber-900/40 hover:border-amber-500/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs truncate">⚽ {eks}</span>
                      {isFilledForStudent ? (
                        <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-1 rounded">✓</span>
                      ) : (
                        <span className="text-[9px] bg-amber-900/80 text-amber-300 font-medium px-1 rounded">-</span>
                      )}
                    </div>
                    <span className="text-[9px] opacity-80">
                      {isCurrentActive ? "Aktif Dinilai" : "Klik untuk nilai"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* UNIFIED MULTI-MAPEL & KEISLAMAN NAVIGATION BAR (1 AKUN UNTUK SEMUA MAPEL YANG DIAMPU) */}
        {(assignedSubjects.length > 1 || isKeislamanTeacher) && activeViewTab !== "ekskul" && (
          <div className="mb-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 p-3.5 rounded-xl shadow-md border border-emerald-700/50 text-white animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-emerald-800/80">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                  {isKeislamanTeacher && assignedSubjects.every((s) => KEISLAMAN_SUB_SUBJECTS.some((k) => k.id === s))
                    ? "Panel Terpadu Rapor Keislaman"
                    : `Mata Pelajaran Yang Diampu (${user.name})`}
                </h4>
                <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">
                  {isKeislamanTeacher && assignedSubjects.every((s) => KEISLAMAN_SUB_SUBJECTS.some((k) => k.id === s))
                    ? "Satu akun untuk menginput seluruh aspek keislaman: Sirah, Tahsin, Tahfidz, Doa & Hadist, serta Wudhu & Sholat."
                    : `Tersedia ${assignedSubjects.length} mapel: ${assignedSubjects.join(", ")}. Klik salah satu mapel di bawah untuk menginput nilai raport siswa.`}
                </p>
              </div>

              {selectedStudent && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-[10px] text-emerald-300 font-medium">Status {selectedStudent.name.split(" ")[0]}:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-500/50 text-emerald-300">
                    {assignedSubjects.filter((sub) =>
                      grades.some(
                        (g) =>
                          g.studentId === selectedStudent.id &&
                          (g.subject === sub ||
                            normalizeSubjectKey(g.subject) === normalizeSubjectKey(sub)),
                      )
                    ).length} / {assignedSubjects.length} Mapel Terisi
                  </span>
                </div>
              )}
            </div>

            {/* Sub-Aspects / Subjects Buttons Switcher */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-1.5" id="multi-subject-selectors">
              {assignedSubjects.map((sub, idx) => {
                const isCurrentActive = activeSubject === sub;
                const isFilledForStudent =
                  selectedStudent &&
                  grades.some(
                    (g) =>
                      g.studentId === selectedStudent.id &&
                      g.subject &&
                      g.subject.trim().toLowerCase() === sub.trim().toLowerCase(),
                  );
                const keislamanItem = KEISLAMAN_SUB_SUBJECTS.find((k) => k.id === sub);
                const shortLabel = keislamanItem ? keislamanItem.short : sub;
                const fullLabel = keislamanItem ? keislamanItem.label : `Mata Pelajaran ${sub}`;

                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleSwitchSubject(sub)}
                    className={`p-2.5 rounded-lg text-left transition cursor-pointer flex flex-col justify-between gap-1.5 border ${
                      isCurrentActive
                        ? "bg-white text-emerald-950 font-bold shadow-lg border-white scale-[1.02] ring-2 ring-emerald-400"
                        : "bg-emerald-950/60 hover:bg-emerald-900/80 text-white border-emerald-700/60"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide">
                        {keislamanItem ? `Bagian ${idx + 1}` : `Mapel ${idx + 1}`}
                      </span>
                      <span
                        className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          isFilledForStudent
                            ? isCurrentActive
                              ? "bg-emerald-100 text-emerald-900 font-bold"
                              : "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                            : isCurrentActive
                            ? "bg-slate-100 text-slate-500 font-bold"
                            : "bg-black/30 text-slate-400"
                        }`}
                      >
                        {isFilledForStudent ? "Terisi ✓" : "Belum"}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-extrabold leading-tight">
                        {shortLabel}
                      </div>
                      <div
                        className={`text-[9px] leading-tight line-clamp-1 mt-0.5 ${
                          isCurrentActive ? "text-emerald-800" : "text-emerald-300/70"
                        }`}
                      >
                        {fullLabel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-250 flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-2.5 bg-green-50 text-green-800 text-xs font-bold rounded border border-green-200 flex items-center gap-1.5 animate-fade-in mb-3">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>{success}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. INPUT SUBJECT GRADING TAB                             */}
        {/* ======================================================== */}
        {activeViewTab === "grades" &&
          (selectedStudent ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedStudent.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-slate-800 uppercase">
                      {selectedStudent.name || "N/A"}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      NISN: {selectedStudent.nisn || "-"} • Kelas{" "}
                      {selectedStudent.kelas || "-"}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-850 font-extrabold text-[11px] rounded-lg border border-emerald-200">
                  {activeSubject}
                </span>
              </div>

              {/* THREE-GRADE EVALUATION CRITERIA + NUMERIC SCORE */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-0.5">
                      Input Nilai & Kriteria Evaluasi ({activeSubject})
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        &gt; 91 = A (Sangat Baik)
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-300">
                        80 - 91 = B (Baik)
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        &le; 79 = C (Cukup)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <div className="text-right">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Nilai Akhir:
                      </label>
                      <span
                        className={`text-[10px] font-extrabold font-mono block ${
                          score !== ""
                            ? Number(score) > 91
                              ? "text-emerald-600"
                              : Number(score) >= 80
                              ? "text-cyan-600"
                              : "text-amber-600"
                            : "text-slate-400"
                        }`}
                      >
                        {score !== "" ? (
                          Number(score) > 91
                            ? "Predikat A"
                            : Number(score) >= 80
                            ? "Predikat B"
                            : "Predikat C"
                        ) : (
                          "Belum diisi"
                        )}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={score}
                      onChange={(e) =>
                        handleScoreChange(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="0"
                      className="w-16 p-1 border-2 border-emerald-500 rounded text-center text-base font-bold bg-white text-emerald-950 focus:outline-none shadow-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Grade Usaha
                    </label>
                    <select
                      value={usaha}
                      onChange={(e) => setUsaha(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Grade Proses
                    </label>
                    <select
                      value={proses}
                      onChange={(e) => setProses(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Grade Capaian
                    </label>
                    <select
                      value={capaian}
                      onChange={(e) => setCapaian(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* TP Objectives Checklist (Tujuan Pembelajaran) */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                  <div>
                    <h4 className="font-extrabold text-[10px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Tujuan Pembelajaran ({activeSubject})</span>
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                        Kelas {selectedClass}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {Array.isArray(tpTemplates) && tpTemplates.length > 0
                        ? "Centang jika anak sudah optimal (Sangat Baik). Un-centang jika masih butuh bimbingan."
                        : "Belum ada TP manual yang diinputkan. Guru dapat menambah TP atau mengisi deskripsi langsung secara manual."}
                    </p>
                  </div>
                  {Array.isArray(tpTemplates) && tpTemplates.length > 0 ? (
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setAllTpStatus(true)}
                        className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded transition cursor-pointer"
                      >
                        Semua Optimal ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllTpStatus(false)}
                        className="px-2 py-0.5 text-[9px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded transition cursor-pointer"
                      >
                        Semua Butuh Bimbingan ⚠️
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveViewTab("tps")}
                        className="px-2 py-0.5 text-[9px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Kelola TP</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveViewTab("tps")}
                      className="px-2.5 py-1 text-[10px] font-bold bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah TP Manual</span>
                    </button>
                  )}
                </div>

                <div
                  className="space-y-1.5 max-h-48 overflow-y-auto"
                  id="tp-grading-list"
                >
                  {!Array.isArray(tpTemplates) || tpTemplates.length === 0 ? (
                    <div className="p-3 bg-slate-50 text-slate-600 text-xs rounded-xl border border-dashed border-slate-300 text-center space-y-1.5">
                      <p className="font-bold text-slate-700 text-[11px]">
                        Belum ada Tujuan Pembelajaran (TP) manual untuk {activeSubject} Kelas {selectedClass}.
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Guru dapat langsung mengetik narasi deskripsi capaian rapor secara manual pada kolom di bawah, atau klik tombol <strong>Tambah TP Manual</strong> di atas jika ingin menambahkan poin TP sewaktu-waktu.
                      </p>
                    </div>
                  ) : (
                    tpTemplates
                      .filter((tp) => tp && tp.id)
                      .map((tp) => {
                        const isChecked =
                          tpAchievements && tpAchievements[tp.id] !== false;
                        return (
                          <div
                            key={tp.id}
                            onClick={() => toggleTp(tp.id)}
                            className={`p-2 rounded-lg border text-[11px] transition cursor-pointer select-none flex items-start gap-2.5 ${
                              isChecked
                                ? "bg-emerald-50/20 border-emerald-200/80 hover:bg-emerald-50/50"
                                : "bg-amber-50/20 border-amber-200/80 hover:bg-amber-50/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTp(tp.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5"
                            />
                            <div className="flex-1">
                              <p className="text-slate-800 leading-normal font-medium">
                                {tp.text}
                              </p>
                              <span
                                className={`text-[9px] font-bold tracking-wide mt-1 inline-flex items-center gap-1 uppercase px-1.5 py-0.5 rounded ${
                                  isChecked
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isChecked
                                  ? "Sudah Optimal ✓"
                                  : "Butuh Bimbingan ⚠️"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* NARRATIVE DESCRIPTION PREVIEW / MANUAL INPUT */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <div>
                    <h4 className="font-extrabold text-[10px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Narasi Deskripsi Raport ({activeSubject})</span>
                      {Array.isArray(tpTemplates) && tpTemplates.length > 0 ? (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-semibold lowercase">
                          sinkron dengan checklist TP
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-semibold">
                          input manual
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      {Array.isArray(tpTemplates) && tpTemplates.length > 0
                        ? `Deskripsi otomatis disesuaikan dengan checklist TP untuk ananda ${selectedStudent.name}, dan tetap dapat Anda edit langsung secara bebas.`
                        : `Ketik/edit narasi deskripsi capaian rapor untuk ananda ${selectedStudent.name} secara langsung di bawah.`}
                    </p>
                  </div>
                  {Array.isArray(tpTemplates) && tpTemplates.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRegenerateFromTp}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3 h-3 text-emerald-600" />
                      <span>Sinkronkan dari TP</span>
                    </button>
                  )}
                </div>

                <textarea
                  value={customDescription}
                  onChange={(e) => {
                    setCustomDescription(e.target.value);
                    setIsCustomDescActive(true);
                  }}
                  rows={4}
                  placeholder={
                    selectedStudent
                      ? `Ketik deskripsi capaian rapor untuk ananda ${selectedStudent.name} di sini...`
                      : "Ketik deskripsi capaian nilai rapor secara manual di sini..."
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Save trigger */}
              <div className="border-t border-slate-150 pt-3 text-right">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-950 text-white rounded text-xs font-bold flex items-center gap-1.5 ml-auto shadow-xs transition disabled:opacity-50 cursor-pointer"
                  id="submit-grades-button"
                >
                  {saveLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Simpan Nilai {activeSubject}
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-12 text-center text-slate-400 italic text-xs">
              Pilihlah salah satu siswa di bar sebelah kiri untuk memulai
              pengisian rapor.
            </div>
          ))}

        {/* ======================================================== */}
        {/* 2. DEDICATED EKSKUL GRADING TAB                          */}
        {/* ======================================================== */}
        {activeViewTab === "ekskul" && (
          <div className="space-y-4">
            {/* Multi-Ekskul Switcher if teacher mentors > 1 ekskul */}
            {assignedEkskuls.length > 1 && (
              <div className="p-3.5 bg-gradient-to-r from-amber-900 via-amber-950 to-slate-900 rounded-xl border border-amber-600/50 shadow-md animate-fade-in text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-amber-800/60">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Ekstrakurikuler yang Anda Bina ({assignedEkskuls.length} Ekskul)</span>
                    </h4>
                    <p className="text-[10px] text-amber-300/80 leading-tight mt-0.5">
                      Anda membina lebih dari 1 kegiatan ekskul. Klik tombol di bawah untuk beralih ekskul yang sedang dinilai:
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-full w-fit">
                    Aktif: {currentEkskul}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {assignedEkskuls.map((eks) => {
                    const isCurrent = currentEkskul.toLowerCase().trim() === eks.toLowerCase().trim();
                    return (
                      <button
                        key={eks}
                        type="button"
                        onClick={() => {
                          setSelectedEkskulName(eks);
                          if (selectedStudent) {
                            const sNote = allNotes[selectedStudent.id];
                            const sEks = Array.isArray(sNote?.ekskul) ? sNote.ekskul : [];
                            const found = sEks.find((item: any) => item && (item.name === eks || item.ekskulName === eks));
                            if (found) {
                              setEkskulUsaha(found.usaha || "B");
                              setEkskulProses(found.proses || "B");
                              setEkskulCapaian(found.capaian || found.predicate || "B");
                              setEkskulDescription(found.description || found.deskripsi || "");
                            } else {
                              setEkskulUsaha("B");
                              setEkskulProses("B");
                              setEkskulCapaian("B");
                              setEkskulDescription(`Aktif dan bersemangat mengikuti latihan serta kegiatan ${eks} dengan baik.`);
                            }
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                          isCurrent
                            ? "bg-amber-500 text-slate-950 border-amber-300 shadow-md font-black"
                            : "bg-slate-900/80 hover:bg-slate-800 text-amber-200 border-amber-700/50"
                        }`}
                      >
                        <span>⚽</span>
                        <span>{eks}</span>
                        {isCurrent && <span className="text-[9px] bg-slate-950 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">Aktif</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedStudent ? (
            <form onSubmit={handleSaveEkskul} className="space-y-4 animate-fade-in">
              {/* Header card with contrast */}
              <div className="p-3.5 bg-amber-50 dark:bg-[#1a1405] border border-amber-300 dark:border-amber-600/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-900 dark:text-slate-100 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-700 dark:bg-amber-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    ⚽
                  </div>
                  <div>
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-amber-100 uppercase tracking-wide">
                      {selectedStudent.name || "N/A"}
                    </h3>
                    <p className="text-[11px] text-amber-900 dark:text-amber-300 font-mono font-bold">
                      NISN: {selectedStudent.nisn || "-"} • Kelas {selectedStudent.kelas || "-"}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1.5 bg-amber-700 dark:bg-amber-600 text-white font-black text-xs rounded-lg shadow-xs tracking-wide self-start sm:self-auto">
                  Ekstrakurikuler: {currentEkskul}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-[#0d1526] border border-slate-200 dark:border-[#223354] p-4 sm:p-5 rounded-xl space-y-4 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Evaluasi & Capaian Ekstrakurikuler ({currentEkskul})</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    Pengisian nilai ekskul {currentEkskul} dibuat setara dengan format mapel standar yang mencakup aspek <strong>Usaha</strong>, <strong>Proses</strong>, dan <strong>Capaian</strong> untuk ananda {selectedStudent.name}.
                  </p>
                </div>

                {/* 3-column evaluation: Usaha, Proses, Capaian (Sama persis seperti pengisian mapel biasa) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-[#223354]">
                  <div className="bg-white dark:bg-[#070d1a] p-3 rounded-lg border border-slate-250 dark:border-[#1e2f4f]">
                    <label className="block text-[10px] font-black text-slate-800 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                      Grade Usaha
                    </label>
                    <select
                      value={ekskulUsaha}
                      onChange={(e) => setEkskulUsaha(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-[#0b1324] border border-slate-300 dark:border-[#2b3e66] rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="A" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">A (Sangat Baik)</option>
                      <option value="B" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">B (Baik)</option>
                      <option value="C" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">C (Cukup)</option>
                      <option value="D" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">D (Kurang)</option>
                    </select>
                  </div>

                  <div className="bg-white dark:bg-[#070d1a] p-3 rounded-lg border border-slate-250 dark:border-[#1e2f4f]">
                    <label className="block text-[10px] font-black text-slate-800 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                      Grade Proses
                    </label>
                    <select
                      value={ekskulProses}
                      onChange={(e) => setEkskulProses(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-[#0b1324] border border-slate-300 dark:border-[#2b3e66] rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="A" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">A (Sangat Baik)</option>
                      <option value="B" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">B (Baik)</option>
                      <option value="C" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">C (Cukup)</option>
                      <option value="D" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">D (Kurang)</option>
                    </select>
                  </div>

                  <div className="bg-white dark:bg-[#070d1a] p-3 rounded-lg border border-slate-250 dark:border-[#1e2f4f]">
                    <label className="block text-[10px] font-black text-slate-800 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                      Grade Capaian
                    </label>
                    <select
                      value={ekskulCapaian}
                      onChange={(e) => setEkskulCapaian(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-[#0b1324] border border-slate-300 dark:border-[#2b3e66] rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="A" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">A (Sangat Baik)</option>
                      <option value="B" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">B (Baik)</option>
                      <option value="C" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">C (Cukup)</option>
                      <option value="D" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">D (Kurang)</option>
                    </select>
                  </div>
                </div>

                {/* Narrative description */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#223354]">
                  <label className="block text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-1.5">
                    Narasi Deskripsi Capaian Raport ({currentEkskul}):
                  </label>

                  <textarea
                    value={ekskulDescription}
                    onChange={(e) => setEkskulDescription(e.target.value)}
                    rows={4}
                    placeholder={`Ketik narasi deskripsi capaian kegiatan ekskul ${currentEkskul} untuk ananda ${selectedStudent.name}...`}
                    className="w-full p-3 border border-slate-300 dark:border-[#2b3e66] rounded-xl text-xs bg-white dark:bg-[#070d1a] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent leading-relaxed font-sans"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-[#223354] pt-3 text-right">
                <button
                  type="submit"
                  disabled={ekskulSaveLoading}
                  className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 active:bg-amber-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 ml-auto shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {ekskulSaveLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Simpan Nilai Ekskul ({currentEkskul})
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-12 text-center text-slate-400 dark:text-slate-400 italic text-xs">
              Pilihlah salah satu siswa di bar sebelah kiri untuk mengisi nilai ekskul.
            </div>
          )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. LOCAL TP MANAGEMENT TAB                               */}
        {/* ======================================================== */}
        {activeViewTab === "tps" && (
          <div
            className="space-y-4 animate-fade-in"
            id="teacher-tplocal-management"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase flex items-center gap-2">
                  <span>Kelola Tujuan Pembelajaran (TP) - {activeSubject}</span>
                  <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[10px] font-bold">
                    Kelas {selectedClass}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tujuan pembelajaran otomatis disesuaikan secara spesifik untuk materi {activeSubject} Kelas {selectedClass}.
                </p>
              </div>
            </div>

            {/* Multi-Mapel Switcher in TP Management */}
            {assignedSubjects.length > 1 && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Pilih Mapel TP:
                </span>
                {assignedSubjects.map((sub) => {
                  const isAct = activeSubject === sub;
                  const keisl = KEISLAMAN_SUB_SUBJECTS.find((k) => k.id === sub);
                  const isSubKeisl = isKeislamanSubject(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => handleSwitchSubject(sub)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        isAct
                          ? "bg-emerald-800 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>{keisl ? keisl.short : sub}</span>
                      {isSubKeisl && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-normal ${isAct ? "bg-emerald-700 text-emerald-100" : "bg-slate-100 text-slate-500"}`}>
                          Keislaman
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Form to add custom learning objective directly by the teacher */}
            <form
              onSubmit={handleAddLocalTp}
              className="p-3 bg-emerald-50 rounded-lg border border-emerald-150 flex gap-2 items-end"
            >
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-emerald-900 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <span>Tambah TP Baru ({activeSubject}):</span>
                  <span className="text-emerald-700 font-extrabold">(Tingkat Kelas {selectedClass})</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTpText}
                  onChange={(e) => setNewTpText(e.target.value)}
                  placeholder={`Contoh: Menguasai kompetensi dasar materi ${activeSubject} kelas ${selectedClass}...`}
                  className="w-full p-1.5 bg-white border border-emerald-250 rounded text-xs focus:outline-none focus:border-emerald-700"
                />
              </div>
              <button
                type="submit"
                disabled={tpSubmitLoading || !newTpText.trim()}
                className="bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white p-1.5 rounded cursor-pointer transition flex items-center justify-center h-[32px] w-[36px]"
                title="Tambahkan TP"
              >
                {tpSubmitLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </form>

            {/* List of current objectives for this subject with delete buttons */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span>Daftar TP ({activeSubject}) - Kelas {selectedClass}</span>
                  <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                    {!Array.isArray(tpTemplates) ? 0 : tpTemplates.length} TP
                  </span>
                </span>
                <span className="text-[9px] text-slate-400 italic">
                  Khusus Rombel {selectedClass}
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {!Array.isArray(tpTemplates) || tpTemplates.length === 0 ? (
                  <div className="p-4 text-center space-y-1">
                    <p className="text-xs text-slate-600 font-medium">
                      Belum ada Tujuan Pembelajaran untuk {activeSubject} Kelas {selectedClass}.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Anda dapat menambahkan TP baru secara manual pada formulir di atas kapan saja.
                    </p>
                  </div>
                ) : (
                  tpTemplates
                    .filter((tp) => tp && tp.id)
                    .map((tp, idx) => {
                      const isEditing = editingTpId === tp.id;
                      return (
                        <div
                          key={tp.id}
                          className="p-2.5 flex items-start justify-between gap-3 bg-white hover:bg-slate-50/50 transition"
                        >
                          <div className="flex gap-2 flex-1">
                            <span className="text-[10px] font-mono text-slate-350 shrink-0 mt-0.5">
                              {idx + 1}.
                            </span>
                            <div className="flex-1">
                              {isEditing ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={editingTpText}
                                    onChange={(e) => setEditingTpText(e.target.value)}
                                    className="w-full p-1.5 bg-slate-50 border border-emerald-500 rounded text-xs focus:outline-none"
                                    autoFocus
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      disabled={editingTpLoading || !editingTpText.trim()}
                                      onClick={() => handleSaveEditLocalTp(tp.id)}
                                      className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[10px] font-bold hover:bg-emerald-900 transition cursor-pointer flex items-center gap-1"
                                    >
                                      <Save className="w-3 h-3" /> Simpan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTpId(null);
                                        setEditingTpText("");
                                      }}
                                      className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 transition cursor-pointer flex items-center gap-1"
                                    >
                                      <X className="w-3 h-3" /> Batal
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                    {tp.text}
                                  </p>
                                  <span className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Kelas {tp.kelas || selectedClass}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTpId(tp.id);
                                  setEditingTpText(tp.text);
                                }}
                                className="text-emerald-700 hover:text-emerald-900 p-1 rounded hover:bg-emerald-50 transition cursor-pointer"
                                title="Edit TP"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLocalTp(tp.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                                title="Hapus TP"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
