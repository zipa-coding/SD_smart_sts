import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import dbData from './data/db.json';
import { isFirebaseConfigured, firebaseApi, isDummyTeacher } from './lib/firebase';
import { normalizeSubjectKey, matchTpClass, isSampleTp, cleanTpList } from './types';
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
        // Only reset if stored database still has old SMP structure (e.g. teachers with kelas 7, 8, 9)
        const hasSmpTeachers = Array.isArray(clientDbCache.teachers) && clientDbCache.teachers.some((t: any) => ["7", "8", "9"].includes(t.kelas));
        
        if (hasSmpTeachers) {
          clientDbCache = dbData;
          localStorage.setItem('smart_sts_db', JSON.stringify(dbData));
          return;
        }

        // Purge dummy sample teachers (t2-t7) if present
        let changed = false;
        if (Array.isArray(clientDbCache.teachers)) {
          const prevCount = clientDbCache.teachers.length;
          clientDbCache.teachers = clientDbCache.teachers.filter((t: any) => !isDummyTeacher(t));
          if (clientDbCache.teachers.length !== prevCount) {
            changed = true;
          }
        }

        // Normalize legacy ekskul names (e.g. Futsal Kids -> Futsal)
        if (Array.isArray(clientDbCache.ekskul)) {
          clientDbCache.ekskul.forEach((e: any) => {
            if (e.name === "Futsal Kids") {
              e.name = "Futsal";
              changed = true;
            }
          });
        }
        if (Array.isArray(clientDbCache.teachers)) {
          clientDbCache.teachers.forEach((t: any) => {
            if (t.ekskulName === "Futsal Kids") {
              t.ekskulName = "Futsal";
              changed = true;
            }
          });
        }

        // Purge obsolete separated duplicate teacher accounts
        const purgedTeacherIds = new Set([
          "t_1790913955043",
          "t_1790914206952",
          "t_1790914287812",
          "t_1790914329138"
        ]);
        if (Array.isArray(clientDbCache.teachers)) {
          const prevLen = clientDbCache.teachers.length;
          clientDbCache.teachers = clientDbCache.teachers.filter(
            (t: any) => !purgedTeacherIds.has(String(t.id)) && !isDummyTeacher(t)
          );
          if (clientDbCache.teachers.length !== prevLen) {
            changed = true;
          }
        }

        // Apply explicit principal name/NIP if saved or retain current settings
        try {
          const explicitPrincipal = localStorage.getItem('smart_sts_principal_name');
          const explicitNip = localStorage.getItem('smart_sts_principal_nip');
          if (!clientDbCache.settings) clientDbCache.settings = {};
          
          if (explicitPrincipal && explicitPrincipal.trim()) {
            clientDbCache.settings.principalName = explicitPrincipal.trim();
          } else if (!clientDbCache.settings.principalName) {
            clientDbCache.settings.principalName = "Sobariyani, S.Pd.";
            localStorage.setItem('smart_sts_principal_name', "Sobariyani, S.Pd.");
            changed = true;
          }
          
          if (explicitNip && explicitNip.trim()) {
            clientDbCache.settings.principalNip = explicitNip.trim();
          } else if (!clientDbCache.settings.principalNip) {
            clientDbCache.settings.principalNip = "19800101 200501 1 003";
            localStorage.setItem('smart_sts_principal_nip', "19800101 200501 1 003");
            changed = true;
          }
        } catch (e) {}

        // Initialize TP templates if completely missing
        if (!clientDbCache.tujuan_pembelajaran_templates || typeof clientDbCache.tujuan_pembelajaran_templates !== 'object') {
          clientDbCache.tujuan_pembelajaran_templates = {};
          changed = true;
        } else {
          // Purge any legacy sample / dummy TPs from clientDbCache
          for (const key of Object.keys(clientDbCache.tujuan_pembelajaran_templates)) {
            const list = clientDbCache.tujuan_pembelajaran_templates[key];
            if (Array.isArray(list)) {
              const prevLen = list.length;
              clientDbCache.tujuan_pembelajaran_templates[key] = cleanTpList(list);
              if (clientDbCache.tujuan_pembelajaran_templates[key].length !== prevLen) {
                changed = true;
              }
            }
          }
        }

        if (changed) {
          localStorage.setItem('smart_sts_db', JSON.stringify(clientDbCache));
        }
      } catch (e) {
        clientDbCache = dbData;
      }
    } else {
      clientDbCache = dbData;
      if (clientDbCache.tujuan_pembelajaran_templates && typeof clientDbCache.tujuan_pembelajaran_templates === 'object') {
        for (const key of Object.keys(clientDbCache.tujuan_pembelajaran_templates)) {
          if (Array.isArray(clientDbCache.tujuan_pembelajaran_templates[key])) {
            clientDbCache.tujuan_pembelajaran_templates[key] = cleanTpList(clientDbCache.tujuan_pembelajaran_templates[key]);
          }
        }
      }
      localStorage.setItem('smart_sts_db', JSON.stringify(clientDbCache));
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
  const getDB = () => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('smart_sts_db');
        if (raw) {
          clientDbCache = JSON.parse(raw);
          if (Array.isArray(clientDbCache.teachers)) {
            clientDbCache.teachers = clientDbCache.teachers.filter((t: any) => !isDummyTeacher(t));
          }
          return clientDbCache;
        }
      }
    } catch (e) {}
    const db = clientDbCache || JSON.parse(JSON.stringify(dbData));
    if (Array.isArray(db.teachers)) {
      db.teachers = db.teachers.filter((t: any) => !isDummyTeacher(t));
    }
    return db;
  };
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
            // Forward write to backend server so db.json is updated permanently
            originalFetch(urlStr, init).catch((err) => console.warn("Backend teacher post sync:", err));
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
          // Forward write to backend server so db.json is updated permanently
          originalFetch(urlStr, init).catch((err) => console.warn("Backend teacher put sync:", err));
          const t = await firebaseApi.putTeacher(id, body);
          return new Response(JSON.stringify(t), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // DELETE /api/teachers/:id
        if (path.startsWith('/api/teachers/') && method === 'DELETE') {
          const id = path.split('/').pop() || "";
          originalFetch(urlStr, init).catch((err) => console.warn("Backend teacher delete sync:", err));
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

        // DELETE /api/students/batch or POST /api/students/delete-batch
        if ((path === '/api/students/batch' && method === 'DELETE') || (path === '/api/students/delete-batch' && method === 'POST')) {
          const ids = body?.ids || [];
          const res = await firebaseApi.deleteStudentsBatch(ids);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
          const urlObj = new URL(urlStr, 'http://localhost');
          const kelasParam = urlObj.searchParams.get('kelas') || undefined;
          const tps = await firebaseApi.getTPs(kelasParam);
          return new Response(JSON.stringify(tps), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/tps
        if (path === '/api/tps' && method === 'POST') {
          try {
            // Forward write to backend server so db.json is updated permanently!
            originalFetch(urlStr, init).catch((err) => console.warn("Backend tps post sync:", err));
          } catch (e) {}

          const tp = await firebaseApi.postTP(body);

          // Also update clientDbCache in memory
          try {
            const db = getDB();
            if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};
            const sub = body?.subject || "PAI";
            let targetKey = sub;
            for (const k of Object.keys(db.tujuan_pembelajaran_templates)) {
              if (k === sub || normalizeSubjectKey(k) === normalizeSubjectKey(sub)) {
                targetKey = k;
                break;
              }
            }
            if (!Array.isArray(db.tujuan_pembelajaran_templates[targetKey])) {
              db.tujuan_pembelajaran_templates[targetKey] = [];
            }
            if (!db.tujuan_pembelajaran_templates[targetKey].some((x: any) => x.id === tp.id)) {
              db.tujuan_pembelajaran_templates[targetKey].push(tp);
            }
            if (targetKey !== sub) {
              db.tujuan_pembelajaran_templates[sub] = db.tujuan_pembelajaran_templates[targetKey];
            }
            saveDB(db);
          } catch (e) {}

          return new Response(JSON.stringify(tp), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        // PUT /api/tps/:subject/:tpId or /api/tp/:subject/:tpId
        if ((path.startsWith('/api/tps/') || path.startsWith('/api/tp/')) && method === 'PUT') {
          try {
            originalFetch(urlStr, init).catch((err) => console.warn("Backend tps put sync:", err));
          } catch (e) {}

          const raw = path.replace(/^\/api\/(?:tps|tp)\//, '');
          const parts = raw.split('/');
          const tpId = decodeURIComponent(parts.pop() || '').trim();
          const subject = decodeURIComponent(parts.join('/') || '').trim();
          const res = await firebaseApi.updateTP(subject, tpId, body);

          try {
            const db = getDB();
            if (db.tujuan_pembelajaran_templates) {
              for (const key of Object.keys(db.tujuan_pembelajaran_templates)) {
                if (!subject || key === subject || normalizeSubjectKey(key) === normalizeSubjectKey(subject)) {
                  if (Array.isArray(db.tujuan_pembelajaran_templates[key])) {
                    db.tujuan_pembelajaran_templates[key] = db.tujuan_pembelajaran_templates[key].map((item: any) => {
                      if (String(item.id).trim() === tpId) {
                        return {
                          ...item,
                          ...(body?.text !== undefined ? { text: String(body.text).trim() } : {}),
                          ...(body?.kelas !== undefined ? { kelas: String(body.kelas).trim() } : {}),
                        };
                      }
                      return item;
                    });
                  }
                }
              }
            }
            saveDB(db);
          } catch (e) {}

          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // DELETE /api/tps/:subject/:tpId or /api/tp/:subject/:tpId
        if ((path.startsWith('/api/tps/') || path.startsWith('/api/tp/')) && method === 'DELETE') {
          try {
            originalFetch(urlStr, init).catch((err) => console.warn("Backend tps delete sync:", err));
          } catch (e) {}

          const raw = path.replace(/^\/api\/(?:tps|tp)\//, '');
          const parts = raw.split('/');
          const tpId = parts.pop() || "";
          const subject = decodeURIComponent(parts.join('/'));
          const res = await firebaseApi.deleteTP(subject, tpId);

          try {
            const db = getDB();
            if (db.tujuan_pembelajaran_templates) {
              for (const key of Object.keys(db.tujuan_pembelajaran_templates)) {
                if (!subject || key === subject || normalizeSubjectKey(key) === normalizeSubjectKey(subject)) {
                  if (Array.isArray(db.tujuan_pembelajaran_templates[key])) {
                    db.tujuan_pembelajaran_templates[key] = db.tujuan_pembelajaran_templates[key].filter(
                      (x: any) => String(x.id).trim() !== tpId
                    );
                  }
                }
              }
            }
            saveDB(db);
          } catch (e) {}

          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // GET, POST, DELETE /api/subjects
        if (path === '/api/subjects' && method === 'GET') {
          const s = await firebaseApi.getSubjects();
          return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (path === '/api/subjects' && method === 'POST') {
          const s = await firebaseApi.postSubject(body?.name);
          return new Response(JSON.stringify({ message: "Mata pelajaran berhasil ditambahkan.", subjects: s }), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        if (path.startsWith('/api/subjects/') && method === 'DELETE') {
          const name = decodeURIComponent(path.replace('/api/subjects/', '')).trim();
          const s = await firebaseApi.deleteSubject(name);
          return new Response(JSON.stringify({ message: `Mata pelajaran "${name}" berhasil dihapus.`, subjects: s }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 7. GET /api/settings
        if (path === '/api/settings' && method === 'GET') {
          const s = await firebaseApi.getSettings();
          return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST /api/settings
        if (path === '/api/settings' && method === 'POST') {
          originalFetch(urlStr, init).catch((err) => console.warn("Backend settings post sync:", err));
          const s = await firebaseApi.postSettings(body);
          return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 8. GET /api/summary
        if (path === '/api/summary' && method === 'GET') {
          const sum = await firebaseApi.getSummary();
          return new Response(JSON.stringify(sum), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 9. GET, POST, PUT, DELETE /api/ekskul for Firebase
        if (path === '/api/ekskul' && method === 'GET') {
          const e = await firebaseApi.getEkskul();
          return new Response(JSON.stringify(e), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (path === '/api/ekskul' && method === 'POST') {
          const e = await firebaseApi.postEkskul(body);
          return new Response(JSON.stringify(e), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        if (path.startsWith('/api/ekskul/') && path.endsWith('/assign-teacher') && method === 'POST') {
          const id = path.replace('/api/ekskul/', '').replace('/assign-teacher', '');
          const res = await firebaseApi.assignTeacherEkskul(id, body?.teacherId);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (path.startsWith('/api/ekskul/') && method === 'PUT') {
          const id = path.split('/').pop() || "";
          const res = await firebaseApi.putEkskul(id, body);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (path.startsWith('/api/ekskul/') && method === 'DELETE') {
          const id = path.split('/').pop() || "";
          const res = await firebaseApi.deleteEkskul(id);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // GET & POST /api/ekskul/grades
        if (path === '/api/ekskul/grades' && method === 'GET') {
          const notes = await firebaseApi.getWaliKelasNotes();
          return new Response(JSON.stringify(notes), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (path === '/api/ekskul/grades' && method === 'POST') {
          const res = await firebaseApi.postEkskulGrade(body);
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
      const cleanUser = String(username || '').trim().toLowerCase();
      const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normUser = normalize(username);

      const teacher = db.teachers.find((t: any) => {
        const passMatch = t.password === password || (!t.password && password === "123");
        if (!passMatch) return false;
        const tUser = String(t.username || '').trim().toLowerCase();
        const tName = String(t.name || '').trim().toLowerCase();
        if (tUser === cleanUser || tName === cleanUser) return true;
        if (normUser && (normalize(t.username) === normUser || normalize(t.name) === normUser)) return true;
        if (Array.isArray(t.aliases)) {
          if (t.aliases.some((a: string) => String(a).toLowerCase().trim() === cleanUser || (normUser && normalize(a) === normUser))) return true;
        }
        return false;
      });
      if (!teacher) {
        return new Response(JSON.stringify({ error: "Kombinasi pengguna dan kata sandi salah." }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const assignedEks = Array.isArray(db.ekskul)
        ? db.ekskul.find(
            (e: any) =>
              (e.teacherId && String(e.teacherId) === String(teacher.id)) ||
              (teacher.isEkskulTeacher && teacher.ekskulName && e.name.toLowerCase().trim() === teacher.ekskulName.toLowerCase().trim())
          )
        : null;
      const teacherSubs = Array.isArray(teacher.subjects) && teacher.subjects.length > 0
        ? teacher.subjects
        : (teacher.subject ? String(teacher.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean) : []);
      return new Response(JSON.stringify({
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        subject: teacher.subject,
        subjects: teacherSubs.length > 0 ? teacherSubs : [teacher.subject || "PAI"],
        isWaliKelas: teacher.isWaliKelas || false,
        kelas: teacher.kelas || "",
        isEkskulTeacher: Boolean(teacher.isEkskulTeacher || assignedEks),
        ekskulName: assignedEks ? assignedEks.name : (teacher.ekskulName || "")
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/verify-session
    if (path === '/api/verify-session' && method === 'POST') {
      const { username, password } = body || {};
      const db = getDB();
      const cleanUser = String(username || '').trim().toLowerCase();
      const teacher = db.teachers.find(
        (t: any) =>
          (t.username.toLowerCase() === cleanUser ||
           t.name.toLowerCase() === cleanUser ||
           (Array.isArray(t.aliases) && t.aliases.some((a: string) => a.toLowerCase() === cleanUser))) &&
          t.password === password
      );
      if (!teacher) {
        return new Response(JSON.stringify({ error: "Sesi tidak valid." }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const assignedEks = Array.isArray(db.ekskul)
        ? db.ekskul.find(
            (e: any) =>
              (e.teacherId && String(e.teacherId) === String(teacher.id)) ||
              (teacher.isEkskulTeacher && teacher.ekskulName && e.name.toLowerCase().trim() === teacher.ekskulName.toLowerCase().trim())
          )
        : null;
      const teacherSubs = Array.isArray(teacher.subjects) && teacher.subjects.length > 0
        ? teacher.subjects
        : (teacher.subject ? String(teacher.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean) : []);
      return new Response(JSON.stringify({
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        subject: teacher.subject,
        subjects: teacherSubs.length > 0 ? teacherSubs : [teacher.subject || "PAI"],
        isWaliKelas: teacher.isWaliKelas || false,
        kelas: teacher.kelas || "",
        isEkskulTeacher: Boolean(teacher.isEkskulTeacher || assignedEks),
        ekskulName: assignedEks ? assignedEks.name : (teacher.ekskulName || "")
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. GET /api/teachers
    if (path === '/api/teachers' && method === 'GET') {
      const db = getDB();
      if (!Array.isArray(db.teachers)) db.teachers = [];
      if (!Array.isArray(db.ekskul)) db.ekskul = [];

      const list = db.teachers
        .filter((t: any) => !isDummyTeacher(t))
        .map((t: any) => {
        const eks = db.ekskul.find(
          (e: any) =>
            (e.teacherId && String(e.teacherId) === String(t.id)) ||
            (t.isEkskulTeacher && t.ekskulName && e.name.toLowerCase().trim() === t.ekskulName.toLowerCase().trim())
        );
        const subs = Array.isArray(t.subjects) && t.subjects.length > 0
          ? t.subjects
          : (t.subject ? String(t.subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean) : []);
        const base = {
          ...t,
          subjects: subs.length > 0 ? subs : [t.subject || "PAI"],
          isEkskulTeacher: Boolean(t.isEkskulTeacher || eks),
          ekskulName: eks ? eks.name : (t.ekskulName || ""),
        };
        if (eks) {
          return {
            ...base,
            isEkskulTeacher: true,
            ekskulName: eks.name,
          };
        }
        return base;
      });

      return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/teachers
    if (path === '/api/teachers' && method === 'POST') {
      const { name, username, password, subject, subjects, isWaliKelas, kelas, isEkskulTeacher, ekskulName } = body || {};
      const db = getDB();
      const exists = db.teachers.some((t: any) => t.username.toLowerCase() === username?.toLowerCase());
      if (exists) {
        return new Response(JSON.stringify({ error: "Username sudah digunakan." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      let finalSubjects: string[] = [];
      if (Array.isArray(subjects) && subjects.length > 0) {
        finalSubjects = Array.from(new Set(subjects.map((s: any) => String(s || '').trim()).filter(Boolean)));
      } else if (subject) {
        finalSubjects = Array.from(new Set(String(subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
      }
      if (finalSubjects.length === 0) finalSubjects = [subject || "PAI"];
      const finalSubjectStr = finalSubjects.join(", ");

      let finalEkskuls: string[] = [];
      if (Array.isArray(body?.ekskulNames) && body.ekskulNames.length > 0) {
        finalEkskuls = Array.from(new Set(body.ekskulNames.map((s: any) => String(s || '').trim()).filter(Boolean)));
      } else if (ekskulName) {
        finalEkskuls = Array.from(new Set(String(ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
      }
      const isEks = Boolean(isEkskulTeacher && finalEkskuls.length > 0);
      const cleanEksName = isEks ? finalEkskuls.join(", ") : "";

      const newTeacher = {
        id: "t_" + Date.now(),
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
      db.teachers.push(newTeacher);

      if (!Array.isArray(db.ekskul)) db.ekskul = [];
      if (isEks && finalEkskuls.length > 0) {
        finalEkskuls.forEach((eksName) => {
          let matchedEks = db.ekskul.find(
            (e: any) => e.name.toLowerCase().trim() === eksName.toLowerCase().trim()
          );
          if (!matchedEks) {
            matchedEks = { id: "e_" + Date.now() + Math.random().toString(36).substr(2, 4), name: eksName, type: "Pilihan", teacherId: newTeacher.id, teacherName: newTeacher.name };
            db.ekskul.push(matchedEks);
          } else {
            matchedEks.teacherId = newTeacher.id;
            matchedEks.teacherName = newTeacher.name;
          }
        });
      }

      saveDB(db);
      return new Response(JSON.stringify(newTeacher), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // PUT /api/teachers/:id
    if (path.startsWith('/api/teachers/') && method === 'PUT') {
      const id = path.split('/').pop();
      const { name, username, password, subject, subjects, isWaliKelas, kelas, isEkskulTeacher, ekskulName, ekskulNames } = body || {};
      const db = getDB();
      const index = db.teachers.findIndex((t: any) => t.id === id);
      if (index === -1) {
        return new Response(JSON.stringify({ error: "Guru tidak ditemukan." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      let finalSubjects: string[] = [];
      if (Array.isArray(subjects) && subjects.length > 0) {
        finalSubjects = Array.from(new Set(subjects.map((s: any) => String(s || '').trim()).filter(Boolean)));
      } else if (subject) {
        finalSubjects = Array.from(new Set(String(subject).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
      }
      if (finalSubjects.length === 0) finalSubjects = [subject || "PAI"];
      const finalSubjectStr = finalSubjects.join(", ");

      let finalEkskuls: string[] = [];
      if (Array.isArray(ekskulNames) && ekskulNames.length > 0) {
        finalEkskuls = Array.from(new Set(ekskulNames.map((s: any) => String(s || '').trim()).filter(Boolean)));
      } else if (ekskulName) {
        finalEkskuls = Array.from(new Set(String(ekskulName).split(',').map((s: any) => String(s || '').trim()).filter(Boolean)));
      }
      const isEks = Boolean(isEkskulTeacher && finalEkskuls.length > 0);
      const cleanEksName = isEks ? finalEkskuls.join(", ") : "";

      db.teachers[index] = {
        ...db.teachers[index],
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

      if (!Array.isArray(db.ekskul)) db.ekskul = [];
      if (isEks && finalEkskuls.length > 0) {
        finalEkskuls.forEach((eksName) => {
          let matchedEks = db.ekskul.find(
            (e: any) => e.name.toLowerCase().trim() === eksName.toLowerCase().trim()
          );
          if (!matchedEks) {
            matchedEks = { id: "e_" + Date.now() + Math.random().toString(36).substr(2, 4), name: eksName, type: "Pilihan", teacherId: id, teacherName: db.teachers[index].name };
            db.ekskul.push(matchedEks);
          } else {
            matchedEks.teacherId = id;
            matchedEks.teacherName = db.teachers[index].name;
          }
        });
      }

      db.ekskul.forEach((e: any) => {
        if (String(e.teacherId) === String(id)) {
          if (!isEks || !finalEkskuls.some((fn) => fn.toLowerCase().trim() === e.name.toLowerCase().trim())) {
            e.teacherId = "";
            e.teacherName = "";
          }
        }
      });

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

    // DELETE /api/students/batch or POST /api/students/delete-batch
    if ((path === '/api/students/batch' && method === 'DELETE') || (path === '/api/students/delete-batch' && method === 'POST')) {
      const ids: string[] = body?.ids || [];
      const db = getDB();
      const idSet = new Set(ids.map(String));
      db.students = db.students.filter((s: any) => !idSet.has(String(s.id)));
      db.grades = db.grades.filter((g: any) => !idSet.has(String(g.studentId)));
      if (db.walikelas_notes) {
        ids.forEach(id => { delete db.walikelas_notes[id]; });
      }
      saveDB(db);
      return new Response(JSON.stringify({ message: `${ids.length} siswa berhasil dihapus.`, deletedCount: ids.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
      const rawTemplates = db.tujuan_pembelajaran_templates || {};
      const templates: Record<string, any[]> = {};
      for (const [k, v] of Object.entries(rawTemplates)) {
        if (Array.isArray(v)) {
          templates[k] = cleanTpList(v);
        }
      }
      const urlObj = new URL(urlStr, 'http://localhost');
      const kelas = urlObj.searchParams.get('kelas');
      const subject = urlObj.searchParams.get('subject');

      if (subject) {
        let items: any[] = [];
        const normTarget = normalizeSubjectKey(subject);
        for (const [k, v] of Object.entries(templates)) {
          if ((k === subject || normalizeSubjectKey(k) === normTarget) && Array.isArray(v)) {
            items = v;
            break;
          }
        }
        if (kelas) {
          items = items.filter((item: any) => matchTpClass(item.kelas, kelas));
        }
        return new Response(JSON.stringify(items), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (kelas) {
        const filtered: Record<string, any[]> = {};
        for (const [sub, list] of Object.entries(templates)) {
          if (Array.isArray(list)) {
            filtered[sub] = list.filter((item: any) => matchTpClass(item.kelas, kelas));
          }
        }
        return new Response(JSON.stringify(filtered), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify(templates), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/tps
    if (path === '/api/tps' && method === 'POST') {
      try {
        originalFetch(urlStr, init).catch((err) => console.warn("Backend fallback tps post sync:", err));
      } catch (e) {}

      const { subject, tpText, kelas } = body || {};
      const db = getDB();
      if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};
      const cleanSub = String(subject || "").trim();
      let targetKey = cleanSub;
      for (const k of Object.keys(db.tujuan_pembelajaran_templates)) {
        if (k === cleanSub || normalizeSubjectKey(k) === normalizeSubjectKey(cleanSub)) {
          targetKey = k;
          break;
        }
      }
      if (!Array.isArray(db.tujuan_pembelajaran_templates[targetKey])) {
        db.tujuan_pembelajaran_templates[targetKey] = [];
      }
      const newTP = { id: "tp_" + Date.now(), text: String(tpText || "").trim(), kelas: kelas ? String(kelas).trim() : "1" };
      db.tujuan_pembelajaran_templates[targetKey].push(newTP);
      if (targetKey !== cleanSub) {
        db.tujuan_pembelajaran_templates[cleanSub] = db.tujuan_pembelajaran_templates[targetKey];
      }
      saveDB(db);
      return new Response(JSON.stringify(newTP), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // PUT /api/tps/:subject/:tpId or /api/tp/:subject/:tpId
    if ((path.startsWith('/api/tps/') || path.startsWith('/api/tp/')) && method === 'PUT') {
      try {
        originalFetch(urlStr, init).catch((err) => console.warn("Backend fallback tps put sync:", err));
      } catch (e) {}

      const raw = path.replace(/^\/api\/(?:tps|tp)\//, '');
      const parts = raw.split('/');
      const tpId = decodeURIComponent(parts.pop() || '').trim();
      const subject = decodeURIComponent(parts.join('/') || '').trim();
      const db = getDB();
      if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};

      const norm = (s: string) => s.replace(/[’'`]/g, "'").toLowerCase().trim();
      const targetNorm = norm(subject);

      for (const key of Object.keys(db.tujuan_pembelajaran_templates)) {
        if (!subject || key === subject || norm(key) === targetNorm) {
          const list = db.tujuan_pembelajaran_templates[key];
          if (Array.isArray(list)) {
            db.tujuan_pembelajaran_templates[key] = list.map((tp: any) => {
              if (String(tp.id).trim() === tpId) {
                return {
                  ...tp,
                  ...(body?.text !== undefined ? { text: String(body.text).trim() } : {}),
                  ...(body?.kelas !== undefined ? { kelas: String(body.kelas).trim() } : {}),
                };
              }
              return tp;
            });
          }
        }
      }

      saveDB(db);
      return new Response(JSON.stringify({ message: "TP berhasil diperbarui.", id: tpId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE /api/tps/:subject/:tpId or /api/tp/:subject/:tpId
    if ((path.startsWith('/api/tps/') || path.startsWith('/api/tp/')) && method === 'DELETE') {
      const raw = path.replace(/^\/api\/(?:tps|tp)\//, '');
      const parts = raw.split('/');
      const tpId = decodeURIComponent(parts.pop() || '').trim();
      const subject = decodeURIComponent(parts.join('/') || '').trim();
      const db = getDB();
      if (!db.tujuan_pembelajaran_templates) db.tujuan_pembelajaran_templates = {};

      const norm = (s: string) => s.replace(/[’'`]/g, "'").toLowerCase().trim();
      const targetNorm = norm(subject);

      for (const key of Object.keys(db.tujuan_pembelajaran_templates)) {
        if (!subject || key === subject || norm(key) === targetNorm) {
          const list = db.tujuan_pembelajaran_templates[key];
          if (Array.isArray(list)) {
            db.tujuan_pembelajaran_templates[key] = list.filter(
              (tp: any) => String(tp.id).trim() !== tpId
            );
          }
        }
      }

      // Also global search across all subjects for this tpId
      for (const key of Object.keys(db.tujuan_pembelajaran_templates)) {
        const list = db.tujuan_pembelajaran_templates[key];
        if (Array.isArray(list)) {
          db.tujuan_pembelajaran_templates[key] = list.filter(
            (tp: any) => String(tp.id).trim() !== tpId
          );
        }
      }

      saveDB(db);
      return new Response(JSON.stringify({ message: "TP berhasil dihapus." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 6.5 GET /api/settings
    if (path === '/api/settings' && method === 'GET') {
      const db = getDB();
      const explicitName = typeof window !== 'undefined' ? localStorage.getItem('smart_sts_principal_name') : null;
      const explicitNip = typeof window !== 'undefined' ? localStorage.getItem('smart_sts_principal_nip') : null;
      const principalName = (explicitName && explicitName.trim()) || db.settings?.principalName || "Sobariyani, S.Pd.";
      const principalNip = (explicitNip && explicitNip.trim()) || (db.settings?.principalNip !== undefined ? db.settings.principalNip : "19800101 200501 1 003");
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
        ...(db.settings?.format || {})
      };
      return new Response(JSON.stringify({ principalName, principalNip, format, settings: { principalName, principalNip, format } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/settings
    if (path === '/api/settings' && method === 'POST') {
      const { principalName, principalNip, format } = body || {};
      const db = getDB();
      if (!db.settings) db.settings = {};
      if (principalName !== undefined && typeof principalName === 'string' && principalName.trim() !== '') {
        db.settings.principalName = principalName.trim();
        try {
          localStorage.setItem('smart_sts_principal_name', principalName.trim());
        } catch (e) {}
      }
      if (principalNip !== undefined && typeof principalNip === 'string') {
        db.settings.principalNip = principalNip.trim();
        try {
          localStorage.setItem('smart_sts_principal_nip', principalNip.trim());
        } catch (e) {}
      }
      if (format && typeof format === 'object') {
        db.settings.format = {
          ...(db.settings.format || {}),
          ...format,
          semesterName: format.semesterName || db.settings.format?.semesterName || "Ganjil",
          tahunPelajaran: format.tahunPelajaran || db.settings.format?.tahunPelajaran || "2026/2027",
          fontSize: format.fontSize || db.settings.format?.fontSize || "11pt",
          showLogo: format.showLogo !== undefined ? format.showLogo : (db.settings.format?.showLogo || false),
          showSpiritual: format.showSpiritual !== undefined ? format.showSpiritual : (db.settings.format?.showSpiritual ?? true),
          showSosial: format.showSosial !== undefined ? format.showSosial : (db.settings.format?.showSosial ?? true),
          showAttendance: format.showAttendance !== undefined ? format.showAttendance : (db.settings.format?.showAttendance ?? true),
          showCatatan: format.showCatatan !== undefined ? format.showCatatan : (db.settings.format?.showCatatan ?? true),
          fontFamily: format.fontFamily || db.settings.format?.fontFamily || "Times New Roman",
          paperSize: format.paperSize || db.settings.format?.paperSize || "A4",
          tanggalRaport: format.tanggalRaport || db.settings.format?.tanggalRaport || "17 Juni 2026",
          signaturePosition: format.signaturePosition || db.settings.format?.signaturePosition || "kanan",
          watermarkSize: format.watermarkSize !== undefined ? Number(format.watermarkSize) : (db.settings.format?.watermarkSize ?? 440),
          watermarkOpacity: format.watermarkOpacity !== undefined ? Number(format.watermarkOpacity) : (db.settings.format?.watermarkOpacity ?? 0.05)
        };
      }
      saveDB(db);
      return new Response(JSON.stringify({ success: true, settings: db.settings, principalName: db.settings.principalName, principalNip: db.settings.principalNip, format: db.settings.format }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // GET /api/ekskul
    if (path === '/api/ekskul' && method === 'GET') {
      const db = getDB();
      const defaultEkskul = [
        { "id": "e1", "name": "Pramuka Siaga & Penggalang", "type": "Wajib" },
        { "id": "e2", "name": "Mentoring & Bina Pribadi Islami", "type": "Wajib" },
        { "id": "e3", "name": "Futsal", "type": "Pilihan" },
        { "id": "e4", "name": "Bulu Tangkis", "type": "Pilihan" },
        { "id": "e5", "name": "Panahan Tradisional", "type": "Pilihan" },
        { "id": "e6", "name": "Klub Sains & Matematika Cilik", "type": "Pilihan" }
      ];
      if (!Array.isArray(db.ekskul) || db.ekskul.length === 0) {
        db.ekskul = defaultEkskul;
        saveDB(db);
      }

      const teachersList = Array.isArray(db.teachers) ? db.teachers : [];
      const enriched = db.ekskul.map((e: any) => {
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

      return new Response(JSON.stringify(enriched), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/ekskul
    if (path === '/api/ekskul' && method === 'POST') {
      const { name, type, teacherId } = body || {};
      const trimmedName = String(name || "").trim();
      const db = getDB();
      if (!Array.isArray(db.ekskul)) db.ekskul = [];
      if (!Array.isArray(db.teachers)) db.teachers = [];

      let target = db.ekskul.find(
        (e: any) => e.name.toLowerCase().trim() === trimmedName.toLowerCase().trim()
      );

      let assignedTeacherName = "";
      if (teacherId) {
        const t = db.teachers.find((tc: any) => String(tc.id) === String(teacherId));
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
        db.ekskul.push(target);
      } else {
        target.name = trimmedName;
        target.type = type || target.type;
        target.teacherId = teacherId || "";
        target.teacherName = assignedTeacherName;
      }

      saveDB(db);
      return new Response(JSON.stringify(target), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/ekskul/:id/assign-teacher
    if (path.startsWith('/api/ekskul/') && path.endsWith('/assign-teacher') && method === 'POST') {
      const id = path.replace('/api/ekskul/', '').replace('/assign-teacher', '');
      const { teacherId } = body || {};
      const db = getDB();
      if (!Array.isArray(db.ekskul)) db.ekskul = [];
      if (!Array.isArray(db.teachers)) db.teachers = [];

      let target = db.ekskul.find((e: any) => String(e.id) === String(id));
      if (!target) {
        target = { id, name: "Ekskul", type: "Pilihan", teacherId: "", teacherName: "" };
        db.ekskul.push(target);
      }

      const oldTeacherId = target.teacherId;
      let assignedTeacherName = "";
      target.teacherId = teacherId || "";

      if (teacherId) {
        const t = db.teachers.find((tc: any) => String(tc.id) === String(teacherId));
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
        const prevT = db.teachers.find((tc: any) => String(tc.id) === String(oldTeacherId));
        if (prevT) {
          const remainingEkskuls = db.ekskul.filter(
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

      saveDB(db);
      return new Response(JSON.stringify({ ekskul: target, teachers: db.teachers }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // PUT /api/ekskul/:id
    if (path.startsWith('/api/ekskul/') && method === 'PUT') {
      const id = path.split('/').pop() || "";
      const { name, type, teacherId } = body || {};
      const trimmedName = String(name || "").trim();
      const db = getDB();
      if (!Array.isArray(db.ekskul)) db.ekskul = [];
      if (!Array.isArray(db.teachers)) db.teachers = [];

      const idx = db.ekskul.findIndex((e: any) => String(e.id) === String(id));
      let target = idx !== -1 ? db.ekskul[idx] : null;

      let assignedTeacherName = "";
      if (teacherId) {
        const t = db.teachers.find((tc: any) => String(tc.id) === String(teacherId));
        if (t) {
          assignedTeacherName = t.name;
          t.isEkskulTeacher = true;
          t.ekskulName = trimmedName || (target ? target.name : "");
        }
      }

      if (target) {
        const oldTeacherId = target.teacherId;
        if (oldTeacherId && String(oldTeacherId) !== String(teacherId)) {
          const prevT = db.teachers.find((tc: any) => String(tc.id) === String(oldTeacherId));
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
        db.ekskul.push(target);
      }

      saveDB(db);
      return new Response(JSON.stringify(target), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

    // GET & POST /api/ekskul/grades
    if (path === '/api/ekskul/grades' && method === 'GET') {
      const db = getDB();
      return new Response(JSON.stringify(db.walikelas_notes || {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (path === '/api/ekskul/grades' && method === 'POST') {
      const { studentId, ekskulName, type, usaha, proses, capaian, predicate, description, deskripsi } = body || {};
      if (!studentId || !ekskulName) {
        return new Response(JSON.stringify({ error: "ID Siswa dan Nama Ekskul wajib diisi." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const db = getDB();
      if (!db.walikelas_notes) db.walikelas_notes = {};
      if (!db.walikelas_notes[studentId]) {
        db.walikelas_notes[studentId] = {
          sakit: 0, izin: 0, alpa: 0, catatan: "",
          spiritualUsaha: "B", spiritualProses: "B", spiritualCapaian: "B", spiritualDeskripsi: "",
          sosialUsaha: "B", sosialProses: "B", sosialCapaian: "B", sosialDeskripsi: "",
          ekskul: []
        };
      }
      if (!Array.isArray(db.walikelas_notes[studentId].ekskul)) {
        db.walikelas_notes[studentId].ekskul = [];
      }

      const existingIdx = db.walikelas_notes[studentId].ekskul.findIndex(
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
        db.walikelas_notes[studentId].ekskul[existingIdx] = ekskulEntry;
      } else {
        db.walikelas_notes[studentId].ekskul.push(ekskulEntry);
      }

      saveDB(db);
      return new Response(JSON.stringify({ success: true, studentId, ekskul: db.walikelas_notes[studentId].ekskul }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

  // Only route directly to local interception if on static hosts (e.g. github.io without backend)
  if (isStaticHost) {
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

