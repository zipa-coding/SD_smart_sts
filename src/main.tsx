import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import dbData from './data/db.json';
import { isFirebaseConfigured, firebaseApi } from './lib/firebase';
import { registerSW } from 'virtual:pwa-register';

// Automatically register and update PWA service worker in production
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('Versi baru Raport STS tersedia. Memperbarui...');
    },
    onOfflineReady() {
      console.log('Aplikasi Raport STS siap digunakan secara offline.');
    },
  });
}

// Keep reference to original fetch
const originalFetch = window.fetch;

// Determine if we should use local localStorage mock API
// We use mock API if on *.github.io, if protocol is file:, or if there is no server running
const isStaticHost = 
  window.location.hostname.includes('github.io') || 
  window.location.hostname.includes('gmpg.io') ||
  window.location.protocol === 'file:';

// Memory cache for client-side storage simulation
let clientDbCache: any = null;

// Initialize localStorage with db.json seed data if empty
function initializeLocalStorage() {
  if (!clientDbCache) {
    const raw = localStorage.getItem('smart_sts_db');
    if (raw) {
      try {
        clientDbCache = JSON.parse(raw);
        // If stored database still has old SMP structure (e.g. teachers or students with kelas 7, 8, 9 and no 1-6), refresh with SD data
        const hasSmpTeachers = Array.isArray(clientDbCache.teachers) && clientDbCache.teachers.some((t: any) => ["7", "8", "9"].includes(t.kelas));
        const hasSdClasses = Array.isArray(clientDbCache.students) && clientDbCache.students.some((s: any) => ["1", "2", "3", "4", "5", "6"].includes(s.kelas));
        
        if (hasSmpTeachers || !hasSdClasses) {
          clientDbCache = dbData;
          localStorage.setItem('smart_sts_db', JSON.stringify(dbData));
          return;
        }

        // Ensure TP templates are strictly separated per class (Kelas 1 - 6)
        let needsSave = false;
        if (!clientDbCache.tujuan_pembelajaran_templates || typeof clientDbCache.tujuan_pembelajaran_templates !== 'object') {
          clientDbCache.tujuan_pembelajaran_templates = dbData.tujuan_pembelajaran_templates;
          needsSave = true;
        } else {
          const seedTemplates = dbData.tujuan_pembelajaran_templates as Record<string, any[]>;
          for (const sub of Object.keys(seedTemplates)) {
            const currentList = clientDbCache.tujuan_pembelajaran_templates[sub];
            if (
              !Array.isArray(currentList) ||
              currentList.length === 0 ||
              currentList.some((t: any) => !t.kelas || t.kelas === "all" || ["7", "8", "9"].includes(String(t.kelas))) ||
              !currentList.some((t: any) => String(t.kelas).trim() === "1") ||
              !currentList.some((t: any) => String(t.kelas).trim() === "6")
            ) {
              clientDbCache.tujuan_pembelajaran_templates[sub] = seedTemplates[sub];
              needsSave = true;
            }
          }
        }
        if (needsSave) {
          localStorage.setItem('smart_sts_db', JSON.stringify(clientDbCache));
        }
      } catch (e) {
        clientDbCache = dbData;
      }
    } else {
      clientDbCache = dbData;
      localStorage.setItem('smart_sts_db', JSON.stringify(dbData));
    }
  }
}

// Wrapper to simulate fetch for /api/* requests on static deployments
const localFetchInterception = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : (input as any).url || '';
  
  // Only intercept /api/ requests
  if (!urlStr.includes('/api/')) {
    return originalFetch(input, init);
  }

  initializeLocalStorage();
  const getDB = () => clientDbCache || JSON.parse(localStorage.getItem('smart_sts_db') || '{}');
  const saveDB = (data: any) => {
    clientDbCache = data;
    localStorage.setItem('smart_sts_db', JSON.stringify(data));
  };

  const path = urlStr.startsWith('http') 
    ? new URL(urlStr).pathname 
    : urlStr.split('?')[0];
    
  const method = init?.method?.toUpperCase() || 'GET';
  const body = init?.body ? JSON.parse(init.body as string) : null;

  try {
    if (isFirebaseConfigured) {
      try {
        // 1. POST /api/login
        if (path === '/api/login' && method === 'POST') {
          const user = await firebaseApi.login(body);
          if (!user) {
            return new Response(JSON.stringify({ error: "Kombinasi pengguna dan kata sandi salah." }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/verify-session
        if (path === '/api/verify-session' && method === 'POST') {
          const user = await firebaseApi.login(body);
          if (!user) {
            return new Response(JSON.stringify({ error: "Sesi tidak valid." }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 2. GET /api/teachers
        if (path === '/api/teachers' && method === 'GET') {
          const t = await firebaseApi.getTeachers();
          return new Response(JSON.stringify(t), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/teachers
        if (path === '/api/teachers' && method === 'POST') {
          try {
            const t = await firebaseApi.postTeacher(body);
            return new Response(JSON.stringify(t), { status: 201, headers: { 'Content-Type': 'application/json' } });
          } catch (e: any) {
            if (e.message?.includes("Username sudah digunakan") || e.message?.includes("wajib") || e.message?.includes("lengkap")) {
              return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            console.warn("Firestore postTeacher failed, falling back to local DB:", e);
            // Fall back to local DB processing
          }
        }

        // PUT /api/teachers/:id
        if (path.startsWith('/api/teachers/') && method === 'PUT') {
          const id = path.split('/').pop() || "";
          const t = await firebaseApi.putTeacher(id, body);
          return new Response(JSON.stringify(t), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // DELETE /api/teachers/:id
        if (path.startsWith('/api/teachers/') && method === 'DELETE') {
          const id = path.split('/').pop() || "";
          try {
            const res = await firebaseApi.deleteTeacher(id);
            return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
        }

        // 3. GET /api/students
        if (path === '/api/students' && method === 'GET') {
          const s = await firebaseApi.getStudents();
          return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/students
        if (path === '/api/students' && method === 'POST') {
          try {
            const s = await firebaseApi.postStudent(body);
            return new Response(JSON.stringify(s), { status: 201, headers: { 'Content-Type': 'application/json' } });
          } catch (e: any) {
            if (e.message?.includes("NISN") || e.message?.includes("wajib") || e.message?.includes("lengkap")) {
              return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            console.warn("Firestore postStudent failed, falling back to local DB:", e);
            // Fall back to local DB processing
          }
        }

        // POST /api/students/batch
        if (path === '/api/students/batch' && method === 'POST') {
          try {
            const res = await firebaseApi.postStudentsBatch(body?.students || []);
            return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch (e: any) {
            console.warn("Firestore postStudentsBatch failed, falling back:", e);
          }
        }

        // PUT /api/students/:id
        if (path.startsWith('/api/students/') && method === 'PUT') {
          const id = path.split('/').pop() || "";
          const s = await firebaseApi.putStudent(id, body);
          return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // DELETE /api/students/:id
        if (path.startsWith('/api/students/') && method === 'DELETE') {
          const id = path.split('/').pop() || "";
          const res = await firebaseApi.deleteStudent(id);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 4. GET /api/grades
        if (path === '/api/grades' && method === 'GET') {
          const g = await firebaseApi.getGrades();
          return new Response(JSON.stringify(g), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/grades
        if (path === '/api/grades' && method === 'POST') {
          const g = await firebaseApi.postGrade(body);
          return new Response(JSON.stringify(g), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 5. GET /api/walikelas/notes
        if (path === '/api/walikelas/notes' && method === 'GET') {
          const n = await firebaseApi.getWaliKelasNotes();
          return new Response(JSON.stringify(n), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/walikelas/notes
        if (path === '/api/walikelas/notes' && method === 'POST') {
          const n = await firebaseApi.postWaliKelasNotes(body);
          return new Response(JSON.stringify(n), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 6. GET /api/tps
        if (path === '/api/tps' && method === 'GET') {
          const tps = await firebaseApi.getTPs();
          return new Response(JSON.stringify(tps), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/tps
        if (path === '/api/tps' && method === 'POST') {
          const tp = await firebaseApi.postTP(body);
          return new Response(JSON.stringify(tp), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        // DELETE /api/tps/:subject/:tpId
        if (path.startsWith('/api/tps/') && method === 'DELETE') {
          const parts = path.split('/');
          const tpId = parts.pop() || "";
          const subject = decodeURIComponent(parts.pop() || '');
          const res = await firebaseApi.deleteTP(subject, tpId);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 7. GET /api/settings
        if (path === '/api/settings' && method === 'GET') {
          const s = await firebaseApi.getSettings();
          return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/settings
        if (path === '/api/settings' && method === 'POST') {
          const s = await firebaseApi.postSettings(body);
          return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 8. GET /api/summary
        if (path === '/api/summary' && method === 'GET') {
          const sum = await firebaseApi.getSummary();
          return new Response(JSON.stringify(sum), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 9. GET, POST, DELETE /api/ekskul for Firebase
        if (path === '/api/ekskul' && method === 'GET') {
          const e = await firebaseApi.getEkskul();
          return new Response(JSON.stringify(e), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (path === '/api/ekskul' && method === 'POST') {
          const e = await firebaseApi.postEkskul(body);
          return new Response(JSON.stringify(e), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        if (path.startsWith('/api/ekskul/') && method === 'DELETE') {
          const id = path.split('/').pop() || "";
          const res = await firebaseApi.deleteEkskul(id);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 10. Firestore Sync & Stats
        if (path === '/api/firestore-stats' && method === 'GET') {
          const stats = await firebaseApi.getFirestoreStats();
          return new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (path === '/api/firestore-sync' && method === 'POST') {
          const result = await firebaseApi.syncAllToFirestore();
          return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (firebaseErr) {
        console.warn("Firestore call failed, falling back to local database storage:", firebaseErr);
      }
    }

    // 1. POST /api/login
    if (path === '/api/login' && method === 'POST') {
      const { username, password } = body || {};
      const db = getDB();
      const teacher = db.teachers.find(
        (t: any) => t.username.toLowerCase() === username?.toLowerCase() && t.password === password
      );
      if (!teacher) {
        return new Response(JSON.stringify({ error: "Kombinasi pengguna dan kata sandi salah." }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        subject: teacher.subject,
        isWaliKelas: teacher.isWaliKelas || false,
        kelas: teacher.kelas || ""
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/verify-session
    if (path === '/api/verify-session' && method === 'POST') {
      const { username, password } = body || {};
      const db = getDB();
      const teacher = db.teachers.find(
        (t: any) => t.username.toLowerCase() === username?.toLowerCase() && t.password === password
      );
      if (!teacher) {
        return new Response(JSON.stringify({ error: "Sesi tidak valid." }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        subject: teacher.subject,
        isWaliKelas: teacher.isWaliKelas || false,
        kelas: teacher.kelas || ""
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. GET /api/teachers
    if (path === '/api/teachers' && method === 'GET') {
      const db = getDB();
      return new Response(JSON.stringify(db.teachers), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/teachers
    if (path === '/api/teachers' && method === 'POST') {
      const { name, username, password, subject, isWaliKelas, kelas } = body || {};
      const db = getDB();
      const exists = db.teachers.some((t: any) => t.username.toLowerCase() === username?.toLowerCase());
      if (exists) {
        return new Response(JSON.stringify({ error: "Username sudah digunakan." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const newTeacher = {
        id: "t_" + Date.now(),
        name,
        username,
        password,
        subject,
        isWaliKelas: !!isWaliKelas,
        kelas: kelas || ""
      };
      db.teachers.push(newTeacher);
      saveDB(db);
      return new Response(JSON.stringify(newTeacher), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // PUT /api/teachers/:id
    if (path.startsWith('/api/teachers/') && method === 'PUT') {
      const id = path.split('/').pop();
      const { name, username, password, subject, isWaliKelas, kelas } = body || {};
      const db = getDB();
      const index = db.teachers.findIndex((t: any) => t.id === id);
      if (index === -1) {
        return new Response(JSON.stringify({ error: "Guru tidak ditemukan." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      db.teachers[index] = { ...db.teachers[index], name, username, password, subject, isWaliKelas: !!isWaliKelas, kelas: kelas || "" };
      saveDB(db);
      return new Response(JSON.stringify(db.teachers[index]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE /api/teachers/:id
    if (path.startsWith('/api/teachers/') && method === 'DELETE') {
      const id = path.split('/').pop();
      if (id === 't1') {
        return new Response(JSON.stringify({ error: "Akun Super Admin utama tidak boleh dihapus." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const db = getDB();
      db.teachers = db.teachers.filter((t: any) => t.id !== id);
      saveDB(db);
      return new Response(JSON.stringify({ message: "Guru berhasil dihapus." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. GET /api/students
    if (path === '/api/students' && method === 'GET') {
      const db = getDB();
      return new Response(JSON.stringify(db.students), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/students
    if (path === '/api/students' && method === 'POST') {
      const { name, nisn, kelas } = body || {};
      const db = getDB();
      const exists = db.students.some((s: any) => s.nisn === nisn);
      if (exists) {
        return new Response(JSON.stringify({ error: "Siswa dengan NISN ini sudah terdaftar." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const newStudent = { id: "s_" + Date.now(), nisn, name, kelas };
      db.students.push(newStudent);
      saveDB(db);
      return new Response(JSON.stringify(newStudent), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/students/batch
    if (path === '/api/students/batch' && method === 'POST') {
      const studentsList = body?.students || [];
      const db = getDB();
      const existingNisns = new Set(db.students.map((s: any) => String(s.nisn || "").trim()));
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
        db.students.push(newStudent);
        addedStudents.push(newStudent);
      }

      if (addedStudents.length > 0) {
        saveDB(db);
      }

      return new Response(JSON.stringify({
        success: true,
        addedCount: addedStudents.length,
        duplicatesCount: duplicates.length,
        duplicates,
        errors,
        students: addedStudents,
        totalStudents: db.students.length
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // PUT /api/students/:id
    if (path.startsWith('/api/students/') && method === 'PUT') {
      const id = path.split('/').pop();
      const { name, nisn, kelas } = body || {};
      const db = getDB();
      const index = db.students.findIndex((s: any) => s.id === id);
      if (index === -1) {
        return new Response(JSON.stringify({ error: "Siswa tidak ditemukan." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      db.students[index] = { ...db.students[index], name, nisn, kelas };
      saveDB(db);
      return new Response(JSON.stringify(db.students[index]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE /api/students/:id
    if (path.startsWith('/api/students/') && method === 'DELETE') {
      const id = path.split('/').pop();
      const db = getDB();
      db.students = db.students.filter((s: any) => s.id !== id);
      db.grades = db.grades.filter((g: any) => g.studentId !== id);
      if (db.walikelas_notes && db.walikelas_notes[id!]) {
        delete db.walikelas_notes[id!];
      }
      saveDB(db);
      return new Response(JSON.stringify({ message: "Siswa berhasil dihapus." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 4. GET /api/grades
    if (path === '/api/grades' && method === 'GET') {
      const db = getDB();
      return new Response(JSON.stringify(db.grades), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/grades
    if (path === '/api/grades' && method === 'POST') {
      const { studentId, subject, score, tps, teacherName, usaha, proses, capaian, deskripsi } = body || {};
      const db = getDB();
      const index = db.grades.findIndex((g: any) => g.studentId === studentId && g.subject === subject);
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
      if (index !== -1) {
        db.grades[index] = updatedGrade;
      } else {
        db.grades.push(updatedGrade);
      }
      saveDB(db);
      return new Response(JSON.stringify(updatedGrade), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 5. GET /api/walikelas/notes
    if (path === '/api/walikelas/notes' && method === 'GET') {
      const db = getDB();
      return new Response(JSON.stringify(db.walikelas_notes || {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/walikelas/notes
    if (path === '/api/walikelas/notes' && method === 'POST') {
      const { studentId, sakit, izin, alpa, catatan, spiritualUsaha, spiritualProses, spiritualCapaian, spiritualDeskripsi, sosialUsaha, sosialProses, sosialCapaian, sosialDeskripsi, ekskul } = body || {};
      const db = getDB();
      if (!db.walikelas_notes) db.walikelas_notes = {};
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
        ekskul: ekskul || []
      };
      saveDB(db);
      return new Response(JSON.stringify({ studentId, ...db.walikelas_notes[studentId] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 6. GET /api/tps
    if (path === '/api/tps' && method === 'GET') {
      const db = getDB();
      const templates = db.tujuan_pembelajaran_templates || {};
      const urlObj = new URL(urlStr, 'http://localhost');
      const kelas = urlObj.searchParams.get('kelas');
      const subject = urlObj.searchParams.get('subject');

      if (subject) {
        let items = templates[subject] || [];
        if (kelas) {
          items = items.filter((item: any) => String(item.kelas || '').trim() === String(kelas).trim());
        }
        return new Response(JSON.stringify(items), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (kelas) {
        const filtered: Record<string, any[]> = {};
        for (const [sub, list] of Object.entries(templates)) {
          if (Array.isArray(list)) {
            filtered[sub] = list.filter((item: any) => String(item.kelas || '').trim() === String(kelas).trim());
          }
        }
        return new Response(JSON.stringify(filtered), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify(templates), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/tps
    if (path === '/api/tps' && method === 'POST') {
      const { subject, tpText, kelas } = body || {};
      const db = getDB();
      if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};
      if (!db.tujuan_pembelajaran_templates[subject]) db.tujuan_pembelajaran_templates[subject] = [];
      const newTP = { id: "tp_" + Date.now(), text: tpText, kelas: kelas ? String(kelas).trim() : "1" };
      db.tujuan_pembelajaran_templates[subject].push(newTP);
      saveDB(db);
      return new Response(JSON.stringify(newTP), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE /api/tps/:subject/:tpId
    if (path.startsWith('/api/tps/') && method === 'DELETE') {
      const parts = path.split('/');
      const tpId = parts.pop();
      const subject = decodeURIComponent(parts.pop() || '');
      const db = getDB();
      if (db.tujuan_pembelajaran_templates && db.tujuan_pembelajaran_templates[subject]) {
        db.tujuan_pembelajaran_templates[subject] = db.tujuan_pembelajaran_templates[subject].filter((tp: any) => tp.id !== tpId);
        saveDB(db);
        return new Response(JSON.stringify({ message: "TP berhasil dihapus." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: "TP tidak ditemukan." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // 6.5 GET /api/settings
    if (path === '/api/settings' && method === 'GET') {
      const db = getDB();
      const principalName = db.settings?.principalName || "Ustadz H. Ir. Abdul Muhyi, M.Pd";
      const principalNip = db.settings?.principalNip || "19780512 200501 1 002";
      const format = db.settings?.format || {
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
      };
      // If format doesn't have tanggalRaport, default it
      if (format && !format.tanggalRaport) {
        format.tanggalRaport = "17 Juni 2026";
      }
      return new Response(JSON.stringify({ principalName, principalNip, format }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/settings
    if (path === '/api/settings' && method === 'POST') {
      const { principalName, principalNip, format } = body || {};
      const db = getDB();
      if (!db.settings) db.settings = {};
      db.settings.principalName = principalName || "Ustadz H. Ir. Abdul Muhyi, M.Pd";
      db.settings.principalNip = principalNip || "19780512 200501 1 002";
      if (format) {
        db.settings.format = {
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
        };
      }
      saveDB(db);
      return new Response(JSON.stringify({ success: true, settings: db.settings }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // GET /api/ekskul
    if (path === '/api/ekskul' && method === 'GET') {
      const db = getDB();
      const defaultEkskul = [
        { "id": "e1", "name": "Pramuka", "type": "Wajib" },
        { "id": "e2", "name": "Mentoring", "type": "Wajib" },
        { "id": "e3", "name": "Futsal", "type": "Pilihan" },
        { "id": "e4", "name": "Voli", "type": "Pilihan" },
        { "id": "e5", "name": "Panahan", "type": "Pilihan" },
        { "id": "e6", "name": "Study Club", "type": "Pilihan" }
      ];
      if (!db.ekskul) {
        db.ekskul = defaultEkskul;
        saveDB(db);
      }
      return new Response(JSON.stringify(db.ekskul), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/ekskul
    if (path === '/api/ekskul' && method === 'POST') {
      const { name, type } = body || {};
      const db = getDB();
      if (!db.ekskul) {
        db.ekskul = [
          { "id": "e1", "name": "Pramuka", "type": "Wajib" },
          { "id": "e2", "name": "Mentoring", "type": "Wajib" },
          { "id": "e3", "name": "Futsal", "type": "Pilihan" },
          { "id": "e4", "name": "Voli", "type": "Pilihan" },
          { "id": "e5", "name": "Panahan", "type": "Pilihan" },
          { "id": "e6", "name": "Study Club", "type": "Pilihan" }
        ];
      }
      const newE = { id: "e_" + Date.now(), name, type };
      db.ekskul.push(newE);
      saveDB(db);
      return new Response(JSON.stringify(newE), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE /api/ekskul/:id
    if (path.startsWith('/api/ekskul/') && method === 'DELETE') {
      const id = path.split('/').pop() || "";
      const db = getDB();
      if (db.ekskul) {
        db.ekskul = db.ekskul.filter((e: any) => e.id !== id);
        saveDB(db);
      }
      return new Response(JSON.stringify({ message: "Ekskul deleted" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const DEFAULT_MAIN_SUBJECTS = [
      "PAI", "PPKN", "Bahasa Indonesia", "Matematika", "IPA", "IPS",
      "Bahasa Inggris", "PJOK", "Prakarya", "Informatika", "Bahasa Arab",
      "Tahsin ABaTaTsa", "Tahfizh Al-Qur’an", "Do’a Harian dan Hadits", "Wudhu dan Sholat"
    ];

    // GET /api/subjects
    if (path === '/api/subjects' && method === 'GET') {
      const db = getDB();
      if (!Array.isArray(db.subjects) || db.subjects.length === 0) {
        db.subjects = [...DEFAULT_MAIN_SUBJECTS];
        saveDB(db);
      }
      return new Response(JSON.stringify(db.subjects), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/subjects
    if (path === '/api/subjects' && method === 'POST') {
      const { name } = body || {};
      const trimmedName = String(name || "").trim();
      if (!trimmedName) {
        return new Response(JSON.stringify({ error: "Nama mata pelajaran wajib diisi." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const db = getDB();
      if (!Array.isArray(db.subjects) || db.subjects.length === 0) {
        db.subjects = [...DEFAULT_MAIN_SUBJECTS];
      }
      const exists = db.subjects.some((s: string) => s.toLowerCase() === trimmedName.toLowerCase());
      if (exists) {
        return new Response(JSON.stringify({ error: `Mata pelajaran "${trimmedName}" sudah terdaftar.` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      db.subjects.push(trimmedName);
      if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};
      if (!db.tujuan_pembelajaran_templates[trimmedName]) {
        db.tujuan_pembelajaran_templates[trimmedName] = [];
      }
      saveDB(db);
      return new Response(JSON.stringify({ message: "Mata pelajaran berhasil ditambahkan.", subjects: db.subjects }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE /api/subjects/:name
    if (path.startsWith('/api/subjects/') && method === 'DELETE') {
      const name = decodeURIComponent(path.replace('/api/subjects/', '')).trim();
      const db = getDB();
      if (!Array.isArray(db.subjects)) db.subjects = [...DEFAULT_MAIN_SUBJECTS];
      db.subjects = db.subjects.filter((s: string) => s.toLowerCase() !== name.toLowerCase());
      if (db.tujuan_pembelajaran_templates && db.tujuan_pembelajaran_templates[name]) {
        delete db.tujuan_pembelajaran_templates[name];
      }
      saveDB(db);
      return new Response(JSON.stringify({ message: `Mata pelajaran "${name}" berhasil dihapus.`, subjects: db.subjects }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 7. GET /api/summary
    if (path === '/api/summary' && method === 'GET') {
      const db = getDB();
      const subjectsList = Array.isArray(db.subjects) && db.subjects.length > 0
        ? db.subjects
        : DEFAULT_MAIN_SUBJECTS;
      const totalStudents = db.students.length;
      const registeredStudentIds = new Set(db.students.map((s: any) => s.id));

      const subjectProgress = subjectsList.map(sub => {
        const filledGradesForSub = db.grades.filter((g: any) => g.subject === sub && registeredStudentIds.has(g.studentId));
        const completedCount = filledGradesForSub.length;
        const percentage = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
        const teacher = db.teachers.find((t: any) => t.subject === sub);
        return {
          subject: sub,
          completed: completedCount,
          total: totalStudents,
          percent: percentage,
          teacherName: teacher ? teacher.name : "Belum Ditugaskan"
        };
      });

      const classSet = new Set(["1", "2", "3", "4", "5", "6"]);
      db.students.forEach((s: any) => {
        const k = String(s.kelas || "").trim();
        if (k) classSet.add(k);
      });
      const classes = Array.from(classSet).sort();

      const classProgress = classes.map(cls => {
        const studentsInClass = db.students.filter((s: any) => String(s.kelas || "").trim() === cls);
        const totalGradesNeeded = studentsInClass.length * subjectsList.length;
        let gradesFilledCount = 0;
        const studentIds = new Set(studentsInClass.map((s: any) => s.id));
        db.grades.forEach((g: any) => {
          if (studentIds.has(g.studentId)) {
            gradesFilledCount++;
          }
        });
        const percent = totalGradesNeeded > 0 ? Math.round((gradesFilledCount / totalGradesNeeded) * 100) : 0;
        const waliKelas = db.teachers.find((t: any) => t.isWaliKelas && String(t.kelas || "").trim() === cls);
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

      return new Response(JSON.stringify({
        totalStudents,
        totalTeachers: db.teachers.length,
        subjectProgress,
        classProgress,
        studentRankings,
        lastUpdate: new Date().toISOString()
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: "Endpoint not found in client-side mock" }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("Local mock server error:", error);
    return new Response(JSON.stringify({ error: "Internal client-server error in mock mode" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// Implement global window.fetch fallback strategy
const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : (input as any).url || '';

  // Non-API fetches are bypassed
  if (!urlStr.includes('/api/')) {
    return originalFetch(input, init);
  }

  // If Firebase is configured or on static hosting without backend, route directly to Firestore / client database
  if (isFirebaseConfigured || isStaticHost) {
    return localFetchInterception(input, init);
  }

  // Always try real backend first, seamlessly fallback if static host serves index.html fallback
  try {
    const res = await originalFetch(input, init);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    
    // If the server returned HTML (e.g. index.html SPA fallback), or non-200 non-JSON, intercept immediately
    if (contentType.includes('text/html') || res.status === 404 || (!res.ok && !contentType.includes('json'))) {
      return localFetchInterception(input, init);
    }
    return res;
  } catch (error) {
    // Server down or offline -> fallback to client-side database
    console.warn("Server API offline, falling back to client-side database:", error);
    return localFetchInterception(input, init);
  }
};

try {
  Object.defineProperty(window, 'fetch', {
    value: customFetch,
    configurable: true,
    writable: true,
    enumerable: true
  });
} catch (error) {
  console.warn("Failed to redefine window.fetch with Object.defineProperty, falling back to direct assignment:", error);
  try {
    (window as any).fetch = customFetch;
  } catch (directError) {
    console.error("Failed to assign fetch on window directly:", directError);
  }
}

// Mount application
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

