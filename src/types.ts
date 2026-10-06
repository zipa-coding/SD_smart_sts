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
 */
export function normalizeSubjectKey(name?: string): string {
  if (!name) return "";
  let s = String(name).trim();
  s = s.replace(/[’'`]/g, "'");
  s = s.replace(/\s+/g, " ");

  const lower = s.toLowerCase();

  // 1. Keislaman sub-subjects
  if (lower.includes("sirah") || lower.includes("siroh")) return "Sirah";
  if (lower.includes("tahsin")) return "Tahsin ABaTaTsa";
  if (lower.includes("tahfizh") || lower.includes("tahfidz")) return "Tahfizh Al-Qur’an";
  if (lower.includes("do'a") || lower.includes("doa")) return "Do’a Harian dan Hadits";
  if (lower.includes("wudhu") || lower.includes("sholat") || lower.includes("shalat")) return "Wudhu dan Sholat";

  // 2. Muatan Lokal
  if (lower.includes("life skill") || lower.includes("lifeskill")) return "Life Skill";
  if (lower.includes("tik") || lower.includes("informatika")) return "TIK";
  if (lower.includes("arab")) return "Bahasa Arab";
  if (lower.includes("inggris")) return "Bahasa Inggris";

  // 3. Umum / Nasional
  if (lower === "pai" || lower.includes("agama islam")) return "PAI";
  if (lower === "ppkn" || lower.includes("pancasila") || lower.includes("kewarganegaraan")) return "PPKN";
  if (lower.includes("indonesia")) return "Bahasa Indonesia";
  if (lower.includes("matematika") || lower === "mtk") return "Matematika";
  if (lower === "ipas" || lower.includes("ilmu pengetahuan alam dan sosial")) return "IPAS";
  if (lower === "ipa") return "IPA";
  if (lower === "ips") return "IPS";
  if (lower === "pjok" || lower.includes("jasmani") || lower.includes("olahraga")) return "PJOK";
  if (lower.includes("seni")) return "Seni Budaya";
  if (lower.includes("prakarya")) return "Prakarya";

  return s;
}

/**
 * Robust check if a TP template's class matches the target class.
 * Supports "all", "Semua", "Kelas 1" vs "1", etc.
 */
export function matchTpClass(tKelas?: any, targetKelas?: string): boolean {
  const tk = String(tKelas || "").trim().toLowerCase();
  const target = String(targetKelas || "").trim().toLowerCase();
  if (!tk || tk === "all" || tk === "semua" || tk === "*" || tk === "semua kelas") return true;
  if (!target || target === "all" || target === "semua" || target === "*") return true;
  const numTk = tk.replace(/\D/g, "");
  const numTarget = target.replace(/\D/g, "");
  if (numTk && numTarget && numTk === numTarget) return true;
  return tk === target;
}

/**
 * Safely looks up TP templates for a subject across all variations (casing, quotes, aliases).
 */
export function getSubjectTps(allTps: Record<string, any[]> | undefined | null, subject: string): any[] {
  if (!allTps || typeof allTps !== "object") return [];
  // 1. Direct key match
  if (Array.isArray(allTps[subject]) && allTps[subject].length > 0) {
    return allTps[subject];
  }
  const normTarget = normalizeSubjectKey(subject);
  // 2. Normalized key match
  if (Array.isArray(allTps[normTarget]) && allTps[normTarget].length > 0) {
    return allTps[normTarget];
  }
  // 3. Search through all keys in allTps using normalizeSubjectKey
  for (const [key, list] of Object.entries(allTps)) {
    if (Array.isArray(list) && list.length > 0) {
      if (normalizeSubjectKey(key) === normTarget) {
        return list;
      }
    }
  }
  // 4. Case/quote-insensitive search
  const cleanTarget = subject.replace(/[’'`]/g, "'").toLowerCase().trim();
  for (const [key, list] of Object.entries(allTps)) {
    if (Array.isArray(list) && list.length > 0) {
      if (key.replace(/[’'`]/g, "'").toLowerCase().trim() === cleanTarget) {
        return list;
      }
    }
  }
  return [];
}


