import React, { useState, useEffect } from "react";
import { Teacher, Student, Grade, WaliKelasNotesMap } from "../types";
import {
  Printer,
  ChevronRight,
  ClipboardCheck,
  Award,
  AlertTriangle,
  UserCheck,
  Save,
  CheckCircle,
  Clock,
  RefreshCw,
  UserPlus,
  X,
  AlertCircle
} from "lucide-react";
import PrintRaportView from "./PrintRaportView";

interface WaliKelasPanelProps {
  user: Teacher;
  onRefreshTrigger: () => void;
}

export default function WaliKelasPanel({ user, onRefreshTrigger }: WaliKelasPanelProps) {
  // Default Mata Pelajaran lists
  const defaultSubjects = [
    "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "PJOK", "Prakarya", "Informatika",
    "Bahasa Arab", "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"
  ];
  const [subjectsList, setSubjectsList] = useState<string[]>(defaultSubjects);

  // If user is Wali Kelas, default to their assigned class. Otherwise fall back to a default like "1".
  const initialClass = user.kelas || "1";
  const [selectedClass, setSelectedClass] = useState(initialClass);

  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [allClassNotes, setAllClassNotes] = useState<WaliKelasNotesMap>({});

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Attendance Form
  const [sakit, setSakit] = useState<string>("0");
  const [izin, setIzin] = useState<string>("0");
  const [alpa, setAlpa] = useState<string>("0");
  const [catatan, setCatatan] = useState<string>("");

  // Spiritual Character Form Elements
  const [spiritualUsaha, setSpiritualUsaha] = useState<string>("B");
  const [spiritualProses, setSpiritualProses] = useState<string>("B");
  const [spiritualCapaian, setSpiritualCapaian] = useState<string>("B");
  const [spiritualDeskripsi, setSpiritualDeskripsi] = useState<string>("");

  // Social Character Form Elements
  const [sosialUsaha, setSosialUsaha] = useState<string>("B");
  const [sosialProses, setSosialProses] = useState<string>("B");
  const [sosialCapaian, setSosialCapaian] = useState<string>("B");
  const [sosialDeskripsi, setSosialDeskripsi] = useState<string>("");

  // Sub-navigation view state
  const [raportPrintTarget, setRaportPrintTarget] = useState<Student | null>(null);

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeEkskulList, setActiveEkskulList] = useState<{ id: string; name: string; type: "Wajib" | "Pilihan" }[]>([]);
  const [studentEkskulGrades, setStudentEkskulGrades] = useState<{ [ekskulName: string]: { predicate: string; description: string; selected: boolean } }>({});

  // Quick Add Student Modal State
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentNisn, setNewStudentNisn] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState("");

  const handleQuickAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStudentError("");

    const name = newStudentName.trim();
    const nisn = newStudentNisn.trim().replace(/\D/g, "");

    if (!name) {
      setAddStudentError("Nama siswa wajib diisi.");
      return;
    }
    if (!nisn) {
      setAddStudentError("NISN siswa wajib diisi (numerik angka).");
      return;
    }

    setIsAddingStudent(true);
    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nisn,
          kelas: selectedClass
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menambahkan siswa.");
      }

      await fetchData();
      onRefreshTrigger();
      setIsAddStudentOpen(false);
      setNewStudentName("");
      setNewStudentNisn("");
      setSuccess(`Siswa ${name} berhasil ditambahkan ke Kelas ${selectedClass}!`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setAddStudentError(err.message || "Terjadi kesalahan saat menambahkan siswa.");
    } finally {
      setIsAddingStudent(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [resS, resG, resN, resE, resSub] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/grades"),
        fetch("/api/walikelas/notes"),
        fetch("/api/ekskul"),
        fetch("/api/subjects")
      ]);

      const sData = await resS.json();
      const gData = await resG.json();
      const nData = await resN.json();
      const eData = await resE.json();
      const subData = await resSub.json();

      const studentsArray = Array.isArray(sData) ? sData : [];
      const gradesArray = Array.isArray(gData) ? gData : [];
      const notesObj = nData && typeof nData === "object" && !Array.isArray(nData) ? nData : {};
      const ekskulArray = Array.isArray(eData) ? eData : [];

      setStudents(studentsArray);
      setGrades(gradesArray);
      setAllClassNotes(notesObj);
      setActiveEkskulList(ekskulArray);
      if (Array.isArray(subData) && subData.length > 0) {
        setSubjectsList(subData);
      }

      // Auto-select first student in this class
      const classStudents = studentsArray.filter((s: Student) => s.kelas === selectedClass);
      if (classStudents.length > 0 && !selectedStudent) {
        handleStudentSelect(classStudents[0], notesObj, ekskulArray);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Gagal memuat sinkronisasi data wali kelas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass]);

  const handleStudentSelect = (student: Student, notesMap = allClassNotes, eksList = activeEkskulList) => {
    setSelectedStudent(student);
    setSuccess("");
    setError("");

    const safeNotesMap = notesMap && typeof notesMap === "object" && !Array.isArray(notesMap) ? notesMap : {};

    // Load attendance & notes if written
    const note = safeNotesMap[student.id];
    if (note) {
      setSakit(String(note.sakit));
      setIzin(String(note.izin));
      setAlpa(String(note.alpa));
      setCatatan(note.catatan);

      setSpiritualUsaha(note.spiritualUsaha || "B");
      setSpiritualProses(note.spiritualProses || "B");
      setSpiritualCapaian(note.spiritualCapaian || "B");
      setSpiritualDeskripsi(note.spiritualDeskripsi || "");

      setSosialUsaha(note.sosialUsaha || "B");
      setSosialProses(note.sosialProses || "B");
      setSosialCapaian(note.sosialCapaian || "B");
      setSosialDeskripsi(note.sosialDeskripsi || "");
    } else {
      setSakit("0");
      setIzin("0");
      setAlpa("0");
      setCatatan(`Ananda ${student.name} menunjukkan kepribadian dan budi pekerti yang baik. Pertahankan terus semangat belajarmu.`);

      setSpiritualUsaha("B");
      setSpiritualProses("B");
      setSpiritualCapaian("B");
      setSpiritualDeskripsi(`Alhamdulillah ananda sholihah ${student.name} menunjukkan perkembangan spiritual yang baik. Ia telah memahami tata cara beribadah harian dengan rajin serta menjaga adab ketertiban.`);

      setSosialUsaha("B");
      setSosialProses("B");
      setSosialCapaian("B");
      setSosialDeskripsi(`Alhamdulillah ananda sholihah ${student.name} mudah bergaul, memiliki rasa empati tinggi, serta sopan santun dalam berkata kata kepada guru maupun sesama kawan.`);
    }

    // Load student's ekskul grades
    const initialGrades: { [ekskulName: string]: { predicate: string; description: string; selected: boolean } } = {};
    
    const safeEksList = Array.isArray(eksList) ? eksList : [];
    safeEksList.forEach(e => {
      initialGrades[e.name] = {
        predicate: "Baik",
        description: "",
        selected: e.type === "Wajib"
      };
    });

    if (note && note.ekskul) {
      const safeNoteEkskul = Array.isArray(note.ekskul) ? note.ekskul : [];
      safeNoteEkskul.forEach((saved: any) => {
        initialGrades[saved.name] = {
          predicate: saved.predicate || saved.capaian || "Baik",
          description: saved.description || saved.deskripsi || "",
          selected: true
        };
      });
    }

    setStudentEkskulGrades(initialGrades);
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setError("");
    setSuccess("");

    const ekskulArray = Object.entries(studentEkskulGrades)
      .filter(([_, g]) => (g as any).selected)
      .map(([name, g]) => {
        const safeActiveEkskulList = Array.isArray(activeEkskulList) ? activeEkskulList : [];
        const match = safeActiveEkskulList.find(e => e.name === name);
        const val = g as any;
        return {
          name,
          type: match ? match.type : "Pilihan",
          predicate: val.predicate,
          description: val.description
        };
      });

    setSaveLoading(true);
    try {
      const response = await fetch("/api/walikelas/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          sakit: Number(sakit || 0),
          izin: Number(izin || 0),
          alpa: Number(alpa || 0),
          catatan,
          spiritualUsaha,
          spiritualProses,
          spiritualCapaian,
          spiritualDeskripsi,
          sosialUsaha,
          sosialProses,
          sosialCapaian,
          sosialDeskripsi,
          ekskul: ekskulArray
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan catatan.");

      setSuccess(`Presensi, capaian karakter, catatan, dan nilai ekskul ${selectedStudent.name} berhasil disimpan!`);
      onRefreshTrigger(); // trigger live summary recalculation in dashboard app

      const getNotes = await fetch("/api/walikelas/notes");
      const updatedNotes = await getNotes.json();
      setAllClassNotes(updatedNotes);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Helper getters
  const currentClassStudents = students.filter((s) => s.kelas === selectedClass);
  const studentGrades = selectedStudent ? grades.filter((g) => g.studentId === selectedStudent.id) : [];
  const gradesCount = studentGrades.length;

  if (raportPrintTarget && selectedStudent) {
    const studentNote = allClassNotes[selectedStudent.id] || {
      sakit: 0,
      izin: 0,
      alpa: 0,
      catatan: "",
      spiritualUsaha: "B",
      spiritualProses: "B",
      spiritualCapaian: "B",
      spiritualDeskripsi: "",
      sosialUsaha: "B",
      sosialProses: "B",
      sosialCapaian: "B",
      sosialDeskripsi: ""
    };
    return (
      <PrintRaportView
        student={selectedStudent}
        grades={studentGrades}
        waliKelasNote={studentNote}
        waliKelas={user}
        onBack={() => setRaportPrintTarget(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="wali-kelas-panel">
      {/* Sidebar: Student list in class */}
      <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 shadow-sm p-3 h-fit space-y-3.5">
        <div>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">
            Wali Kelas Mandat
          </span>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">
              Kelas {selectedClass} {user.kelas === selectedClass && "⭐ (Kelas Anda)"}
            </h3>
            {/* If admin is viewing, let them switch class */}
            {user.subject === "Admin" && (
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedStudent(null);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded p-1 font-semibold text-slate-700 focus:outline-none"
              >
                <option value="1">Kelas 1</option>
                <option value="2">Kelas 2</option>
                <option value="3">Kelas 3</option>
                <option value="4">Kelas 4</option>
                <option value="5">Kelas 5</option>
                <option value="6">Kelas 6</option>
              </select>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Pilih Siswa ({currentClassStudents.length}):
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setAddStudentError("");
                setIsAddStudentOpen(true);
              }}
              title="Tambah Siswa Baru ke Kelas Ini"
              className="p-1 hover:bg-emerald-50 text-emerald-750 border border-emerald-300 rounded transition cursor-pointer flex items-center gap-1 text-[10px] font-bold px-1.5"
            >
              <UserPlus className="w-3 h-3" />
              <span>+ Siswa</span>
            </button>
            <button
              onClick={fetchData}
              title="Sinkronisasi"
              className="p-1 hover:bg-slate-100 rounded transition cursor-pointer text-slate-400"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1" id="walikelas-student-scroll">
          {loading ? (
            <div className="p-3 text-center text-xs text-slate-450 italic">Memuat data siswa...</div>
          ) : currentClassStudents.length === 0 ? (
            <p className="text-xs text-slate-450 italic text-center py-3 text-slate-400">Belum ada siswa.</p>
          ) : (
            currentClassStudents.map((s) => {
              const sGrades = grades.filter((g) => g.studentId === s.id);
              const count = sGrades.length;
              const hasNotes = !!allClassNotes[s.id];
              const isSelected = selectedStudent?.id === s.id;

              return (
                <button
                  key={s.id}
                  onClick={() => handleStudentSelect(s)}
                  className={`w-full p-2 rounded text-left text-xs transition flex flex-col gap-1 border cursor-pointer ${isSelected ? "bg-emerald-50/70 border-emerald-400 font-bold text-emerald-950" : "bg-white border-slate-150 text-slate-750 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold block truncate leading-tight">{s.name}</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSelected ? "translate-x-0.5 text-emerald-800" : ""}`} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded ${count === subjectsList.length ? "bg-green-100 text-green-700 font-bold" : count > 0 ? "bg-amber-100 text-amber-800 font-medium" : "bg-slate-100 text-slate-400"}`}>
                      Mapel: {count}/{subjectsList.length}
                    </span>
                    {hasNotes && (
                      <span className="bg-sky-50 border border-sky-100 text-sky-750 px-1 py-0.5 rounded font-semibold">
                        Catatan ✔
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main pane: Grade status and attendance form */}
      <div className="lg:col-span-8 space-y-4" id="walikelas-main-pane">
        {selectedStudent ? (
          <>
            {/* Student card header */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-emerald-800 text-white flex items-center justify-center font-bold text-base shrink-0">
                  {selectedStudent.name?.charAt(0) || "?"}
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-slate-800 uppercase">{selectedStudent.name || "N/A"}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {selectedStudent.nisn || "-"} • Kelas {selectedStudent.kelas || "-"}</p>
                </div>
              </div>

              {/* PDF and Word print trigger */}
              <button
                onClick={() => setRaportPrintTarget(selectedStudent)}
                className="flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-xs rounded transition shadow-xs cursor-pointer"
                id="view-raport-trigger"
              >
                <Printer className="w-3.5 h-3.5" /> Pratinjau & Cetak Rapor
              </button>
            </div>

            {/* Error and success messages */}
            {error && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-250">
                {error}
              </div>
            )}
            {success && (
              <div className="p-2.5 bg-green-50 text-green-800 text-xs font-bold rounded border border-green-200 flex items-center gap-1 animate-fade-in">
                <CheckCircle className="w-4 h-4 text-green-600 mr-1 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Sub-grid: Subject completion rate checker */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-600">
                    Progres Kelengkapan Nilai Siswa ({subjectsList.length} Mapel)
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Semua mata pelajaran wajib diisi nilainya oleh guru mapel agar rapor diterbitkan lengkap.
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold ${gradesCount >= subjectsList.length ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {gradesCount}/{subjectsList.length} Terisi
                </span>
              </div>

              {/* Visual mini circles representing subjects */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2" id="subject-matrix-completion">
                {subjectsList.map((sub) => {
                  const xGrade = studentGrades.find((g) => g.subject === sub);
                  const isFilled = !!xGrade;

                  return (
                    <div
                      key={sub}
                      className={`p-2 rounded border text-center transition ${isFilled ? "bg-emerald-50/40 border-emerald-250 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-400"}`}
                    >
                      <span className="text-[9px] font-bold block truncate" title={sub}>{sub}</span>
                      <span className="text-sm font-extrabold block mt-0.5">
                        {isFilled ? `${xGrade.score}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {gradesCount < subjectsList.length && (
                <div className="p-2.5 bg-amber-50 text-amber-900 text-[10px] rounded border border-amber-200 flex items-start gap-2 italic leading-relaxed">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Perhatian: Terdapat {Math.max(0, subjectsList.length - gradesCount)} mata pelajaran belum diisi oleh guru pengampu. Raport tetap bisa dipratinjau, namun nilai tidak lengkap.
                  </span>
                </div>
              )}
            </div>

            {/* Attendance & Homeroom Note forms */}
            <form onSubmit={handleSaveNotes} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
              <div>
                <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-600 mb-2">
                  Input Presensi & Absensi Tengah Semester
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Sakit (S) - Hari</label>
                    <input
                      type="text"
                      value={sakit}
                      onChange={(e) => setSakit(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-center px-2 py-1.5 border border-slate-350 rounded font-bold text-xs text-slate-800 bg-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Izin (I) - Hari</label>
                    <input
                      type="text"
                      value={izin}
                      onChange={(e) => setIzin(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-center px-2 py-1.5 border border-slate-350 rounded font-bold text-xs text-slate-800 bg-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Alpa (A) - Hari</label>
                    <input
                      type="text"
                      value={alpa}
                      onChange={(e) => setAlpa(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-center px-2 py-1.5 border border-slate-350 rounded font-bold text-xs text-slate-800 bg-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* SPIRITUAL ATTITUDE EVALUATION FORM */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-600">
                  Evaluasi Sikap Spiritual (Wali Kelas)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Spiritual Usaha</label>
                    <select
                      value={spiritualUsaha}
                      onChange={(e) => setSpiritualUsaha(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Spiritual Proses</label>
                    <select
                      value={spiritualProses}
                      onChange={(e) => setSpiritualProses(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Spiritual Capaian</label>
                    <select
                      value={spiritualCapaian}
                      onChange={(e) => setSpiritualCapaian(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Deskripsi Sikap Spiritual</label>
                  <textarea
                    value={spiritualDeskripsi}
                    onChange={(e) => setSpiritualDeskripsi(e.target.value)}
                    rows={2}
                    placeholder="Deskripsi kemajuan sikap sosial dan kerohanian..."
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none text-slate-700 font-sans leading-relaxed"
                  />
                </div>
              </div>

              {/* SOCIAL ATTITUDE EVALUATION FORM */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-600">
                  Evaluasi Sikap Sosial (Wali Kelas)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sosial Usaha</label>
                    <select
                      value={sosialUsaha}
                      onChange={(e) => setSosialUsaha(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sosial Proses</label>
                    <select
                      value={sosialProses}
                      onChange={(e) => setSosialProses(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sosial Capaian</label>
                    <select
                      value={sosialCapaian}
                      onChange={(e) => setSosialCapaian(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                    >
                      <option value="A">A (Sangat Baik)</option>
                      <option value="B">B (Baik)</option>
                      <option value="C">C (Cukup)</option>
                      <option value="D">D (Kurang)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Deskripsi Sikap Sosial</label>
                  <textarea
                    value={sosialDeskripsi}
                    onChange={(e) => setSosialDeskripsi(e.target.value)}
                    rows={2}
                    placeholder="Deskripsi interaksi sosial, gotong-royong, empati dan kedisiplinan..."
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none text-slate-700 font-sans leading-relaxed"
                  />
                </div>
              </div>

              {/* EXTRACURRICULAR EVALUATION FORM */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-850" />
                  Evaluasi Kegiatan Ekstrakurikuler (Ekskul)
                </h4>
                <p className="text-[10px] text-slate-400">
                  Tandai kegiatan ekstrakurikuler yang diikuti oleh ananda dan berikan nilai predikat serta keterangan capaiannya.
                </p>

                {activeEkskulList.length === 0 ? (
                  <p className="text-[11px] text-slate-450 italic bg-slate-50 p-2 rounded text-center">
                    Belum ada ekstrakurikuler yang dibuat di Admin Panel. Silakan buat di Admin terlebih dahulu.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeEkskulList.map((eks) => {
                      const gradeInfo = studentEkskulGrades[eks.name] || { selected: eks.type === "Wajib", predicate: "Baik", description: "" };
                      return (
                        <div key={eks.id} className={`p-3 rounded-lg border transition ${gradeInfo.selected ? "bg-emerald-50/10 border-emerald-150" : "bg-slate-50/50 border-slate-200"}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={gradeInfo.selected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setStudentEkskulGrades(prev => ({
                                    ...prev,
                                    [eks.name]: {
                                      ...prev[eks.name],
                                      selected: checked
                                    }
                                  }));
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-550 w-4 h-4"
                              />
                              <span className="text-xs font-bold text-slate-800">{eks.name}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold tracking-wider uppercase ${eks.type === "Wajib" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-sky-100 text-sky-800 border border-sky-200"}`}>
                                {eks.type}
                              </span>
                            </label>
                          </div>

                          {gradeInfo.selected && (
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-2 pl-6 animate-fade-in">
                              <div className="sm:col-span-3">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Predikat</label>
                                <select
                                  value={gradeInfo.predicate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStudentEkskulGrades(prev => ({
                                      ...prev,
                                      [eks.name]: {
                                        ...prev[eks.name],
                                        predicate: val
                                      }
                                    }));
                                  }}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                                >
                                  <option value="Sangat Baik">A (Sangat Baik)</option>
                                  <option value="Baik">B (Baik)</option>
                                  <option value="Cukup font-sans">C (Cukup)</option>
                                  <option value="Kurang">D (Kurang)</option>
                                </select>
                              </div>
                              <div className="sm:col-span-9">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Keterangan / Capaian Kegiatan</label>
                                <input
                                  type="text"
                                  value={gradeInfo.description}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStudentEkskulGrades(prev => ({
                                      ...prev,
                                      [eks.name]: {
                                        ...prev[eks.name],
                                        description: val
                                      }
                                    }));
                                  }}
                                  placeholder={`Contoh: Aktif mengikuti kegiatan ${eks.name} dengan kedisiplinan tinggi.`}
                                  className="w-full p-1.5 border border-slate-200 rounded text-xs focus:outline-none text-slate-700 font-sans leading-relaxed"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CATATAN PERKEMBANGAN UMUM */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wide mb-1">
                  Catatan Umum Wali Kelas (Dicetak di Bawah)
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={2}
                  placeholder={`Contoh: Ananda ${selectedStudent.name} merupakan siswa teladan dengan kepatuhan tinggi serta akhlak yang baik...`}
                  className="w-full px-2.5 py-2 border border-slate-350 rounded text-[11px] focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                />
              </div>

              <div className="text-right pt-2.5 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-xs rounded flex items-center gap-1.5 ml-auto shadow-xs transition disabled:opacity-50 cursor-pointer"
                  id="submit-notes-button"
                >
                  {saveLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Simpan Presensi & Rilis Raport
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="p-12 text-center text-slate-450 italic text-xs bg-white border border-slate-200 rounded-lg">
            Pilihlah peserta didik pada panel sebelah kiri untuk melihat rincian progres nilai, presensi, dan mencetak raport.
          </div>
        )}
      </div>

      {/* QUICK ADD STUDENT MODAL FOR WALI KELAS */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-up">
            <div className="bg-emerald-800 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>Tambah Siswa ke Kelas {selectedClass}</span>
              </h3>
              <button
                onClick={() => setIsAddStudentOpen(false)}
                className="text-white/85 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddStudent} className="p-6 space-y-4">
              {addStudentError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span className="font-semibold">{addStudentError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Contoh: Ahmad Fadilah"
                  className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5">
                  NISN Siswa (Nomor Induk Siswa Nasional)
                </label>
                <input
                  type="text"
                  required
                  value={newStudentNisn}
                  onChange={(e) => setNewStudentNisn(e.target.value)}
                  placeholder="Contoh: 0134988720"
                  className="w-full px-3 py-2 border border-gray-250 rounded-lg text-xs md:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white"
                  id="quick-student-nisn-input"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                Siswa baru akan otomatis didaftarkan ke dalam <strong>Kelas {selectedClass}</strong> dan dapat langsung diinput nilainya.
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  disabled={isAddingStudent}
                  onClick={() => setIsAddStudentOpen(false)}
                  className="w-1/2 py-2.5 border border-gray-250 text-gray-650 hover:bg-gray-50 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent}
                  className="w-1/2 py-2.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                >
                  {isAddingStudent ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Siswa</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
