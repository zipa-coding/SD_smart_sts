import React, { useState, useEffect } from "react";
import { Teacher, Student, Grade, TPItem } from "../types";
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
} from "lucide-react";

interface TeacherPanelProps {
  user: Teacher;
  onRefreshTrigger: () => void;
}

export default function TeacherPanel({
  user,
  onRefreshTrigger,
}: TeacherPanelProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [tpTemplates, setTpTemplates] = useState<
    { id: string; text: string }[]
  >([]);

  // View state tab: grades (pengisian nilai) or tps (kelola TP)
  const [activeViewTab, setActiveViewTab] = useState<"grades" | "tps">(
    "grades",
  );

  // Class selection state (1, 2, 3, 4, 5, 6)
  const [selectedClass, setSelectedClass] = useState("1");
  // Student selection state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form states
  const [score, setScore] = useState<string>("");
  const [usaha, setUsaha] = useState<string>("B");
  const [proses, setProses] = useState<string>("B");
  const [capaian, setCapaian] = useState<string>("B");
  const [tpAchievements, setTpAchievements] = useState<{
    [tpId: string]: boolean;
  }>({});

  const [customDescription, setCustomDescription] = useState<string>("");
  const [isCustomDescActive, setIsCustomDescActive] = useState<boolean>(false);

  // Manage TP template state for teacher
  const [newTpText, setNewTpText] = useState("");
  const [tpSubmitLoading, setTpSubmitLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [resS, resG, resTp] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/grades"),
        fetch("/api/tps"),
      ]);

      const sData = await resS.json();
      const gData = await resG.json();
      const tpData = await resTp.json();

      const sArr = Array.isArray(sData) ? sData : [];
      const gArr = Array.isArray(gData) ? gData : [];
      const tpObj = tpData && typeof tpData === "object" ? tpData : {};

      setStudents(sArr);
      setGrades(gArr);

      // Filter TP templates specifically for this teacher's subject and the selected class
      const allSubjectTps = Array.isArray(tpObj[user.subject])
        ? tpObj[user.subject]
        : [];
      const classTps = allSubjectTps.filter(
        (t: any) => String(t.kelas || "").trim() === String(selectedClass).trim()
      );
      setTpTemplates(classTps);

      // Auto-select first student in this class if available
      const classStudents = sArr.filter(
        (s: Student) => s.kelas === selectedClass,
      );
      if (classStudents.length > 0) {
        handleStudentSelect(classStudents[0], gArr, classTps);
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
  }, [selectedClass, user.subject]);

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
  ) => {
    try {
      setSelectedStudent(student);
      setSuccess("");
      setError("");

      const safeGrades = Array.isArray(allGrades) ? allGrades : [];
      const safeTemplates = Array.isArray(templates) ? templates : [];

      // Look up if this student already has a grade for this teacher's subject
      const existingGrade = safeGrades.find(
        (g) => g && g.studentId === student?.id && g.subject === user.subject,
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
            achievedMap[tmpl.id] = found ? !!found.achieved : true; // Default to true mapped
          }
        });
        setTpAchievements(achievedMap);

        if (existingGrade.deskripsi && existingGrade.deskripsi.trim() !== "") {
          setCustomDescription(existingGrade.deskripsi.trim());
          setIsCustomDescActive(true);
        } else if (safeTemplates.length > 0) {
          const auto = generateNarrativeDescription(
            student,
            user.subject,
            safeTemplates,
            achievedMap,
          );
          setCustomDescription(auto);
          setIsCustomDescActive(false);
        } else {
          setCustomDescription("");
          setIsCustomDescActive(false);
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

        if (safeTemplates.length > 0) {
          const auto = generateNarrativeDescription(
            student,
            user.subject,
            safeTemplates,
            defaultMap,
          );
          setCustomDescription(auto);
        } else {
          setCustomDescription("");
        }
        setIsCustomDescActive(false);
      }
    } catch (e: any) {
      console.error("Error in handleStudentSelect:", e);
      setError("Terjadi kesalahan memproses data siswa terpilih.");
    }
  };

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

    // Otomatis memperbarui deskripsi sesuai status TP terbaru & menyertakan nama siswa
    if (selectedStudent && tpTemplates.length > 0) {
      const updatedDesc = generateNarrativeDescription(
        selectedStudent,
        user.subject,
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

    if (selectedStudent && tpTemplates.length > 0) {
      const updatedDesc = generateNarrativeDescription(
        selectedStudent,
        user.subject,
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
      user.subject,
      tpTemplates,
      tpAchievements,
    );
    setCustomDescription(updatedDesc);
    setSuccess("Deskripsi berhasil diperbarui otomatis dari ceklist TP.");
    setTimeout(() => setSuccess(""), 3000);
  };

  // Auto generate narrative description (used as fallback)
  const getAutoDescription = () => {
    return generateNarrativeDescription(
      selectedStudent,
      user.subject,
      tpTemplates,
      tpAchievements,
    );
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

    // Format TP list for post payload (supports empty TP list)
    const safeTemplates = Array.isArray(tpTemplates) ? tpTemplates : [];
    const formattedTps: TPItem[] = safeTemplates.map((tp) => ({
      id: tp.id,
      text: tp.text,
      achieved: tpAchievements[tp.id] ?? true,
    }));

    // Description is taken directly from the textarea (supports both auto from TP and purely manual)
    const finalDescription = customDescription.trim();

    try {
      const response = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          subject: user.subject,
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
        `Nilai ${user.subject} untuk ${selectedStudent.name} berhasil disimpan!`,
      );
      onRefreshTrigger(); // trigger live stats update in index

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

  // Add TP template directly by the teacher
  const handleAddLocalTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTpText.trim()) return;
    setError("");
    setSuccess("");
    setTpSubmitLoading(true);

    try {
      const response = await fetch("/api/tps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: user.subject,
          tpText: newTpText.trim(),
          kelas: selectedClass,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan TP.");

      setNewTpText("");
      setSuccess(`Tujuan Pembelajaran untuk Kelas ${selectedClass} berhasil ditambahkan!`);

      // Reload TP templates for this subject and selected class
      const resTp = await fetch(`/api/tps?kelas=${selectedClass}`);
      const tpData = await resTp.json();
      const allSubjectTps = Array.isArray(tpData[user.subject])
        ? tpData[user.subject]
        : Array.isArray(tpData)
        ? tpData
        : [];
      const classTps = allSubjectTps.filter(
        (t: any) => String(t.kelas || "").trim() === String(selectedClass).trim()
      );
      setTpTemplates(classTps);

      // Default the new TP as achieved in state
      setTpAchievements((prev) => ({
        ...prev,
        [data.id]: true,
      }));
    } catch (err: any) {
      setError(err.message || "Gagal menambahkan TP.");
    } finally {
      setTpSubmitLoading(false);
    }
  };

  // Delete TP template by teacher
  const handleDeleteLocalTp = async (tpId: string) => {
    if (
      !confirm(
        "Apakah Anda yakin ingin menghapus Tujuan Pembelajaran (TP) ini?",
      )
    )
      return;
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/tps/${encodeURIComponent(user.subject)}/${tpId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghapus TP.");

      setSuccess("Tujuan Pembelajaran berhasil dihapus.");

      // Reload TP templates for selected class
      const resTp = await fetch(`/api/tps?kelas=${selectedClass}`);
      const tpData = await resTp.json();
      const allSubjectTps = Array.isArray(tpData[user.subject])
        ? tpData[user.subject]
        : Array.isArray(tpData)
        ? tpData
        : [];
      const classTps = allSubjectTps.filter(
        (t: any) => String(t.kelas || "").trim() === String(selectedClass).trim()
      );
      setTpTemplates(classTps);
    } catch (err: any) {
      setError(err.message || "Gagal menghapus TP.");
    }
  };

  // Helper arrays
  const safeStudents = Array.isArray(students) ? students : [];
  const classStudents = safeStudents.filter(
    (s) => s && s.kelas === selectedClass,
  );
  const filledCount = Array.isArray(grades)
    ? classStudents.filter((s) =>
        grades.some(
          (g) => g && g.studentId === s.id && g.subject === user.subject,
        ),
      ).length
    : 0;

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
            Terisi: {filledCount}/{classStudents.length}
          </span>
        </div>

        <div
          className="space-y-1 max-h-[350px] overflow-y-auto pr-1"
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
              const isFilled =
                Array.isArray(grades) &&
                grades.some(
                  (g) =>
                    g && g.studentId === s.id && g.subject === user.subject,
                );
              const isSelected = selectedStudent?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleStudentSelect(s)}
                  className={`w-full p-2 rounded text-left text-xs transition flex items-center justify-between gap-2 border cursor-pointer ${isSelected ? "bg-emerald-50/70 border-emerald-400 font-bold text-emerald-900" : "bg-white border-slate-150 text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="truncate">{s.name || "N/A"}</span>
                  {isFilled ? (
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
          className="flex border-b border-slate-200 gap-1 mb-4"
          id="teacher-view-tabs"
        >
          <button
            onClick={() => setActiveViewTab("grades")}
            className={`py-1.5 px-3 uppercase tracking-wider text-[10px] font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeViewTab === "grades" ? "border-emerald-800 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <ClipboardPlus className="w-3.5 h-3.5" /> Pengisian Nilai &
            Deskripsi
          </button>
          <button
            onClick={() => setActiveViewTab("tps")}
            className={`py-1.5 px-3 uppercase tracking-wider text-[10px] font-extrabold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeViewTab === "tps" ? "border-emerald-800 text-emerald-850 bg-emerald-50/40" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Kelola TP ({user.subject})
          </button>
        </div>

        <div className="pb-2.5 mb-4 flex items-center justify-between">
          <div>
            <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[10px] uppercase tracking-wider font-extrabold mr-2">
              Mapel {user.subject}
            </span>
            <span className="text-[11px] text-slate-400 italic">
              Pengampu: {user.name}
            </span>
          </div>
          <button
            onClick={fetchData}
            className="p-1 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-bold rounded transition text-slate-600 cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Sinkronkan DB
          </button>
        </div>

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

        {/* INPUT GRADING TAB */}
        {activeViewTab === "grades" &&
          (selectedStudent ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
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

              {/* THREE-GRADE EVALUATION CRITERIA + NUMERIC SCORE */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-0.5">
                      Input Nilai & Kriteria Evaluasi
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
                      <span className={`text-[10px] font-extrabold font-mono block ${
                        score !== ""
                          ? Number(score) > 91
                            ? "text-emerald-600"
                            : Number(score) >= 80
                            ? "text-cyan-600"
                            : "text-amber-600"
                          : "text-slate-400"
                      }`}>
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
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                  <div>
                    <h4 className="font-extrabold text-[10px] text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      Tujuan Pembelajaran (TP) untuk Anak Ini
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Centang jika anak sudah optimal (Sangat Baik). Un-centang jika masih butuh bimbingan.
                    </p>
                  </div>
                  {Array.isArray(tpTemplates) && tpTemplates.length > 0 && (
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setAllTpStatus(true)}
                        className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded transition cursor-pointer"
                      >
                        Semua Optimal ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllTpStatus(false)}
                        className="px-2 py-0.5 text-[9px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded transition cursor-pointer"
                      >
                        Semua Butuh Bimbingan ⚠️
                      </button>
                    </div>
                  )}
                </div>

                <div
                  className="space-y-1.5 max-h-48 overflow-y-auto"
                  id="tp-grading-list"
                >
                  {!Array.isArray(tpTemplates) || tpTemplates.length === 0 ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded border border-slate-200 dark:border-slate-700 text-center">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                        Belum ada template Tujuan Pembelajaran (TP) Kelas {selectedClass}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Anda tetap dapat menyimpan nilai serta menuliskan narasi deskripsi raport secara manual pada kolom di bawah.
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
                                ? "bg-emerald-50/20 border-emerald-200/80 hover:bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                                : "bg-amber-50/20 border-amber-200/80 hover:bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTp(tp.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5 dark:bg-slate-900 dark:border-slate-700"
                            />
                            <div className="flex-1">
                              <p className="text-slate-800 dark:text-slate-200 leading-normal font-medium">
                                {tp.text}
                              </p>
                              <span
                                className={`text-[9px] font-bold tracking-wide mt-1 inline-flex items-center gap-1 uppercase px-1.5 py-0.5 rounded ${
                                  isChecked
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
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
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <div>
                    <h4 className="font-extrabold text-[10px] text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Narasi Deskripsi Raport</span>
                      {tpTemplates.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded text-[9px] font-semibold lowercase">
                          otomatis memuat nama siswa
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {tpTemplates.length > 0
                        ? `Deskripsi otomatis langsung diperbarui saat ceklist TP diubah (termasuk nama ananda ${selectedStudent.name}). Tetap bisa diedit manual langsung di kolom ini.`
                        : `Ketik narasi deskripsi capaian raport ananda ${selectedStudent.name} secara manual di bawah (dapat disimpan tanpa TP).`}
                    </p>
                  </div>
                  {tpTemplates.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRegenerateFromTp}
                      title="Klik untuk menyinkronkan atau menghasilkan ulang narasi deskripsi dari ceklist TP saat ini"
                      className="px-2.5 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3 h-3 text-emerald-600" />
                      <span>Sinkronkan dari TP</span>
                    </button>
                  )}
                </div>

                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  rows={4}
                  placeholder={
                    selectedStudent
                      ? `Ketik deskripsi capaian rapor untuk ananda ${selectedStudent.name} di sini...`
                      : "Ketik deskripsi capaian nilai rapor secara manual di sini..."
                  }
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                      <Save className="w-3.5 h-3.5" /> Simpan Nilai & Deskripsi
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

        {/* LOCAL TP MANAGEMENT TAB */}
        {activeViewTab === "tps" && (
          <div
            className="space-y-4 animate-fade-in"
            id="teacher-tplocal-management"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase flex items-center gap-2">
                  <span>Kelola Tujuan Pembelajaran (TP) - {user.subject}</span>
                  <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[10px] font-bold">
                    Kelas {selectedClass}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tujuan pembelajaran otomatis disesuaikan secara spesifik untuk tingkat Kelas {selectedClass}. Anda dapat menambah atau memperbarui sesuai kebutuhan materi.
                </p>
              </div>
            </div>

            {/* Form to add custom learning objective directly by the teacher */}
            <form
              onSubmit={handleAddLocalTp}
              className="p-3 bg-emerald-50 rounded-lg border border-emerald-150 flex gap-2 items-end"
            >
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-emerald-900 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <span>Tambah Tujuan Pembelajaran Baru:</span>
                  <span className="text-emerald-700 font-extrabold">(Tingkat Kelas {selectedClass})</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTpText}
                  onChange={(e) => setNewTpText(e.target.value)}
                  placeholder={`Contoh: Menguasai kompetensi dasar materi kelas ${selectedClass}...`}
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
                  <span>Daftar TP Kelas {selectedClass}</span>
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
                  <p className="p-4 text-center text-xs text-slate-400 italic">
                    Belum ada Tujuan Pembelajaran untuk Kelas {selectedClass}. Silakan tambahkan pada form di atas.
                  </p>
                ) : (
                  tpTemplates
                    .filter((tp) => tp && tp.id)
                    .map((tp, idx) => (
                      <div
                        key={tp.id}
                        className="p-2.5 flex items-start justify-between gap-3 bg-white hover:bg-slate-50/50 transition"
                      >
                        <div className="flex gap-2">
                          <span className="text-[10px] font-mono text-slate-350">
                            {idx + 1}.
                          </span>
                          <div>
                            <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                              {tp.text}
                            </p>
                            <span className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Kelas {tp.kelas || selectedClass}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteLocalTp(tp.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer shrink-0"
                          title="Hapus TP"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
