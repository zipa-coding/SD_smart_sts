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
  // B. Umum
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
  // C. Muatan Lokal
  "Bahasa Arab",
  // D. Keislaman
  "Keislaman",
  "Tahsin ABaTaTsa",
  "Tahfizh Al-Qur’an",
  "Do’a Harian dan Hadits",
  "Wudhu dan Sholat"
];

export const KEISLAMAN_SUB_SUBJECTS = [
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

  // Expand "Keislaman" into 4 sub-subjects if present
  const expanded: string[] = [];
  for (const s of list) {
    const sTrimmed = s.trim();
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
      if (!expanded.includes(sTrimmed)) expanded.push(sTrimmed);
    }
  }

  const cleanedAcademic = expanded.filter(
    (s) => s !== "Pembina Ekskul" && s !== "Pelatih Ekskul" && s !== "Admin"
  );
  if (cleanedAcademic.length > 0) return cleanedAcademic;

  return expanded.length > 0 ? expanded : [teacher.subject || "PAI"];
}


