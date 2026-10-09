export interface Teacher {
  id: string;
  name: string;
  username: string;
  password?: string;
  subject: string;
  subjects?: string[];
  isWaliKelas: boolean;
  kelas: string;
  isEkskulTeacher?: boolean;
  ekskulName?: string;
  ekskulNames?: string[];
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  kelas: string;
}

export interface TPItem {
  id: string;
  text: string;
  achieved: boolean;
  kelas?: string;
}

export interface TPTemplate {
  id: string;
  text: string;
  kelas?: string;
}

export interface StudentRanking {
  studentId: string;
  name: string;
  nisn: string;
  kelas: string;
  totalScore: number;
  averageScore: number;
  filledSubjectsCount: number;
  totalSubjectsCount: number;
  rank: number;
  rankInClass: number;
  predikat: string;
  subjectScores?: { [subject: string]: number };
}

export interface Grade {
  studentId: string;
  subject: string;
  score: number;
  tps: TPItem[];
  usaha?: string;
  proses?: string;
  capaian?: string;
  deskripsi?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export interface WaliKelasNote {
  sakit: number;
  izin: number;
  alpa: number;
  catatan: string;
  spiritualUsaha?: string;
  spiritualProses?: string;
  spiritualCapaian?: string;
  spiritualDeskripsi?: string;
  sosialUsaha?: string;
  sosialProses?: string;
  sosialCapaian?: string;
  sosialDeskripsi?: string;
}

export interface WaliKelasNotesMap {
  [studentId: string]: WaliKelasNote;
}

export interface SubjectProgress {
  subject: string;
  completed: number;
  total: number;
  percent: number;
  teacherName: string;
}

export interface ClassProgress {
  kelas: string;
  studentCount: number;
  filledGrades: number;
  totalNeeded: number;
  percent: number;
  waliKelasName: string;
}

export interface SchoolSummary {
  totalStudents: number;
  totalTeachers: number;
  subjectProgress: SubjectProgress[];
  classProgress: ClassProgress[];
  studentRankings?: StudentRanking[];
  lastUpdate: string;
}

export const SUBJECT_LIST = [
  // B. Umum / Nasional
  "PAI",
  "PPKN",
  "Bahasa Indonesia",
  "Matematika",
  "IPA",
  "IPS",
  "PJOK",
  "Seni Budaya",
  "Prakarya",

  // C. Muatan Lokal (Bahasa Inggris, TIK, Life Skill, Bahasa Arab)
  "Bahasa Arab",
  "Bahasa Inggris",
  "TIK",
  "Life Skill",

  // D. Keislaman (Sirah, Tahsin, Tahfidz, Doa & Hadits, Wudhu & Sholat)
  "Keislaman",
  "Sirah",
  "Tahsin ABaTaTsa",
  "Tahfizh Al-Qur’an",
  "Do’a Harian dan Hadits",
  "Wudhu dan Sholat"
];

export const KEISLAMAN_SUB_SUBJECTS = [
  { id: "Sirah", label: "Sirah", short: "Sirah" },
  { id: "Tahsin ABaTaTsa", label: "Tahsin ABaTaTsa", short: "Tahsin" },
  { id: "Tahfizh Al-Qur’an", label: "Tahfizh Al-Qur’an", short: "Tahfidz" },
  { id: "Do’a Harian dan Hadits", label: "Do’a Harian dan Hadits", short: "Doa & Hadist" },
  { id: "Wudhu dan Sholat", label: "Wudhu dan Sholat", short: "Wudhu & Sholat" }
] as const;

export interface EkskulItem {
  id: string;
  name: string;
  type: "Wajib" | "Pilihan";
  teacherId?: string;
  teacherName?: string;
}

/**
 * Extracts all extracurriculars assigned to a teacher.
 */
export function getTeacherAssignedEkskuls(
  teacher: Partial<Teacher> | null | undefined
): string[] {
  if (!teacher) return [];
  if (Array.isArray(teacher.ekskulNames) && teacher.ekskulNames.length > 0) {
    return Array.from(
      new Set(
        teacher.ekskulNames
          .map((s) => String(s || "").trim())
          .filter(Boolean)
      )
    );
  }
  if (teacher.ekskulName) {
    return Array.from(
      new Set(
        String(teacher.ekskulName)
          .split(",")
          .map((s) => String(s || "").trim())
          .filter(Boolean)
      )
    );
  }
  return [];
}

/**
 * Extracts and normalizes all subjects taught by a teacher.
 * If teacher has "Keislaman", expands to the 4 Keislaman aspects.
 * If teacher is "Admin", returns all available subjects.
 */
export function getTeacherAssignedSubjects(
  teacher: Partial<Teacher> | null | undefined,
  allAvailableSubjects: string[] = []
): string[] {
  if (!teacher) return [];
  if (
    teacher.subject === "Admin" ||
    (Array.isArray(teacher.subjects) && teacher.subjects.includes("Admin"))
  ) {
    return allAvailableSubjects.length > 0 ? allAvailableSubjects : SUBJECT_LIST;
  }

  let list: string[] = [];
  if (Array.isArray(teacher.subjects) && teacher.subjects.length > 0) {
    list = [...teacher.subjects];
  } else if (teacher.subject) {
    list = teacher.subject
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Expand "Keislaman" into sub-subjects if present
  const expanded: string[] = [];
  for (const s of list) {
    let sTrimmed = s.trim();
    if (!sTrimmed) continue;

    if (
      sTrimmed === "Keislaman" ||
      sTrimmed === "Pendidikan Keislaman" ||
      sTrimmed === "Agama Islam / Keislaman" ||
      sTrimmed.toLowerCase().includes("keislaman")
    ) {
      KEISLAMAN_SUB_SUBJECTS.forEach((k) => {
        if (!expanded.includes(k.id)) expanded.push(k.id);
      });
    } else {
      // Map Siroh to Sirah for consistent keying
      if (sTrimmed.toLowerCase().includes("siroh") || sTrimmed.toLowerCase().includes("sirah")) {
        sTrimmed = "Sirah";
      }
      if (!expanded.includes(sTrimmed)) expanded.push(sTrimmed);
    }
  }

  const cleanedAcademic = expanded.filter(
    (s) => s !== "Pembina Ekskul" && s !== "Pelatih Ekskul" && s !== "Admin"
  );
  if (cleanedAcademic.length > 0) return cleanedAcademic;

  return expanded.length > 0 ? expanded : [teacher.subject || "PAI"];
}

/**
 * Normalizes subject names into canonical keys to eliminate spelling/alias/casing mismatches.
 * Strictly prevents cross-subject collisions (e.g. Matematika containing "tik").
 */
export function normalizeSubjectKey(name?: string): string {
  if (!name) return "";
  let s = String(name).trim();
  s = s.replace(/[’'`]/g, "'");
  s = s.replace(/\s+/g, " ");

  const lower = s.toLowerCase();

  // 1. Matematika (Handled early with dedicated keywords so it never matches "tik")
  if (lower.includes("matematika") || lower === "mtk" || lower === "math") {
    return "Matematika";
  }

  // 2. Keislaman sub-subjects
  if (lower.includes("sirah") || lower.includes("siroh")) return "Sirah";
  if (lower.includes("tahsin")) return "Tahsin ABaTaTsa";
  if (lower.includes("tahfizh") || lower.includes("tahfidz")) return "Tahfizh Al-Qur’an";
  if (lower.includes("hadits") || lower.includes("hadist") || lower.includes("do'a") || lower.includes("doa")) {
    return "Do’a Harian dan Hadits";
  }
  if (lower.includes("wudhu") || lower.includes("sholat") || lower.includes("shalat")) {
    return "Wudhu dan Sholat";
  }

  // 3. Muatan Lokal & TIK
  if (lower.includes("life skill") || lower.includes("lifeskill") || lower.includes("keterampilan hidup")) {
    return "Life Skill";
  }
  if (lower === "tik" || lower.startsWith("tik ") || lower.endsWith(" tik") || lower.includes(" tik ")) {
    return "TIK";
  }
  if (lower.includes("informatika") || lower.includes("teknologi informasi") || lower.includes("komputer")) {
    return "Informatika";
  }
  if (lower.includes("arab")) return "Bahasa Arab";
  if (lower.includes("inggris") || lower === "english" || lower === "bing") return "Bahasa Inggris";

  // 4. Umum / Nasional
  if (lower === "pai" || lower.includes("agama islam") || lower.includes("pendidikan agama")) return "PAI";
  if (lower === "ppkn" || lower === "pkn" || lower.includes("pancasila") || lower.includes("kewarganegaraan")) return "PPKN";
  if (lower.includes("indonesia") || lower === "b. indonesia" || lower === "b indonesia" || lower === "bindo") {
    return "Bahasa Indonesia";
  }
  if (lower === "ipas" || lower.includes("alam dan sosial") || lower.includes("ipa dan ips")) return "IPAS";
  if (lower === "ipa" || lower.includes("pengetahuan alam") || lower === "sains") return "IPA";
  if (lower === "ips" || lower.includes("pengetahuan sosial") || lower === "sosial") return "IPS";
  if (lower === "pjok" || lower.includes("jasmani") || lower.includes("olahraga") || lower.includes("penjaskes")) return "PJOK";
  if (lower.includes("seni") || lower === "sbdp") return "Seni Budaya";
  if (lower.includes("prakarya") || lower.includes("kewirausahaan")) return "Prakarya";

  return s;
}

/**
 * Robust check if a TP template's class matches the target class.
 * Strictly separates TPs between classes so that TPs from one class never bleed into another class.
 */
export function matchTpClass(tKelas?: any, targetKelas?: string): boolean {
  const tk = String(tKelas || "").trim().toLowerCase();
  const target = String(targetKelas || "").trim().toLowerCase();

  // If no target class specified or wildcard target, match all
  if (!target || target === "all" || target === "semua" || target === "*") return true;

  // If template explicitly designated for all classes
  if (tk === "all" || tk === "semua" || tk === "*" || tk === "semua kelas") return true;

  // Extract numeric class identifiers (e.g. "Kelas 1" -> "1", "1" -> "1")
  const numTk = tk.replace(/\D/g, "");
  const numTarget = target.replace(/\D/g, "");

  // If both have numbers, they must match exactly
  if (numTk && numTarget) {
    return numTk === numTarget;
  }

  // If template has no class defined at all, match strictly if target is "1" or exact string match
  if (!tk) {
    return target === "1" || numTarget === "1";
  }

  return tk === target;
}

/**
 * Checks if a subject belongs to Keislaman category (which uses manual narrative descriptions, no TP checklist).
 */
export function isKeislamanSubject(subject?: string): boolean {
  if (!subject) return false;
  const norm = normalizeSubjectKey(subject).toLowerCase();
  return (
    norm === "keislaman" ||
    norm.includes("doa") ||
    norm.includes("do’a") ||
    norm.includes("hadits") ||
    norm.includes("tahfizh") ||
    norm.includes("tahfidz") ||
    norm.includes("tahsin") ||
    norm.includes("wudhu") ||
    norm.includes("sholat") ||
    norm.includes("shalat") ||
    norm.includes("sirah") ||
    norm.includes("siroh")
  );
}

const KNOWN_SAMPLE_TP_IDS = new Set([
  "tp_1791000095834",
  "tp_1791000110170",
  "tp_1791000123377",
  "tp_1791000135065",
]);

/**
 * Detects if a TP is a legacy dummy/sample template (which must be completely excluded).
 * Only real user/teacher inputted TPs (with valid text) are allowed.
 */
export function isSampleTp(tp: any): boolean {
  if (!tp) return true;
  const text = String(tp.text || "").trim();
  if (!text) return true;
  const id = String(tp.id || "").trim();
  const lowerId = id.toLowerCase();
  if (!id) return true;

  if (KNOWN_SAMPLE_TP_IDS.has(id) || KNOWN_SAMPLE_TP_IDS.has(lowerId)) return true;
  if (/^[1-9]$/.test(id)) return true;
  if (lowerId === "dummy" || lowerId === "sample" || lowerId.startsWith("dummy_") || lowerId.startsWith("sample_")) return true;

  // Filter out any legacy seeded template ID patterns:
  if (/^tp_[a-z_]+_\d{1,2}_\d{1,2}$/i.test(id)) return true;
  if (/^[a-z_]+_\d{1,2}_\d{1,2}$/i.test(id)) return true;

  // Real teacher generated TPs are accepted
  return false;
}

export function cleanTpList(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.filter((tp) => !isSampleTp(tp));
}

/**
 * Safely looks up TP templates for a subject across all variations (casing, quotes, aliases),
 * strictly excluding any dummy / sample templates, while guaranteeing strict isolation between subjects.
 */
export function getSubjectTps(allTps: Record<string, any[]> | undefined | null, subject: string): any[] {
  if (!allTps || typeof allTps !== "object" || !subject) return [];

  const cleanSubject = String(subject).trim();
  if (!cleanSubject) return [];

  // 1. Exact key match
  if (Array.isArray(allTps[cleanSubject])) {
    return cleanTpList(allTps[cleanSubject]);
  }

  // 2. Case-insensitive key match
  const lowerTarget = cleanSubject.toLowerCase();
  for (const [key, list] of Object.entries(allTps)) {
    if (key.trim().toLowerCase() === lowerTarget && Array.isArray(list)) {
      return cleanTpList(list);
    }
  }

  // 3. Canonical key match (if exact key was not found)
  const normTarget = normalizeSubjectKey(cleanSubject);
  if (normTarget && normTarget !== cleanSubject && Array.isArray(allTps[normTarget])) {
    return cleanTpList(allTps[normTarget]);
  }

  return [];
}

/**
 * Extracts a normalized list of subject strings taught by a teacher.
 */
export function extractTeacherSubjects(t: any): string[] {
  if (!t) return [];
  const list: string[] = [];
  if (t.subject && typeof t.subject === "string") {
    list.push(...t.subject.split(",").map((s: string) => s.trim()));
  }
  if (Array.isArray(t.subjects)) {
    t.subjects.forEach((s: any) => {
      if (typeof s === "string") list.push(...s.split(",").map((x) => x.trim()));
    });
  }
  return Array.from(new Set(list.filter(Boolean)));
}


