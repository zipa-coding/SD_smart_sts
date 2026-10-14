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
  isEkskulSubject,
  getEkskulTps,
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
  key?: React.Key;
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
    try {
      const savedSub = localStorage.getItem("smart_sts_active_subject");
      const list = getTeacherAssignedSubjects(user);
      if (savedSub && list.includes(savedSub)) return savedSub;
      if (list.length > 0) return list[0];
      if (user.subject === "Keislaman" || user.subject === "Admin") {
        return "Tahsin ABaTaTsa";
      }
      return user.subject || "PAI";
    } catch (e) {
      return user.subject || "PAI";
    }
  });

  // Ensure activeSubject stays valid when assignedSubjects change
  useEffect(() => {
    if (assignedSubjects.length > 0 && !assignedSubjects.includes(activeSubject)) {
      setActiveSubject(assignedSubjects[0]);
    }
  }, [assignedSubjects, activeSubject]);

  useEffect(() => {
    try {
      if (activeSubject) localStorage.setItem("smart_sts_active_subject", activeSubject);
    } catch (e) {}
  }, [activeSubject]);

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
    if (
      user.isEkskulTeacher ||
      (Array.isArray(user.ekskulNames) && user.ekskulNames.length > 0) ||
      user.subject === "Pembina Ekskul" ||
      user.subject === "Pelatih Ekskul" ||
      user.subject === "Ekskul" ||
      !user.subject ||
      user.subject === "-" ||
      assignedSubjects.length === 0
    ) {
      if (assignedSubjects.length === 0 || user.isEkskulTeacher) {
        return "ekskul";
      }
    }
    return "grades";
  });

  // Class selection state (1, 2, 3, 4, 5, 6) - defaults to saved class, or teacher's class if wali kelas
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    try {
      const savedClass = localStorage.getItem("smart_sts_selected_class");
      if (savedClass && ["1", "2", "3", "4", "5", "6"].includes(savedClass)) {
        return savedClass;
      }
    } catch (e) {}
    if (user.isWaliKelas && user.kelas && ["1", "2", "3", "4", "5", "6"].includes(String(user.kelas).trim())) {
      return String(user.kelas).trim();
    }
    return "1";
  });

  useEffect(() => {
    try {
      if (selectedClass) localStorage.setItem("smart_sts_selected_class", selectedClass);
    } catch (e) {}
  }, [selectedClass]);
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
  const [ekskulTpAchievements, setEkskulTpAchievements] = useState<{ [tpId: string]: boolean }>({});
  const [isEkskulCustomDescActive, setIsEkskulCustomDescActive] = useState<boolean>(false);
  const [showAddEkskulTpHolder, setShowAddEkskulTpHolder] = useState<boolean>(false);
  const [newEkskulTpText, setNewEkskulTpText] = useState<string>("");
  const [ekskulTpSubmitLoading, setEkskulTpSubmitLoading] = useState<boolean>(false);
  const [editingEkskulTpId, setEditingEkskulTpId] = useState<string | null>(null);
  const [editingEkskulTpText, setEditingEkskulTpText] = useState<string>("");
  const [editingEkskulTpLoading, setEditingEkskulTpLoading] = useState<boolean>(false);

  // Manage TP template state for teacher
  const [newTpText, setNewTpText] = useState("");
  const [tpTargetClass, setTpTargetClass] = useState<string>("current"); // "current" | "all"
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

  // Filter or retrieve TP templates specifically for active currentEkskul
  const ekskulTpTemplates = useMemo(() => {
    return getEkskulTps(allTpObj, currentEkskul);
  }, [allTpObj, currentEkskul]);

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
  }, [user.id, selectedClass, activeSubject, selectedEkskulName, refreshTrigger]);

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

  // Helper function to generate narrative description for extracurriculars based on TP checklist
  const generateEkskulNarrativeDescription = (
    student: Student | null,
    ekskulName: string,
    templates: { id: string; text: string }[],
    achievements: { [tpId: string]: boolean },
    capaianGrade: string = "B"
  ) => {
    if (!student) return "";
    const name = student.name ? student.name.trim() : "Siswa";
    const cleanEkskul = (ekskulName || "Ekstrakurikuler").trim();

    const safeTemplates = Array.isArray(templates)
      ? templates.filter((tp) => tp && tp.id && tp.text)
      : [];

    if (safeTemplates.length === 0) {
      return `Alhamdulillah, ananda ${name} aktif dan bersemangat mengikuti kegiatan ekstrakurikuler ${cleanEkskul} dengan capaian ${capaianGrade === "A" ? "Sangat Baik" : capaianGrade === "B" ? "Baik" : "Cukup"}.`;
    }

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
      text = `Alhamdulillah, ananda ${name} dalam kegiatan ekstrakurikuler ${cleanEkskul} menunjukkan penguasaan yang sangat optimal dalam ${joinItems(achieved)}. Pertahankan semangat berlatih, teruslah bertumbuh dengan rendah hati, dan kembangkan potensi terbaikmu.`;
    } else if (achieved.length > 0 && needImprovement.length > 0) {
      text = `Alhamdulillah, ananda ${name} dalam kegiatan ekstrakurikuler ${cleanEkskul} menunjukkan penguasaan yang baik dalam ${joinItems(achieved)}. Namun masih memerlukan bimbingan dan pendampingan lebih lanjut dalam ${joinItems(needImprovement)}. Tetaplah bersemangat, jangan pernah lelah untuk mencoba dan terus berlatih.`;
    } else if (needImprovement.length > 0) {
      text = `Ananda ${name} dalam kegiatan ekstrakurikuler ${cleanEkskul} masih memerlukan bimbingan dan pendampingan lebih intensif dalam ${joinItems(needImprovement)}. Jangan berkecil hati, dengan ketekunan, kedisiplinan, dan latihan rutin, ananda pasti mampu meraih capaian yang lebih baik.`;
    } else {
      text = `Alhamdulillah, ananda ${name} aktif dan bersemangat mengikuti kegiatan ekstrakurikuler ${cleanEkskul} dengan baik.`;
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
      const normSubj = normalizeSubjectKey(subj);
      const existingGrade = safeGrades.find(
        (g) =>
          g &&
          g.studentId === student?.id &&
          g.subject &&
          (g.subject.trim().toLowerCase() === lowerSubj ||
            normalizeSubjectKey(g.subject) === normSubj),
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

      // Load ekskul grade and TP achievements for this student
      const curEkskul = selectedEkskulName || (assignedEkskuls.length > 0 ? assignedEkskuls[0] : (user.ekskulName || "Pramuka"));
      const studentNote = notesMap[student.id];
      const studentEkskuls = Array.isArray(studentNote?.ekskul) ? studentNote.ekskul : [];
      const foundEks = studentEkskuls.find(
        (e: any) => e && (e.name === curEkskul || e.ekskulName === curEkskul)
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

      const curEksTps = getEkskulTps(allTpObj, curEkskul);
      const defaultEksMap: { [tpId: string]: boolean } = {};
      curEksTps.forEach((t) => {
        if (t && t.id) defaultEksMap[t.id] = true;
      });

      if (foundEks) {
        const cap = normalizeGrade(foundEks.capaian || foundEks.predicate);
        setEkskulUsaha(normalizeGrade(foundEks.usaha, cap));
        setEkskulProses(normalizeGrade(foundEks.proses, cap));
        setEkskulCapaian(cap);

        if (foundEks.tpAchievements && typeof foundEks.tpAchievements === "object" && Object.keys(foundEks.tpAchievements).length > 0) {
          setEkskulTpAchievements({ ...defaultEksMap, ...foundEks.tpAchievements });
        } else {
          setEkskulTpAchievements(defaultEksMap);
        }

        if (foundEks.description && foundEks.description.trim() !== "") {
          setEkskulDescription(foundEks.description.trim());
          setIsEkskulCustomDescActive(true);
        } else if (foundEks.deskripsi && foundEks.deskripsi.trim() !== "") {
          setEkskulDescription(foundEks.deskripsi.trim());
          setIsEkskulCustomDescActive(true);
        } else {
          const auto = generateEkskulNarrativeDescription(
            student,
            curEkskul,
            curEksTps,
            foundEks.tpAchievements || defaultEksMap,
            cap
          );
          setEkskulDescription(auto);
          setIsEkskulCustomDescActive(false);
        }
      } else {
        setEkskulUsaha("B");
        setEkskulProses("B");
        setEkskulCapaian("B");
        setEkskulTpAchievements(defaultEksMap);
        const auto = generateEkskulNarrativeDescription(
          student,
          curEkskul,
          curEksTps,
          defaultEksMap,
          "B"
        );
        setEkskulDescription(auto);
        setIsEkskulCustomDescActive(false);
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
      if (num >= 89) defaultGrade = "A";
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
      kelas: tp.kelas || selectedClass,
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

  // Switch active ekskul and synchronize student's ekskul grade & TPs
  const handleSwitchEkskul = (eks: string) => {
    setSelectedEkskulName(eks);
    setShowAddEkskulTpHolder(false);
    setError("");
    setSuccess("");

    if (selectedStudent) {
      const sNote = allNotes[selectedStudent.id];
      const sEks = Array.isArray(sNote?.ekskul) ? sNote.ekskul : [];
      const found = sEks.find((item: any) => item && (item.name === eks || item.ekskulName === eks));
      const curTps = getEkskulTps(allTpObj, eks);
      const defMap: { [tpId: string]: boolean } = {};
      curTps.forEach((t) => {
        if (t && t.id) defMap[t.id] = true;
      });

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

      if (found) {
        const cap = normalizeGrade(found.capaian || found.predicate);
        setEkskulUsaha(normalizeGrade(found.usaha, cap));
        setEkskulProses(normalizeGrade(found.proses, cap));
        setEkskulCapaian(cap);

        if (found.tpAchievements && typeof found.tpAchievements === "object" && Object.keys(found.tpAchievements).length > 0) {
          setEkskulTpAchievements({ ...defMap, ...found.tpAchievements });
        } else {
          setEkskulTpAchievements(defMap);
        }

        if (found.description && found.description.trim() !== "") {
          setEkskulDescription(found.description.trim());
          setIsEkskulCustomDescActive(true);
        } else if (found.deskripsi && found.deskripsi.trim() !== "") {
          setEkskulDescription(found.deskripsi.trim());
          setIsEkskulCustomDescActive(true);
        } else {
          const auto = generateEkskulNarrativeDescription(
            selectedStudent,
            eks,
            curTps,
            found.tpAchievements || defMap,
            cap
          );
          setEkskulDescription(auto);
          setIsEkskulCustomDescActive(false);
        }
      } else {
        setEkskulUsaha("B");
        setEkskulProses("B");
        setEkskulCapaian("B");
        setEkskulTpAchievements(defMap);
        const auto = generateEkskulNarrativeDescription(
          selectedStudent,
          eks,
          curTps,
          defMap,
          "B"
        );
        setEkskulDescription(auto);
        setIsEkskulCustomDescActive(false);
      }
    }
  };

  // Toggle achievement status of an Ekskul TP and auto-update narrative description
  const toggleEkskulTp = (id: string) => {
    const nextAchieved = !ekskulTpAchievements[id];
    const nextMap = {
      ...ekskulTpAchievements,
      [id]: nextAchieved,
    };
    setEkskulTpAchievements(nextMap);

    if (!isEkskulCustomDescActive && selectedStudent && ekskulTpTemplates.length > 0) {
      const updatedDesc = generateEkskulNarrativeDescription(
        selectedStudent,
        currentEkskul,
        ekskulTpTemplates,
        nextMap,
        ekskulCapaian
      );
      setEkskulDescription(updatedDesc);
    }
  };

  // Bulk set all Ekskul TPs status (Semua Optimal atau Semua Perlu Bimbingan)
  const setAllEkskulTpStatus = (status: boolean) => {
    const nextMap: { [tpId: string]: boolean } = {};
    ekskulTpTemplates.forEach((tp) => {
      if (tp && tp.id) nextMap[tp.id] = status;
    });
    setEkskulTpAchievements(nextMap);

    if (selectedStudent && ekskulTpTemplates.length > 0) {
      const updatedDesc = generateEkskulNarrativeDescription(
        selectedStudent,
        currentEkskul,
        ekskulTpTemplates,
        nextMap,
        ekskulCapaian
      );
      setEkskulDescription(updatedDesc);
      setIsEkskulCustomDescActive(false);
    }
  };

  // Re-sync description from current Ekskul TP checklist
  const handleRegenerateEkskulFromTp = () => {
    if (!selectedStudent) return;
    if (ekskulTpTemplates.length === 0) {
      setError(`Belum ada TP untuk kegiatan ekskul ${currentEkskul}.`);
      return;
    }
    const updatedDesc = generateEkskulNarrativeDescription(
      selectedStudent,
      currentEkskul,
      ekskulTpTemplates,
      ekskulTpAchievements,
      ekskulCapaian
    );
    setEkskulDescription(updatedDesc);
    setIsEkskulCustomDescActive(false);
    setSuccess(`Deskripsi capaian ekskul ${currentEkskul} berhasil disinkronkan dari ceklist TP.`);
    setTimeout(() => setSuccess(""), 3000);
  };

  // Add a new TP specifically for the active extracurricular
  const handleAddEkskulTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEkskulTpText.trim()) return;
    setError("");
    setSuccess("");
    setEkskulTpSubmitLoading(true);

    const textToSave = newEkskulTpText.trim();
    const tempId = "tp_eks_" + Date.now();

    // Optimistically update
    setAllTpObj((prev) => {
      const next = { ...prev };
      const list = Array.isArray(next[currentEkskul]) ? [...next[currentEkskul]] : [];
      list.push({ id: tempId, text: textToSave, kelas: "all" });
      next[currentEkskul] = list;
      return next;
    });

    try {
      const response = await fetch("/api/tps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: currentEkskul,
          tpText: textToSave,
          kelas: "all",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan TP Ekskul.");

      setNewEkskulTpText("");
      setShowAddEkskulTpHolder(false);
      setSuccess(`Tujuan Pembelajaran untuk ekskul ${currentEkskul} berhasil ditambahkan!`);
      setTimeout(() => setSuccess(""), 3000);
      onRefreshTrigger();

      // Reload TPs
      const resTp = await fetch("/api/tps");
      const tpData = await resTp.json();
      if (tpData && typeof tpData === "object") {
        setAllTpObj(tpData);
      }

      setEkskulTpAchievements((prev) => ({
        ...prev,
        [data.id || tempId]: true,
      }));
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan TP Ekskul.");
    } finally {
      setEkskulTpSubmitLoading(false);
    }
  };

  // Start editing an Ekskul TP item
  const handleStartEditEkskulTp = (tp: { id: string; text: string }) => {
    setEditingEkskulTpId(tp.id);
    setEditingEkskulTpText(tp.text);
  };

  // Save edited Ekskul TP
  const handleSaveEditEkskulTp = async (tpId: string) => {
    if (!editingEkskulTpText.trim()) return;
    setError("");
    setSuccess("");
    setEditingEkskulTpLoading(true);

    const nextText = editingEkskulTpText.trim();

    // Optimistically update
    setAllTpObj((prev) => {
      const updated = { ...prev };
      const currentList = Array.isArray(updated[currentEkskul]) ? [...updated[currentEkskul]] : [];
      const idx = currentList.findIndex((item: any) => String(item.id).trim() === String(tpId).trim());
      if (idx >= 0) {
        currentList[idx] = { ...currentList[idx], text: nextText };
      } else {
        currentList.push({ id: tpId, text: nextText, kelas: "all" });
      }
      updated[currentEkskul] = currentList;
      return updated;
    });

    try {
      const response = await fetch(
        `/api/tps/${encodeURIComponent(currentEkskul)}/${encodeURIComponent(tpId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: nextText, kelas: "all" }),
        }
      );

      if (!response.ok) {
        await fetch("/api/tps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: currentEkskul, tpText: nextText, kelas: "all" }),
        }).catch(() => null);
      }

      setSuccess("Tujuan Pembelajaran Ekskul berhasil diperbarui!");
      setTimeout(() => setSuccess(""), 3000);
      setEditingEkskulTpId(null);
      setEditingEkskulTpText("");
      onRefreshTrigger();

      // Reload TPs
      const resTp = await fetch("/api/tps");
      const tpData = await resTp.json();
      if (tpData && typeof tpData === "object") {
        setAllTpObj(tpData);
      }

      // Re-generate description if auto-description is active
      if (!isEkskulCustomDescActive && selectedStudent) {
        const updatedTemplates = ekskulTpTemplates.map((t) =>
          t.id === tpId ? { ...t, text: nextText } : t
        );
        const auto = generateEkskulNarrativeDescription(
          selectedStudent,
          currentEkskul,
          updatedTemplates,
          ekskulTpAchievements,
          ekskulCapaian
        );
        setEkskulDescription(auto);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memperbarui TP Ekskul.");
    } finally {
      setEditingEkskulTpLoading(false);
    }
  };

  // Delete an Ekskul TP (default or custom)
  const handleDeleteEkskulTp = async (tpId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus indikator TP Ekskul ini?")) return;
    setError("");
    setSuccess("");

    // Optimistic remove
    setAllTpObj((prev) => {
      const updated = { ...prev };
      if (Array.isArray(updated[currentEkskul])) {
        updated[currentEkskul] = updated[currentEkskul].filter(
          (item: any) => String(item.id).trim() !== String(tpId).trim()
        );
      }
      if (!Array.isArray(updated._deleted)) updated._deleted = [];
      if (!updated._deleted.includes(tpId)) updated._deleted.push(tpId);
      return updated;
    });

    try {
      const response = await fetch(
        `/api/tps/${encodeURIComponent(currentEkskul)}/${encodeURIComponent(tpId)}`,
        { method: "DELETE" }
      );
      setSuccess("Indikator TP Ekskul berhasil dihapus.");
      setTimeout(() => setSuccess(""), 3000);
      onRefreshTrigger();

      const resTp = await fetch("/api/tps");
      const tpData = await resTp.json();
      if (tpData && typeof tpData === "object") {
        setAllTpObj(tpData);
      }

      // Re-generate description if auto-description is active
      if (!isEkskulCustomDescActive && selectedStudent) {
        const remainingTemplates = ekskulTpTemplates.filter((t) => t.id !== tpId);
        const auto = generateEkskulNarrativeDescription(
          selectedStudent,
          currentEkskul,
          remainingTemplates,
          ekskulTpAchievements,
          ekskulCapaian
        );
        setEkskulDescription(auto);
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghapus TP.");
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
          tpAchievements: ekskulTpAchievements,
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
    const targetKelas =
      tpTargetClass === "current"
        ? selectedClass
        : tpTargetClass === "all"
        ? "all"
        : tpTargetClass;
    const newCreatedTp = {
      id: tempId,
      text: textToSave,
      kelas: targetKelas,
    };

    // Optimistically update allTpObj immediately across both activeSubject and canonicalKey
    const canonicalKey = normalizeSubjectKey(activeSubject) || activeSubject;
    setAllTpObj((prev) => {
      const next = { ...prev };
      const keysToUpdate = [activeSubject, canonicalKey];
      keysToUpdate.forEach((k) => {
        const currentList = Array.isArray(next[k]) ? [...next[k]] : [];
        if (!currentList.some((x: any) => x.id === tempId)) {
          currentList.push(newCreatedTp);
        }
        next[k] = currentList;
      });
      return next;
    });

    // Immediately cache in localStorage as safety net
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("smart_sts_db");
        if (raw) {
          const dbObj = JSON.parse(raw);
          if (!dbObj.tujuan_pembelajaran_templates) dbObj.tujuan_pembelajaran_templates = {};
          [activeSubject, canonicalKey].forEach((k) => {
            if (!Array.isArray(dbObj.tujuan_pembelajaran_templates[k])) {
              dbObj.tujuan_pembelajaran_templates[k] = [];
            }
            if (!dbObj.tujuan_pembelajaran_templates[k].some((x: any) => x.id === tempId)) {
              dbObj.tujuan_pembelajaran_templates[k].push(newCreatedTp);
            }
          });
          localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
        }
      }
    } catch (e) {}

    try {
      const response = await fetch("/api/tps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: activeSubject,
          tpText: textToSave,
          kelas: targetKelas,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan TP.");

      setNewTpText("");
      const classLabel = targetKelas === "all" ? "Semua Rombel (Kelas 1-6)" : `Kelas ${selectedClass}`;
      setSuccess(`Tujuan Pembelajaran ${activeSubject} (${classLabel}) berhasil disimpan!`);
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
        [activeSubject, canonicalKey].forEach((k) => {
          if (Array.isArray(next[k])) {
            next[k] = next[k].filter((x: any) => x.id !== tempId);
          }
        });
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
                  className={`w-full p-2.5 rounded-lg text-left text-xs transition flex items-center justify-between gap-2 border-2 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-100 border-emerald-600 font-black text-emerald-950 shadow-xs"
                      : "bg-white border-slate-300 text-slate-950 font-bold hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate">{s.name || "N/A"}</span>
                  {activeViewTab === "ekskul" ? (
                    isFilled ? (
                      <span className="bg-emerald-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 shadow-2xs">
                        Selesai ✓
                      </span>
                    ) : (
                      <span className="bg-slate-200 text-slate-900 border border-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">
                        Kosong
                      </span>
                    )
                  ) : assignedSubjects.length > 1 ? (
                    multiFilledCount === assignedSubjects.length ? (
                      <span className="bg-emerald-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 shadow-2xs">
                        Lengkap ({assignedSubjects.length}) ✓
                      </span>
                    ) : multiFilledCount > 0 ? (
                      <span className="bg-amber-800 text-white border border-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 shadow-2xs">
                        {multiFilledCount}/{assignedSubjects.length} Mapel
                      </span>
                    ) : (
                      <span className="bg-slate-200 text-slate-900 border border-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">
                        0/{assignedSubjects.length}
                      </span>
                    )
                  ) : isFilled ? (
                    <span className="bg-emerald-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 shadow-2xs">
                      Selesai ✓
                    </span>
                  ) : (
                    <span className="bg-slate-200 text-slate-900 border border-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">
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
      <div className="lg:col-span-2 bg-white rounded-lg border-2 border-slate-300 shadow-sm p-4">
        {/* Navigation Tab Headers */}
        <div
          className="flex border-b-2 border-slate-300 gap-1 mb-4 flex-wrap"
          id="teacher-view-tabs"
        >
          {/* Grades tab (Only for teachers with subjects or Admin) */}
          {(assignedSubjects.length > 0 || user.subject === "Admin") && (
            <button
              onClick={() => setActiveViewTab("grades")}
              className={`py-2 px-3.5 uppercase tracking-wider text-[11px] font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeViewTab === "grades"
                  ? "border-emerald-800 text-emerald-950 bg-emerald-100 font-black"
                  : "border-transparent text-slate-900 hover:text-emerald-900 hover:bg-slate-100 font-extrabold"
              }`}
            >
              <ClipboardPlus className="w-4 h-4 text-emerald-800" /> Pengisian Nilai Raport
            </button>
          )}
          {(assignedSubjects.length > 0 || user.subject === "Admin") && !isEkskulSubject(activeSubject) && (
            <button
              onClick={() => setActiveViewTab("tps")}
              className={`py-2 px-3.5 uppercase tracking-wider text-[11px] font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeViewTab === "tps"
                  ? "border-emerald-800 text-emerald-950 bg-emerald-100 font-black"
                  : "border-transparent text-slate-900 hover:text-emerald-900 hover:bg-slate-100 font-extrabold"
              }`}
            >
              <BookOpen className="w-4 h-4 text-emerald-800" /> Kelola TP ({activeSubject})
            </button>
          )}

          {/* Ekskul Tab (Shown for Ekskul Teachers, Admin, or Teachers without academic subjects) */}
          {(Boolean(user.isEkskulTeacher) || assignedEkskuls.length > 0 || user.subject === "Pembina Ekskul" || user.subject === "Pelatih Ekskul" || user.subject === "Admin" || assignedSubjects.length === 0) && (
            <button
              onClick={() => setActiveViewTab("ekskul")}
              className={`py-2 px-3.5 uppercase tracking-wider text-[11px] font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeViewTab === "ekskul"
                  ? "border-amber-700 text-amber-950 bg-amber-100 font-black shadow-2xs"
                  : "border-transparent text-amber-900 hover:bg-amber-50 font-extrabold"
              }`}
            >
              <Award className="w-4 h-4 text-amber-800" />
              <span>Nilai Ekskul: {currentEkskul} {assignedEkskuls.length > 1 && `(${assignedEkskuls.length})`}</span>
            </button>
          )}
        </div>

        {/* TOP STATUS BAR & KEISLAMAN UNIFIED BAR */}
        <div className="pb-2.5 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 bg-emerald-900 text-white rounded-md text-[10px] uppercase tracking-wider font-black shadow-2xs">
              {activeViewTab === "ekskul" ? `Pembina Ekskul: ${currentEkskul}` : (activeSubject ? `Mapel: ${activeSubject}` : "Pembina Ekskul")}
            </span>
            <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300">
              Pengampu: {user.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* If Admin, let them switch ekskul in ekskul tab */}
            {activeViewTab === "ekskul" && user.subject === "Admin" && ekskulList.length > 0 && (
              <select
                value={selectedEkskulName}
                onChange={(e) => handleSwitchEkskul(e.target.value)}
                className="text-xs bg-amber-100 border-2 border-amber-500 text-slate-950 font-black rounded-lg px-2.5 py-1 focus:outline-none"
              >
                {ekskulList.map((eks) => (
                  <option key={eks.id} value={eks.name} className="bg-white text-slate-950 font-bold">
                    ⚽ {eks.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchData}
              className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[10px] font-black rounded-lg transition text-slate-900 cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <RefreshCw className="w-3 h-3 text-slate-800" /> Sinkronkan DB
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
                    onClick={() => handleSwitchEkskul(eks)}
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
                        &ge; 89 = A (Sangat Baik)
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-300">
                        80 - 88 = B (Baik)
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
                            ? Number(score) >= 89
                              ? "text-emerald-600"
                              : Number(score) >= 80
                              ? "text-cyan-600"
                              : "text-amber-600"
                            : "text-slate-400"
                        }`}
                      >
                        {score !== "" ? (
                          Number(score) >= 89
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
                        onClick={() => handleSwitchEkskul(eks)}
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
              {/* Header card with high contrast */}
              <div className="p-4 bg-amber-100 dark:bg-[#201802] border-2 border-amber-500 dark:border-amber-500/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-950 dark:text-amber-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-800 dark:bg-amber-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs">
                    ⚽
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-slate-950 dark:text-amber-100 uppercase tracking-wide">
                      {selectedStudent.name || "N/A"}
                    </h3>
                    <p className="text-xs text-amber-950 dark:text-amber-200 font-mono font-bold">
                      NISN: {selectedStudent.nisn || "-"} • Kelas {selectedStudent.kelas || "-"}
                    </p>
                  </div>
                </div>

                <span className="px-3.5 py-1.5 bg-amber-800 dark:bg-amber-600 text-white font-black text-xs rounded-xl shadow-xs tracking-wide self-start sm:self-auto uppercase">
                  Ekskul: {currentEkskul}
                </span>
              </div>

              <div className="bg-white dark:bg-[#090f1d] border-2 border-amber-400 dark:border-amber-600/80 p-4 sm:p-5 rounded-2xl space-y-4 shadow-sm">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    <span>Evaluasi & Capaian Ekstrakurikuler ({currentEkskul})</span>
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 font-medium">
                    Pengisian nilai ekskul {currentEkskul} dibuat setara dengan format mapel standar yang mencakup aspek <strong>Usaha</strong>, <strong>Proses</strong>, dan <strong>Capaian</strong> untuk ananda {selectedStudent.name}.
                  </p>
                </div>

                {/* 3-column evaluation: Usaha, Proses, Capaian (High contrast selects) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t-2 border-amber-200 dark:border-amber-800/60">
                  <div className="bg-amber-50/90 dark:bg-[#121c2e] p-3 rounded-xl border-2 border-amber-300 dark:border-amber-600/60">
                    <label className="block text-[11px] font-black text-slate-950 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                      Grade Usaha
                    </label>
                    <select
                      value={ekskulUsaha}
                      onChange={(e) => setEkskulUsaha(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-[#070d1a] border-2 border-slate-300 dark:border-amber-500 rounded-lg text-xs font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="A" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">A (Sangat Baik)</option>
                      <option value="B" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">B (Baik)</option>
                      <option value="C" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">C (Cukup)</option>
                      <option value="D" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">D (Kurang)</option>
                    </select>
                  </div>

                  <div className="bg-amber-50/90 dark:bg-[#121c2e] p-3 rounded-xl border-2 border-amber-300 dark:border-amber-600/60">
                    <label className="block text-[11px] font-black text-slate-950 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                      Grade Proses
                    </label>
                    <select
                      value={ekskulProses}
                      onChange={(e) => setEkskulProses(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-[#070d1a] border-2 border-slate-300 dark:border-amber-500 rounded-lg text-xs font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="A" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">A (Sangat Baik)</option>
                      <option value="B" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">B (Baik)</option>
                      <option value="C" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">C (Cukup)</option>
                      <option value="D" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">D (Kurang)</option>
                    </select>
                  </div>

                  <div className="bg-amber-50/90 dark:bg-[#121c2e] p-3 rounded-xl border-2 border-amber-300 dark:border-amber-600/60">
                    <label className="block text-[11px] font-black text-slate-950 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                      Grade Capaian
                    </label>
                    <select
                      value={ekskulCapaian}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEkskulCapaian(val);
                        if (!isEkskulCustomDescActive && selectedStudent && ekskulTpTemplates.length > 0) {
                          const auto = generateEkskulNarrativeDescription(
                            selectedStudent,
                            currentEkskul,
                            ekskulTpTemplates,
                            ekskulTpAchievements,
                            val
                          );
                          setEkskulDescription(auto);
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-[#070d1a] border-2 border-slate-300 dark:border-amber-500 rounded-lg text-xs font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="A" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">A (Sangat Baik)</option>
                      <option value="B" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">B (Baik)</option>
                      <option value="C" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">C (Cukup)</option>
                      <option value="D" className="bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-bold">D (Kurang)</option>
                    </select>
                  </div>
                </div>

                {/* TP Objectives Checklist (Tujuan Pembelajaran Ekstrakurikuler) */}
                <div className="border-t-2 border-amber-300 dark:border-amber-800/80 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-slate-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                        <Award className="w-4.5 h-4.5 text-amber-700 dark:text-amber-400 shrink-0" />
                        <span>Tujuan Pembelajaran (TP) & Capaian: {currentEkskul}</span>
                        <span className="px-2.5 py-0.5 bg-amber-800 text-white border border-amber-600 rounded-md text-[10px] font-black font-mono">
                          {ekskulTpTemplates.length} Indikator TP
                        </span>
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                        Centang TP yang sudah dikuasai/optimal oleh <strong>{selectedStudent.name}</strong>. Anda dapat mengedit teks TP atau menghapusnya kapan saja!
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setAllEkskulTpStatus(true)}
                        className="px-3 py-1.5 text-xs font-black bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg transition cursor-pointer shadow-xs"
                      >
                        Semua Optimal ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllEkskulTpStatus(false)}
                        className="px-3 py-1.5 text-xs font-black bg-amber-800 hover:bg-amber-900 text-white rounded-lg transition cursor-pointer shadow-xs"
                      >
                        Semua Perlu Bimbingan ⚠️
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddEkskulTpHolder((prev) => !prev)}
                        className="px-3 py-1.5 text-xs font-black bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-4 h-4 text-amber-400" />
                        <span>{showAddEkskulTpHolder ? "Tutup Form TP" : "Tambah TP Ekskul"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add TP Form */}
                  {showAddEkskulTpHolder && (
                    <div className="mb-4 p-3.5 bg-amber-100 dark:bg-[#1a2338] border-2 border-amber-500 rounded-xl space-y-2 animate-fade-in shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-950 dark:text-amber-200 uppercase tracking-wide">
                          Tambah Indikator TP Baru untuk Ekskul {currentEkskul}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddEkskulTpHolder(false)}
                          className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-bold"
                        >
                          ✕ Batal
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newEkskulTpText}
                          onChange={(e) => setNewEkskulTpText(e.target.value)}
                          placeholder={`Contoh: Mampu melakukan passing terarah dan teknik dasar ${currentEkskul}...`}
                          className="flex-1 p-2.5 bg-white dark:bg-[#070d1a] border-2 border-amber-400 dark:border-[#2b3e66] rounded-lg text-xs font-bold text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddEkskulTp}
                          disabled={ekskulTpSubmitLoading || !newEkskulTpText.trim()}
                          className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-black text-xs rounded-lg transition disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
                        >
                          {ekskulTpSubmitLoading ? "Menyimpan..." : "Simpan TP"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of Ekskul TPs with high contrast and full Edit & Delete functionality */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {ekskulTpTemplates.length === 0 ? (
                      <div className="p-4 bg-amber-50 dark:bg-[#121a2c] rounded-xl border-2 border-dashed border-amber-400 dark:border-amber-800/80 text-center text-xs text-slate-700 dark:text-slate-300 font-bold">
                        Belum ada indikator TP untuk {currentEkskul}. Klik tombol <strong>Tambah TP Ekskul</strong> di atas.
                      </div>
                    ) : (
                      ekskulTpTemplates.map((tp) => {
                        const isChecked = ekskulTpAchievements && ekskulTpAchievements[tp.id] !== false;
                        const isEditing = editingEkskulTpId === tp.id;

                        if (isEditing) {
                          return (
                            <div
                              key={tp.id}
                              className="p-3 bg-white dark:bg-[#0c1424] border-2 border-amber-500 rounded-xl space-y-2 shadow-md animate-fade-in"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                                  Edit Teks Indikator TP ({currentEkskul})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingEkskulTpId(null)}
                                  className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                                >
                                  ✕ Batal
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editingEkskulTpText}
                                onChange={(e) => setEditingEkskulTpText(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-[#030712] border-2 border-amber-400 dark:border-amber-600 text-slate-950 dark:text-white font-bold text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingEkskulTpId(null)}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 font-bold text-xs rounded-lg transition cursor-pointer"
                                >
                                  Batal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditEkskulTp(tp.id)}
                                  disabled={editingEkskulTpLoading || !editingEkskulTpText.trim()}
                                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>{editingEkskulTpLoading ? "Menyimpan..." : "Simpan Perubahan TP"}</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={tp.id}
                            onClick={() => toggleEkskulTp(tp.id)}
                            className={`p-3.5 rounded-xl border-2 text-xs transition cursor-pointer select-none flex items-start gap-3 shadow-xs ${
                              isChecked
                                ? "bg-emerald-100 dark:bg-emerald-950 border-emerald-600 dark:border-emerald-500 hover:bg-emerald-200/80"
                                : "bg-amber-100 dark:bg-amber-950 border-amber-600 dark:border-amber-500 hover:bg-amber-200/80"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleEkskulTp(tp.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 rounded border-2 border-amber-700 text-amber-800 focus:ring-amber-600 cursor-pointer mt-0.5 shrink-0"
                            />
                            <div className="flex-1">
                              <p className="text-slate-950 dark:text-white leading-relaxed font-black text-xs sm:text-sm">
                                {tp.text}
                              </p>
                              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                <span
                                  className={`text-[11px] font-black tracking-wide uppercase px-3 py-1 rounded-md shadow-2xs ${
                                    isChecked
                                      ? "bg-emerald-900 text-white border border-emerald-700"
                                      : "bg-amber-900 text-white border border-amber-700"
                                  }`}
                                >
                                  {isChecked ? "Sudah Optimal ✓" : "Perlu Bimbingan ⚠️"}
                                </span>

                                <div className="flex items-center gap-2 ml-auto">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditEkskulTp(tp);
                                    }}
                                    className="px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-lg font-black text-xs flex items-center gap-1 cursor-pointer transition shadow-xs border border-amber-700"
                                    title="Edit teks TP ini"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEkskulTp(tp.id);
                                    }}
                                    className="px-3 py-1.5 bg-rose-900 hover:bg-rose-950 text-white rounded-lg font-black text-xs flex items-center gap-1 cursor-pointer transition shadow-xs border border-rose-700"
                                    title="Hapus TP ini"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Narrative description */}
                <div className="pt-4 border-t-2 border-amber-300 dark:border-amber-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                    <div>
                      <label className="block text-xs font-black text-slate-950 dark:text-amber-100 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                        <span>Narasi Deskripsi Capaian Raport ({currentEkskul}):</span>
                        {ekskulTpTemplates.length > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-800 text-white rounded-md text-[10px] font-black lowercase">
                            sinkron dengan checklist TP
                          </span>
                        )}
                      </label>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-medium">
                        {ekskulTpTemplates.length > 0
                          ? `Deskripsi otomatis disesuaikan dengan checklist TP untuk ananda ${selectedStudent.name}, dan tetap dapat Anda edit langsung secara bebas.`
                          : `Ketik narasi deskripsi capaian kegiatan ekskul ${currentEkskul} untuk ananda ${selectedStudent.name}.`}
                      </p>
                    </div>

                    {ekskulTpTemplates.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRegenerateEkskulFromTp}
                        className="px-3 py-1.5 text-xs font-black bg-amber-800 hover:bg-amber-900 text-white rounded-lg flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer shadow-xs"
                        title="Sinkronkan ulang deskripsi dari centangan TP"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                        <span>Sinkronkan dari TP</span>
                      </button>
                    )}
                  </div>

                  <textarea
                    value={ekskulDescription}
                    onChange={(e) => {
                      setEkskulDescription(e.target.value);
                      setIsEkskulCustomDescActive(true);
                    }}
                    rows={4}
                    placeholder={`Ketik narasi deskripsi capaian kegiatan ekskul ${currentEkskul} untuk ananda ${selectedStudent.name}...`}
                    className="w-full p-3.5 border-2 border-slate-400 dark:border-amber-500 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#070d1a] text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed font-bold shadow-xs"
                  />
                </div>
              </div>

              <div className="border-t-2 border-amber-300 dark:border-[#223354] pt-4 text-right">
                <button
                  type="submit"
                  disabled={ekskulSaveLoading}
                  className="px-6 py-3 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 ml-auto shadow-md border-2 border-amber-600 transition disabled:opacity-50 cursor-pointer"
                >
                  {ekskulSaveLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-4.5 h-4.5 text-amber-300" /> Simpan Nilai & Deskripsi Ekskul ({currentEkskul})
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

            {/* Class Switcher in TP Management */}
            <div className="p-2.5 bg-emerald-50/50 border border-emerald-150 rounded-xl flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider mr-1">
                Pilih Rombel / Kelas:
              </span>
              {["1", "2", "3", "4", "5", "6"].map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedClass(cls)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    selectedClass === cls
                      ? "bg-emerald-800 text-white shadow-xs ring-2 ring-emerald-600/30"
                      : "bg-white text-slate-700 border border-emerald-200 hover:bg-emerald-50"
                  }`}
                >
                  <span>Kelas {cls}</span>
                  {selectedClass === cls && <span className="text-[10px]">✔</span>}
                </button>
              ))}
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
              className="p-3 bg-emerald-50 rounded-lg border border-emerald-150 space-y-2"
            >
              <div>
                <label className="block text-[9px] font-bold text-emerald-900 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <span>Tambah TP Baru ({activeSubject})</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    required
                    value={newTpText}
                    onChange={(e) => setNewTpText(e.target.value)}
                    placeholder={`Contoh: Menguasai kompetensi dasar materi ${activeSubject}...`}
                    className="flex-1 p-1.5 bg-white border border-emerald-250 rounded text-xs focus:outline-none focus:border-emerald-700"
                  />
                  <button
                    type="submit"
                    disabled={tpSubmitLoading || !newTpText.trim()}
                    className="bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white p-1.5 rounded cursor-pointer transition flex items-center justify-center h-[32px] w-[36px] shrink-0"
                    title="Tambahkan TP"
                  >
                    {tpSubmitLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-[10px] pt-0.5">
                <span className="text-slate-600 font-semibold">Terapkan untuk Rombel:</span>
                <button
                  type="button"
                  onClick={() => setTpTargetClass("current")}
                  className={`flex items-center gap-1 cursor-pointer font-bold px-2.5 py-1 rounded-lg border transition ${
                    tpTargetClass === "current" || tpTargetClass === selectedClass
                      ? "bg-emerald-800 text-white border-emerald-800 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-250 hover:bg-slate-50"
                  }`}
                >
                  <span>Kelas Aktif ({selectedClass})</span>
                  {(tpTargetClass === "current" || tpTargetClass === selectedClass) && <span>✔</span>}
                </button>
                {["1", "2", "3", "4", "5", "6"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setTpTargetClass(c);
                      setSelectedClass(c);
                    }}
                    className={`flex items-center gap-1 cursor-pointer font-bold px-2 py-1 rounded-lg border transition ${
                      tpTargetClass === c || (tpTargetClass === "current" && selectedClass === c)
                        ? "bg-emerald-800 text-white border-emerald-800 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>Kelas {c}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTpTargetClass("all")}
                  className={`flex items-center gap-1 cursor-pointer font-bold px-2.5 py-1 rounded-lg border transition ${
                    tpTargetClass === "all"
                      ? "bg-emerald-800 text-white border-emerald-800 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>Semua Rombel (1-6)</span>
                  {tpTargetClass === "all" && <span>✔</span>}
                </button>
              </div>
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
