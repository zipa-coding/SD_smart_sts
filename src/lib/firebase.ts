import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
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
import { normalizeSubjectKey, getSubjectTps, matchTpClass, isSampleTp, cleanTpList, isKeislamanSubject, extractTeacherSubjects } from "../types";

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

// Dummy sample teachers (wali kelas 1-6) that must NEVER appear in teacher management
export const DUMMY_TEACHER_IDS = ['t2', 't3', 't4', 't5', 't6', 't7'];
export const DUMMY_TEACHER_USERNAMES = ['fatimah', 'ahmad', 'lukman', 'khadijah', 'yusuf', 'aisyah'];

export function isDummyTeacher(t: any): boolean {
  if (!t) return false;
  const id = String(t.id || '').toLowerCase().trim();
  const user = String(t.username || t.user || '').toLowerCase().trim();
  const name = String(t.name || t.nama || t.namaGuru || t.nama_lengkap || '').toLowerCase().trim();

  if (DUMMY_TEACHER_IDS.includes(id)) return true;
  if (DUMMY_TEACHER_USERNAMES.includes(user)) return true;
  if (
    name.includes('ustadzah fatimah') ||
    name.includes('ustadz ahmad') ||
    name.includes('ustadz lukman') ||
    name.includes('ustadzah khadijah') ||
    name.includes('ustadz yusuf') ||
    name.includes('ustadzah aisyah')
  ) {
    return true;
  }
  return false;
}

// Helpers to guarantee data is NEVER lost and immediately persists
export function getLocalFallbackData() {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem("smart_sts_db");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          let updated = false;
          if (Array.isArray(parsed.ekskul)) {
            parsed.ekskul.forEach((e: any) => {
              if (e.name === "Futsal Kids") {
                e.name = "Futsal";
                updated = true;
              }
            });
          }
          if (Array.isArray(parsed.teachers)) {
            const prevLen = parsed.teachers.length;
            parsed.teachers = parsed.teachers.filter((t: any) => !isDummyTeacher(t));
            if (parsed.teachers.length !== prevLen) {
              updated = true;
            }
            parsed.teachers.forEach((t: any) => {
              if (t.ekskulName === "Futsal Kids") {
                t.ekskulName = "Futsal";
                updated = true;
              }
            });
          }
          if (parsed.tujuan_pembelajaran_templates && typeof parsed.tujuan_pembelajaran_templates === 'object') {
            for (const key of Object.keys(parsed.tujuan_pembelajaran_templates)) {
              if (Array.isArray(parsed.tujuan_pembelajaran_templates[key])) {
                const prevLen = parsed.tujuan_pembelajaran_templates[key].length;
                parsed.tujuan_pembelajaran_templates[key] = cleanTpList(parsed.tujuan_pembelajaran_templates[key]);
                if (parsed.tujuan_pembelajaran_templates[key].length !== prevLen) {
                  updated = true;
                }
              }
            }
          } else {
            parsed.tujuan_pembelajaran_templates = {};
            updated = true;
          }
          if (Array.isArray(parsed.grades)) {
            parsed.grades.forEach((g: any) => {
              if (Array.isArray(g.tps) && g.tps.length > 0) {
                const filtered = cleanTpList(g.tps);
                if (filtered.length !== g.tps.length) {
                  g.tps = filtered;
                  updated = true;
                }
              }
            });
          }
          if (updated) {
            localStorage.setItem("smart_sts_db", JSON.stringify(parsed));
          }
          return parsed;
        }
      }
    }
  } catch (e) {}
  return dbDataAny;
}

export function getDeletedSet(key: string): Set<string> {
  const set = new Set<string>();
  if (key === 'teachers') {
    DUMMY_TEACHER_IDS.forEach((id) => set.add(id));
    DUMMY_TEACHER_USERNAMES.forEach((u) => set.add(u));
  }
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`smart_sts_deleted_${key}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) arr.forEach((x) => set.add(String(x)));
      }
    }
  } catch (e) {}
  return set;
}

export function recordDeletedId(key: string, id: string | string[]) {
  try {
    if (typeof window === 'undefined') return;
    const set = getDeletedSet(key);
    const ids = Array.isArray(id) ? id : [id];
    ids.forEach(i => { if (i) set.add(String(i).trim()); });
    localStorage.setItem(`smart_sts_deleted_${key}`, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function unmarkDeletedId(key: string, id: string | string[]) {
  try {
    if (typeof window === 'undefined') return;
    const set = getDeletedSet(key);
    const ids = Array.isArray(id) ? id : [id];
    ids.forEach(i => { if (i) set.delete(String(i).trim()); });
    localStorage.setItem(`smart_sts_deleted_${key}`, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function updateLocalFallbackItem(collectionName: 'students' | 'teachers' | 'grades' | 'ekskul', item: any, idKey: string = 'id') {
  try {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem("smart_sts_db");
    const dbObj = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(dbDataAny));
    if (!dbObj[collectionName]) dbObj[collectionName] = [];
    
    let idx = -1;
    if (collectionName === 'grades') {
      const normSub = normalizeSubjectKey(item.subject);
      idx = dbObj.grades.findIndex((x: any) =>
        x &&
        x.studentId === item.studentId &&
        (x.subject === item.subject || normalizeSubjectKey(x.subject) === normSub || String(x[idKey]) === String(item[idKey]))
      );
    } else {
      idx = dbObj[collectionName].findIndex((x: any) => String(x[idKey]) === String(item[idKey]));
    }

    if (idx >= 0) {
      dbObj[collectionName][idx] = { ...dbObj[collectionName][idx], ...item };
    } else {
      dbObj[collectionName].push(item);
    }
    localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
  } catch (e) {
    console.warn("Failed to update local storage item:", e);
  }
}

export function deleteLocalFallbackItem(collectionName: 'students' | 'teachers' | 'grades' | 'ekskul', id: string, idKey: string = 'id') {
  try {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem("smart_sts_db");
    if (!raw) return;
    const dbObj = JSON.parse(raw);
    if (!dbObj[collectionName]) return;
    dbObj[collectionName] = dbObj[collectionName].filter((x: any) => String(x[idKey]) !== String(id));
    
    // Cascading clean up for students
    if (collectionName === 'students') {
      if (Array.isArray(dbObj.grades)) {
        dbObj.grades = dbObj.grades.filter((g: any) => String(g.studentId) !== String(id));
      }
      if (dbObj.walikelas_notes && dbObj.walikelas_notes[id]) {
        delete dbObj.walikelas_notes[id];
      }
    }

    localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
  } catch (e) {}
}

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
    try {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      db = getFirestore(app);
    }
    console.log("Firebase initialized successfully with cloud Firestore.");
    
    // Automatically populate Firestore in real-time immediately on boot if empty
    seedFirestoreIfEmpty();
    // Schedule a quick retry in case security rules or network are initializing
    setTimeout(() => seedFirestoreIfEmpty(), 4000);
  } catch (error) {
    console.warn("Firebase initialization skipped or failed:", error);
  }
}

// Function to seed Firestore automatically in real-time if empty
export async function seedFirestoreIfEmpty() {
  try {
    if (!db) return;
    
    // Check if teachers collection already exists
    const teachersRef = collection(db, "teachers");
    const snapshot = await withTimeout(getDocs(teachersRef), 3500).catch(() => null);
    
    // If teachers collection exists and has documents, keep existing live data
    if (snapshot && !snapshot.empty) {
      console.log(`Firestore already has ${snapshot.size} teacher(s). Keeping live database records.`);
      return;
    }

    // Check alternative 'guru' collection
    const snapGuru = await withTimeout(getDocs(collection(db, "guru")), 2000).catch(() => null);
    if (snapGuru && !snapGuru.empty) {
      console.log("Existing 'guru' collection detected, keeping live records.");
      return;
    }

    console.log("⚡ Auto-seeding Cloud Firestore in real-time with initial website data...");
    
    // Get source data from localStorage if available, otherwise dbDataAny
    const sourceData = getLocalFallbackData();

    const writePromises: Promise<any>[] = [];

    // 1. Teachers
    for (const t of (sourceData.teachers || [])) {
      if (isDummyTeacher(t)) continue;
      writePromises.push(setDoc(doc(db, "teachers", t.id), t));
    }

    // 2. Students
    for (const s of (sourceData.students || [])) {
      writePromises.push(setDoc(doc(db, "students", s.id), s));
    }

    // 3. Grades
    for (const g of (sourceData.grades || [])) {
      const id = `${g.studentId}_${g.subject.replace(/[^a-zA-Z0-9]/g, "_")}`;
      writePromises.push(setDoc(doc(db, "grades", id), g));
    }

    // 4. Wali Kelas Notes
    if (sourceData.walikelas_notes) {
      for (const [studentId, note] of Object.entries(sourceData.walikelas_notes)) {
        writePromises.push(setDoc(doc(db, "walikelas_notes", studentId), note as any));
      }
    }

    // 5. TP Templates (Only sync genuine teacher/admin created TPs)
    if (sourceData.tujuan_pembelajaran_templates) {
      for (const [subject, tps] of Object.entries(sourceData.tujuan_pembelajaran_templates)) {
        const cleanList = cleanTpList(tps as any[]);
        if (cleanList.length > 0) {
          writePromises.push(setDoc(doc(db, "tujuan_pembelajaran_templates", subject), { tps: cleanList }));
        }
      }
    }

    // 6. Settings
    if (sourceData.settings) {
      writePromises.push(setDoc(doc(db, "settings", "app"), sourceData.settings));
    }

    // 7. Ekskul
    const defaultEkskul = sourceData.ekskul || [
      { id: "e1", name: "Pramuka", type: "Wajib" },
      { id: "e2", name: "Mentoring", type: "Wajib" },
      { id: "e3", name: "Futsal", type: "Pilihan" },
      { id: "e4", name: "Voli", type: "Pilihan" },
      { id: "e5", name: "Panahan", type: "Pilihan" },
      { id: "e6", name: "Study Club", type: "Pilihan" }
    ];
    for (const e of defaultEkskul) {
      writePromises.push(setDoc(doc(db, "ekskul", e.id), e));
    }

    // Execute in parallel batches
    const results = await Promise.allSettled(writePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    if (successful > 0) {
      console.log(`✅ Cloud Firestore is now populated in real-time with ${successful} website records.`);
    }
  } catch (error) {
    console.warn("Auto-seed Firestore error (will retry when online/rules published):", error);
  }
}

// Explicit sync function to populate/refresh Firestore from application dataset
export async function syncAllToFirestore(onProgress?: (msg: string) => void): Promise<{ success: boolean; message: string; counts?: any }> {
  if (!db) {
    throw new Error("Firebase Firestore belum terhubung. Periksa konfigurasi Firebase.");
  }

  // Get source data from localStorage if available, otherwise dbDataAny
  let sourceData = dbDataAny;
  try {
    const rawLocal = localStorage.getItem("smart_sts_db");
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed.teachers?.length || parsed.students?.length) {
        sourceData = parsed;
      }
    }
  } catch (e) {
    // fallback to dbDataAny
  }

  const counts = { teachers: 0, students: 0, grades: 0, tps: 0, notes: 0, ekskul: 0, settings: 1 };

  try {
    onProgress?.("Menyinkronkan data Guru...");
    for (const t of (sourceData.teachers || [])) {
      await withTimeout(setDoc(doc(db, "teachers", t.id), t), 6000);
      counts.teachers++;
    }

    onProgress?.(`Menyinkronkan ${sourceData.students?.length || 0} Siswa...`);
    for (const s of (sourceData.students || [])) {
      await withTimeout(setDoc(doc(db, "students", s.id), s), 6000);
      counts.students++;
    }

    onProgress?.(`Menyinkronkan ${sourceData.grades?.length || 0} Nilai...`);
    for (const g of (sourceData.grades || [])) {
      const docId = `${g.studentId}_${g.subject.replace(/[^a-zA-Z0-9]/g, "_")}`;
      await withTimeout(setDoc(doc(db, "grades", docId), g), 6000);
      counts.grades++;
    }

    onProgress?.("Menyinkronkan Catatan Wali Kelas...");
    if (sourceData.walikelas_notes) {
      for (const [studentId, note] of Object.entries(sourceData.walikelas_notes)) {
        await withTimeout(setDoc(doc(db, "walikelas_notes", studentId), note as any), 6000);
        counts.notes++;
      }
    }

    onProgress?.("Menyinkronkan Template Tujuan Pembelajaran (TP)...");
    if (sourceData.tujuan_pembelajaran_templates) {
      for (const [subject, tps] of Object.entries(sourceData.tujuan_pembelajaran_templates)) {
        const cleanList = cleanTpList(tps as any[]);
        if (cleanList.length > 0) {
          await withTimeout(setDoc(doc(db, "tujuan_pembelajaran_templates", subject), { tps: cleanList }), 6000);
          counts.tps += cleanList.length;
        }
      }
    }

    onProgress?.("Menyinkronkan Pengaturan Sekolah...");
    if (sourceData.settings) {
      await withTimeout(setDoc(doc(db, "settings", "app"), sourceData.settings), 6000);
    }

    onProgress?.("Menyinkronkan Ekstrakurikuler...");
    const ekskulList = sourceData.ekskul || [
      { id: "e1", name: "Pramuka", type: "Wajib" },
      { id: "e2", name: "Mentoring", type: "Wajib" },
      { id: "e3", name: "Futsal", type: "Pilihan" },
      { id: "e4", name: "Voli", type: "Pilihan" },
      { id: "e5", name: "Panahan", type: "Pilihan" },
      { id: "e6", name: "Study Club", type: "Pilihan" }
    ];
    for (const e of ekskulList) {
      await withTimeout(setDoc(doc(db, "ekskul", e.id), e), 6000);
      counts.ekskul++;
    }

    onProgress?.("Sinkronisasi Firestore berhasil!");
    return {
      success: true,
      message: `Berhasil menyinkronkan: ${counts.teachers} Guru, ${counts.students} Siswa, ${counts.grades} Nilai, ${counts.tps} Template TP, dan Pengaturan ke Firestore.`,
      counts
    };
  } catch (err: any) {
    console.error("Gagal sinkronisasi Firestore:", err);
    throw new Error(`Gagal menyinkronkan data ke Firestore: ${err.message || err}`);
  }
}

export async function getFirestoreStats(): Promise<{ connected: boolean; teacherCount: number; studentCount: number; gradeCount: number; projectId: string }> {
  if (!db) {
    return { connected: false, teacherCount: 0, studentCount: 0, gradeCount: 0, projectId: firebaseConfig.projectId };
  }
  try {
    const [tSnap, sSnap, gSnap] = await Promise.all([
      withTimeout(getDocs(collection(db, "teachers")), 4000).catch(() => ({ size: 0 })),
      withTimeout(getDocs(collection(db, "students")), 4000).catch(() => ({ size: 0 })),
      withTimeout(getDocs(collection(db, "grades")), 4000).catch(() => ({ size: 0 }))
    ]);
    return {
      connected: true,
      teacherCount: tSnap.size,
      studentCount: sSnap.size,
      gradeCount: gSnap.size,
      projectId: firebaseConfig.projectId
    };
  } catch (e) {
    return { connected: false, teacherCount: 0, studentCount: 0, gradeCount: 0, projectId: firebaseConfig.projectId };
  }
}

// Firestore operations matching API routes
export const firebaseApi = {
  syncAllToFirestore,
  getFirestoreStats,
  // 1. POST /api/login
  login: async (body: any) => {
    if (!db) return null;
    const { username, password } = body || {};
    if (!username) return null;

    const trimmedUser = String(username).trim();
    const cleanUser = trimmedUser.toLowerCase();
    const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normUser = normalize(username);

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
                const subs = Array.isArray(data.subjects) && data.subjects.length > 0
                  ? data.subjects
                  : (data.subject ? String(data.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean) : []);
                return {
                  id: docSnap.id,
                  name: data.name || data.nama || data.namaGuru || data.nama_lengkap || "Guru",
                  username: data.username || data.user || trimmedUser,
                  password: data.password || password,
                  subject: data.subject || data.mapel || data.mataPelajaran || data.mata_pelajaran || "Guru",
                  subjects: subs.length > 0 ? subs : [data.subject || "PAI"],
                  isWaliKelas: !!(data.isWaliKelas || data.waliKelas || data.is_wali_kelas || data.isWali),
                  kelas: data.kelas || data.rombel || data.class || "",
                  ...data
                };
              }
            }
          }

          // Check query by name
          const qName = query(collection(db, colName), where("name", "==", trimmedUser));
          const snapName = await withTimeout(getDocs(qName), 3000).catch(() => null);
          if (snapName && !snapName.empty) {
            for (const docSnap of snapName.docs) {
              const data = docSnap.data();
              if (data.password === password || (!data.password && password === "123")) {
                const subs = Array.isArray(data.subjects) && data.subjects.length > 0
                  ? data.subjects
                  : (data.subject ? String(data.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean) : []);
                return {
                  id: docSnap.id,
                  name: data.name || data.nama || data.namaGuru || data.nama_lengkap || "Guru",
                  username: data.username || data.user || trimmedUser,
                  password: data.password || password,
                  subject: data.subject || data.mapel || data.mataPelajaran || data.mata_pelajaran || "Guru",
                  subjects: subs.length > 0 ? subs : [data.subject || "PAI"],
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

          // Case-insensitive & alias fallback scan on the collection
          const allDocs = await withTimeout(getDocs(collection(db, colName)), 3000).catch(() => null);
          if (allDocs && !allDocs.empty) {
            for (const docSnap of allDocs.docs) {
              const data = docSnap.data();
              const passMatch = data.password === password || (!data.password && password === "123");
              if (!passMatch) continue;

              const docUser = String(data.username || data.user || '').trim().toLowerCase();
              const docName = String(data.name || data.nama || '').trim().toLowerCase();
              const aliases = Array.isArray(data.aliases) ? data.aliases : [];

              const isMatch =
                docUser === cleanUser ||
                docName === cleanUser ||
                (normUser && (normalize(docUser) === normUser || normalize(docName) === normUser)) ||
                aliases.some((a: string) => String(a).toLowerCase().trim() === cleanUser || (normUser && normalize(a) === normUser));

              if (isMatch) {
                const subs = Array.isArray(data.subjects) && data.subjects.length > 0
                  ? data.subjects
                  : (data.subject ? String(data.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean) : []);
                return {
                  id: docSnap.id,
                  name: data.name || data.nama || data.namaGuru || data.nama_lengkap || "Guru",
                  username: data.username || data.user || trimmedUser,
                  password: data.password || password,
                  subject: data.subject || data.mapel || data.mataPelajaran || data.mata_pelajaran || "Guru",
                  subjects: subs.length > 0 ? subs : [data.subject || "PAI"],
                  isWaliKelas: !!(data.isWaliKelas || data.waliKelas || data.is_wali_kelas || data.isWali),
                  kelas: data.kelas || data.rombel || data.class || "",
                  ...data
                };
              }
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
    const deleted = getDeletedSet('teachers');
    const fallback = (getLocalFallbackData().teachers || []).filter(
      (t: any) => !deleted.has(String(t.id)) && !deleted.has(String(t.username || ""))
    );
    if (!db) return fallback;
    const teacherCollections = ["teachers", "guru", "Teachers", "Guru", "data_guru", "dataGuru", "data_teachers", "DataGuru", "ustadz"];
    try {
      for (const colName of teacherCollections) {
        try {
          const snap = await withTimeout(getDocs(collection(db, colName)), 4000).catch(() => null);
          if (snap && !snap.empty) {
            const list: any[] = [];
            for (const docSnap of snap.docs) {
              const d = docSnap.data();
              const subs = Array.isArray(d.subjects) && d.subjects.length > 0
                ? d.subjects
                : (d.subject ? String(d.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean) : []);
              const isWalas = !!(d.isWaliKelas || d.waliKelas || d.is_wali_kelas || d.isWali);
              const teacherObj = {
                ...d,
                id: docSnap.id,
                name: d.name || d.nama || d.namaGuru || d.nama_lengkap || d.namaLengkap || d.fullname || "Guru",
                username: d.username || d.user || d.email || docSnap.id,
                password: d.password || d.pass || "123",
                subject: d.subject || d.mapel || d.mataPelajaran || d.mata_pelajaran || "Guru",
                subjects: subs.length > 0 ? subs : [d.subject || "PAI"],
                isWaliKelas: isWalas,
                kelas: isWalas ? (d.kelas || d.rombel || d.class || "") : "",
                isEkskulTeacher: !!(d.isEkskulTeacher || d.is_ekskul_teacher || d.ekskulName),
                ekskulName: d.ekskulName || d.ekskul || "",
              };
              if (isDummyTeacher(teacherObj)) {
                // Permanently clean from Firestore collection
                deleteDoc(doc(db, colName, docSnap.id)).catch(() => {});
                continue;
              }
              const purgedIds = ["t_1790913955043", "t_1790914206952", "t_1790914287812", "t_1790914329138"];
              if (purgedIds.includes(String(teacherObj.id))) {
                deleteDoc(doc(db, colName, docSnap.id)).catch(() => {});
                continue;
              }
              if (!deleted.has(String(teacherObj.id)) && !deleted.has(String(teacherObj.username || ""))) {
                list.push(teacherObj);
              }
            }
            return list;
          }
        } catch (err) {
          // continue
        }
      }
    } catch (e) {
      console.warn("Failed to get teachers from Firestore:", e);
    }
    return fallback;
  },
  postTeacher: async (body: any) => {
    const { name, username, password, subject, subjects, isWaliKelas, kelas, isEkskulTeacher, ekskulName } = body;
    const fallback = getLocalFallbackData();
    const exists = (fallback.teachers || []).some((t: any) => t.username.toLowerCase() === username.toLowerCase());
    if (exists) throw new Error("Username sudah digunakan.");

    let finalSubjects: string[] = [];
    if (Array.isArray(subjects) && subjects.length > 0) {
      finalSubjects = Array.from(new Set(subjects.map((s: any) => String(s || '').trim()).filter(Boolean)));
    } else if (subject) {
      finalSubjects = Array.from(new Set(String(subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
    }
    if (finalSubjects.length === 0) finalSubjects = [subject || "PAI"];
    const finalSubjectStr = finalSubjects.join(", ");

    const id = "t_" + Date.now();
    let finalEkskuls: string[] = [];
    if (Array.isArray(body?.ekskulNames) && body.ekskulNames.length > 0) {
      finalEkskuls = Array.from(new Set(body.ekskulNames.map((s: any) => String(s || '').trim()).filter(Boolean)));
    } else if (ekskulName) {
      finalEkskuls = Array.from(new Set(String(ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
    }
    const isEks = Boolean(isEkskulTeacher && finalEkskuls.length > 0);
    const cleanEksName = isEks ? finalEkskuls.join(", ") : "";

    const newTeacher = {
      id,
      name,
      username,
      password,
      subject: finalSubjectStr,
      subjects: finalSubjects,
      isWaliKelas: !!isWaliKelas,
      kelas: kelas || "",
      isEkskulTeacher: isEks,
      ekskulName: cleanEksName,
      ekskulNames: isEks ? finalEkskuls : []
    };
    
    unmarkDeletedId('teachers', [id, username]);
    // Always persist to local cache immediately
    updateLocalFallbackItem('teachers', newTeacher);

    if (!Array.isArray(fallback.ekskul)) fallback.ekskul = [];
    if (isEks && finalEkskuls.length > 0) {
      finalEkskuls.forEach((eksName) => {
        let matchedEks = fallback.ekskul.find(
          (e: any) => e.name.toLowerCase().trim() === eksName.toLowerCase().trim()
        );
        if (!matchedEks) {
          matchedEks = { id: "e_" + Date.now() + Math.random().toString(36).substr(2, 4), name: eksName, type: "Pilihan", teacherId: id, teacherName: name };
          fallback.ekskul.push(matchedEks);
        } else {
          matchedEks.teacherId = id;
          matchedEks.teacherName = name;
        }
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem("smart_sts_db", JSON.stringify(fallback));
      }
    }

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "teachers", id), newTeacher), 4000);
      } catch (err) {
        console.warn("Firestore postTeacher write error:", err);
      }
    }
    return newTeacher;
  },
  putTeacher: async (id: string, body: any) => {
    const { name, username, password, subject, subjects, isWaliKelas, kelas, isEkskulTeacher, ekskulName, ekskulNames } = body;
    let finalEkskuls: string[] = [];
    if (Array.isArray(ekskulNames) && ekskulNames.length > 0) {
      finalEkskuls = Array.from(new Set(ekskulNames.map((s: any) => String(s || '').trim()).filter(Boolean)));
    } else if (ekskulName) {
      finalEkskuls = Array.from(new Set(String(ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
    }
    const isEks = Boolean(isEkskulTeacher && finalEkskuls.length > 0);
    const cleanEksName = isEks ? finalEkskuls.join(", ") : "";

    let finalSubjects: string[] = [];
    if (Array.isArray(subjects) && subjects.length > 0) {
      finalSubjects = Array.from(new Set(subjects.map((s: any) => String(s || '').trim()).filter(Boolean)));
    } else if (subject) {
      finalSubjects = Array.from(new Set(String(subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
    }
    if (finalSubjects.length === 0) finalSubjects = [subject || "PAI"];
    const finalSubjectStr = finalSubjects.join(", ");

    const updated = {
      id,
      name,
      username,
      password,
      subject: finalSubjectStr,
      subjects: finalSubjects,
      isWaliKelas: !!isWaliKelas,
      kelas: kelas || "",
      isEkskulTeacher: isEks,
      ekskulName: cleanEksName,
      ekskulNames: isEks ? finalEkskuls : []
    };
    updateLocalFallbackItem('teachers', updated);

    const fallback = getLocalFallbackData();
    if (!Array.isArray(fallback.ekskul)) fallback.ekskul = [];
    if (isEks && finalEkskuls.length > 0) {
      finalEkskuls.forEach((eksName) => {
        let matchedEks = fallback.ekskul.find(
          (e: any) => e.name.toLowerCase().trim() === eksName.toLowerCase().trim()
        );
        if (!matchedEks) {
          matchedEks = { id: "e_" + Date.now() + Math.random().toString(36).substr(2, 4), name: eksName, type: "Pilihan", teacherId: id, teacherName: name };
          fallback.ekskul.push(matchedEks);
        } else {
          matchedEks.teacherId = id;
          matchedEks.teacherName = name;
        }
      });
    }

    fallback.ekskul.forEach((e: any) => {
      if (String(e.teacherId) === String(id)) {
        if (!isEks || !finalEkskuls.some((fn) => fn.toLowerCase().trim() === e.name.toLowerCase().trim())) {
          e.teacherId = "";
          e.teacherName = "";
        }
      }
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem("smart_sts_db", JSON.stringify(fallback));
    }

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "teachers", id), updated), 4000);
      } catch (err) {
        console.warn("Firestore putTeacher write error:", err);
      }
    }
    return updated;
  },
  deleteTeacher: async (id: string) => {
    if (id === 't1') throw new Error("Akun Super Admin utama tidak boleh dihapus.");
    const fallback = getLocalFallbackData();
    const target = (fallback.teachers || []).find((t: any) => String(t.id) === String(id));
    const username = target?.username;

    recordDeletedId('teachers', [id, username].filter(Boolean) as string[]);
    deleteLocalFallbackItem('teachers', id);

    if (db) {
      try {
        await withTimeout(deleteDoc(doc(db, "teachers", id)), 4000);
        await deleteDoc(doc(db, "guru", id)).catch(() => {});
        if (username) {
          await deleteDoc(doc(db, "teachers", username)).catch(() => {});
          await deleteDoc(doc(db, "guru", username)).catch(() => {});
        }
      } catch (err) {
        console.warn("Firestore deleteTeacher error:", err);
      }
    }
    return { message: "Guru berhasil dihapus." };
  },

  // 3. GET, POST, PUT, DELETE /api/students
  getStudents: async (): Promise<any[]> => {
    const deleted = getDeletedSet('students');
    const fallback = (getLocalFallbackData().students || []).filter(
      (s: any) => !deleted.has(String(s.id)) && !deleted.has(String(s.nisn || ""))
    );
    if (!db) return fallback;
    const studentCollections = ["students", "siswa", "Students", "Siswa", "data_siswa", "dataSiswa", "data_students", "DataSiswa", "santri"];
    try {
      for (const colName of studentCollections) {
        try {
          const snap = await withTimeout(getDocs(collection(db, colName)), 4000).catch(() => null);
          if (snap && !snap.empty) {
            const list = snap.docs.map(docSnap => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: d.name || d.nama || d.namaSiswa || d.nama_lengkap || d.namaLengkap || d.fullname || "Siswa",
                nisn: d.nisn || d.nis || d.nisnSiswa || d.nis_nisn || d.no_induk || docSnap.id,
                kelas: String(d.kelas || d.rombel || d.class || d.tingkat || "1").trim(),
                ...d
              };
            });
            return list.filter((s: any) => !deleted.has(String(s.id)) && !deleted.has(String(s.nisn || "")));
          }
        } catch (err) {
          // continue
        }
      }
    } catch (e) {
      console.warn("Failed to get students from Firestore:", e);
    }
    return fallback;
  },
  postStudent: async (body: any) => {
    const { name, nisn, kelas } = body;
    const cleanNisn = String(nisn || "").trim().replace(/\D/g, "");
    const fallback = getLocalFallbackData();
    const dupLocal = (fallback.students || []).some((s: any) => String(s.nisn).trim() === cleanNisn);
    if (dupLocal) throw new Error("Siswa dengan NISN ini sudah terdaftar.");

    const id = "s_" + Date.now();
    const newStudent = { id, nisn: cleanNisn, name: String(name || "").trim(), kelas: String(kelas || "1").trim() };
    
    unmarkDeletedId('students', [id, cleanNisn]);
    // Always persist to local cache immediately
    updateLocalFallbackItem('students', newStudent);

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "students", id), newStudent), 4000);
      } catch (err) {
        console.warn("Firestore postStudent write error:", err);
      }
    }
    return newStudent;
  },
  postStudentsBatch: async (studentsList: any[]): Promise<any> => {
    const fallback = getLocalFallbackData();
    const existing = fallback.students || [];
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
      unmarkDeletedId('students', [id, nisn]);
      updateLocalFallbackItem('students', newStudent);
      addedStudents.push(newStudent);

      if (db) {
        setDoc(doc(db, "students", id), newStudent).catch(() => {});
      }
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
    const { name, nisn, kelas } = body;
    const updated = { id, name, nisn, kelas };
    updateLocalFallbackItem('students', updated);

    if (db) {
      try {
        await withTimeout(updateDoc(doc(db, "students", id), updated), 4000);
      } catch (err) {
        console.warn("Firestore putStudent error:", err);
      }
    }
    return { id, ...updated };
  },
  deleteStudent: async (id: string) => {
    const fallback = getLocalFallbackData();
    const st = (fallback.students || []).find((s: any) => String(s.id) === String(id) || String(s.nisn) === String(id));
    const nisn = st?.nisn;

    recordDeletedId('students', [id, nisn].filter(Boolean) as string[]);
    deleteLocalFallbackItem('students', id);
    if (nisn) deleteLocalFallbackItem('students', nisn, 'nisn');

    if (db) {
      try {
        const studentCollections = ["students", "siswa", "Students", "Siswa"];
        for (const col of studentCollections) {
          await deleteDoc(doc(db, col, id)).catch(() => {});
          if (nisn) await deleteDoc(doc(db, col, nisn)).catch(() => {});
        }
        // Clean up grades
        const gradesSnap = await withTimeout(getDocs(collection(db, "grades")), 4000).catch(() => ({ docs: [] }));
        for (const gDoc of gradesSnap.docs) {
          const gData = gDoc.data();
          if (gData.studentId === id || (nisn && gData.studentId === nisn)) {
            await deleteDoc(doc(db, "grades", gDoc.id)).catch(() => {});
          }
        }
        await deleteDoc(doc(db, "walikelas_notes", id)).catch(() => {});
        if (nisn) await deleteDoc(doc(db, "walikelas_notes", nisn)).catch(() => {});
      } catch (err) {
        console.warn("Firestore deleteStudent error:", err);
      }
    }
    return { message: "Siswa berhasil dihapus." };
  },
  deleteStudentsBatch: async (ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return { deletedCount: 0 };
    const fallback = getLocalFallbackData();
    const deletedNisns: string[] = [];
    ids.forEach(id => {
      const st = (fallback.students || []).find((s: any) => String(s.id) === String(id) || String(s.nisn) === String(id));
      if (st?.nisn) deletedNisns.push(st.nisn);
    });

    const allKeys = [...ids, ...deletedNisns];
    recordDeletedId('students', allKeys);

    ids.forEach(id => {
      deleteLocalFallbackItem('students', id);
    });
    deletedNisns.forEach(nisn => {
      deleteLocalFallbackItem('students', nisn, 'nisn');
    });

    if (db) {
      try {
        const studentCollections = ["students", "siswa", "Students", "Siswa"];
        for (const id of ids) {
          for (const col of studentCollections) {
            deleteDoc(doc(db, col, id)).catch(() => {});
          }
          deleteDoc(doc(db, "walikelas_notes", id)).catch(() => {});
        }
        for (const nisn of deletedNisns) {
          for (const col of studentCollections) {
            deleteDoc(doc(db, col, nisn)).catch(() => {});
          }
          deleteDoc(doc(db, "walikelas_notes", nisn)).catch(() => {});
        }
        // Clean up grades
        getDocs(collection(db, "grades")).then(snap => {
          const idSet = new Set(allKeys);
          for (const gDoc of snap.docs) {
            if (idSet.has(gDoc.data().studentId)) {
              deleteDoc(doc(db, "grades", gDoc.id)).catch(() => {});
            }
          }
        }).catch(() => {});
      } catch (e) {
        console.warn("Firestore batch delete error:", e);
      }
    }
    return { success: true, deletedCount: ids.length, message: `${ids.length} siswa berhasil dihapus.` };
  },

  // 4. GET & POST /api/grades
  getGrades: async (): Promise<any[]> => {
    const rawFallback = getLocalFallbackData().grades || [];
    const sanitizeGrade = (g: any) => {
      if (!g) return g;
      const cleanTps = Array.isArray(g.tps) ? cleanTpList(g.tps) : [];
      return {
        ...g,
        tps: cleanTps,
      };
    };

    if (!db) return rawFallback.map(sanitizeGrade);
    try {
      const snap = await withTimeout(getDocs(collection(db, "grades")), 6000);
      if (snap && !snap.empty) {
        return snap.docs.map(docSnap => sanitizeGrade(docSnap.data()));
      }
    } catch (e) {
      console.warn("Failed to get grades from Firestore:", e);
    }
    return rawFallback.map(sanitizeGrade);
  },
  postGrade: async (body: any) => {
    const { studentId, subject, score, tps, teacherName, usaha, proses, capaian, deskripsi } = body;
    const normSub = normalizeSubjectKey(subject) || subject;
    const cleanSub = normSub.replace(/[^a-zA-Z0-9]/g, "_");
    const docId = `${studentId}_${cleanSub}`;
    
    const updatedGrade = {
      id: docId,
      studentId,
      subject,
      score: Number(score),
      tps: Array.isArray(tps) ? cleanTpList(tps) : [],
      usaha: usaha || "B",
      proses: proses || "B",
      capaian: capaian || "B",
      deskripsi: deskripsi !== undefined ? deskripsi : "",
      lastUpdatedBy: teacherName || "Guru Mata Pelajaran",
      lastUpdatedAt: new Date().toISOString()
    };
    
    updateLocalFallbackItem('grades', updatedGrade, 'id');

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "grades", docId), updatedGrade), 4000);
      } catch (err) {
        console.warn("Firestore postGrade error:", err);
      }
    }
    return updatedGrade;
  },

  // 5. GET & POST /api/walikelas/notes
  getWaliKelasNotes: async () => {
    const fallback = getLocalFallbackData().walikelas_notes || {};
    if (!db) return fallback;
    try {
      const snap = await withTimeout(getDocs(collection(db, "walikelas_notes")), 3500);
      if (snap && !snap.empty) {
        const notes: any = {};
        snap.docs.forEach(docSnap => {
          notes[docSnap.id] = docSnap.data();
        });
        return notes;
      }
    } catch (err) {}
    return fallback;
  },
  postWaliKelasNotes: async (body: any) => {
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

    // Update local
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem("smart_sts_db");
        const dbObj = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(dbDataAny));
        if (!dbObj.walikelas_notes) dbObj.walikelas_notes = {};
        dbObj.walikelas_notes[studentId] = note;
        localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
      }
    } catch (e) {}

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "walikelas_notes", studentId), note), 4000);
      } catch (err) {
        console.warn("Firestore postWaliKelasNotes error:", err);
      }
    }
    return { studentId, ...note };
  },

  // 6. GET, POST, DELETE /api/tps
  getTPs: async (kelas?: string) => {
    const fallback = getLocalFallbackData().tujuan_pembelajaran_templates || {};
    let templates: Record<string, any[]> = {};
    for (const [sub, list] of Object.entries(fallback)) {
      if (Array.isArray(list)) {
        templates[sub] = cleanTpList(list);
      }
    }

    if (db) {
      try {
        const snap = await withTimeout(getDocs(collection(db, "tujuan_pembelajaran_templates")), 3500);
        if (snap && !snap.empty) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const subjectId = docSnap.id;
            const originalList = Array.isArray(data.tps) ? data.tps : [];
            let tpsList = cleanTpList(originalList);
            const normKey = normalizeSubjectKey(subjectId) || subjectId;
            const existing = Array.isArray(templates[normKey])
              ? templates[normKey]
              : (Array.isArray(templates[subjectId]) ? templates[subjectId] : []);

            // Non-destructive merge between local and cloud TPs
            const mergedMap = new Map<string, any>();
            existing.forEach((tp: any) => { if (tp && tp.id) mergedMap.set(String(tp.id).trim(), tp); });
            tpsList.forEach((tp: any) => { if (tp && tp.id) mergedMap.set(String(tp.id).trim(), tp); });
            const mergedList = Array.from(mergedMap.values());

            templates[subjectId] = mergedList;
            templates[normKey] = mergedList;

            // Auto-clean Firestore doc if it contained dummy templates
            if (originalList.length !== tpsList.length) {
              setDoc(
                doc(db, "tujuan_pembelajaran_templates", docSnap.id),
                { tps: tpsList, updatedAt: new Date().toISOString() },
                { merge: true }
              ).catch(() => {});
            }
          });
        }
      } catch (e) {
        // Fallback gracefully to local storage
      }
    }

    // Safety net: Recover any TPs embedded in grades
    try {
      const grades = await firebaseApi.getGrades() as any[];
      if (Array.isArray(grades)) {
        grades.forEach((g: any) => {
          if (g && g.subject && Array.isArray(g.tps) && g.tps.length > 0) {
            const sub = g.subject;
            const normSub = normalizeSubjectKey(sub) || sub;
            const validTps = cleanTpList(g.tps);
            if (validTps.length > 0) {
              const current = Array.isArray(templates[normSub]) ? templates[normSub] : [];
              const map = new Map<string, any>();
              current.forEach((t) => map.set(String(t.id).trim(), t));
              validTps.forEach((t) => map.set(String(t.id).trim(), t));
              const combined = Array.from(map.values());
              templates[normSub] = combined;
              templates[sub] = combined;
            }
          }
        });
      }
    } catch (e) {}

    if (kelas) {
      const filtered: Record<string, any[]> = {};
      for (const [sub, list] of Object.entries(templates)) {
        if (Array.isArray(list)) {
          filtered[sub] = list.filter((item: any) => matchTpClass(item.kelas, kelas));
        }
      }
      return filtered;
    }

    return templates;
  },
  postTP: async (body: any) => {
    const { subject, tpText, kelas } = body || {};
    const cleanSubject = String(subject || "").trim();
    const newTP = {
      id: "tp_" + Date.now(),
      text: String(tpText || "").trim(),
      kelas: kelas ? String(kelas).trim() : "1"
    };
    
    // Update local storage and fallback
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem("smart_sts_db");
        const dbObj = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(dbDataAny));
        if (!dbObj.tujuan_pembelajaran_templates) dbObj.tujuan_pembelajaran_templates = {};

        // Find existing key matching this subject
        const normTarget = normalizeSubjectKey(cleanSubject);
        let targetKey = cleanSubject;
        for (const k of Object.keys(dbObj.tujuan_pembelajaran_templates)) {
          if (k === cleanSubject || normalizeSubjectKey(k) === normTarget) {
            targetKey = k;
            break;
          }
        }
        if (!Array.isArray(dbObj.tujuan_pembelajaran_templates[targetKey])) {
          dbObj.tujuan_pembelajaran_templates[targetKey] = [];
        }
        // Clean out any sample TPs
        dbObj.tujuan_pembelajaran_templates[targetKey] = cleanTpList(dbObj.tujuan_pembelajaran_templates[targetKey]);
        if (!dbObj.tujuan_pembelajaran_templates[targetKey].some((x: any) => x.id === newTP.id)) {
          dbObj.tujuan_pembelajaran_templates[targetKey].push(newTP);
        }

        // Also ensure cleanSubject and normalized keys are populated
        if (targetKey !== cleanSubject) {
          dbObj.tujuan_pembelajaran_templates[cleanSubject] = dbObj.tujuan_pembelajaran_templates[targetKey];
        }
        if (normTarget && normTarget !== targetKey) {
          dbObj.tujuan_pembelajaran_templates[normTarget] = dbObj.tujuan_pembelajaran_templates[targetKey];
        }
        for (const k of Object.keys(dbObj.tujuan_pembelajaran_templates)) {
          if (normalizeSubjectKey(k) === normTarget && k !== targetKey) {
            dbObj.tujuan_pembelajaran_templates[k] = dbObj.tujuan_pembelajaran_templates[targetKey];
          }
        }
        localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
      }
    } catch (e) {}

    // Save to Firestore with preservation of existing teacher templates
    if (db) {
      try {
        const normKey = normalizeSubjectKey(cleanSubject) || cleanSubject;
        const safeDocId = normKey.replace(/\//g, "_");
        const ref = doc(db, "tujuan_pembelajaran_templates", safeDocId);
        const docSnap = await withTimeout(getDoc(ref), 2500).catch(() => null);
        
        let tpsList: any[] = [];
        if (docSnap && docSnap.exists() && Array.isArray(docSnap.data().tps)) {
          tpsList = cleanTpList(docSnap.data().tps);
        } else {
          const fallback = getLocalFallbackData().tujuan_pembelajaran_templates || {};
          const existing = getSubjectTps(fallback, cleanSubject);
          tpsList = cleanTpList(existing);
        }
        
        // Avoid duplicate ID if any
        if (!tpsList.some((x: any) => x.id === newTP.id)) {
          tpsList.push(newTP);
        }
        await withTimeout(
          setDoc(ref, { tps: tpsList, subject: normKey, updatedAt: new Date().toISOString() }, { merge: true }),
          3000
        );

        if (cleanSubject !== normKey) {
          const altRef = doc(db, "tujuan_pembelajaran_templates", cleanSubject.replace(/\//g, "_"));
          await withTimeout(
            setDoc(altRef, { tps: tpsList, subject: cleanSubject, updatedAt: new Date().toISOString() }, { merge: true }),
            3000
          ).catch(() => null);
        }
      } catch (err) {
        console.warn("Firestore postTP write error:", err);
      }
    }
    return newTP;
  },
  updateTP: async (subject: string, tpId: string, updates: { text?: string; kelas?: string }) => {
    const cleanSubject = decodeURIComponent(subject || '').trim();
    const cleanTpId = decodeURIComponent(tpId || '').trim();
    const nextText = updates?.text !== undefined ? String(updates.text).trim() : undefined;
    const nextKelas = updates?.kelas !== undefined ? String(updates.kelas).trim() : undefined;

    // Update local storage
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem("smart_sts_db");
        if (raw) {
          const dbObj = JSON.parse(raw);
          if (dbObj.tujuan_pembelajaran_templates) {
            for (const key of Object.keys(dbObj.tujuan_pembelajaran_templates)) {
              if (!cleanSubject || key === cleanSubject || normalizeSubjectKey(key) === normalizeSubjectKey(cleanSubject)) {
                if (Array.isArray(dbObj.tujuan_pembelajaran_templates[key])) {
                  dbObj.tujuan_pembelajaran_templates[key] = dbObj.tujuan_pembelajaran_templates[key].map((item: any) => {
                    if (String(item.id).trim() === cleanTpId) {
                      return {
                        ...item,
                        ...(nextText !== undefined ? { text: nextText } : {}),
                        ...(nextKelas !== undefined ? { kelas: nextKelas } : {}),
                      };
                    }
                    return item;
                  });
                }
              }
            }
            // Global search
            for (const key of Object.keys(dbObj.tujuan_pembelajaran_templates)) {
              if (Array.isArray(dbObj.tujuan_pembelajaran_templates[key])) {
                dbObj.tujuan_pembelajaran_templates[key] = dbObj.tujuan_pembelajaran_templates[key].map((item: any) => {
                  if (String(item.id).trim() === cleanTpId) {
                    return {
                      ...item,
                      ...(nextText !== undefined ? { text: nextText } : {}),
                      ...(nextKelas !== undefined ? { kelas: nextKelas } : {}),
                    };
                  }
                  return item;
                });
              }
            }
            localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
          }
        }
      }
    } catch (e) {}

    // Firestore update
    if (db) {
      try {
        if (cleanSubject) {
          const safeDocId = cleanSubject.replace(/\//g, "_");
          const ref = doc(db, "tujuan_pembelajaran_templates", safeDocId);
          const docSnap = await withTimeout(getDoc(ref), 2500).catch(() => null);
          if (docSnap && docSnap.exists() && Array.isArray(docSnap.data().tps)) {
            const updatedList = docSnap.data().tps.map((tp: any) => {
              if (String(tp.id).trim() === cleanTpId) {
                return {
                  ...tp,
                  ...(nextText !== undefined ? { text: nextText } : {}),
                  ...(nextKelas !== undefined ? { kelas: nextKelas } : {}),
                };
              }
              return tp;
            });
            await withTimeout(setDoc(ref, { tps: updatedList, updatedAt: new Date().toISOString() }, { merge: true }), 2500);
          }
        }
        // Also check all documents in collection
        const snap = await withTimeout(getDocs(collection(db, "tujuan_pembelajaran_templates")), 2500).catch(() => null);
        if (snap && !snap.empty) {
          for (const docItem of snap.docs) {
            const tpsList = docItem.data().tps || [];
            if (tpsList.some((tp: any) => String(tp.id).trim() === cleanTpId)) {
              const updatedList = tpsList.map((tp: any) => {
                if (String(tp.id).trim() === cleanTpId) {
                  return {
                    ...tp,
                    ...(nextText !== undefined ? { text: nextText } : {}),
                    ...(nextKelas !== undefined ? { kelas: nextKelas } : {}),
                  };
                }
                return tp;
              });
              await withTimeout(setDoc(doc(db, "tujuan_pembelajaran_templates", docItem.id), { tps: updatedList, updatedAt: new Date().toISOString() }, { merge: true }), 2500);
            }
          }
        }
      } catch (err) {
        console.warn("Firestore updateTP error:", err);
      }
    }
    return { success: true, id: cleanTpId, text: nextText, kelas: nextKelas };
  },
  deleteTP: async (subject: string, tpId: string) => {
    const cleanSubject = decodeURIComponent(subject || '').trim();
    const cleanTpId = decodeURIComponent(tpId || '').trim();
    recordDeletedId('tps', `${cleanSubject}_${cleanTpId}`);
    recordDeletedId('tps', cleanTpId);

    // Update local storage
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem("smart_sts_db");
        if (raw) {
          const dbObj = JSON.parse(raw);
          if (dbObj.tujuan_pembelajaran_templates) {
            for (const key of Object.keys(dbObj.tujuan_pembelajaran_templates)) {
              if (!cleanSubject || key === cleanSubject || normalizeSubjectKey(key) === normalizeSubjectKey(cleanSubject)) {
                if (Array.isArray(dbObj.tujuan_pembelajaran_templates[key])) {
                  dbObj.tujuan_pembelajaran_templates[key] = dbObj.tujuan_pembelajaran_templates[key].filter(
                    (x: any) => String(x.id).trim() !== cleanTpId
                  );
                }
              }
            }
            // Global scan
            for (const key of Object.keys(dbObj.tujuan_pembelajaran_templates)) {
              if (Array.isArray(dbObj.tujuan_pembelajaran_templates[key])) {
                dbObj.tujuan_pembelajaran_templates[key] = dbObj.tujuan_pembelajaran_templates[key].filter(
                  (x: any) => String(x.id).trim() !== cleanTpId
                );
              }
            }
            localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
          }
        }
      }
    } catch (e) {}

    // Firestore update
    if (db) {
      try {
        if (cleanSubject) {
          const safeDocId = cleanSubject.replace(/\//g, "_");
          const ref = doc(db, "tujuan_pembelajaran_templates", safeDocId);
          const docSnap = await withTimeout(getDoc(ref), 2500).catch(() => null);
          if (docSnap && docSnap.exists() && Array.isArray(docSnap.data().tps)) {
            const filtered = docSnap.data().tps.filter((tp: any) => String(tp.id).trim() !== cleanTpId);
            await withTimeout(setDoc(ref, { tps: filtered, updatedAt: new Date().toISOString() }, { merge: true }), 2500);
          }
        }
        // Also check all documents in collection to ensure thorough deletion
        const snap = await withTimeout(getDocs(collection(db, "tujuan_pembelajaran_templates")), 2500).catch(() => null);
        if (snap && !snap.empty) {
          for (const docItem of snap.docs) {
            const tpsList = docItem.data().tps || [];
            if (tpsList.some((tp: any) => String(tp.id).trim() === cleanTpId)) {
              const filtered = tpsList.filter((tp: any) => String(tp.id).trim() !== cleanTpId);
              await withTimeout(setDoc(doc(db, "tujuan_pembelajaran_templates", docItem.id), { tps: filtered, updatedAt: new Date().toISOString() }, { merge: true }), 2500);
            }
          }
        }
      } catch (err) {
        console.warn("Firestore deleteTP error:", err);
      }
    }
    return { success: true, id: cleanTpId };
  },

  // 7. GET & POST /api/settings
  getSettings: async () => {
    let explicitName: string | null = null;
    let explicitNip: string | null = null;
    try {
      if (typeof window !== 'undefined') {
        explicitName = localStorage.getItem("smart_sts_principal_name");
        explicitNip = localStorage.getItem("smart_sts_principal_nip");
      }
    } catch {}

    const localDb = getLocalFallbackData();
    const fallbackSettings = localDb.settings || {};

    const finalName = (explicitName && explicitName.trim()) || fallbackSettings.principalName || "Sobariyani, S.Pd.";
    const finalNip = (explicitNip && explicitNip.trim()) || fallbackSettings.principalNip || "19800101 200501 1 003";

    const fallback = {
      principalName: finalName,
      principalNip: finalNip,
      format: {
        semesterName: fallbackSettings.format?.semesterName || "Ganjil",
        tahunPelajaran: fallbackSettings.format?.tahunPelajaran || "2026/2027",
        fontSize: fallbackSettings.format?.fontSize || "11pt",
        showLogo: fallbackSettings.format?.showLogo !== undefined ? fallbackSettings.format.showLogo : false,
        showSpiritual: fallbackSettings.format?.showSpiritual !== undefined ? fallbackSettings.format.showSpiritual : true,
        showSosial: fallbackSettings.format?.showSosial !== undefined ? fallbackSettings.format.showSosial : true,
        showAttendance: fallbackSettings.format?.showAttendance !== undefined ? fallbackSettings.format.showAttendance : true,
        showCatatan: fallbackSettings.format?.showCatatan !== undefined ? fallbackSettings.format.showCatatan : true,
        fontFamily: fallbackSettings.format?.fontFamily || "Times New Roman",
        paperSize: fallbackSettings.format?.paperSize || "A4",
        tanggalRaport: fallbackSettings.format?.tanggalRaport || "17 Juni 2026",
        signaturePosition: fallbackSettings.format?.signaturePosition || "kanan",
        watermarkSize: fallbackSettings.format?.watermarkSize !== undefined ? fallbackSettings.format.watermarkSize : 440,
        watermarkOpacity: fallbackSettings.format?.watermarkOpacity !== undefined ? fallbackSettings.format.watermarkOpacity : 0.05
      }
    };

    if (!db) {
      return fallback;
    }

    try {
      const ref = doc(db, "settings", "app");
      const docSnap = await withTimeout(getDoc(ref), 3500);
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        if (data.format) {
          if (!data.format.tanggalRaport) data.format.tanggalRaport = "17 Juni 2026";
          if (!data.format.signaturePosition) data.format.signaturePosition = "kanan";
          if (data.format.watermarkSize === undefined) data.format.watermarkSize = 440;
          if (data.format.watermarkOpacity === undefined) data.format.watermarkOpacity = 0.05;
        }
        if (data.principalName) {
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem("smart_sts_principal_name", String(data.principalName).trim());
            }
          } catch {}
        }
        if (data.principalNip) {
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem("smart_sts_principal_nip", String(data.principalNip).trim());
            }
          } catch {}
        }
        return {
          principalName: data.principalName || finalName,
          principalNip: data.principalNip || finalNip,
          format: { ...fallback.format, ...(data.format || {}) }
        };
      }
    } catch (err) {}
    return fallback;
  },
  postSettings: async (body: any) => {
    const { principalName, principalNip, format } = body;
    const fallback = getLocalFallbackData();
    const prevSettings = fallback.settings || {};

    let explicitName: string | null = null;
    let explicitNip: string | null = null;
    try {
      if (typeof window !== 'undefined') {
        explicitName = localStorage.getItem("smart_sts_principal_name");
        explicitNip = localStorage.getItem("smart_sts_principal_nip");
      }
    } catch {}
    
    let savedPrincipalName = (principalName !== undefined && typeof principalName === 'string' && principalName.trim() !== '')
      ? principalName.trim()
      : ((explicitName && explicitName.trim()) || prevSettings.principalName || "Sobariyani, S.Pd.");

    let savedPrincipalNip = (principalNip !== undefined && typeof principalNip === 'string' && principalNip.trim() !== '')
      ? principalNip.trim()
      : ((explicitNip && explicitNip.trim()) || prevSettings.principalNip || "19800101 200501 1 003");

    const settingsData = {
      principalName: savedPrincipalName,
      principalNip: savedPrincipalNip,
      format: format ? {
        semesterName: format.semesterName || prevSettings.format?.semesterName || "Ganjil",
        tahunPelajaran: format.tahunPelajaran || prevSettings.format?.tahunPelajaran || "2026/2027",
        fontSize: format.fontSize || prevSettings.format?.fontSize || "11pt",
        showLogo: format.showLogo !== undefined ? format.showLogo : (prevSettings.format?.showLogo ?? false),
        showSpiritual: format.showSpiritual !== undefined ? format.showSpiritual : (prevSettings.format?.showSpiritual ?? true),
        showSosial: format.showSosial !== undefined ? format.showSosial : (prevSettings.format?.showSosial ?? true),
        showAttendance: format.showAttendance !== undefined ? format.showAttendance : (prevSettings.format?.showAttendance ?? true),
        showCatatan: format.showCatatan !== undefined ? format.showCatatan : (prevSettings.format?.showCatatan ?? true),
        fontFamily: format.fontFamily || prevSettings.format?.fontFamily || "Times New Roman",
        paperSize: format.paperSize || prevSettings.format?.paperSize || "A4",
        tanggalRaport: format.tanggalRaport || prevSettings.format?.tanggalRaport || "17 Juni 2026",
        signaturePosition: format.signaturePosition || prevSettings.format?.signaturePosition || "kanan",
        watermarkSize: format.watermarkSize !== undefined ? Number(format.watermarkSize) : (prevSettings.format?.watermarkSize ?? 440),
        watermarkOpacity: format.watermarkOpacity !== undefined ? Number(format.watermarkOpacity) : (prevSettings.format?.watermarkOpacity ?? 0.05)
      } : (prevSettings.format || {})
    };

    // Update local storage
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem("smart_sts_db");
        const dbObj = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(dbDataAny));
        dbObj.settings = settingsData;
        localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
        localStorage.setItem("smart_sts_principal_name", savedPrincipalName);
        localStorage.setItem("smart_sts_principal_nip", savedPrincipalNip);
      }
    } catch (e) {}

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "settings", "app"), settingsData, { merge: true }), 3500);
      } catch (err) {
        console.warn("Firestore postSettings error:", err);
      }
    }
    return { success: true, settings: settingsData, principalName: settingsData.principalName, principalNip: settingsData.principalNip, format: settingsData.format };
  },

  // 8. GET /api/summary
  getSummary: async () => {
    // Aggregation logic
    const students = await firebaseApi.getStudents() as any[];
    const teachers = await firebaseApi.getTeachers() as any[];
    const grades = await firebaseApi.getGrades() as any[];
    const fetchedSubjects = await firebaseApi.getSubjects() as string[];

    const subjectsList = Array.isArray(fetchedSubjects) && fetchedSubjects.length > 0
      ? fetchedSubjects
      : [
        "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPAS", "PJOK", "Seni Budaya", "Prakarya",
        "Bahasa Arab", "Bahasa Inggris", "TIK", "Life Skill", "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an",
        "Do’a Harian dan Hadits", "Wudhu dan Sholat", "Sirah Nabawiyah"
      ];

    const totalStudents = students.length;
    const registeredStudentIds = new Set(students.map((s: any) => s.id));
    
    const subjectProgress = subjectsList.map(sub => {
      const normSub = normalizeSubjectKey(sub);
      const filledGradesForSub = grades.filter((g: any) =>
        (g.subject === sub || normalizeSubjectKey(g.subject) === normSub) &&
        registeredStudentIds.has(g.studentId) &&
        ((g.score !== undefined && g.score !== null && g.score !== "") ||
          (g.deskripsi && String(g.deskripsi).trim() !== "") ||
          (Array.isArray(g.tps) && g.tps.length > 0))
      );
      const completedCount = filledGradesForSub.length;
      const percentage = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
      const t = teachers.find((teach: any) => {
        const subs = extractTeacherSubjects(teach);
        if (subs.some((s: string) => s === sub || normalizeSubjectKey(s) === normSub)) return true;
        if (teach.subject === sub || normalizeSubjectKey(teach.subject) === normSub) return true;
        return false;
      });
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

  postEkskulGrade: async (body: any) => {
    const { studentId, ekskulName, type, usaha, proses, capaian, predicate, description, deskripsi } = body;
    const fallback = getLocalFallbackData();
    if (!fallback.walikelas_notes) fallback.walikelas_notes = {};
    if (!fallback.walikelas_notes[studentId]) {
      fallback.walikelas_notes[studentId] = {
        sakit: 0, izin: 0, alpa: 0, catatan: "",
        spiritualUsaha: "B", spiritualProses: "B", spiritualCapaian: "B", spiritualDeskripsi: "",
        sosialUsaha: "B", sosialProses: "B", sosialCapaian: "B", sosialDeskripsi: "",
        ekskul: []
      };
    }
    if (!Array.isArray(fallback.walikelas_notes[studentId].ekskul)) {
      fallback.walikelas_notes[studentId].ekskul = [];
    }

    const existingIdx = fallback.walikelas_notes[studentId].ekskul.findIndex(
      (e: any) => e && (e.name === ekskulName || e.ekskulName === ekskulName)
    );

    const finalCapaian = capaian || predicate || "B";
    const ekskulEntry = {
      name: ekskulName,
      type: type || "Pilihan",
      usaha: usaha || "B",
      proses: proses || "B",
      capaian: finalCapaian,
      predicate: finalCapaian,
      description: description || deskripsi || "",
    };

    if (existingIdx >= 0) {
      fallback.walikelas_notes[studentId].ekskul[existingIdx] = ekskulEntry;
    } else {
      fallback.walikelas_notes[studentId].ekskul.push(ekskulEntry);
    }

    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem("smart_sts_db");
        const dbObj = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(dbDataAny));
        if (!dbObj.walikelas_notes) dbObj.walikelas_notes = {};
        dbObj.walikelas_notes[studentId] = fallback.walikelas_notes[studentId];
        localStorage.setItem("smart_sts_db", JSON.stringify(dbObj));
      }
    } catch (e) {}

    if (db) {
      try {
        const ref = doc(db, "walikelas_notes", String(studentId));
        await withTimeout(setDoc(ref, fallback.walikelas_notes[studentId]), 2500);
      } catch (err) {
        console.warn("Firestore postEkskulGrade error:", err);
      }
    }

    return { success: true, studentId, ekskul: fallback.walikelas_notes[studentId].ekskul };
  },

  // 10. GET, POST, PUT, DELETE /api/ekskul
  getEkskul: async (): Promise<any[]> => {
    const fallback = getLocalFallbackData();
    let ekskulList = Array.isArray(fallback.ekskul) && fallback.ekskul.length > 0
      ? fallback.ekskul
      : [
          { "id": "e1", "name": "Pramuka Siaga & Penggalang", "type": "Wajib" },
          { "id": "e2", "name": "Mentoring & Bina Pribadi Islami", "type": "Wajib" },
          { "id": "e3", "name": "Futsal", "type": "Pilihan" },
          { "id": "e4", "name": "Bulu Tangkis", "type": "Pilihan" },
          { "id": "e5", "name": "Panahan Tradisional", "type": "Pilihan" },
          { "id": "e6", "name": "Klub Sains & Matematika Cilik", "type": "Pilihan" }
        ];

    if (db) {
      try {
        const snap = await withTimeout(getDocs(collection(db, "ekskul")), 2500);
        if (snap && !snap.empty) {
          ekskulList = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
      } catch (e) {}
    }

    // Enrich with teachers
    const teachersList = Array.isArray(fallback.teachers) ? fallback.teachers : [];
    return ekskulList.map((e: any) => {
      const assignedTeacher = teachersList.find(
        (t: any) =>
          (e.teacherId && String(e.teacherId) === String(t.id)) ||
          (t.isEkskulTeacher && t.ekskulName && e.name.toLowerCase().trim() === t.ekskulName.toLowerCase().trim())
      );
      return {
        ...e,
        teacherId: assignedTeacher ? assignedTeacher.id : (e.teacherId || ""),
        teacherName: assignedTeacher ? assignedTeacher.name : (e.teacherName || "")
      };
    });
  },
  postEkskul: async (body: any) => {
    const { name, type, teacherId } = body;
    const trimmedName = String(name || "").trim();
    const fallback = getLocalFallbackData();
    if (!Array.isArray(fallback.ekskul)) fallback.ekskul = [];
    if (!Array.isArray(fallback.teachers)) fallback.teachers = [];

    let target = fallback.ekskul.find(
      (e: any) => e.name.toLowerCase().trim() === trimmedName.toLowerCase().trim()
    );

    let assignedTeacherName = "";
    if (teacherId) {
      const t = fallback.teachers.find((tc: any) => String(tc.id) === String(teacherId));
      if (t) {
        assignedTeacherName = t.name;
        t.isEkskulTeacher = true;
        t.ekskulName = trimmedName;
      }
    }

    if (!target) {
      target = {
        id: "e_" + Date.now(),
        name: trimmedName,
        type: type || "Pilihan",
        teacherId: teacherId || "",
        teacherName: assignedTeacherName
      };
      fallback.ekskul.push(target);
    } else {
      target.name = trimmedName;
      target.type = type || target.type;
      target.teacherId = teacherId || "";
      target.teacherName = assignedTeacherName;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem("smart_sts_db", JSON.stringify(fallback));
    }

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "ekskul", target.id), target), 2500);
      } catch (err) {
        console.warn("Firestore postEkskul error:", err);
      }
    }
    return target;
  },
  putEkskul: async (id: string, body: any) => {
    const { name, type, teacherId } = body;
    const trimmedName = String(name || "").trim();
    const fallback = getLocalFallbackData();
    if (!Array.isArray(fallback.ekskul)) fallback.ekskul = [];
    if (!Array.isArray(fallback.teachers)) fallback.teachers = [];

    const idx = fallback.ekskul.findIndex((e: any) => String(e.id) === String(id));
    let target = idx !== -1 ? fallback.ekskul[idx] : null;

    let assignedTeacherName = "";
    if (teacherId) {
      const t = fallback.teachers.find((tc: any) => String(tc.id) === String(teacherId));
      if (t) {
        assignedTeacherName = t.name;
        t.isEkskulTeacher = true;
        t.ekskulName = trimmedName || (target ? target.name : "");
      }
    }

    if (target) {
      const oldTeacherId = target.teacherId;
      if (oldTeacherId && String(oldTeacherId) !== String(teacherId)) {
        const prevT = fallback.teachers.find((tc: any) => String(tc.id) === String(oldTeacherId));
        if (prevT) {
          prevT.isEkskulTeacher = false;
          prevT.ekskulName = "";
        }
      }
      target.name = trimmedName || target.name;
      target.type = type || target.type;
      target.teacherId = teacherId || "";
      target.teacherName = assignedTeacherName;
    } else {
      target = {
        id,
        name: trimmedName,
        type: type || "Pilihan",
        teacherId: teacherId || "",
        teacherName: assignedTeacherName
      };
      fallback.ekskul.push(target);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem("smart_sts_db", JSON.stringify(fallback));
    }

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "ekskul", id), target), 2500);
      } catch (err) {
        console.warn("Firestore putEkskul error:", err);
      }
    }
    return target;
  },
  assignTeacherEkskul: async (id: string, teacherId: string) => {
    const fallback = getLocalFallbackData();
    if (!Array.isArray(fallback.ekskul)) fallback.ekskul = [];
    if (!Array.isArray(fallback.teachers)) fallback.teachers = [];

    let target = fallback.ekskul.find((e: any) => String(e.id) === String(id));
    if (!target) {
      target = {
        id,
        name: "Ekskul",
        type: "Pilihan",
        teacherId: "",
        teacherName: ""
      };
      fallback.ekskul.push(target);
    }

    const oldTeacherId = target.teacherId;
    let assignedTeacherName = "";
    target.teacherId = teacherId || "";

    if (teacherId) {
      const t = fallback.teachers.find((tc: any) => String(tc.id) === String(teacherId));
      if (t) {
        assignedTeacherName = t.name;
        t.isEkskulTeacher = true;
        if (!Array.isArray(t.ekskulNames)) {
          t.ekskulNames = t.ekskulName
            ? t.ekskulName.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [];
        }
        if (!t.ekskulNames.includes(target.name)) {
          t.ekskulNames.push(target.name);
        }
        t.ekskulName = t.ekskulNames.join(", ");
      }
    }

    target.teacherName = assignedTeacherName;

    // Update old teacher if changed
    if (oldTeacherId && String(oldTeacherId) !== String(teacherId)) {
      const prevT = fallback.teachers.find((tc: any) => String(tc.id) === String(oldTeacherId));
      if (prevT) {
        const remainingEkskuls = fallback.ekskul.filter(
          (e: any) => String(e.id) !== String(id) && String(e.teacherId) === String(oldTeacherId)
        );
        if (remainingEkskuls.length > 0) {
          prevT.isEkskulTeacher = true;
          prevT.ekskulNames = remainingEkskuls.map((e: any) => e.name);
          prevT.ekskulName = prevT.ekskulNames.join(", ");
        } else {
          prevT.isEkskulTeacher = false;
          prevT.ekskulNames = [];
          prevT.ekskulName = "";
        }
      }
    }

    target.teacherId = teacherId || "";
    target.teacherName = assignedTeacherName;

    if (typeof window !== 'undefined') {
      localStorage.setItem("smart_sts_db", JSON.stringify(fallback));
    }

    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "ekskul", id), target), 2500);
      } catch (err) {
        console.warn("Firestore assignTeacherEkskul error:", err);
      }
    }
    return { ekskul: target, teachers: fallback.teachers };
  },
  deleteEkskul: async (id: string) => {
    deleteLocalFallbackItem('ekskul', id);

    if (db) {
      try {
        await withTimeout(deleteDoc(doc(db, "ekskul", id)), 2500);
      } catch (err) {
        console.warn("Firestore deleteEkskul error:", err);
      }
    }
    return { message: "Ekskul deleted" };
  },

  // 10. GET, POST, DELETE /api/subjects
  getSubjects: async (): Promise<string[]> => {
    const fallback = getLocalFallbackData();
    const defaultSubs = [
      "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPA", "IPS",
      "Bahasa Inggris", "PJOK", "Prakarya", "Informatika", "Bahasa Arab",
      "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"
    ];
    let list = Array.isArray(fallback.subjects) && fallback.subjects.length > 0 
      ? fallback.subjects 
      : defaultSubs;

    if (!db) return list;
    try {
      const snap = await withTimeout(getDoc(doc(db, "settings", "subjects")), 2500).catch(() => null);
      if (snap && snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0) {
        return snap.data().list;
      }
    } catch (e) {}
    return list;
  },
  postSubject: async (name: string): Promise<string[]> => {
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new Error("Nama mata pelajaran wajib diisi.");
    const fallback = getLocalFallbackData();
    const defaultSubs = [
      "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPA", "IPS",
      "Bahasa Inggris", "PJOK", "Prakarya", "Informatika", "Bahasa Arab",
      "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"
    ];
    if (!Array.isArray(fallback.subjects)) fallback.subjects = [...defaultSubs];
    if (fallback.subjects.some((s: string) => s.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Mata pelajaran "${trimmed}" sudah terdaftar.`);
    }
    fallback.subjects.push(trimmed);
    if (!fallback.tujuan_pembelajaran_templates) fallback.tujuan_pembelajaran_templates = {};
    if (!fallback.tujuan_pembelajaran_templates[trimmed]) fallback.tujuan_pembelajaran_templates[trimmed] = [];
    if (typeof window !== 'undefined') {
      localStorage.setItem("smart_sts_db", JSON.stringify(fallback));
    }
    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "settings", "subjects"), { list: fallback.subjects }), 2500);
      } catch (e) {}
    }
    return fallback.subjects;
  },
  deleteSubject: async (name: string): Promise<string[]> => {
    const trimmed = decodeURIComponent(name || "").trim();
    const fallback = getLocalFallbackData();
    const defaultSubs = [
      "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPA", "IPS",
      "Bahasa Inggris", "PJOK", "Prakarya", "Informatika", "Bahasa Arab",
      "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"
    ];
    if (!Array.isArray(fallback.subjects)) fallback.subjects = [...defaultSubs];
    fallback.subjects = fallback.subjects.filter((s: string) => s.toLowerCase() !== trimmed.toLowerCase());
    if (fallback.tujuan_pembelajaran_templates && fallback.tujuan_pembelajaran_templates[trimmed]) {
      delete fallback.tujuan_pembelajaran_templates[trimmed];
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem("smart_sts_db", JSON.stringify(fallback));
    }
    if (db) {
      try {
        await withTimeout(setDoc(doc(db, "settings", "subjects"), { list: fallback.subjects }), 2500);
        await withTimeout(deleteDoc(doc(db, "tujuan_pembelajaran_templates", trimmed)), 2500).catch(() => {});
      } catch (e) {}
    }
    return fallback.subjects;
  }
};
export { db as default };
