import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from "firebase/firestore";
import dbData from "../data/db.json";

const dbDataAny = dbData as any;
const metaEnv = (import.meta as any).env || {};

// Firebase configuration with smart-sd-sts
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDe3hjTP6AphfSaPY8KJkPPgYFocJ2xTcs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-sd-sts.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-sd-sts",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-sd-sts.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "132220678784",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:132220678784:web:1187d3dfe1403becedec65",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L5XBRWBZRQ"
};

// Check if Firebase is genuinely configured with credentials
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.appId
);

let app: any = null;
let db: any = null;

// Timeout helper with 8s default so Firestore operations have ample time
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Firebase request timeout")), ms)
    ),
  ]);
}

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("Firebase initialized successfully with cloud Firestore.");
    
    // Check and seed templates in background only if completely empty
    setTimeout(() => {
      seedFirestoreIfEmpty().catch((err) => console.warn("Firestore seed skipped:", err));
    }, 1500);
  } catch (error) {
    console.warn("Firebase initialization skipped or failed:", error);
  }
}

// Function to seed Firestore if completely empty
async function seedFirestoreIfEmpty() {
  try {
    if (!db) return;
    const teachersRef = collection(db, "teachers");
    const snapshot = await withTimeout(getDocs(teachersRef), 5000);
    if (snapshot.empty) {
      // Also check alternative 'guru' collection
      const snapGuru = await withTimeout(getDocs(collection(db, "guru")), 3000).catch(() => ({ empty: true }));
      if (!snapGuru.empty) {
        console.log("Existing 'guru' collection detected, skipping default seed.");
        return;
      }

      console.log("Firestore is empty. Seeding initial templates...");
      
      // 1. Seed Teachers
      for (const t of dbDataAny.teachers) {
        await setDoc(doc(db, "teachers", t.id), t);
      }
      
      // 2. Seed Students
      for (const s of dbDataAny.students) {
        await setDoc(doc(db, "students", s.id), s);
      }
      
      // 3. Seed Grades
      for (const g of dbDataAny.grades) {
        const id = `${g.studentId}_${g.subject.replace(/[^a-zA-Z0-9]/g, "_")}`;
        await setDoc(doc(db, "grades", id), g);
      }
      
      // 4. Seed Wali Kelas Notes
      if (dbDataAny.walikelas_notes) {
        for (const [studentId, note] of Object.entries(dbDataAny.walikelas_notes)) {
          await setDoc(doc(db, "walikelas_notes", studentId), note as any);
        }
      }
      
      // 5. Seed TPs templates
      if (dbDataAny.tujuan_pembelajaran_templates) {
        for (const [subject, tps] of Object.entries(dbDataAny.tujuan_pembelajaran_templates)) {
          await setDoc(doc(db, "tujuan_pembelajaran_templates", subject), { tps });
        }
      }
      
      // 6. Seed Settings
      if (dbDataAny.settings) {
        await setDoc(doc(db, "settings", "app"), dbDataAny.settings);
      }
      
      // 7. Seed Ekskul
      const defaultEkskul = [
        { "id": "e1", "name": "Pramuka", "type": "Wajib" },
        { "id": "e2", "name": "Mentoring", "type": "Wajib" },
        { "id": "e3", "name": "Futsal", "type": "Pilihan" },
        { "id": "e4", "name": "Voli", "type": "Pilihan" },
        { "id": "e5", "name": "Panahan", "type": "Pilihan" },
        { "id": "e6", "name": "Study Club", "type": "Pilihan" }
      ];
      for (const e of defaultEkskul) {
        await setDoc(doc(db, "ekskul", e.id), e);
      }
      
      console.log("Firestore initialized with template data.");
    } else {
      console.log(`Firestore already has ${snapshot.size} teacher(s). Retaining all user database records.`);
    }
  } catch (error) {
    console.warn("Background seed check skipped:", error);
  }
}

// Firestore operations matching API routes
export const firebaseApi = {
  // 1. POST /api/login
  login: async (body: any) => {
    if (!db) return null;
    const { username, password } = body || {};
    if (!username) return null;

    const trimmedUser = String(username).trim();
    const teacherCollections = ["teachers", "guru", "Teachers", "Guru", "data_guru", "dataGuru", "users", "Users", "ustadz"];

    try {
      for (const colName of teacherCollections) {
        try {
          // Check query by username
          const q = query(collection(db, colName), where("username", "==", trimmedUser));
          const snapshot = await withTimeout(getDocs(q), 3000).catch(() => null);
          if (snapshot && !snapshot.empty) {
            for (const docSnap of snapshot.docs) {
              const data = docSnap.data();
              if (data.password === password || (!data.password && password === "123")) {
                return {
                  id: docSnap.id,
                  name: data.name || data.nama || data.namaGuru || data.nama_lengkap || "Guru",
                  username: data.username || data.user || trimmedUser,
                  password: data.password || password,
                  subject: data.subject || data.mapel || data.mataPelajaran || data.mata_pelajaran || "Guru",
                  isWaliKelas: !!(data.isWaliKelas || data.waliKelas || data.is_wali_kelas || data.isWali),
                  kelas: data.kelas || data.rombel || data.class || "",
                  ...data
                };
              }
            }
          }

          // Direct doc lookup by ID (e.g. doc ID is the username)
          const docDirect = await withTimeout(getDoc(doc(db, colName, trimmedUser)), 2000).catch(() => null);
          if (docDirect && docDirect.exists()) {
            const data = docDirect.data();
            if (data.password === password || (!data.password && password === "123")) {
              return {
                id: docDirect.id,
                name: data.name || data.nama || data.namaGuru || data.nama_lengkap || "Guru",
                username: data.username || data.user || trimmedUser,
                password: data.password || password,
                subject: data.subject || data.mapel || data.mataPelajaran || data.mata_pelajaran || "Guru",
                isWaliKelas: !!(data.isWaliKelas || data.waliKelas || data.is_wali_kelas || data.isWali),
                kelas: data.kelas || data.rombel || data.class || "",
                ...data
              };
            }
          }
        } catch (colErr) {
          // continue checking next collection
        }
      }
    } catch (e) {
      console.warn("Firestore login check error:", e);
    }

    // Default admin fallback
    if (trimmedUser === "admin" && password === "123") {
      return {
        id: "t1",
        name: "Admin",
        username: "admin",
        password: "123",
        subject: "Admin",
        isWaliKelas: false,
        kelas: ""
      };
    }

    return null;
  },

  // 2. GET & POST /api/teachers
  getTeachers: async (): Promise<any[]> => {
    if (!db) return [];
    const teacherCollections = ["teachers", "guru", "Teachers", "Guru", "data_guru", "dataGuru", "data_teachers", "DataGuru", "ustadz"];
    try {
      for (const colName of teacherCollections) {
        try {
          const snap = await withTimeout(getDocs(collection(db, colName)), 4000).catch(() => null);
          if (snap && !snap.empty) {
            return snap.docs.map(docSnap => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: d.name || d.nama || d.namaGuru || d.nama_lengkap || d.namaLengkap || d.fullname || "Guru",
                username: d.username || d.user || d.email || docSnap.id,
                password: d.password || d.pass || "123",
                subject: d.subject || d.mapel || d.mataPelajaran || d.mata_pelajaran || "Guru",
                isWaliKelas: !!(d.isWaliKelas || d.waliKelas || d.is_wali_kelas || d.isWali),
                kelas: d.kelas || d.rombel || d.class || "",
                ...d
              };
            });
          }
        } catch (err) {
          // continue
        }
      }
    } catch (e) {
      console.warn("Failed to get teachers from Firestore:", e);
    }
    return [];
  },
  postTeacher: async (body: any) => {
    if (!db) throw new Error("Database not connected");
    const { name, username, password, subject, isWaliKelas, kelas } = body;
    // Check duplication
    const q = query(collection(db, "teachers"), where("username", "==", username));
    const dup = await withTimeout(getDocs(q), 2500);
    if (!dup.empty) throw new Error("Username sudah digunakan.");

    const id = "t_" + Date.now();
    const newTeacher = { id, name, username, password, subject, isWaliKelas: !!isWaliKelas, kelas: kelas || "" };
    await withTimeout(setDoc(doc(db, "teachers", id), newTeacher), 2500);
    return newTeacher;
  },
  putTeacher: async (id: string, body: any) => {
    if (!db) throw new Error("Database not connected");
    const { name, username, password, subject, isWaliKelas, kelas } = body;
    const ref = doc(db, "teachers", id);
    const updated = { name, username, password, subject, isWaliKelas: !!isWaliKelas, kelas: kelas || "" };
    await withTimeout(updateDoc(ref, updated), 2500);
    return { id, ...updated };
  },
  deleteTeacher: async (id: string) => {
    if (!db) throw new Error("Database not connected");
    if (id === 't1') throw new Error("Akun Super Admin utama tidak boleh dihapus.");
    await withTimeout(deleteDoc(doc(db, "teachers", id)), 2500);
    return { message: "Guru berhasil dihapus." };
  },

  // 3. GET, POST, PUT, DELETE /api/students
  getStudents: async (): Promise<any[]> => {
    if (!db) return dbDataAny.students || [];
    const studentCollections = ["students", "siswa", "Students", "Siswa", "data_siswa", "dataSiswa", "data_students", "DataSiswa", "santri"];
    try {
      for (const colName of studentCollections) {
        try {
          const snap = await withTimeout(getDocs(collection(db, colName)), 4000).catch(() => null);
          if (snap && !snap.empty) {
            return snap.docs.map(docSnap => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: d.name || d.nama || d.namaSiswa || d.nama_lengkap || d.namaLengkap || d.fullname || "Siswa",
                nisn: d.nisn || d.nis || d.nisnSiswa || d.nis_nisn || d.no_induk || docSnap.id,
                kelas: String(d.kelas || d.rombel || d.class || d.tingkat || "1").trim(),
                ...d
              };
            });
          }
        } catch (err) {
          // continue
        }
      }
    } catch (e) {
      console.warn("Failed to get students from Firestore:", e);
    }
    return dbDataAny.students || [];
  },
  postStudent: async (body: any) => {
    if (!db) throw new Error("Database not connected");
    const { name, nisn, kelas } = body;
    const cleanNisn = String(nisn || "").trim().replace(/\D/g, "");
    const q = query(collection(db, "students"), where("nisn", "==", cleanNisn));
    const dup = await withTimeout(getDocs(q), 5000).catch(() => ({ empty: true }));
    if (!dup.empty) throw new Error("Siswa dengan NISN ini sudah terdaftar.");

    const id = "s_" + Date.now();
    const newStudent = { id, nisn: cleanNisn, name: String(name || "").trim(), kelas: String(kelas || "1").trim() };
    await withTimeout(setDoc(doc(db, "students", id), newStudent), 5000);
    return newStudent;
  },
  postStudentsBatch: async (studentsList: any[]): Promise<any> => {
    if (!db) throw new Error("Database not connected");
    const existing = await firebaseApi.getStudents();
    const existingNisns = new Set(existing.map((s: any) => String(s.nisn || "").trim()));
    const batchNisns = new Set<string>();

    const addedStudents: any[] = [];
    const duplicates: string[] = [];
    const errors: string[] = [];

    let counter = 0;
    for (const item of studentsList) {
      const name = String(item.name || "").trim();
      const nisn = String(item.nisn || "").trim().replace(/\D/g, "");
      const kelas = String(item.kelas || "1").trim();

      if (!name) {
        errors.push(`Baris NISN ${nisn || "?"}: Nama siswa tidak boleh kosong.`);
        continue;
      }
      if (!nisn) {
        errors.push(`Siswa "${name}": NISN tidak valid (harus angka).`);
        continue;
      }

      if (existingNisns.has(nisn) || batchNisns.has(nisn)) {
        duplicates.push(`${name} (${nisn})`);
        continue;
      }

      batchNisns.add(nisn);
      existingNisns.add(nisn);

      const id = "s_" + Date.now() + "_" + (++counter);
      const newStudent = { id, nisn, name, kelas };
      await withTimeout(setDoc(doc(db, "students", id), newStudent), 5000);
      addedStudents.push(newStudent);
    }

    return {
      success: true,
      addedCount: addedStudents.length,
      duplicatesCount: duplicates.length,
      duplicates,
      errors,
      students: addedStudents,
      totalStudents: existing.length + addedStudents.length,
    };
  },
  putStudent: async (id: string, body: any) => {
    if (!db) throw new Error("Database not connected");
    const { name, nisn, kelas } = body;
    const ref = doc(db, "students", id);
    const updated = { name, nisn, kelas };
    await withTimeout(updateDoc(ref, updated), 5000);
    return { id, ...updated };
  },
  deleteStudent: async (id: string) => {
    if (!db) throw new Error("Database not connected");
    // Delete student doc
    await withTimeout(deleteDoc(doc(db, "students", id)), 5000);
    
    // Clean up grades
    const gradesSnap = await withTimeout(getDocs(collection(db, "grades")), 5000).catch(() => ({ docs: [] }));
    for (const gDoc of gradesSnap.docs) {
      if (gDoc.data().studentId === id) {
        await deleteDoc(doc(db, "grades", gDoc.id));
      }
    }
    
    // Clean up notes
    await deleteDoc(doc(db, "walikelas_notes", id)).catch(() => {});
    return { message: "Siswa berhasil dihapus." };
  },

  // 4. GET & POST /api/grades
  getGrades: async (): Promise<any[]> => {
    if (!db) return [];
    try {
      const snap = await withTimeout(getDocs(collection(db, "grades")), 8000);
      return snap.docs.map(docSnap => docSnap.data());
    } catch (e) {
      console.warn("Failed to get grades from Firestore:", e);
      return [];
    }
  },
  postGrade: async (body: any) => {
    if (!db) throw new Error("Database not connected");
    const { studentId, subject, score, tps, teacherName, usaha, proses, capaian, deskripsi } = body;
    const cleanSub = subject.replace(/[^a-zA-Z0-9]/g, "_");
    const docId = `${studentId}_${cleanSub}`;
    
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
      lastUpdatedAt: new Date().toISOString()
    };
    
    await withTimeout(setDoc(doc(db, "grades", docId), updatedGrade), 5000);
    return updatedGrade;
  },

  // 5. GET & POST /api/walikelas/notes
  getWaliKelasNotes: async () => {
    if (!db) return {};
    const snap = await withTimeout(getDocs(collection(db, "walikelas_notes")), 2500);
    const notes: any = {};
    snap.docs.forEach(docSnap => {
      notes[docSnap.id] = docSnap.data();
    });
    return notes;
  },
  postWaliKelasNotes: async (body: any) => {
    if (!db) throw new Error("Database not connected");
    const { studentId, sakit, izin, alpa, catatan, spiritualUsaha, spiritualProses, spiritualCapaian, spiritualDeskripsi, sosialUsaha, sosialProses, sosialCapaian, sosialDeskripsi, ekskul } = body;
    const note = {
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
      ekskul: ekskul || []
    };
    await withTimeout(setDoc(doc(db, "walikelas_notes", studentId), note), 2500);
    return { studentId, ...note };
  },

  // 6. GET, POST, DELETE /api/tps
  getTPs: async (kelas?: string) => {
    if (!db) return {};
    const snap = await withTimeout(getDocs(collection(db, "tujuan_pembelajaran_templates")), 2500);
    const templates: any = {};
    snap.docs.forEach(docSnap => {
      let tpsList = docSnap.data().tps || [];
      if (kelas) {
        tpsList = tpsList.filter((item: any) => String(item.kelas || '').trim() === String(kelas).trim());
      }
      templates[docSnap.id] = tpsList;
    });
    return templates;
  },
  postTP: async (body: any) => {
    if (!db) throw new Error("Database not connected");
    const { subject, tpText, kelas } = body;
    const ref = doc(db, "tujuan_pembelajaran_templates", subject);
    const docSnap = await withTimeout(getDoc(ref), 2500);
    let tpsList = [];
    if (docSnap.exists()) {
      tpsList = docSnap.data().tps || [];
    }
    const newTP = { id: "tp_" + Date.now(), text: tpText, kelas: kelas ? String(kelas).trim() : "1" };
    tpsList.push(newTP);
    await withTimeout(setDoc(ref, { tps: tpsList }), 2500);
    return newTP;
  },
  deleteTP: async (subject: string, tpId: string) => {
    if (!db) throw new Error("Database not connected");
    const ref = doc(db, "tujuan_pembelajaran_templates", subject);
    const docSnap = await withTimeout(getDoc(ref), 2500);
    if (!docSnap.exists()) throw new Error("TP tidak ditemukan.");
    const tpsList = docSnap.data().tps || [];
    const filtered = tpsList.filter((tp: any) => tp.id !== tpId);
    await withTimeout(setDoc(ref, { tps: filtered }), 2500);
    return { message: "TP berhasil dihapus." };
  },

  // 7. GET & POST /api/settings
  getSettings: async () => {
    if (!db) throw new Error("Database not connected");
    const ref = doc(db, "settings", "app");
    const docSnap = await withTimeout(getDoc(ref), 2500);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.format && !data.format.tanggalRaport) {
        data.format.tanggalRaport = "17 Juni 2026";
      }
      return data;
    }
    return {
      principalName: "Ustadz H. Ir. Abdul Muhyi, M.Pd",
      principalNip: "19780512 200501 1 002",
      format: {
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
        tanggalRaport: "17 Juni 2026"
      }
    };
  },
  postSettings: async (body: any) => {
    if (!db) throw new Error("Database not connected");
    const { principalName, principalNip, format } = body;
    const settingsData = {
      principalName: principalName || "Ustadz H. Ir. Abdul Muhyi, M.Pd",
      principalNip: principalNip || "19780512 200501 1 002",
      format: format ? {
        semesterName: format.semesterName || "Ganjil",
        tahunPelajaran: format.tahunPelajaran || "2026/2027",
        fontSize: format.fontSize || "11pt",
        showLogo: format.showLogo !== undefined ? format.showLogo : false,
        showSpiritual: format.showSpiritual !== undefined ? format.showSpiritual : true,
        showSosial: format.showSosial !== undefined ? format.showSosial : true,
        showAttendance: format.showAttendance !== undefined ? format.showAttendance : true,
        showCatatan: format.showCatatan !== undefined ? format.showCatatan : true,
        fontFamily: format.fontFamily || "Times New Roman",
        paperSize: format.paperSize || "A4",
        tanggalRaport: format.tanggalRaport || "17 Juni 2026"
      } : {}
    };
    await withTimeout(setDoc(doc(db, "settings", "app"), settingsData), 2500);
    return { success: true, settings: settingsData };
  },

  // 8. GET /api/summary
  getSummary: async () => {
    // Aggregation logic
    const students = await firebaseApi.getStudents() as any[];
    const teachers = await firebaseApi.getTeachers() as any[];
    const grades = await firebaseApi.getGrades() as any[];
    
    const subjectsList = [
      "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "PJOK", "Prakarya", "Informatika",
      "Bahasa Arab", "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"
    ];
    const totalStudents = students.length;
    const registeredStudentIds = new Set(students.map((s: any) => s.id));
    
    const subjectProgress = subjectsList.map(sub => {
      const filledGradesForSub = grades.filter((g: any) => g.subject === sub && registeredStudentIds.has(g.studentId));
      const completedCount = filledGradesForSub.length;
      const percentage = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
      const t = teachers.find((teach: any) => teach.subject === sub);
      return {
        subject: sub,
        completed: completedCount,
        total: totalStudents,
        percent: percentage,
        teacherName: t ? t.name : "Belum Ditugaskan"
      };
    });

    const classSet = new Set(["1", "2", "3", "4", "5", "6"]);
    students.forEach((s: any) => {
      const k = String(s.kelas || "").trim();
      if (k) classSet.add(k);
    });
    const classes = Array.from(classSet).sort();

    const classProgress = classes.map(cls => {
      const studentsInClass = students.filter((s: any) => String(s.kelas || "").trim() === cls);
      const totalGradesNeeded = studentsInClass.length * subjectsList.length;
      let gradesFilledCount = 0;
      const studentIds = new Set(studentsInClass.map((s: any) => s.id));
      grades.forEach((g: any) => {
        if (studentIds.has(g.studentId)) {
          gradesFilledCount++;
        }
      });
      const percent = totalGradesNeeded > 0 ? Math.round((gradesFilledCount / totalGradesNeeded) * 100) : 0;
      const waliKelas = teachers.find((teach: any) => teach.isWaliKelas && String(teach.kelas || "").trim() === cls);
      return {
        kelas: cls,
        studentCount: studentsInClass.length,
        filledGrades: gradesFilledCount,
        totalNeeded: totalGradesNeeded,
        percent,
        waliKelasName: waliKelas ? waliKelas.name : "Belum Ditugaskan"
      };
    });

    // Calculate Student Rankings
    const studentRankings = students.map((s: any) => {
      const studentGrades = grades.filter((g: any) => g.studentId === s.id);
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
        totalSubjectsCount: subjectsList.length,
        rank: 0,
        rankInClass: 0,
        predikat,
        subjectScores,
      };
    });

    studentRankings.sort((a: any, b: any) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      return a.name.localeCompare(b.name);
    });

    studentRankings.forEach((s: any, idx: number) => {
      s.rank = idx + 1;
    });

    const classCounters: Record<string, number> = {};
    studentRankings.forEach((s: any) => {
      const k = s.kelas;
      classCounters[k] = (classCounters[k] || 0) + 1;
      s.rankInClass = classCounters[k];
    });

    return {
      totalStudents,
      totalTeachers: teachers.length,
      subjectProgress,
      classProgress,
      studentRankings,
      lastUpdate: new Date().toISOString()
    };
  },

  // 9. GET, POST, DELETE /api/ekskul
  getEkskul: async (): Promise<any[]> => {
    if (!db) return [];
    const snap = await withTimeout(getDocs(collection(db, "ekskul")), 2500);
    if (snap.empty) {
      return [
        { "id": "e1", "name": "Pramuka", "type": "Wajib" },
        { "id": "e2", "name": "Mentoring", "type": "Wajib" },
        { "id": "e3", "name": "Futsal", "type": "Pilihan" },
        { "id": "e4", "name": "Voli", "type": "Pilihan" },
        { "id": "e5", "name": "Panahan", "type": "Pilihan" },
        { "id": "e6", "name": "Study Club", "type": "Pilihan" }
      ];
    }
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  },
  postEkskul: async (body: any) => {
    if (!db) throw new Error("Database not connected");
    const { name, type } = body;
    const id = "e_" + Date.now();
    const newE = { id, name, type };
    await withTimeout(setDoc(doc(db, "ekskul", id), newE), 2500);
    return newE;
  },
  deleteEkskul: async (id: string) => {
    if (!db) throw new Error("Database not connected");
    await withTimeout(deleteDoc(doc(db, "ekskul", id)), 2500);
    return { message: "Ekskul deleted" };
  }
};
export { db as default };
