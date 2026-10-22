import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  setLogLevel
} from "firebase/firestore";
import { normalizeSubjectKey, matchTpClass, getSubjectTps, isSampleTp, cleanTpList, isKeislamanSubject, isEkskulSubject, normalizeEkskulKey, deduplicateStudentEkskuls, pickNewerGrade, deduplicateGradesList } from "./src/types";

try {
  setLogLevel("error");
} catch (e) {}

const app = express();
const PORT = 3000;

app.use(express.json());

// Firebase configuration for smart-sd-sts
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDe3hjTP6AphfSaPY8KJkPPgYFocJ2xTcs",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-sd-sts.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "smart-sd-sts",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-sd-sts.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "132220678784",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:132220678784:web:1187d3dfe1403becedec65",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L5XBRWBZRQ"
};

let firestoreDb: any = null;
try {
  const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  try {
    firestoreDb = initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    firestoreDb = getFirestore(firebaseApp);
  }
  console.log("⚡ Firebase Firestore successfully connected on backend server.");
} catch (e) {
  console.warn("Firebase Firestore initialization warning on server:", e);
}

// Path to data file
const DB_PATH = path.join(process.cwd(), "src", "data", "db.json");

// In-memory database cache with file mtime tracking
let memoryDB: any = null;
let lastDbMtime = 0;
let saveDebounceTimer: NodeJS.Timeout | null = null;
let dbVersion = Date.now();

// Helper to read database with memory caching and disk change detection
async function readDB() {
  try {
    const stat = await fs.stat(DB_PATH);
    if (!memoryDB || stat.mtimeMs > lastDbMtime) {
      const data = await fs.readFile(DB_PATH, "utf-8");
      memoryDB = JSON.parse(data);
      if (Array.isArray(memoryDB.grades)) {
        memoryDB.grades = deduplicateGradesList(memoryDB.grades);
      }
      lastDbMtime = stat.mtimeMs;
    }
    return memoryDB;
  } catch (err) {
    if (memoryDB) return memoryDB;
    console.error("Error reading db file, using empty default:", err);
    memoryDB = {
      teachers: [],
      students: [],
      grades: [],
      walikelas_notes: {},
      tujuan_pembelajaran_templates: {},
      settings: {},
    };
    return memoryDB;
  }
}

// Helper to write database with background async disk sync
async function writeDB(data: any) {
  memoryDB = data;
  dbVersion = Date.now();
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(DB_PATH, content, "utf-8");
    try {
      const stat = await fs.stat(DB_PATH);
      lastDbMtime = stat.mtimeMs;
    } catch {}
  } catch (err) {
    console.error("Error writing db file:", err);
  }
}

// Background sync helper that doesn't block HTTP responses
function asyncPersistDB() {
  dbVersion = Date.now();
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    if (memoryDB) {
      try {
        const content = JSON.stringify(memoryDB, null, 2);
        await fs.writeFile(DB_PATH, content, "utf-8");
        try {
          const stat = await fs.stat(DB_PATH);
          lastDbMtime = stat.mtimeMs;
        } catch {}
      } catch (e) {
        console.error("Async disk sync error:", e);
      }
    }
  }, 50);
}

// Helper to sync database from Firestore into local server cache
async function syncDatabaseWithFirestore() {
  if (!firestoreDb) return { success: false, message: "Firestore not initialized" };
  try {
    const db = await readDB();
    let changed = false;

    // 1. Sync Teachers
    const tSnap = await getDocs(collection(firestoreDb, "teachers"));
    if (!tSnap.empty) {
      const fsTeachers: any[] = [];
      tSnap.forEach(d => {
        const data = d.data();
        if (!isDummyTeacherServer(data)) {
          fsTeachers.push({ id: d.id, ...data });
        }
      });
      if (fsTeachers.length > 0) {
        db.teachers = fsTeachers;
        changed = true;
      }
    }

    // 2. Sync Students
    const sSnap = await getDocs(collection(firestoreDb, "students"));
    if (!sSnap.empty) {
      const fsStudents: any[] = [];
      sSnap.forEach(d => fsStudents.push({ id: d.id, ...d.data() }));
      if (fsStudents.length >= (db.students || []).length) {
        db.students = fsStudents;
        changed = true;
      }
    }

    // 3. Sync Settings
    const setSnap = await getDoc(doc(firestoreDb, "settings", "app"));
    if (setSnap.exists()) {
      const fsSet = setSnap.data();
      if (!db.settings) db.settings = {};
      if (fsSet.principalName && String(fsSet.principalName).trim()) {
        db.settings.principalName = String(fsSet.principalName).trim();
      }
      if (fsSet.principalNip !== undefined) {
        db.settings.principalNip = String(fsSet.principalNip).trim();
      }
      if (fsSet.format) {
        db.settings.format = { ...(db.settings.format || {}), ...fsSet.format };
      }
      changed = true;
    }

    // 4. Sync Grades
    try {
      const gSnap = await getDocs(collection(firestoreDb, "grades"));
      if (gSnap && !gSnap.empty) {
        const fsGradesMap = new Map<string, any>();
        if (Array.isArray(db.grades)) {
          db.grades.forEach((g: any) => {
            if (g && g.studentId && g.subject) {
              const key = `${g.studentId}_${normalizeSubjectKey(g.subject)}`;
              const prev = fsGradesMap.get(key);
              fsGradesMap.set(key, prev ? pickNewerGrade(prev, g) : g);
            }
          });
        }
        gSnap.forEach((d) => {
          const data = d.data();
          if (data && data.studentId && data.subject) {
            if (Array.isArray(data.tps)) {
              data.tps = cleanTpList(data.tps);
            }
            const key = `${data.studentId}_${normalizeSubjectKey(data.subject)}`;
            const prev = fsGradesMap.get(key);
            fsGradesMap.set(key, prev ? pickNewerGrade(prev, data) : data);
          }
        });
        db.grades = Array.from(fsGradesMap.values());
        changed = true;
      }
    } catch (e) {
      console.warn("[Firestore Sync] Grades sync error:", e);
    }

    // 5. Sync TP Templates (Tujuan Pembelajaran) with Grade Auto-Recovery
    try {
      if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};
      if (!Array.isArray(db.deleted_tps)) db.deleted_tps = [];
      const deletedTpSet = new Set<string>(db.deleted_tps.map((id: any) => String(id).trim()));

      // Purge any ekskul templates from TP templates
      for (const k of Object.keys(db.tujuan_pembelajaran_templates)) {
        if (isEkskulSubject(k)) {
          delete db.tujuan_pembelajaran_templates[k];
          changed = true;
        }
      }

      const tpSnap = await getDocs(collection(firestoreDb, "tujuan_pembelajaran_templates"));
      if (tpSnap && !tpSnap.empty) {
        tpSnap.forEach((docSnap) => {
          const docId = docSnap.id;
          if (isEkskulSubject(docId)) {
            // Delete ekskul TP document from Firestore if it exists
            deleteDoc(doc(firestoreDb, "tujuan_pembelajaran_templates", docId)).catch(() => {});
            return;
          }
          const data = docSnap.data();
          if (Array.isArray(data.tps)) {
            const cleanList = cleanTpList(data.tps).filter((tp: any) => !deletedTpSet.has(String(tp.id).trim()));
            const normDocId = normalizeSubjectKey(docId) || docId;
            const existing = Array.isArray(db.tujuan_pembelajaran_templates[normDocId])
              ? db.tujuan_pembelajaran_templates[normDocId]
              : (Array.isArray(db.tujuan_pembelajaran_templates[docId]) ? db.tujuan_pembelajaran_templates[docId] : []);
            
            // Merge existing local and cloud TPs safely
            const mergedMap = new Map<string, any>();
            existing.forEach((tp: any) => {
              if (tp && tp.id && tp.text && !deletedTpSet.has(String(tp.id).trim())) mergedMap.set(String(tp.id).trim(), tp);
            });
            cleanList.forEach((tp: any) => {
              if (tp && tp.id && tp.text && !deletedTpSet.has(String(tp.id).trim())) mergedMap.set(String(tp.id).trim(), tp);
            });
            const mergedList = Array.from(mergedMap.values());
            db.tujuan_pembelajaran_templates[normDocId] = mergedList;
            db.tujuan_pembelajaran_templates[docId] = mergedList;
            changed = true;
          }
        });
      }

      // Auto-recover any TPs embedded in grades (skipping deleted TPs and ekskul)
      if (Array.isArray(db.grades)) {
        db.grades.forEach((g: any) => {
          if (g && g.subject && !isEkskulSubject(g.subject) && Array.isArray(g.tps) && g.tps.length > 0) {
            const normSub = normalizeSubjectKey(g.subject) || g.subject;
            const validTps = cleanTpList(g.tps).filter((tp: any) => !deletedTpSet.has(String(tp.id).trim()));
            if (validTps.length > 0) {
              const current = Array.isArray(db.tujuan_pembelajaran_templates[normSub])
                ? db.tujuan_pembelajaran_templates[normSub]
                : [];
              const map = new Map<string, any>();
              current.forEach((t: any) => map.set(String(t.id).trim(), t));
              const student = (db.students || []).find((s: any) => String(s.id) === String(g.studentId));
              const studentClass = student ? String(student.kelas || student.classId || "") : "";
              validTps.forEach((t: any) => {
                const prev = map.get(String(t.id).trim());
                map.set(String(t.id).trim(), {
                  ...prev,
                  id: t.id,
                  text: t.text,
                  kelas: t.kelas || (prev && prev.kelas) || studentClass || "all"
                });
              });
              const combined = Array.from(map.values());
              db.tujuan_pembelajaran_templates[normSub] = combined;
              db.tujuan_pembelajaran_templates[g.subject] = combined;
              changed = true;
            }
          }
        });
      }
    } catch (e) {
      console.warn("[Firestore Sync] TP templates sync error:", e);
    }

    // 6. Sync Wali Kelas Notes & Ekskul Grades
    try {
      const wSnap = await getDocs(collection(firestoreDb, "walikelas_notes"));
      if (wSnap && !wSnap.empty) {
        if (!db.walikelas_notes) db.walikelas_notes = {};
        wSnap.forEach((d) => {
          const studentId = d.id;
          const cloudData = d.data() || {};
          const localData = db.walikelas_notes[studentId] || {};

          const combinedDeleted = Array.from(
            new Set([
              ...(Array.isArray(localData.deletedEkskuls) ? localData.deletedEkskuls : []),
              ...(Array.isArray(cloudData.deletedEkskuls) ? cloudData.deletedEkskuls : []),
            ])
          );

          const combinedEkskuls = [
            ...(Array.isArray(localData.ekskul) ? localData.ekskul : []),
            ...(Array.isArray(cloudData.ekskul) ? cloudData.ekskul : []),
          ];
          const dedupedEkskul = deduplicateStudentEkskuls(combinedEkskuls, combinedDeleted, db.ekskul);

          // Never allow an empty string from an ekskul-only save to erase a filled spiritual/sosial description
          const cloudSpDesc = String(cloudData.spiritualDeskripsi || "").trim();
          const localSpDesc = String(localData.spiritualDeskripsi || "").trim();
          const cloudSoDesc = String(cloudData.sosialDeskripsi || "").trim();
          const localSoDesc = String(localData.sosialDeskripsi || "").trim();
          const cloudCat = String(cloudData.catatan || "").trim();
          const localCat = String(localData.catatan || "").trim();

          db.walikelas_notes[studentId] = {
            ...localData,
            ...cloudData,
            spiritualUsaha: cloudData.spiritualUsaha || localData.spiritualUsaha || "B",
            spiritualProses: cloudData.spiritualProses || localData.spiritualProses || "B",
            spiritualCapaian: cloudData.spiritualCapaian || localData.spiritualCapaian || "B",
            spiritualDeskripsi: cloudSpDesc || localSpDesc || "",
            sosialUsaha: cloudData.sosialUsaha || localData.sosialUsaha || "B",
            sosialProses: cloudData.sosialProses || localData.sosialProses || "B",
            sosialCapaian: cloudData.sosialCapaian || localData.sosialCapaian || "B",
            sosialDeskripsi: cloudSoDesc || localSoDesc || "",
            catatan: cloudCat || localCat || "",
            ekskul: dedupedEkskul,
            deletedEkskuls: combinedDeleted,
          };
        });
        changed = true;
      }
    } catch (e) {
      console.warn("[Firestore Sync] Walikelas notes sync error:", e);
    }

    // 7. Sync Ekskul Master List
    try {
      const eSnap = await getDocs(collection(firestoreDb, "ekskul"));
      if (eSnap && !eSnap.empty) {
        const fsEkskuls: any[] = [];
        eSnap.forEach((d) => fsEkskuls.push({ id: d.id, ...d.data() }));
        if (fsEkskuls.length >= (db.ekskul || []).length) {
          db.ekskul = fsEkskuls;
          changed = true;
        }
      }
    } catch (e) {
      console.warn("[Firestore Sync] Ekskul sync error:", e);
    }

    if (changed) {
      await writeDB(db);
      console.log(`[Firestore Sync] Sync complete. Teachers: ${db.teachers?.length || 0}, Students: ${db.students?.length || 0}, Grades: ${db.grades?.length || 0}, Principal: ${db.settings?.principalName}`);
    }
    return {
      success: true,
      teachersCount: db.teachers?.length || 0,
      studentsCount: db.students?.length || 0,
      principalName: db.settings?.principalName,
      principalNip: db.settings?.principalNip
    };
  } catch (err: any) {
    console.warn("[Firestore Sync] Error syncing:", err.message);
    return { success: false, error: err.message };
  }
}

// Initial background sync
setTimeout(() => {
  syncDatabaseWithFirestore().catch(() => {});
}, 1000);

// ==================== API ENDPOINTS ====================

// Real-time Database Version Check for Multi-Device Auto-Sync
app.get("/api/db-version", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    version: dbVersion,
    timestamp: Date.now(),
  });
});

// 1. Auth Endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  const db = await readDB();
  const cleanUser = String(username || "").trim().toLowerCase();
  const normalize = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normUser = normalize(username);

  const teacher = db.teachers.find((t: any) => {
    const passMatch = t.password === password || (!t.password && password === "123");
    if (!passMatch) return false;
    const tUser = String(t.username || "").trim().toLowerCase();
    const tName = String(t.name || "").trim().toLowerCase();
    if (tUser === cleanUser || tName === cleanUser) return true;
    if (normUser && (normalize(t.username) === normUser || normalize(t.name) === normUser)) return true;
    if (Array.isArray(t.aliases)) {
      if (t.aliases.some((a: string) => String(a).toLowerCase().trim() === cleanUser || (normUser && normalize(a) === normUser))) return true;
    }
    return false;
  });

  if (!teacher) {
    return res
      .status(401)
      .json({ error: "Kombinasi pengguna dan kata sandi salah." });
  }

  const assignedEks = Array.isArray(db.ekskul)
    ? db.ekskul.find(
        (e: any) =>
          (e.teacherId && String(e.teacherId) === String(teacher.id)) ||
          (teacher.isEkskulTeacher && teacher.ekskulName && (
            e.name.toLowerCase() === teacher.ekskulName.toLowerCase() ||
            e.name.toLowerCase().includes(teacher.ekskulName.toLowerCase()) ||
            teacher.ekskulName.toLowerCase().includes(e.name.toLowerCase())
          ))
      )
    : null;

  const isEkskulTeacher = Boolean(teacher.isEkskulTeacher || assignedEks);
  const ekskulName = assignedEks ? assignedEks.name : (teacher.ekskulName || "");
  const teacherSubs = extractTeacherSubjects(teacher);

  res.json({
    id: teacher.id,
    name: teacher.name,
    username: teacher.username,
    subject: teacher.subject,
    subjects: teacherSubs.length > 0 ? teacherSubs : [teacher.subject || "PAI"],
    isWaliKelas: teacher.isWaliKelas || false,
    kelas: teacher.kelas || "",
    isEkskulTeacher,
    ekskulName,
  });
});

app.post("/api/verify-session", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Sesi tidak lengkap." });
  }

  const db = await readDB();
  const cleanUser = String(username || "").trim().toLowerCase();
  const normalize = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normUser = normalize(username);

  const teacher = db.teachers.find((t: any) => {
    const passMatch = t.password === password || (!t.password && password === "123");
    if (!passMatch) return false;
    const tUser = String(t.username || "").trim().toLowerCase();
    const tName = String(t.name || "").trim().toLowerCase();
    if (tUser === cleanUser || tName === cleanUser) return true;
    if (normUser && (normalize(t.username) === normUser || normalize(t.name) === normUser)) return true;
    if (Array.isArray(t.aliases)) {
      if (t.aliases.some((a: string) => String(a).toLowerCase().trim() === cleanUser || (normUser && normalize(a) === normUser))) return true;
    }
    return false;
  });

  if (!teacher) {
    return res.status(401).json({ error: "Sesi tidak valid." });
  }

  const teacherEkskuls = extractTeacherEkskuls(teacher);
  const isEkskulTeacher = Boolean(teacher.isEkskulTeacher || teacherEkskuls.length > 0);
  const ekskulName = teacher.ekskulName || teacherEkskuls.join(", ");
  const teacherSubs = extractTeacherSubjects(teacher);

  res.json({
    id: teacher.id,
    name: teacher.name,
    username: teacher.username,
    subject: teacher.subject,
    subjects: teacherSubs.length > 0 ? teacherSubs : [teacher.subject || "PAI"],
    isWaliKelas: teacher.isWaliKelas || false,
    kelas: teacher.kelas || "",
    isEkskulTeacher,
    ekskulName,
    ekskulNames: teacherEkskuls,
  });
});

// Helper to extract and normalize teacher extracurriculars
function extractTeacherEkskuls(t: any): string[] {
  if (!t) return [];
  if (Array.isArray(t.ekskulNames) && t.ekskulNames.length > 0) {
    return Array.from(new Set(t.ekskulNames.map((s: any) => String(s || '').trim()).filter(Boolean)));
  }
  if (t.ekskulName) {
    return Array.from(new Set(String(t.ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
  }
  return [];
}

// Helper to extract and normalize teacher subjects
function extractTeacherSubjects(t: any): string[] {
  if (!t) return [];
  let rawList: string[] = [];
  if (Array.isArray(t.subjects) && t.subjects.length > 0) {
    rawList = t.subjects.map((s: any) => String(s || '').trim()).filter(Boolean);
  } else if (t.subject) {
    rawList = String(t.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean);
  }

  const expanded: string[] = [];
  const keislamanSubs = [
    "Tahsin ABaTaTsa",
    "Tahfizh Al-Qur’an",
    "Do’a Harian dan Hadits",
    "Wudhu dan Sholat"
  ];

  for (const s of rawList) {
    if (
      s === "Keislaman" ||
      s === "Pendidikan Keislaman" ||
      s === "Agama Islam / Keislaman" ||
      s.toLowerCase().includes("keislaman")
    ) {
      keislamanSubs.forEach(k => {
        if (!expanded.includes(k)) expanded.push(k);
      });
    } else {
      if (!expanded.includes(s)) expanded.push(s);
    }
  }

  if (t && t.isWaliKelas && expanded.filter(s => s !== "Pembina Ekskul" && s !== "Pelatih Ekskul" && s !== "Admin").length <= 1) {
    const defaultWaliSubs = [
      "Bahasa Indonesia",
      "PPKN",
      "Matematika",
      "IPAS",
      "Seni Budaya",
      "TIK",
      "Bahasa Inggris",
      "Life skill"
    ];
    defaultWaliSubs.forEach(sub => {
      if (!expanded.includes(sub)) expanded.push(sub);
    });
  }

  return expanded;
}

// 2. Teachers CRUD
const DUMMY_TEACHER_IDS = ['t2', 't3', 't4', 't5', 't6', 't7'];
const DUMMY_TEACHER_USERNAMES = ['fatimah', 'ahmad', 'lukman', 'khadijah', 'yusuf', 'aisyah'];

function isDummyTeacherServer(t: any): boolean {
  if (!t) return false;
  const id = String(t.id || '').toLowerCase().trim();
  const u = String(t.username || '').toLowerCase().trim();
  const n = String(t.name || '').toLowerCase().trim();
  return (
    DUMMY_TEACHER_IDS.includes(id) ||
    DUMMY_TEACHER_USERNAMES.includes(u) ||
    n.includes('ustadzah fatimah') ||
    n.includes('ustadz ahmad') ||
    n.includes('ustadz lukman') ||
    n.includes('ustadzah khadijah') ||
    n.includes('ustadz yusuf') ||
    n.includes('ustadzah aisyah')
  );
}

app.get("/api/teachers", async (req, res) => {
  const db = await readDB();
  if (!Array.isArray(db.teachers)) db.teachers = [];
  if (!Array.isArray(db.ekskul)) db.ekskul = [];

  const initialCount = db.teachers.length;
  db.teachers = db.teachers.filter((t: any) => !isDummyTeacherServer(t));
  if (db.teachers.length !== initialCount) {
    await writeDB(db);
  }

  const list = db.teachers.map((t: any) => {
    const assignedEkskuls = (db.ekskul || [])
      .filter((e: any) => e.teacherId && String(e.teacherId) === String(t.id))
      .map((e: any) => e.name);

    const teacherEkskuls = extractTeacherEkskuls(t);
    const allEksSet = new Set<string>();
    assignedEkskuls.forEach((e: string) => { if (e) allEksSet.add(e.trim()); });
    teacherEkskuls.forEach((e: string) => { if (e) allEksSet.add(e.trim()); });
    const finalEkskuls = Array.from(allEksSet);

    const teacherSubs = extractTeacherSubjects(t);
    const isEks = Boolean(t.isEkskulTeacher || finalEkskuls.length > 0);

    return {
      ...t,
      subjects: teacherSubs.length > 0 ? teacherSubs : (t.subject ? [t.subject] : []),
      subject: teacherSubs.length > 0 ? teacherSubs.join(", ") : (t.subject || ""),
      isEkskulTeacher: isEks,
      ekskulNames: finalEkskuls,
      ekskulName: finalEkskuls.join(", "),
    };
  });

  res.json(list);
});

app.post("/api/teachers", async (req, res) => {
  const { name, username, password, subject, subjects, isWaliKelas, kelas, isEkskulTeacher, ekskulName } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: "Data guru kurang lengkap." });
  }

  let finalSubjects: string[] = [];
  if (Array.isArray(subjects) && subjects.length > 0) {
    finalSubjects = Array.from(new Set(subjects.map((s: any) => String(s || '').trim()).filter(Boolean)));
  } else if (subject && subject !== "-" && subject !== "Pembina Ekskul") {
    finalSubjects = Array.from(new Set(String(subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
  }
  const isEkskulTeacherFlag = Boolean(isEkskulTeacher || req.body.ekskulName || (Array.isArray(req.body.ekskulNames) && req.body.ekskulNames.length > 0));
  const finalSubjectStr = finalSubjects.length > 0 ? finalSubjects.join(", ") : (isEkskulTeacherFlag ? "Pembina Ekskul" : "");

  const db = await readDB();
  if (!Array.isArray(db.teachers)) db.teachers = [];
  if (!Array.isArray(db.ekskul)) db.ekskul = [];

  // Check unique username
  const exists = db.teachers.some(
    (t: any) => t.username.toLowerCase() === username.toLowerCase(),
  );
  if (exists) {
    return res.status(400).json({ error: "Username sudah digunakan." });
  }

  let finalEkskuls: string[] = [];
  if (Array.isArray(req.body.ekskulNames) && req.body.ekskulNames.length > 0) {
    finalEkskuls = Array.from(new Set(req.body.ekskulNames.map((s: any) => String(s || '').trim()).filter(Boolean)));
  } else if (req.body.ekskulName) {
    finalEkskuls = Array.from(new Set(String(req.body.ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
  }
  const isEks = Boolean(isEkskulTeacher && finalEkskuls.length > 0);
  const cleanEkskulName = isEks ? finalEkskuls.join(", ") : "";

  const newTeacher = {
    id: "t_" + Date.now(),
    name: String(name || "").trim(),
    username: String(username || "").trim().toLowerCase(),
    password: String(password || "123").trim(),
    subject: finalSubjectStr,
    subjects: finalSubjects,
    isWaliKelas: Boolean(isWaliKelas),
    kelas: isWaliKelas ? String(kelas || "").trim() : "",
    isEkskulTeacher: isEks,
    ekskulName: cleanEkskulName,
    ekskulNames: isEks ? finalEkskuls : [],
  };

  db.teachers.push(newTeacher);

  // Sync with db.ekskul for all assigned ekskuls
  if (isEks && finalEkskuls.length > 0) {
    finalEkskuls.forEach((eksName) => {
      let matchedEks = db.ekskul.find(
        (e: any) => e.name.toLowerCase().trim() === eksName.toLowerCase().trim()
      );

      if (!matchedEks) {
        matchedEks = {
          id: "e_" + Date.now() + Math.random().toString(36).substr(2, 4),
          name: eksName,
          type: "Pilihan",
          teacherId: newTeacher.id,
          teacherName: newTeacher.name,
        };
        db.ekskul.push(matchedEks);
      } else {
        matchedEks.teacherId = newTeacher.id;
        matchedEks.teacherName = newTeacher.name;
      }
    });
  }

  await writeDB(db);

  if (firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "teachers", newTeacher.id), newTeacher);
    } catch (e) {
      console.warn("Firestore teacher create error:", e);
    }
  }

  res.status(201).json(newTeacher);
});

app.put("/api/teachers/:id", async (req, res) => {
  const { id } = req.params;
  const { name, username, password, subject, subjects, isWaliKelas, kelas, isEkskulTeacher, ekskulName } = req.body;

  const db = await readDB();
  if (!Array.isArray(db.teachers)) db.teachers = [];
  if (!Array.isArray(db.ekskul)) db.ekskul = [];

  const index = db.teachers.findIndex(
    (t: any) =>
      t.id === id ||
      String(t.id) === String(id) ||
      (t.username && t.username.toLowerCase() === id.toLowerCase()) ||
      (t.username && t.username.toLowerCase() === String(username || "").toLowerCase())
  );
  if (index === -1) {
    return res.status(404).json({ error: "Guru tidak ditemukan." });
  }

  // Check username unique except itself
  const exists = db.teachers.some(
    (t: any) =>
      t.username.toLowerCase() === String(username || "").trim().toLowerCase() &&
      t.id !== db.teachers[index].id,
  );
  if (exists) {
    return res.status(400).json({ error: "Username sudah digunakan." });
  }

  let finalSubjects: string[] = [];
  if (Array.isArray(subjects)) {
    finalSubjects = Array.from(new Set(subjects.map((s: any) => String(s || '').trim()).filter(Boolean)));
  } else if (subject && subject !== "-" && subject !== "Pembina Ekskul") {
    finalSubjects = Array.from(new Set(String(subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
  }
  const isEkskulTeacherFlag = Boolean(isEkskulTeacher || req.body.ekskulName || (Array.isArray(req.body.ekskulNames) && req.body.ekskulNames.length > 0));
  const finalSubjectStr = finalSubjects.length > 0 ? finalSubjects.join(", ") : (isEkskulTeacherFlag ? "Pembina Ekskul" : "");

  let finalEkskuls: string[] = [];
  if (Array.isArray(req.body.ekskulNames) && req.body.ekskulNames.length > 0) {
    finalEkskuls = Array.from(new Set(req.body.ekskulNames.map((s: any) => String(s || '').trim()).filter(Boolean)));
  } else if (req.body.ekskulName) {
    finalEkskuls = Array.from(new Set(String(req.body.ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
  }
  const isEks = Boolean(isEkskulTeacher && finalEkskuls.length > 0);
  const cleanEkskulName = isEks ? finalEkskuls.join(", ") : "";

  db.teachers[index] = {
    ...db.teachers[index],
    name: String(name || db.teachers[index].name || "").trim(),
    username: String(username || db.teachers[index].username || "").trim().toLowerCase(),
    password: String(password || db.teachers[index].password || "123").trim(),
    subject: finalSubjectStr,
    subjects: finalSubjects,
    isWaliKelas: Boolean(isWaliKelas),
    kelas: isWaliKelas ? String(kelas || "").trim() : "",
    isEkskulTeacher: isEks,
    ekskulName: cleanEkskulName,
    ekskulNames: isEks ? finalEkskuls : [],
  };

  // Synchronize db.ekskul for all assigned ekskuls
  if (isEks && finalEkskuls.length > 0) {
    finalEkskuls.forEach((eksName) => {
      let matchedEks = db.ekskul.find(
        (e: any) => e.name.toLowerCase().trim() === eksName.toLowerCase().trim()
      );

      if (!matchedEks) {
        matchedEks = {
          id: "e_" + Date.now() + Math.random().toString(36).substr(2, 4),
          name: eksName,
          type: "Pilihan",
          teacherId: id,
          teacherName: db.teachers[index].name,
        };
        db.ekskul.push(matchedEks);
      } else {
        matchedEks.teacherId = id;
        matchedEks.teacherName = db.teachers[index].name;
      }
    });
  }

  // Clear teacher only from ekskuls that are NOT in finalEkskuls
  db.ekskul.forEach((e: any) => {
    if (String(e.teacherId) === String(id)) {
      if (!isEks || !finalEkskuls.some((fn) => fn.toLowerCase().trim() === e.name.toLowerCase().trim())) {
        e.teacherId = "";
        e.teacherName = "";
      }
    }
  });

  await writeDB(db);

  if (firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "teachers", String(id)), db.teachers[index], { merge: true });
    } catch (e) {
      console.warn("Firestore teacher update error:", e);
    }
  }

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

  if (firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, "teachers", String(id)));
    } catch (e) {
      console.warn("Firestore teacher delete error:", e);
    }
  }

  res.json({ message: "Guru berhasil dihapus." });
});

function formatTitleCase(str: string) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
        .join("-")
    )
    .join(" ");
}

// 3. Students CRUD
app.get("/api/students", async (req, res) => {
  const db = await readDB();
  const formatted = (db.students || []).map((s: any) => ({
    ...s,
    name: formatTitleCase(s.name),
  }));
  res.json(formatted);
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
    name: formatTitleCase(name),
    kelas,
  };

  db.students.push(newStudent);
  await writeDB(db);
  res.status(201).json(newStudent);
});

// POST /api/students/batch - Batch import students
app.post("/api/students/batch", async (req, res) => {
  const { students, autoGenerateMissingNisn } = req.body;
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
    let nisn = String(item.nisn || "").trim().replace(/\D/g, "");
    const kelas = String(item.kelas || "1").trim();

    if (!name) {
      errors.push(`Baris: Nama siswa tidak boleh kosong.`);
      continue;
    }

    if (!nisn) {
      if (autoGenerateMissingNisn || item.autoGenerateNisn) {
        // Auto-generate clean 10-digit NISN: 2026 + random 6 digits
        let gen = "";
        do {
          gen = "2026" + Math.floor(100000 + Math.random() * 900000);
        } while (existingNisns.has(gen) || batchNisns.has(gen));
        nisn = gen;
      } else {
        errors.push(`Siswa "${name}": NISN tidak boleh kosong dan harus berupa angka.`);
        continue;
      }
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
  res.json(db.grades || []);
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
  if (!Array.isArray(db.grades)) db.grades = [];

  const normSub = normalizeSubjectKey(subject) || subject;
  const cleanSub = normSub.replace(/[^a-zA-Z0-9]/g, "_");
  const docId = `${studentId}_${cleanSub}`;
  const rawCleanSub = String(subject || "").trim().replace(/[^a-zA-Z0-9]/g, "_");
  const rawDocId = `${studentId}_${rawCleanSub}`;

  let existingMatched: any = null;
  const remainingGrades: any[] = [];
  for (const g of db.grades) {
    if (!g) continue;
    if (
      g.studentId === studentId &&
      (g.subject === subject || normalizeSubjectKey(g.subject) === normSub)
    ) {
      existingMatched = existingMatched ? pickNewerGrade(existingMatched, g) : g;
    } else {
      remainingGrades.push(g);
    }
  }

  const updatedGrade = {
    id: docId,
    studentId,
    subject,
    score: Number(score),
    tps: Array.isArray(tps) ? cleanTpList(tps) : [],
    usaha: usaha || (existingMatched ? existingMatched.usaha : "B") || "B",
    proses: proses || (existingMatched ? existingMatched.proses : "B") || "B",
    capaian: capaian || (existingMatched ? existingMatched.capaian : "B") || "B",
    deskripsi:
      deskripsi !== undefined && String(deskripsi).trim() !== ""
        ? deskripsi
        : existingMatched && String(existingMatched.deskripsi || "").trim() !== ""
        ? existingMatched.deskripsi
        : deskripsi || "",
    lastUpdatedBy: teacherName || "Guru Mata Pelajaran",
    lastUpdatedAt: new Date().toISOString(),
  };

  remainingGrades.push(updatedGrade);
  db.grades = deduplicateGradesList(remainingGrades);

  // Auto-persist grade TPs to master templates list
  if (Array.isArray(updatedGrade.tps) && updatedGrade.tps.length > 0) {
    if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};
    const canonicalKey = normSub || subject;
    const existing = Array.isArray(db.tujuan_pembelajaran_templates[canonicalKey])
      ? db.tujuan_pembelajaran_templates[canonicalKey]
      : [];
    const map = new Map<string, any>();
    existing.forEach((t: any) => map.set(String(t.id).trim(), t));
    const student = (db.students || []).find((s: any) => String(s.id) === String(studentId));
    const studentClass = student ? String(student.kelas || student.classId || "") : "";
    updatedGrade.tps.forEach((t: any) => {
      const prev = map.get(String(t.id).trim());
      const assignedClass = t.kelas || (prev && prev.kelas) || studentClass || "all";
      map.set(String(t.id).trim(), {
        ...prev,
        id: t.id,
        text: t.text,
        kelas: assignedClass,
      });
    });
    const combined = Array.from(map.values());
    db.tujuan_pembelajaran_templates[canonicalKey] = combined;
    db.tujuan_pembelajaran_templates[subject] = combined;

    if (firestoreDb) {
      try {
        const safeDocId = canonicalKey.replace(/\//g, "_");
        setDoc(doc(firestoreDb, "tujuan_pembelajaran_templates", safeDocId), {
          tps: cleanTpList(combined),
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      } catch (e) {}
    }
  }

  asyncPersistDB();

  if (firestoreDb) {
    setDoc(doc(firestoreDb, "grades", docId), updatedGrade, { merge: true })
      .then(() => {
        const legacySuffixes: Record<string, string[]> = {
          Sirah: ["Siroh", "Sirah_Nabawiyah"],
          Life_Skill: ["Life_skill", "Life_skills", "Life_Skills"],
          TIK: ["Informatika"],
          Tahfizh_Al_Qur_an: ["Tahfidz_Al_Qur_an", "Tahfizh"],
          Do_a_Harian_dan_Hadits: ["Doa_Harian_dan_Hadits", "Doa_dan_Hadist"],
        };
        const extraIdsToClean = new Set<string>();
        if (rawDocId && rawDocId !== docId) {
          extraIdsToClean.add(rawDocId);
        }
        if (legacySuffixes[cleanSub]) {
          legacySuffixes[cleanSub].forEach((suf) => extraIdsToClean.add(`${studentId}_${suf}`));
        }
        extraIdsToClean.forEach((oldId) => {
          if (oldId !== docId) {
            deleteDoc(doc(firestoreDb, "grades", oldId)).catch(() => {});
          }
        });
      })
      .catch((e: any) => {
        console.warn("Firestore grade save error:", e);
      });
  }

  res.json(updatedGrade);
});

// 5. Wali Kelas Notes & Attendance
app.get("/api/walikelas/notes", async (req, res) => {
  const db = await readDB();
  const rawNotes = db.walikelas_notes || {};
  const cleanedNotes: Record<string, any> = {};
  for (const [sId, noteObj] of Object.entries(rawNotes)) {
    const note = noteObj as any;
    if (!note || typeof note !== "object") continue;
    cleanedNotes[sId] = {
      ...note,
      ekskul: deduplicateStudentEkskuls(note.ekskul, note.deletedEkskuls, db.ekskul),
    };
  }
  res.json(cleanedNotes);
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
    replaceEkskul,
    deletedEkskuls,
  } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "ID Siswa harus diisi." });
  }

  const db = await readDB();
  if (!db.walikelas_notes) {
    db.walikelas_notes = {};
  }

  const existingNote = db.walikelas_notes[studentId] || {};
  const existingEkskuls = Array.isArray(existingNote.ekskul) ? existingNote.ekskul : [];
  const incomingEkskuls = Array.isArray(ekskul) ? ekskul : [];

  const mergedDeleted = Array.from(
    new Set([
      ...(Array.isArray(existingNote.deletedEkskuls) ? existingNote.deletedEkskuls : []),
      ...(Array.isArray(deletedEkskuls) ? deletedEkskuls : []),
    ])
  );

  const rawEkskulList = replaceEkskul
    ? incomingEkskuls
    : [...existingEkskuls, ...incomingEkskuls];
  const finalEkskul = deduplicateStudentEkskuls(rawEkskulList, mergedDeleted, db.ekskul);

  const incomingSpDesc = spiritualDeskripsi !== undefined && spiritualDeskripsi !== null ? String(spiritualDeskripsi).trim() : "";
  const existingSpDesc = String(existingNote.spiritualDeskripsi || "").trim();
  const spiritualDeskFinal = incomingSpDesc ? String(spiritualDeskripsi) : existingSpDesc;

  const incomingSoDesc = sosialDeskripsi !== undefined && sosialDeskripsi !== null ? String(sosialDeskripsi).trim() : "";
  const existingSoDesc = String(existingNote.sosialDeskripsi || "").trim();
  const sosialDeskFinal = incomingSoDesc ? String(sosialDeskripsi) : existingSoDesc;

  const incomingCatatan = catatan !== undefined && catatan !== null ? String(catatan).trim() : "";
  const existingCatatan = String(existingNote.catatan || "").trim();
  const catatanFinal = incomingCatatan ? String(catatan) : existingCatatan;

  db.walikelas_notes[studentId] = {
    sakit: sakit !== undefined && sakit !== null ? Number(sakit) : Number(existingNote.sakit || 0),
    izin: izin !== undefined && izin !== null ? Number(izin) : Number(existingNote.izin || 0),
    alpa: alpa !== undefined && alpa !== null ? Number(alpa) : Number(existingNote.alpa || 0),
    catatan: catatanFinal,

    spiritualUsaha: spiritualUsaha || existingNote.spiritualUsaha || "B",
    spiritualProses: spiritualProses || existingNote.spiritualProses || "B",
    spiritualCapaian: spiritualCapaian || existingNote.spiritualCapaian || "B",
    spiritualDeskripsi: spiritualDeskFinal,

    sosialUsaha: sosialUsaha || existingNote.sosialUsaha || "B",
    sosialProses: sosialProses || existingNote.sosialProses || "B",
    sosialCapaian: sosialCapaian || existingNote.sosialCapaian || "B",
    sosialDeskripsi: sosialDeskFinal,

    ekskul: finalEkskul,
    deletedEkskuls: mergedDeleted,
  };

  asyncPersistDB();

  if (firestoreDb) {
    setDoc(doc(firestoreDb, "walikelas_notes", String(studentId)), db.walikelas_notes[studentId], { merge: true }).catch((e: any) => {
      console.warn("Firestore walikelas_notes sync error:", e);
    });
  }

  res.json({ studentId, ...db.walikelas_notes[studentId] });
});

// 6. Learning Objectives (TP) Templates CRUD
app.get("/api/tps", async (req, res) => {
  const db = await readDB();
  const rawTemplates = db.tujuan_pembelajaran_templates || {};
  if (!Array.isArray(db.deleted_tps)) db.deleted_tps = [];
  const deletedTpSet = new Set<string>(db.deleted_tps.map((id: any) => String(id).trim()));

  const templates: Record<string, any[]> = {};
  for (const [sub, list] of Object.entries(rawTemplates)) {
    if (isEkskulSubject(sub)) continue;
    if (Array.isArray(list)) {
      templates[sub] = cleanTpList(list).filter((tp: any) => !deletedTpSet.has(String(tp.id).trim()));
    }
  }

  // Ensure all canonical alias keys share the merged list
  for (const key of Object.keys(templates)) {
    const merged = getSubjectTps(templates, key);
    templates[key] = merged;
  }

  const { kelas, subject } = req.query;

  // If specific subject requested
  if (subject && typeof subject === "string") {
    let items = getSubjectTps(templates, subject);
    if (kelas && typeof kelas === "string") {
      items = items.filter((item: any) => matchTpClass(item.kelas, kelas));
    }
    return res.json(items);
  }

  // If filtered by kelas across all subjects
  if (kelas && typeof kelas === "string") {
    const filtered: Record<string, any[]> = {};
    for (const [sub, list] of Object.entries(templates)) {
      if (Array.isArray(list)) {
        filtered[sub] = list.filter((item: any) => matchTpClass(item.kelas, kelas));
      }
    }
    return res.json(filtered);
  }

  templates._deleted = db.deleted_tps || [];
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

  const cleanSubject = String(subject).trim();
  const canonicalKey = normalizeSubjectKey(cleanSubject) || cleanSubject;

  const newTP = {
    id: "tp_" + Date.now(),
    text: String(tpText).trim(),
    kelas: kelas ? String(kelas).trim() : "all",
  };

  // Find all alias keys in db.tujuan_pembelajaran_templates for this subject
  const aliasKeys = new Set<string>();
  aliasKeys.add(canonicalKey);
  aliasKeys.add(cleanSubject);
  for (const k of Object.keys(db.tujuan_pembelajaran_templates)) {
    if (normalizeSubjectKey(k) === canonicalKey || k.toLowerCase() === cleanSubject.toLowerCase()) {
      aliasKeys.add(k);
    }
  }

  // Get current merged list and append new TP
  const existingList = getSubjectTps(db.tujuan_pembelajaran_templates, canonicalKey);
  if (!existingList.some((t: any) => String(t.id).trim() === newTP.id)) {
    existingList.push(newTP);
  }

  // Update ALL alias keys with the complete list
  aliasKeys.forEach((key) => {
    db.tujuan_pembelajaran_templates[key] = [...existingList];
  });

  await writeDB(db);

  if (firestoreDb) {
    try {
      for (const key of aliasKeys) {
        const safeDocId = key.replace(/\//g, "_");
        const listToSave = cleanTpList(existingList);
        await setDoc(doc(firestoreDb, "tujuan_pembelajaran_templates", safeDocId), {
          tps: listToSave,
          subject: canonicalKey,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (e) {
      console.warn("[Firestore TP] Error persisting TP to Firestore:", e);
    }
  }

  res.status(201).json(newTP);
});

app.put("/api/tps/:subject/:tpId", async (req, res) => {
  const { subject, tpId } = req.params;
  const { text, kelas } = req.body;
  const decodedSubject = decodeURIComponent(subject || "").trim();
  const cleanTpId = decodeURIComponent(tpId || "").trim();
  const db = await readDB();

  if (!db.tujuan_pembelajaran_templates) {
    return res.status(404).json({ error: "TP tidak ditemukan." });
  }

  const canonicalKey = normalizeSubjectKey(decodedSubject) || decodedSubject;
  const aliasKeys = new Set<string>();
  aliasKeys.add(canonicalKey);
  aliasKeys.add(decodedSubject);
  for (const k of Object.keys(db.tujuan_pembelajaran_templates)) {
    if (normalizeSubjectKey(k) === canonicalKey || k.toLowerCase() === decodedSubject.toLowerCase()) {
      aliasKeys.add(k);
    }
  }
  const mergedList = getSubjectTps(db.tujuan_pembelajaran_templates, canonicalKey);
  let item = mergedList.find((tp: any) => String(tp.id).trim() === cleanTpId);

  if (!item && text !== undefined) {
    item = {
      id: cleanTpId,
      text: String(text).trim(),
      kelas: kelas ? String(kelas).trim() : "all",
    };
    mergedList.push(item);
  } else if (item) {
    if (text !== undefined) item.text = String(text).trim();
    if (kelas !== undefined) item.kelas = String(kelas).trim();
  }

  if (item) {
    // Propagate updated list to all alias keys
    aliasKeys.forEach((k) => {
      db.tujuan_pembelajaran_templates[k] = [...mergedList];
    });

    await writeDB(db);

    if (firestoreDb) {
      try {
        for (const k of aliasKeys) {
          const safeDocId = k.replace(/\//g, "_");
          await setDoc(doc(firestoreDb, "tujuan_pembelajaran_templates", safeDocId), {
            tps: cleanTpList(mergedList),
            subject: canonicalKey,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      } catch (e) {
        console.warn("[Firestore TP] Error updating TP in Firestore:", e);
      }
    }

    return res.json({ success: true, message: "TP berhasil diperbarui." });
  }

  res.status(404).json({ error: "TP tidak ditemukan." });
});

const deleteTpHandler = async (req: any, res: any) => {
  let { subject, tpId } = req.params;
  if (!tpId && subject) {
    tpId = subject;
    subject = "";
  }
  const decodedSubject = decodeURIComponent(subject || "").trim();
  const cleanTpId = decodeURIComponent(tpId || "").trim();
  const db = await readDB();

  if (!db.tujuan_pembelajaran_templates) {
    db.tujuan_pembelajaran_templates = {};
  }
  if (!Array.isArray(db.deleted_tps)) {
    db.deleted_tps = [];
  }

  // 1. Blacklist this TP ID so it can never be auto-recovered
  if (cleanTpId && !db.deleted_tps.includes(cleanTpId)) {
    db.deleted_tps.push(cleanTpId);
  }

  // 2. Remove from all keys in tujuan_pembelajaran_templates
  let deletedCount = 0;
  for (const k of Object.keys(db.tujuan_pembelajaran_templates)) {
    if (Array.isArray(db.tujuan_pembelajaran_templates[k])) {
      const origLen = db.tujuan_pembelajaran_templates[k].length;
      db.tujuan_pembelajaran_templates[k] = db.tujuan_pembelajaran_templates[k].filter(
        (tp: any) => String(tp.id).trim() !== cleanTpId
      );
      if (db.tujuan_pembelajaran_templates[k].length < origLen) {
        deletedCount++;
      }
    }
  }

  // 3. Purge deleted TP from all student grade records so grades can't resurrect it
  if (Array.isArray(db.grades)) {
    db.grades.forEach((g: any) => {
      if (Array.isArray(g.tps)) {
        g.tps = g.tps.filter((tp: any) => String(tp.id).trim() !== cleanTpId);
      }
    });
  }

  await writeDB(db);

  // 4. Clean up Firestore
  if (firestoreDb && cleanTpId) {
    try {
      const snap = await getDocs(collection(firestoreDb, "tujuan_pembelajaran_templates"));
      if (snap && !snap.empty) {
        for (const docItem of snap.docs) {
          const tpsList = docItem.data().tps;
          if (Array.isArray(tpsList) && tpsList.some((tp: any) => String(tp.id).trim() === cleanTpId)) {
            const filtered = tpsList.filter((tp: any) => String(tp.id).trim() !== cleanTpId);
            await setDoc(doc(firestoreDb, "tujuan_pembelajaran_templates", docItem.id), {
              tps: filtered,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        }
      }
    } catch (e) {
      console.warn("[Firestore TP] Error deleting TP in Firestore:", e);
    }
  }

  res.json({ message: "TP berhasil dihapus.", deleted: deletedCount > 0 });
};

app.delete("/api/tps/:subject/:tpId", deleteTpHandler);
app.delete("/api/tp/:subject/:tpId", deleteTpHandler);
app.delete("/api/tps/:tpId", deleteTpHandler);
app.delete("/api/tp/:tpId", deleteTpHandler);

// 6.5. School Settings API (Principal, NIP & Raport Format config)
app.get("/api/settings", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const db = await readDB();
  const principalName =
    db.settings?.principalName || "Sobariyani, S.Pd.";
  const principalNip =
    db.settings?.principalNip !== undefined
      ? db.settings.principalNip
      : "19800101 200501 1 003";
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
    signaturePosition: "kanan",
    watermarkSize: 440,
    watermarkOpacity: 0.05,
    ...(db.settings?.format || {}),
  };
  res.json({ principalName, principalNip, format, settings: { principalName, principalNip, format } });
});

app.post("/api/settings", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const { principalName, principalNip, format } = req.body;
  const db = await readDB();
  if (!db.settings) {
    db.settings = {};
  }
  
  // Only update principalName and principalNip if explicitly provided as non-empty/valid values
  if (principalName !== undefined && typeof principalName === "string" && principalName.trim() !== "") {
    db.settings.principalName = principalName.trim();
  }
  if (principalNip !== undefined && typeof principalNip === "string") {
    db.settings.principalNip = principalNip.trim();
  }

  if (format && typeof format === "object") {
    db.settings.format = {
      ...(db.settings.format || {}),
      ...format,
      semesterName: format.semesterName || db.settings.format?.semesterName || "Ganjil",
      tahunPelajaran: format.tahunPelajaran || db.settings.format?.tahunPelajaran || "2026/2027",
      fontSize: format.fontSize || db.settings.format?.fontSize || "11pt",
      showLogo: format.showLogo !== undefined ? format.showLogo : (db.settings.format?.showLogo || false),
      showSpiritual:
        format.showSpiritual !== undefined ? format.showSpiritual : (db.settings.format?.showSpiritual ?? true),
      showSosial: format.showSosial !== undefined ? format.showSosial : (db.settings.format?.showSosial ?? true),
      showAttendance:
        format.showAttendance !== undefined ? format.showAttendance : (db.settings.format?.showAttendance ?? true),
      showCatatan: format.showCatatan !== undefined ? format.showCatatan : (db.settings.format?.showCatatan ?? true),
      fontFamily: format.fontFamily || db.settings.format?.fontFamily || "Times New Roman",
      paperSize: format.paperSize || db.settings.format?.paperSize || "A4",
      tanggalRaport: format.tanggalRaport || db.settings.format?.tanggalRaport || "17 Juni 2026",
      signaturePosition: format.signaturePosition || db.settings.format?.signaturePosition || "kanan",
      watermarkSize:
        format.watermarkSize !== undefined ? format.watermarkSize : (db.settings.format?.watermarkSize ?? 440),
      watermarkOpacity:
        format.watermarkOpacity !== undefined ? format.watermarkOpacity : (db.settings.format?.watermarkOpacity ?? 0.05),
    };
  }

  await writeDB(db);

  // Sync to Firestore immediately
  if (firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "settings", "app"), {
        principalName: db.settings.principalName,
        principalNip: db.settings.principalNip,
        format: db.settings.format,
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore settings update error:", e);
    }
  }

  res.json({ success: true, settings: db.settings, principalName: db.settings.principalName, principalNip: db.settings.principalNip, format: db.settings.format });
});

// Force Real-time Cloud Firestore Re-sync Endpoint
app.post("/api/sync-database", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const result = await syncDatabaseWithFirestore();
  res.json(result);
});

app.get("/api/sync-database", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const result = await syncDatabaseWithFirestore();
  res.json(result);
});

// 6.6. Extracurricular List API
app.get("/api/ekskul", async (req, res) => {
  const db = await readDB();
  const defaultEkskul = [
    { id: "e1", name: "Pramuka Siaga & Penggalang", type: "Wajib" },
    { id: "e2", name: "Mentoring", type: "Wajib" },
    { id: "e3", name: "Futsal Kids", type: "Pilihan" },
    { id: "e4", name: "Bulu Tangkis", type: "Pilihan" },
    { id: "e5", name: "Panahan Tradisional", type: "Pilihan" },
    { id: "e6", name: "Klub Sains & Matematika Cilik", type: "Pilihan" },
  ];
  if (!Array.isArray(db.ekskul) || db.ekskul.length === 0) {
    db.ekskul = defaultEkskul;
    await writeDB(db);
  }

  // Enrich each ekskul with assigned teacher if available
  const enriched = db.ekskul.map((e: any) => {
    const assignedTeacher = Array.isArray(db.teachers)
      ? db.teachers.find(
          (t: any) =>
            t.isEkskulTeacher &&
            t.ekskulName &&
            t.ekskulName.toLowerCase() === e.name.toLowerCase(),
        )
      : null;

    return {
      ...e,
      teacherId: assignedTeacher ? assignedTeacher.id : (e.teacherId || ""),
      teacherName: assignedTeacher ? assignedTeacher.name : (e.teacherName || ""),
    };
  });

  res.json(enriched);
});

app.post("/api/ekskul", async (req, res) => {
  const { name, type, teacherId } = req.body;
  const trimmedName = String(name || "").trim();
  if (!trimmedName || !type) {
    return res.status(400).json({ error: "Nama dan tipe ekskul wajib diisi." });
  }
  const db = await readDB();
  if (!Array.isArray(db.ekskul)) {
    db.ekskul = [];
  }
  if (!Array.isArray(db.teachers)) {
    db.teachers = [];
  }

  // Check if ekskul with exact same name exists
  const existingIdx = db.ekskul.findIndex(
    (e: any) => e.name.toLowerCase().trim() === trimmedName.toLowerCase().trim()
  );

  let targetEkskul: any;

  if (existingIdx !== -1) {
    // Update existing ekskul
    targetEkskul = db.ekskul[existingIdx];
    targetEkskul.name = trimmedName;
    targetEkskul.type = type === "Wajib" ? "Wajib" : "Pilihan";
  } else {
    // Create new ekskul
    targetEkskul = {
      id: "e_" + Date.now(),
      name: trimmedName,
      type: type === "Wajib" ? "Wajib" : "Pilihan",
      teacherId: "",
      teacherName: "",
    };
    db.ekskul.push(targetEkskul);
  }

  const oldTeacherId = targetEkskul.teacherId;

  let assignedTeacherName = "";
  if (teacherId) {
    const tIdx = db.teachers.findIndex((t: any) => String(t.id) === String(teacherId));
    if (tIdx !== -1) {
      assignedTeacherName = db.teachers[tIdx].name;
      db.teachers[tIdx].isEkskulTeacher = true;
      if (!Array.isArray(db.teachers[tIdx].ekskulNames)) {
        db.teachers[tIdx].ekskulNames = db.teachers[tIdx].ekskulName
          ? String(db.teachers[tIdx].ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)
          : [];
      }
      if (!db.teachers[tIdx].ekskulNames.includes(targetEkskul.name)) {
        db.teachers[tIdx].ekskulNames.push(targetEkskul.name);
      }
      db.teachers[tIdx].ekskulName = db.teachers[tIdx].ekskulNames.join(", ");
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "teachers", String(db.teachers[tIdx].id)), db.teachers[tIdx], { merge: true });
        } catch (e) {
          console.warn("Firestore teacher sync error:", e);
        }
      }
    }
  }

  // Clear previous teacher if changed
  if (oldTeacherId && String(oldTeacherId) !== String(teacherId)) {
    const prevTIdx = db.teachers.findIndex((t: any) => String(t.id) === String(oldTeacherId));
    if (prevTIdx !== -1) {
      const remainingEkskuls = db.ekskul.filter(
        (e: any) => String(e.id) !== String(targetEkskul.id) && String(e.teacherId) === String(oldTeacherId)
      );
      if (remainingEkskuls.length > 0) {
        db.teachers[prevTIdx].isEkskulTeacher = true;
        db.teachers[prevTIdx].ekskulNames = remainingEkskuls.map((e: any) => e.name);
        db.teachers[prevTIdx].ekskulName = db.teachers[prevTIdx].ekskulNames.join(", ");
      } else {
        db.teachers[prevTIdx].isEkskulTeacher = false;
        db.teachers[prevTIdx].ekskulNames = [];
        db.teachers[prevTIdx].ekskulName = "";
      }
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "teachers", String(db.teachers[prevTIdx].id)), db.teachers[prevTIdx], { merge: true });
        } catch (e) {
          console.warn("Firestore prev teacher sync error:", e);
        }
      }
    }
  }

  targetEkskul.teacherId = teacherId || "";
  targetEkskul.teacherName = assignedTeacherName;

  await writeDB(db);
  res.status(existingIdx !== -1 ? 200 : 201).json(targetEkskul);
});

app.put("/api/ekskul/:id", async (req, res) => {
  const { id } = req.params;
  const { name, type, teacherId, onlyRename } = req.body;
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    return res.status(400).json({ error: "Nama ekskul wajib diisi." });
  }
  const db = await readDB();
  if (!Array.isArray(db.ekskul)) {
    db.ekskul = [];
  }
  if (!Array.isArray(db.teachers)) {
    db.teachers = [];
  }
  const idx = db.ekskul.findIndex((e: any) => e.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Ekstrakurikuler tidak ditemukan." });
  }

  const oldName = String(db.ekskul[idx].name || "").trim();
  const oldTeacherId = db.ekskul[idx].teacherId || "";
  const effectiveType = onlyRename || !type ? (db.ekskul[idx].type || "Pilihan") : (type === "Wajib" ? "Wajib" : "Pilihan");
  const effectiveTeacherId = (onlyRename || teacherId === undefined) ? oldTeacherId : (teacherId || "");

  let assignedTeacherName = db.ekskul[idx].teacherName || "";
  if (effectiveTeacherId) {
    const tIdx = db.teachers.findIndex((t: any) => String(t.id) === String(effectiveTeacherId));
    if (tIdx !== -1) {
      assignedTeacherName = db.teachers[tIdx].name;
      db.teachers[tIdx].isEkskulTeacher = true;
      if (!Array.isArray(db.teachers[tIdx].ekskulNames)) {
        db.teachers[tIdx].ekskulNames = db.teachers[tIdx].ekskulName
          ? String(db.teachers[tIdx].ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)
          : [];
      }
      if (oldName && oldName !== trimmedName) {
        db.teachers[tIdx].ekskulNames = db.teachers[tIdx].ekskulNames.map((n: string) =>
          n.trim().toLowerCase() === oldName.toLowerCase() ? trimmedName : n
        );
      }
      if (!db.teachers[tIdx].ekskulNames.some((n: string) => n.trim().toLowerCase() === trimmedName.toLowerCase())) {
        db.teachers[tIdx].ekskulNames.push(trimmedName);
      }
      db.teachers[tIdx].ekskulName = db.teachers[tIdx].ekskulNames.join(", ");
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "teachers", String(db.teachers[tIdx].id)), db.teachers[tIdx], { merge: true });
        } catch (e) {
          console.warn("Firestore teacher sync error:", e);
        }
      }
    }
  } else if (!onlyRename && teacherId !== undefined) {
    assignedTeacherName = "";
  }

  // If previous teacher was explicitly replaced (not during a simple rename)
  if (!onlyRename && teacherId !== undefined && oldTeacherId && String(oldTeacherId) !== String(effectiveTeacherId)) {
    const prevTIdx = db.teachers.findIndex((t: any) => String(t.id) === String(oldTeacherId));
    if (prevTIdx !== -1) {
      const remainingEkskuls = db.ekskul.filter(
        (e: any) => String(e.id) !== String(id) && String(e.teacherId) === String(oldTeacherId)
      );
      if (remainingEkskuls.length > 0) {
        db.teachers[prevTIdx].isEkskulTeacher = true;
        db.teachers[prevTIdx].ekskulNames = remainingEkskuls.map((e: any) => e.name);
        db.teachers[prevTIdx].ekskulName = db.teachers[prevTIdx].ekskulNames.join(", ");
      } else {
        db.teachers[prevTIdx].isEkskulTeacher = false;
        db.teachers[prevTIdx].ekskulNames = [];
        db.teachers[prevTIdx].ekskulName = "";
      }
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "teachers", String(db.teachers[prevTIdx].id)), db.teachers[prevTIdx], { merge: true });
        } catch (e) {
          console.warn("Firestore prev teacher sync error:", e);
        }
      }
    }
  }

  // Synchronize all existing data (teachers, student ekskul grades/descriptions, TP templates) if name changed
  if (oldName && oldName !== trimmedName) {
    const lowerOld = oldName.toLowerCase();

    // 1. Update any teachers who have this ekskul in their ekskulNames / ekskulName
    for (const t of db.teachers) {
      let teacherModified = false;
      if (Array.isArray(t.ekskulNames)) {
        const hasOld = t.ekskulNames.some((n: string) => String(n || "").trim().toLowerCase() === lowerOld);
        if (hasOld) {
          t.ekskulNames = Array.from(
            new Set(
              t.ekskulNames.map((n: string) =>
                String(n || "").trim().toLowerCase() === lowerOld ? trimmedName : String(n || "").trim()
              ).filter(Boolean)
            )
          );
          t.ekskulName = t.ekskulNames.join(", ");
          teacherModified = true;
        }
      } else if (t.ekskulName && String(t.ekskulName).toLowerCase().includes(lowerOld)) {
        const parts = String(t.ekskulName)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((s: string) => (s.toLowerCase() === lowerOld ? trimmedName : s));
        t.ekskulNames = Array.from(new Set(parts));
        t.ekskulName = t.ekskulNames.join(", ");
        teacherModified = true;
      }
      if (teacherModified && firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "teachers", String(t.id)), t, { merge: true });
        } catch (e) {
          console.warn("Firestore teacher rename sync error:", e);
        }
      }
    }

    // 2. Preserve & migrate student ekskul grades and descriptions in walikelas_notes
    if (db.walikelas_notes && typeof db.walikelas_notes === "object") {
      for (const [sId, noteObj] of Object.entries(db.walikelas_notes)) {
        const note = noteObj as any;
        if (note && Array.isArray(note.ekskul)) {
          let noteModified = false;
          note.ekskul = note.ekskul.map((eks: any) => {
            if (eks && String(eks.name || "").trim().toLowerCase() === lowerOld) {
              noteModified = true;
              return { ...eks, name: trimmedName };
            }
            return eks;
          });
          if (noteModified && firestoreDb) {
            try {
              await setDoc(doc(firestoreDb, "walikelas_notes", String(sId)), note, { merge: true });
            } catch (e) {
              console.warn("Firestore walikelas_notes rename sync error:", e);
            }
          }
        }
      }
    }

    // 3. Preserve & migrate ekskul TP templates in tps_templates
    if (db.tps_templates && typeof db.tps_templates === "object") {
      const tpKeys = Object.keys(db.tps_templates);
      for (const k of tpKeys) {
        const kTrim = k.trim();
        const kLower = kTrim.toLowerCase();
        if (kLower === lowerOld || kLower === `ekskul ${lowerOld}`) {
          const isPrefixed = kLower.startsWith("ekskul ");
          const newKey = isPrefixed ? `Ekskul ${trimmedName}` : trimmedName;
          const existingOldList = Array.isArray(db.tps_templates[k]) ? db.tps_templates[k] : [];
          const existingNewList = Array.isArray(db.tps_templates[newKey]) ? db.tps_templates[newKey] : [];
          const mergedMap = new Map<string, any>();
          [...existingNewList, ...existingOldList].forEach((tp: any) => {
            if (tp && tp.id) mergedMap.set(String(tp.id), tp);
          });
          db.tps_templates[newKey] = Array.from(mergedMap.values());
          if (firestoreDb) {
            try {
              await setDoc(doc(firestoreDb, "tps_templates", newKey), { subject: newKey, tps: db.tps_templates[newKey] }, { merge: true });
            } catch (e) {
              console.warn("Firestore tps_templates rename sync error:", e);
            }
          }
        }
      }
    }
  }

  db.ekskul[idx] = {
    ...db.ekskul[idx],
    name: trimmedName,
    type: effectiveType,
    teacherId: effectiveTeacherId,
    teacherName: assignedTeacherName,
  };

  await writeDB(db);
  if (firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "ekskul", String(id)), db.ekskul[idx], { merge: true });
    } catch (e) {
      console.warn("Firestore ekskul sync error:", e);
    }
  }
  res.json(db.ekskul[idx]);
});

// Quick assignment endpoint
app.post("/api/ekskul/:id/assign-teacher", async (req, res) => {
  const { id } = req.params;
  const { teacherId } = req.body;
  const db = await readDB();
  if (!Array.isArray(db.ekskul)) {
    db.ekskul = [];
  }
  if (!Array.isArray(db.teachers)) {
    db.teachers = [];
  }
  const idx = db.ekskul.findIndex((e: any) => e.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Ekstrakurikuler tidak ditemukan." });
  }

  const ekskul = db.ekskul[idx];
  const oldTeacherId = ekskul.teacherId;

  let assignedTeacherName = "";
  if (teacherId) {
    const tIdx = db.teachers.findIndex((t: any) => String(t.id) === String(teacherId));
    if (tIdx !== -1) {
      assignedTeacherName = db.teachers[tIdx].name;
      db.teachers[tIdx].isEkskulTeacher = true;
      if (!Array.isArray(db.teachers[tIdx].ekskulNames)) {
        db.teachers[tIdx].ekskulNames = db.teachers[tIdx].ekskulName
          ? db.teachers[tIdx].ekskulName.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
      }
      if (!db.teachers[tIdx].ekskulNames.includes(ekskul.name)) {
        db.teachers[tIdx].ekskulNames.push(ekskul.name);
      }
      db.teachers[tIdx].ekskulName = db.teachers[tIdx].ekskulNames.join(", ");
    }
  }

  // Update previous teacher if changed
  if (oldTeacherId && String(oldTeacherId) !== String(teacherId)) {
    const prevTIdx = db.teachers.findIndex((t: any) => String(t.id) === String(oldTeacherId));
    if (prevTIdx !== -1) {
      const remainingEkskuls = db.ekskul.filter(
        (e: any) => String(e.id) !== String(id) && String(e.teacherId) === String(oldTeacherId)
      );
      if (remainingEkskuls.length > 0) {
        db.teachers[prevTIdx].isEkskulTeacher = true;
        db.teachers[prevTIdx].ekskulNames = remainingEkskuls.map((e: any) => e.name);
        db.teachers[prevTIdx].ekskulName = db.teachers[prevTIdx].ekskulNames.join(", ");
      } else {
        db.teachers[prevTIdx].isEkskulTeacher = false;
        db.teachers[prevTIdx].ekskulNames = [];
        db.teachers[prevTIdx].ekskulName = "";
      }
    }
  }

  db.ekskul[idx].teacherId = teacherId || "";
  db.ekskul[idx].teacherName = assignedTeacherName;

  await writeDB(db);
  res.json({ ekskul: db.ekskul[idx], teachers: db.teachers });
});

app.delete("/api/ekskul/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDB();
  if (Array.isArray(db.ekskul)) {
    const target = db.ekskul.find((e: any) => e.id === id);
    if (target && target.teacherId) {
      const tIdx = Array.isArray(db.teachers) ? db.teachers.findIndex((t: any) => String(t.id) === String(target.teacherId)) : -1;
      if (tIdx !== -1) {
        const remainingEkskuls = db.ekskul.filter(
          (e: any) => String(e.id) !== String(id) && String(e.teacherId) === String(target.teacherId)
        );
        if (remainingEkskuls.length > 0) {
          db.teachers[tIdx].isEkskulTeacher = true;
          db.teachers[tIdx].ekskulNames = remainingEkskuls.map((e: any) => e.name);
          db.teachers[tIdx].ekskulName = db.teachers[tIdx].ekskulNames.join(", ");
        } else {
          db.teachers[tIdx].isEkskulTeacher = false;
          db.teachers[tIdx].ekskulNames = [];
          db.teachers[tIdx].ekskulName = "";
        }
        if (firestoreDb) {
          try {
            await setDoc(doc(firestoreDb, "teachers", String(db.teachers[tIdx].id)), db.teachers[tIdx], { merge: true });
          } catch (e) {
            console.warn("Firestore delete ekskul teacher sync error:", e);
          }
        }
      }
    }
    db.ekskul = db.ekskul.filter((e: any) => e.id !== id);
    await writeDB(db);
  }
  res.json({ message: "Ekskul berhasil dihapus." });
});

// 6.6.1 Ekskul Grades API
app.get("/api/ekskul/grades", async (req, res) => {
  const db = await readDB();
  const rawNotes = db.walikelas_notes || {};
  const cleanedNotes: Record<string, any> = {};
  for (const [sId, noteObj] of Object.entries(rawNotes)) {
    const note = noteObj as any;
    if (!note || typeof note !== "object") continue;
    cleanedNotes[sId] = {
      ...note,
      ekskul: deduplicateStudentEkskuls(note.ekskul, note.deletedEkskuls, db.ekskul),
    };
  }
  res.json(cleanedNotes);
});

app.post("/api/ekskul/grades", async (req, res) => {
  const { studentId, ekskulName, type, usaha, proses, capaian, predicate, description, deskripsi } = req.body;
  if (!studentId || !ekskulName) {
    return res.status(400).json({ error: "ID Siswa dan Nama Ekskul wajib diisi." });
  }

  const db = await readDB();
  if (!db.walikelas_notes) {
    db.walikelas_notes = {};
  }
  if (!db.walikelas_notes[studentId]) {
    db.walikelas_notes[studentId] = {
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
      sosialDeskripsi: "",
      ekskul: [],
      deletedEkskuls: [],
    };
  }
  if (!Array.isArray(db.walikelas_notes[studentId].ekskul)) {
    db.walikelas_notes[studentId].ekskul = [];
  }

  const normTarget = normalizeEkskulKey(ekskulName);

  // If this ekskul was previously unchecked/deleted, un-delete it since coach is saving it now
  if (Array.isArray(db.walikelas_notes[studentId].deletedEkskuls)) {
    db.walikelas_notes[studentId].deletedEkskuls = db.walikelas_notes[studentId].deletedEkskuls.filter(
      (d: string) =>
        String(d || "").toLowerCase().trim() !== String(ekskulName).toLowerCase().trim() &&
        normalizeEkskulKey(d) !== normTarget
    );
  }

  const existingIdx = db.walikelas_notes[studentId].ekskul.findIndex((e: any) => {
    if (!e) return false;
    const eName = e.name || e.ekskulName || "";
    if (eName === ekskulName) return true;
    const eNorm = normalizeEkskulKey(eName);
    return eNorm && normTarget && eNorm === normTarget;
  });

  const finalCapaian = capaian || predicate || "B";
  const ekskulEntry = {
    name: ekskulName,
    type: type || "Pilihan",
    usaha: usaha || "B",
    proses: proses || "B",
    capaian: finalCapaian,
    predicate: finalCapaian,
    description: description || deskripsi || "",
    tpAchievements: req.body.tpAchievements || {},
  };

  if (existingIdx >= 0) {
    db.walikelas_notes[studentId].ekskul[existingIdx] = ekskulEntry;
  } else {
    db.walikelas_notes[studentId].ekskul.push(ekskulEntry);
  }

  db.walikelas_notes[studentId].ekskul = deduplicateStudentEkskuls(
    db.walikelas_notes[studentId].ekskul,
    db.walikelas_notes[studentId].deletedEkskuls,
    db.ekskul
  );

  await writeDB(db);

  // CRITICAL: Only sync ekskul & deletedEkskuls fields to Firestore so coach saves NEVER overwrite spiritualDeskripsi / sosialDeskripsi!
  if (firestoreDb) {
    try {
      await setDoc(
        doc(firestoreDb, "walikelas_notes", String(studentId)),
        {
          ekskul: db.walikelas_notes[studentId].ekskul,
          deletedEkskuls: db.walikelas_notes[studentId].deletedEkskuls || [],
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Firestore ekskul grades sync error:", e);
    }
  }

  res.json({ success: true, studentId, ekskul: db.walikelas_notes[studentId].ekskul });
});

// Delete / Uncheck an Ekskul from a specific student
const handleDeleteStudentEkskul = async (req: any, res: any) => {
  const { studentId, ekskulName } = req.body || {};
  if (!studentId || !ekskulName) {
    return res.status(400).json({ error: "ID Siswa dan Nama Ekskul wajib diisi." });
  }

  const db = await readDB();
  if (!db.walikelas_notes) db.walikelas_notes = {};
  if (!db.walikelas_notes[studentId]) {
    return res.json({ success: true, studentId, ekskul: [] });
  }

  const normTarget = normalizeEkskulKey(ekskulName);
  const rawTarget = String(ekskulName).toLowerCase().trim();

  const currentDeleted = Array.isArray(db.walikelas_notes[studentId].deletedEkskuls)
    ? db.walikelas_notes[studentId].deletedEkskuls
    : [];
  const updatedDeleted = Array.from(new Set([...currentDeleted, rawTarget, ...(normTarget ? [normTarget] : [])]));

  const currentEkskuls = Array.isArray(db.walikelas_notes[studentId].ekskul)
    ? db.walikelas_notes[studentId].ekskul
    : [];
  const filteredEkskuls = currentEkskuls.filter((e: any) => {
    if (!e) return false;
    const eName = String(e.name || e.ekskulName || "").toLowerCase().trim();
    const eNorm = normalizeEkskulKey(eName);
    if (eName === rawTarget) return false;
    if (normTarget && eNorm === normTarget) return false;
    return true;
  });

  db.walikelas_notes[studentId].deletedEkskuls = updatedDeleted;
  db.walikelas_notes[studentId].ekskul = deduplicateStudentEkskuls(filteredEkskuls, updatedDeleted, db.ekskul);

  await writeDB(db);

  if (firestoreDb) {
    try {
      await setDoc(
        doc(firestoreDb, "walikelas_notes", String(studentId)),
        {
          ekskul: db.walikelas_notes[studentId].ekskul,
          deletedEkskuls: updatedDeleted,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Firestore delete student ekskul sync error:", e);
    }
  }

  res.json({
    success: true,
    studentId,
    ekskul: db.walikelas_notes[studentId].ekskul,
    deletedEkskuls: updatedDeleted,
  });
};

app.post("/api/ekskul/grades/delete", handleDeleteStudentEkskul);
app.delete("/api/ekskul/grades", handleDeleteStudentEkskul);

// 6.7. Subjects (Mata Pelajaran) API
const DEFAULT_SUBJECTS = [
  "PAI",
  "PPKN",
  "Bahasa Indonesia",
  "Matematika",
  "IPAS",
  "PJOK",
  "Seni Budaya",
  "Prakarya",
  "Bahasa Arab",
  "Bahasa Inggris",
  "TIK",
  "Life Skill",
  "Tahsin ABaTaTsa",
  "Tahfizh Al-Qur’an",
  "Do’a Harian dan Hadits",
  "Wudhu dan Sholat",
  "Sirah Nabawiyah",
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
    const normSub = normalizeSubjectKey(sub);
    const filledGradesForSub = db.grades.filter(
      (g: any) =>
        (g.subject === sub || normalizeSubjectKey(g.subject) === normSub) &&
        registeredStudentIds.has(g.studentId) &&
        ((g.score !== undefined && g.score !== null && g.score !== "") ||
          (g.deskripsi && String(g.deskripsi).trim() !== "") ||
          (Array.isArray(g.tps) && g.tps.length > 0))
    );
    const completedCount = filledGradesForSub.length;
    const percentage =
      totalStudents > 0
        ? Math.round((completedCount / totalStudents) * 100)
        : 0;

    // Find active teacher for this subject
    const teacher = db.teachers.find((t: any) => {
      const subs = extractTeacherSubjects(t);
      if (subs.some((s: string) => s === sub || normalizeSubjectKey(s) === normSub)) return true;
      if (t.subject === sub || normalizeSubjectKey(t.subject) === normSub) return true;
      return false;
    });

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
    else if (averageScore >= 89) predikat = "A (Sangat Baik)";
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
