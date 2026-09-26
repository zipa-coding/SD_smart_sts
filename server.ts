import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to data file
const DB_PATH = path.join(process.cwd(), "src", "data", "db.json");

// In-memory database cache for sub-millisecond responses
let memoryDB: any = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;

// Helper to read database with memory caching
async function readDB() {
  if (memoryDB) {
    return memoryDB;
  }
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    memoryDB = JSON.parse(data);
    return memoryDB;
  } catch (err) {
    console.error("Error reading db file, using empty default:", err);
    memoryDB = {
      teachers: [],
      students: [],
      grades: [],
      walikelas_notes: {},
      tujuan_pembelajaran_templates: {},
    };
    return memoryDB;
  }
}

// Helper to write database with background async disk sync
async function writeDB(data: any) {
  memoryDB = data;
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing db file:", err);
  }
}

// Background sync helper that doesn't block HTTP responses
function asyncPersistDB() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    if (memoryDB) {
      try {
        await fs.writeFile(DB_PATH, JSON.stringify(memoryDB, null, 2), "utf-8");
      } catch (e) {
        console.error("Async disk sync error:", e);
      }
    }
  }, 50);
}

// ==================== API ENDPOINTS ====================

// 1. Auth Endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  const db = await readDB();
  const teacher = db.teachers.find(
    (t: any) =>
      t.username.toLowerCase() === username.toLowerCase() &&
      t.password === password,
  );

  if (!teacher) {
    return res
      .status(401)
      .json({ error: "Kombinasi pengguna dan kata sandi salah." });
  }

  res.json({
    id: teacher.id,
    name: teacher.name,
    username: teacher.username,
    subject: teacher.subject,
    isWaliKelas: teacher.isWaliKelas || false,
    kelas: teacher.kelas || "",
  });
});

app.post("/api/verify-session", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Sesi tidak lengkap." });
  }

  const db = await readDB();
  const teacher = db.teachers.find(
    (t: any) =>
      t.username.toLowerCase() === username.toLowerCase() &&
      t.password === password,
  );

  if (!teacher) {
    return res.status(401).json({ error: "Sesi tidak valid." });
  }

  res.json({
    id: teacher.id,
    name: teacher.name,
    username: teacher.username,
    subject: teacher.subject,
    isWaliKelas: teacher.isWaliKelas || false,
    kelas: teacher.kelas || "",
  });
});

// 2. Teachers CRUD
app.get("/api/teachers", async (req, res) => {
  const db = await readDB();
  res.json(db.teachers);
});

app.post("/api/teachers", async (req, res) => {
  const { name, username, password, subject, isWaliKelas, kelas } = req.body;
  if (!name || !username || !password || !subject) {
    return res.status(400).json({ error: "Data guru kurang lengkap." });
  }

  const db = await readDB();

  // Check unique username
  const exists = db.teachers.some(
    (t: any) => t.username.toLowerCase() === username.toLowerCase(),
  );
  if (exists) {
    return res.status(400).json({ error: "Username sudah digunakan." });
  }

  const newTeacher = {
    id: "t_" + Date.now(),
    name,
    username,
    password,
    subject,
    isWaliKelas: !!isWaliKelas,
    kelas: kelas || "",
  };

  db.teachers.push(newTeacher);
  await writeDB(db);
  res.status(201).json(newTeacher);
});

app.put("/api/teachers/:id", async (req, res) => {
  const { id } = req.params;
  const { name, username, password, subject, isWaliKelas, kelas } = req.body;

  const db = await readDB();
  const index = db.teachers.findIndex((t: any) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Guru tidak ditemukan." });
  }

  // Check username unique except itself
  const exists = db.teachers.some(
    (t: any) =>
      t.username.toLowerCase() === username.toLowerCase() && t.id !== id,
  );
  if (exists) {
    return res.status(400).json({ error: "Username sudah digunakan." });
  }

  db.teachers[index] = {
    ...db.teachers[index],
    name,
    username,
    password,
    subject,
    isWaliKelas: !!isWaliKelas,
    kelas: kelas || "",
  };

  await writeDB(db);
  res.json(db.teachers[index]);
});

app.delete("/api/teachers/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDB();

  if (id === "t1") {
    return res
      .status(400)
      .json({ error: "Akun Super Admin utama tidak boleh dihapus." });
  }

  const filtered = db.teachers.filter((t: any) => t.id !== id);
  if (filtered.length === db.teachers.length) {
    return res.status(404).json({ error: "Guru tidak ditemukan." });
  }

  db.teachers = filtered;
  await writeDB(db);
  res.json({ message: "Guru berhasil dihapus." });
});

// 3. Students CRUD
app.get("/api/students", async (req, res) => {
  const db = await readDB();
  res.json(db.students);
});

app.post("/api/students", async (req, res) => {
  const { name, nisn, kelas } = req.body;
  if (!name || !nisn || !kelas) {
    return res
      .status(400)
      .json({ error: "Nama, NISN, dan Kelas harus diisi." });
  }

  const db = await readDB();

  // Check unique NISN
  const exists = db.students.some((s: any) => s.nisn === nisn);
  if (exists) {
    return res
      .status(400)
      .json({ error: "Siswa dengan NISN ini sudah terdaftar." });
  }

  const newStudent = {
    id: "s_" + Date.now(),
    nisn,
    name,
    kelas,
  };

  db.students.push(newStudent);
  await writeDB(db);
  res.status(201).json(newStudent);
});

// POST /api/students/batch - Batch import students
app.post("/api/students/batch", async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res
      .status(400)
      .json({ error: "Daftar siswa wajib berupa array dan tidak boleh kosong." });
  }

  const db = await readDB();
  const existingNisns = new Set(
    db.students.map((s: any) => String(s.nisn || "").trim())
  );
  const batchNisns = new Set<string>();

  const addedStudents: any[] = [];
  const duplicates: string[] = [];
  const errors: string[] = [];

  let counter = 0;
  for (const item of students) {
    const name = String(item.name || "").trim();
    const nisn = String(item.nisn || "").trim().replace(/\D/g, "");
    const kelas = String(item.kelas || "1").trim();

    if (!name) {
      errors.push(`Baris NISN ${nisn || "?"}: Nama siswa tidak boleh kosong.`);
      continue;
    }
    if (!nisn) {
      errors.push(`Siswa "${name}": NISN tidak boleh kosong dan harus berupa angka.`);
      continue;
    }

    if (existingNisns.has(nisn) || batchNisns.has(nisn)) {
      duplicates.push(`${name} (${nisn})`);
      continue;
    }

    batchNisns.add(nisn);
    existingNisns.add(nisn);

    const newStudent = {
      id: "s_" + Date.now() + "_" + (++counter),
      nisn,
      name,
      kelas: kelas || "1",
    };

    db.students.push(newStudent);
    addedStudents.push(newStudent);
  }

  if (addedStudents.length > 0) {
    await writeDB(db);
  }

  res.status(200).json({
    success: true,
    addedCount: addedStudents.length,
    duplicatesCount: duplicates.length,
    duplicates,
    errors,
    students: addedStudents,
    totalStudents: db.students.length,
  });
});

app.put("/api/students/:id", async (req, res) => {
  const { id } = req.params;
  const { name, nisn, kelas } = req.body;

  const db = await readDB();
  const index = db.students.findIndex((s: any) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Siswa tidak ditemukan." });
  }

  const exists = db.students.some((s: any) => s.nisn === nisn && s.id !== id);
  if (exists) {
    return res
      .status(400)
      .json({ error: "NISN sudah digunakan oleh siswa lain." });
  }

  db.students[index] = {
    ...db.students[index],
    name,
    nisn,
    kelas,
  };

  await writeDB(db);
  res.json(db.students[index]);
});

app.delete("/api/students/batch", async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Daftar ID siswa tidak valid." });
  }
  const db = await readDB();
  const idSet = new Set(ids.map(String));
  db.students = db.students.filter((s: any) => !idSet.has(String(s.id)));
  db.grades = db.grades.filter((g: any) => !idSet.has(String(g.studentId)));
  if (db.walikelas_notes) {
    ids.forEach((id: string) => { delete db.walikelas_notes[id]; });
  }
  await writeDB(db);
  res.json({ message: `${ids.length} siswa berhasil dihapus.`, deletedCount: ids.length });
});

app.post("/api/students/delete-batch", async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Daftar ID siswa tidak valid." });
  }
  const db = await readDB();
  const idSet = new Set(ids.map(String));
  db.students = db.students.filter((s: any) => !idSet.has(String(s.id)));
  db.grades = db.grades.filter((g: any) => !idSet.has(String(g.studentId)));
  if (db.walikelas_notes) {
    ids.forEach((id: string) => { delete db.walikelas_notes[id]; });
  }
  await writeDB(db);
  res.json({ message: `${ids.length} siswa berhasil dihapus.`, deletedCount: ids.length });
});

app.delete("/api/students/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDB();

  const filtered = db.students.filter((s: any) => s.id !== id);
  if (filtered.length === db.students.length) {
    return res.status(404).json({ error: "Siswa tidak ditemukan." });
  }

  // Also clear grades with this studentId to keep DB clean
  db.grades = db.grades.filter((g: any) => g.studentId !== id);

  // Also clear walikelas_notes
  if (db.walikelas_notes[id]) {
    delete db.walikelas_notes[id];
  }

  db.students = filtered;
  await writeDB(db);
  res.json({ message: "Siswa berhasil dihapus." });
});

// 4. Grades & Objectives Management
app.get("/api/grades", async (req, res) => {
  const db = await readDB();
  res.json(db.grades);
});

app.post("/api/grades", async (req, res) => {
  const {
    studentId,
    subject,
    score,
    tps,
    teacherName,
    usaha,
    proses,
    capaian,
    deskripsi,
  } = req.body;
  if (!studentId || !subject || score === undefined || !tps) {
    return res.status(400).json({ error: "Data input nilai tidak lengkap." });
  }

  const db = await readDB();

  // Find if grade already exists for this student and subject
  const index = db.grades.findIndex(
    (g: any) => g.studentId === studentId && g.subject === subject,
  );

  const updatedGrade = {
    studentId,
    subject,
    score: Number(score),
    tps,
    usaha: usaha || "B",
    proses: proses || "B",
    capaian: capaian || "B",
    deskripsi: deskripsi || "",
    lastUpdatedBy: teacherName || "Guru Mata Pelajaran",
    lastUpdatedAt: new Date().toISOString(),
  };

  if (index !== -1) {
    db.grades[index] = updatedGrade;
  } else {
    db.grades.push(updatedGrade);
  }

  await writeDB(db);
  res.json(updatedGrade);
});

// 5. Wali Kelas Notes & Attendance
app.get("/api/walikelas/notes", async (req, res) => {
  const db = await readDB();
  res.json(db.walikelas_notes || {});
});

app.post("/api/walikelas/notes", async (req, res) => {
  const {
    studentId,
    sakit,
    izin,
    alpa,
    catatan,
    spiritualUsaha,
    spiritualProses,
    spiritualCapaian,
    spiritualDeskripsi,
    sosialUsaha,
    sosialProses,
    sosialCapaian,
    sosialDeskripsi,
    ekskul,
  } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "ID Siswa harus diisi." });
  }

  const db = await readDB();
  if (!db.walikelas_notes) {
    db.walikelas_notes = {};
  }

  db.walikelas_notes[studentId] = {
    sakit: Number(sakit || 0),
    izin: Number(izin || 0),
    alpa: Number(alpa || 0),
    catatan: catatan || "",
    spiritualUsaha: spiritualUsaha || "B",
    spiritualProses: spiritualProses || "B",
    spiritualCapaian: spiritualCapaian || "B",
    spiritualDeskripsi: spiritualDeskripsi || "",
    sosialUsaha: sosialUsaha || "B",
    sosialProses: sosialProses || "B",
    sosialCapaian: sosialCapaian || "B",
    sosialDeskripsi: sosialDeskripsi || "",
    ekskul: ekskul || [],
  };

  await writeDB(db);
  res.json({ studentId, ...db.walikelas_notes[studentId] });
});

// 6. Learning Objectives (TP) Templates CRUD
app.get("/api/tps", async (req, res) => {
  const db = await readDB();
  const templates = db.tujuan_pembelajaran_templates || {};
  const { kelas, subject } = req.query;

  // If specific subject requested
  if (subject && typeof subject === "string") {
    let items = templates[subject] || [];
    if (kelas && typeof kelas === "string") {
      items = items.filter(
        (item: any) => String(item.kelas || "").trim() === String(kelas).trim()
      );
    }
    return res.json(items);
  }

  // If filtered by kelas across all subjects
  if (kelas && typeof kelas === "string") {
    const filtered: Record<string, any[]> = {};
    for (const [sub, list] of Object.entries(templates)) {
      if (Array.isArray(list)) {
        filtered[sub] = list.filter(
          (item: any) => String(item.kelas || "").trim() === String(kelas).trim()
        );
      }
    }
    return res.json(filtered);
  }

  res.json(templates);
});

app.post("/api/tps", async (req, res) => {
  const { subject, tpText, kelas } = req.body;
  if (!subject || !tpText) {
    return res
      .status(400)
      .json({ error: "Mata pelajaran dan teks TP diperlukan." });
  }

  const db = await readDB();
  if (!db.tujuan_pembelajaran_templates) {
    db.tujuan_pembelajaran_templates = {};
  }
  if (!db.tujuan_pembelajaran_templates[subject]) {
    db.tujuan_pembelajaran_templates[subject] = [];
  }

  const newTP = {
    id: "tp_" + Date.now(),
    text: tpText,
    kelas: kelas ? String(kelas).trim() : "1",
  };

  db.tujuan_pembelajaran_templates[subject].push(newTP);
  await writeDB(db);
  res.status(201).json(newTP);
});

const deleteTpHandler = async (req: any, res: any) => {
  const { subject, tpId } = req.params;
  const decodedSubject = decodeURIComponent(subject);
  const db = await readDB();

  if (
    db.tujuan_pembelajaran_templates &&
    db.tujuan_pembelajaran_templates[decodedSubject]
  ) {
    db.tujuan_pembelajaran_templates[decodedSubject] =
      db.tujuan_pembelajaran_templates[decodedSubject].filter(
        (tp: any) => String(tp.id) !== String(tpId),
      );
    await writeDB(db);
    res.json({ message: "TP berhasil dihapus." });
  } else {
    res.status(404).json({ error: "Tujuan Pembelajaran tidak ditemukan." });
  }
};

app.delete("/api/tps/:subject/:tpId", deleteTpHandler);
app.delete("/api/tp/:subject/:tpId", deleteTpHandler);

// 6.5. School Settings API (Principal, NIP & Raport Format config)
app.get("/api/settings", async (req, res) => {
  const db = await readDB();
  const principalName =
    db.settings?.principalName || "Ustadz H. Ir. Abdul Muhyi, M.Pd";
  const principalNip = db.settings?.principalNip || "19780512 200501 1 002";
  const format = {
    semesterName: "Ganjil",
    tahunPelajaran: "2026/2027",
    fontSize: "11pt",
    showLogo: false,
    showSpiritual: true,
    showSosial: true,
    showAttendance: true,
    showCatatan: true,
    fontFamily: "Times New Roman",
    paperSize: "A4",
    tanggalRaport: "17 Juni 2026",
    watermarkSize: 440,
    watermarkOpacity: 0.05,
    ...(db.settings?.format || {}),
  };
  res.json({ principalName, principalNip, format });
});

app.post("/api/settings", async (req, res) => {
  const { principalName, principalNip, format } = req.body;
  const db = await readDB();
  if (!db.settings) {
    db.settings = {};
  }
  db.settings.principalName =
    principalName || "Ustadz H. Ir. Abdul Muhyi, M.Pd";
  db.settings.principalNip = principalNip || "19780512 200501 1 002";

  if (format) {
    db.settings.format = {
      semesterName: format.semesterName || "Ganjil",
      tahunPelajaran: format.tahunPelajaran || "2026/2027",
      fontSize: format.fontSize || "11pt",
      showLogo: format.showLogo !== undefined ? format.showLogo : false,
      showSpiritual:
        format.showSpiritual !== undefined ? format.showSpiritual : true,
      showSosial: format.showSosial !== undefined ? format.showSosial : true,
      showAttendance:
        format.showAttendance !== undefined ? format.showAttendance : true,
      showCatatan: format.showCatatan !== undefined ? format.showCatatan : true,
      fontFamily: format.fontFamily || "Times New Roman",
      paperSize: format.paperSize || "A4",
      tanggalRaport: format.tanggalRaport || "17 Juni 2026",
      watermarkSize:
        format.watermarkSize !== undefined ? format.watermarkSize : 440,
      watermarkOpacity:
        format.watermarkOpacity !== undefined ? format.watermarkOpacity : 0.05,
    };
  }

  await writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// 6.6. Extracurricular List API
app.get("/api/ekskul", async (req, res) => {
  const db = await readDB();
  const defaultEkskul = [
    { id: "e1", name: "Pramuka", type: "Wajib" },
    { id: "e2", name: "Mentoring", type: "Wajib" },
    { id: "e3", name: "Futsal", type: "Pilihan" },
    { id: "e4", name: "Voli", type: "Pilihan" },
    { id: "e5", name: "Panahan", type: "Pilihan" },
    { id: "e6", name: "Study Club", type: "Pilihan" },
  ];
  const ekskul = db.ekskul || defaultEkskul;
  if (!db.ekskul) {
    db.ekskul = defaultEkskul;
    await writeDB(db);
  }
  res.json(ekskul);
});

app.post("/api/ekskul", async (req, res) => {
  const { name, type } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: "Nama dan tipe ekskul wajib diisi." });
  }
  const db = await readDB();
  if (!db.ekskul) {
    db.ekskul = [
      { id: "e1", name: "Pramuka", type: "Wajib" },
      { id: "e2", name: "Mentoring", type: "Wajib" },
      { id: "e3", name: "Futsal", type: "Pilihan" },
      { id: "e4", name: "Voli", type: "Pilihan" },
      { id: "e5", name: "Panahan", type: "Pilihan" },
      { id: "e6", name: "Study Club", type: "Pilihan" },
    ];
  }
  const newEkskul = {
    id: "e_" + Date.now(),
    name,
    type,
  };
  db.ekskul.push(newEkskul);
  await writeDB(db);
  res.status(201).json(newEkskul);
});

app.delete("/api/ekskul/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDB();
  if (db.ekskul) {
    db.ekskul = db.ekskul.filter((e: any) => e.id !== id);
    await writeDB(db);
  }
  res.json({ message: "Ekskul berhasil dihapus." });
});

// 6.7. Subjects (Mata Pelajaran) API
const DEFAULT_SUBJECTS = [
  "PAI",
  "PPKN",
  "Bahasa Indonesia",
  "Matematika",
  "IPA",
  "IPS",
  "Bahasa Inggris",
  "PJOK",
  "Prakarya",
  "Informatika",
  "Bahasa Arab",
  "Tahsin ABaTaTsa",
  "Tahfizh Al-Qur’an",
  "Do’a Harian dan Hadits",
  "Wudhu dan Sholat",
];

app.get("/api/subjects", async (req, res) => {
  const db = await readDB();
  if (!Array.isArray(db.subjects) || db.subjects.length === 0) {
    db.subjects = [...DEFAULT_SUBJECTS];
    await writeDB(db);
  }
  res.json(db.subjects);
});

app.post("/api/subjects", async (req, res) => {
  const { name } = req.body;
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    return res.status(400).json({ error: "Nama mata pelajaran wajib diisi." });
  }

  const db = await readDB();
  if (!Array.isArray(db.subjects) || db.subjects.length === 0) {
    db.subjects = [...DEFAULT_SUBJECTS];
  }

  const exists = db.subjects.some(
    (s: string) => s.toLowerCase() === trimmedName.toLowerCase()
  );
  if (exists) {
    return res.status(400).json({ error: `Mata pelajaran "${trimmedName}" sudah terdaftar.` });
  }

  db.subjects.push(trimmedName);
  if (!db.tujuan_pembelajaran_templates) {
    db.tujuan_pembelajaran_templates = {};
  }
  if (!db.tujuan_pembelajaran_templates[trimmedName]) {
    db.tujuan_pembelajaran_templates[trimmedName] = [];
  }

  await writeDB(db);
  res.status(201).json({ message: "Mata pelajaran berhasil ditambahkan.", subjects: db.subjects });
});

app.delete("/api/subjects/:name", async (req, res) => {
  const { name } = req.params;
  const decodedName = decodeURIComponent(name).trim();
  const db = await readDB();

  if (!Array.isArray(db.subjects)) {
    db.subjects = [...DEFAULT_SUBJECTS];
  }

  const initialCount = db.subjects.length;
  db.subjects = db.subjects.filter(
    (s: string) => s.toLowerCase() !== decodedName.toLowerCase()
  );

  if (db.subjects.length === initialCount) {
    return res.status(404).json({ error: "Mata pelajaran tidak ditemukan." });
  }

  // Also remove from templates map if empty or desired
  if (db.tujuan_pembelajaran_templates && db.tujuan_pembelajaran_templates[decodedName]) {
    delete db.tujuan_pembelajaran_templates[decodedName];
  }

  await writeDB(db);
  res.json({ message: `Mata pelajaran "${decodedName}" berhasil dihapus.`, subjects: db.subjects });
});

// 7. General Progress / Summary APIs
app.get("/api/summary", async (req, res) => {
  const db = await readDB();

  const subjects = Array.isArray(db.subjects) && db.subjects.length > 0
    ? db.subjects
    : DEFAULT_SUBJECTS;

  const totalStudents = db.students.length;
  const registeredStudentIds = new Set(db.students.map((s: any) => s.id));

  // Calculate progress mapping - only count grades for active registered students
  const subjectProgress = subjects.map((sub) => {
    const filledGradesForSub = db.grades.filter(
      (g: any) => g.subject === sub && registeredStudentIds.has(g.studentId)
    );
    const completedCount = filledGradesForSub.length;
    const percentage =
      totalStudents > 0
        ? Math.round((completedCount / totalStudents) * 100)
        : 0;

    // Find active teacher for this subject
    const teacher = db.teachers.find((t: any) => t.subject === sub);

    return {
      subject: sub,
      completed: completedCount,
      total: totalStudents,
      percent: percentage,
      teacherName: teacher ? teacher.name : "Belum Ditugaskan",
    };
  });

  // Ensure standard SD classes (1 to 6) and any custom classes are represented
  const classSet = new Set(["1", "2", "3", "4", "5", "6"]);
  db.students.forEach((s: any) => {
    const k = String(s.kelas || "").trim();
    if (k) classSet.add(k);
  });
  const classes = Array.from(classSet).sort();

  const classProgress = classes.map((cls) => {
    const studentsInClass = db.students.filter(
      (s: any) => String(s.kelas || "").trim() === cls
    );
    const totalGradesNeeded = studentsInClass.length * subjects.length;

    let gradesFilledCount = 0;
    const studentIds = new Set(studentsInClass.map((s: any) => s.id));
    db.grades.forEach((g: any) => {
      if (studentIds.has(g.studentId)) {
        gradesFilledCount++;
      }
    });

    const percent =
      totalGradesNeeded > 0
        ? Math.round((gradesFilledCount / totalGradesNeeded) * 100)
        : 0;
    const waliKelas = db.teachers.find(
      (t: any) => t.isWaliKelas && String(t.kelas || "").trim() === cls,
    );

    return {
      kelas: cls,
      studentCount: studentsInClass.length,
      filledGrades: gradesFilledCount,
      totalNeeded: totalGradesNeeded,
      percent,
      waliKelasName: waliKelas ? waliKelas.name : "Belum Ditugaskan",
    };
  });

  // Calculate Student Rankings (Akumulasi Nilai Tertinggi ke Nilai Terendah)
  const studentRankings = db.students.map((s: any) => {
    const studentGrades = db.grades.filter((g: any) => g.studentId === s.id);
    const subjectScores: Record<string, number> = {};
    let totalScore = 0;
    let filledSubjectsCount = 0;

    studentGrades.forEach((g: any) => {
      const val = Number(g.score);
      if (!isNaN(val) && g.score !== null && g.score !== undefined && g.subject) {
        subjectScores[g.subject] = val;
        totalScore += val;
        filledSubjectsCount++;
      }
    });

    const averageScore =
      filledSubjectsCount > 0
        ? Math.round((totalScore / filledSubjectsCount) * 10) / 10
        : 0;

    let predikat = "C (Cukup)";
    if (filledSubjectsCount === 0) predikat = "Belum Ada Nilai";
    else if (averageScore > 91) predikat = "A (Sangat Baik)";
    else if (averageScore >= 80) predikat = "B (Baik)";
    else predikat = "C (Cukup)";

    return {
      studentId: s.id,
      name: s.name,
      nisn: s.nisn,
      kelas: String(s.kelas || "").trim(),
      totalScore,
      averageScore,
      filledSubjectsCount,
      totalSubjectsCount: subjects.length,
      rank: 0,
      rankInClass: 0,
      predikat,
      subjectScores,
    };
  });

  // Sort descending by totalScore, then averageScore, then name
  studentRankings.sort((a: any, b: any) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return a.name.localeCompare(b.name);
  });

  // Assign overall rank (1-indexed)
  studentRankings.forEach((s: any, idx: number) => {
    s.rank = idx + 1;
  });

  // Assign rankInClass per class
  const classCounters: Record<string, number> = {};
  studentRankings.forEach((s: any) => {
    const k = s.kelas;
    classCounters[k] = (classCounters[k] || 0) + 1;
    s.rankInClass = classCounters[k];
  });

  res.json({
    totalStudents,
    totalTeachers: db.teachers.length,
    subjectProgress,
    classProgress,
    studentRankings,
    lastUpdate: new Date().toISOString(),
  });
});

// ==================== FRONTEND INTEGRATION ====================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
