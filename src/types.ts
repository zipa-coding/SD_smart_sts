export interface Teacher {
  id: string;
  name: string;
  username: string;
  password?: string;
  subject: string;
  isWaliKelas: boolean;
  kelas: string;
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
  "Tahsin ABaTaTsa",
  "Tahfizh Al-Qur’an",
  "Do’a Harian dan Hadits",
  "Wudhu dan Sholat"
];
