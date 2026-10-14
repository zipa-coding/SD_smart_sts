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
    (s) => s !== "Pembina Ekskul" && s !== "Pelatih Ekskul" && s !== "Admin" && s !== "-"
  );
  if (cleanedAcademic.length > 0) return cleanedAcademic;

  // If teacher has no academic subjects (e.g. Pembina Ekskul only), return empty array
  if (
    teacher.isEkskulTeacher ||
    (Array.isArray(teacher.ekskulNames) && teacher.ekskulNames.length > 0) ||
    !teacher.subject ||
    teacher.subject === "-" ||
    teacher.subject === "Pembina Ekskul" ||
    teacher.subject === "Pelatih Ekskul"
  ) {
    return [];
  }

  return expanded.length > 0 ? expanded : (teacher.subject && teacher.subject !== "-" ? [teacher.subject] : []);
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
  if (
    lower === "tik" ||
    lower.startsWith("tik ") ||
    lower.endsWith(" tik") ||
    lower.includes(" tik ") ||
    lower.includes("informatika") ||
    lower.includes("teknologi informasi") ||
    lower.includes("komputer")
  ) {
    return "TIK";
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

  // If template explicitly designated for all classes or has no class restriction, match all
  if (!tk || tk === "all" || tk === "semua" || tk === "*" || tk === "semua kelas") return true;

  // Extract numeric class identifiers (e.g. "Kelas 1" -> "1", "1" -> "1")
  const numTk = tk.replace(/\D/g, "");
  const numTarget = target.replace(/\D/g, "");

  // If both have numbers, they must match exactly
  if (numTk && numTarget) {
    return numTk === numTarget;
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

  // Real teacher and curriculum TPs are accepted
  return false;
}

/**
 * Checks if a subject string represents generic coach titles that are not actual academic subjects.
 */
export function isEkskulSubject(subject: string): boolean {
  if (!subject) return false;
  const s = String(subject).toLowerCase().trim();
  return (
    s === "pelatih ekskul" ||
    s === "pembina ekskul"
  );
}

export const DEFAULT_EKSKUL_TPS: Record<string, string[]> = {
  "Pramuka": [
    "Menunjukkan kedisiplinan dan kerapian dalam baris-berbaris (PBB)",
    "Mampu mempraktikkan keterampilan dasar kepramukaan (tali-temali, sandi, dan kompas)",
    "Menunjukkan sikap gotong royong, kemandirian, dan kepedulian sosial yang tinggi"
  ],
  "Futsal": [
    "Menguasai teknik dasar mengoper (passing) dan mengontrol (control) bola dengan baik",
    "Menguasai teknik menggiring bola (dribbling) terarah dan menembak (shooting) ke gawang",
    "Menunjukkan sportivitas, kedisiplinan latihan, dan kerja sama tim yang solid"
  ],
  "Bulu Tangkis": [
    "Menguasai teknik pegangan raket, footwork langkah kaki, dan servis dasar dengan benar",
    "Mampu melakukan pukulan lob, netting, dan smash terarah",
    "Menunjukkan sportivitas, fokus tinggi, dan daya juang selama permainan"
  ],
  "Voli": [
    "Menguasai teknik dasar passing bawah dan passing atas secara terarah",
    "Mampu melakukan servis dan penempatan bola dasar dengan tepat",
    "Menunjukkan kekompakan, sportivitas, dan kegigihan dalam tim"
  ],
  "Panahan": [
    "Memahami prosedur keselamatan dan sikap tubuh (stance) memanah yang benar",
    "Menguasai teknik menarik busur (drawing), membidik, dan melepaskan anak panah (release)",
    "Menunjukkan konsentrasi, ketenangan emosi, dan konsistensi selama latihan"
  ],
  "Mentoring": [
    "Aktif dan istiqomah dalam menghadiri halaqah serta kegiatan pembinaan karakter",
    "Menunjukkan pemahaman materi keislaman, adab, dan akhlak terpuji sehari-hari",
    "Memiliki kepedulian sosial dan ukhuwah islamiyah yang erat antarsesama teman"
  ],
  "Klub Sains": [
    "Menunjukkan rasa ingin tahu yang tinggi terhadap fenomena sains dan eksperimen ilmiah",
    "Mampu melakukan percobaan ilmiah sederhana dan mencatat hasil pengamatan",
    "Mampu bernalar kritis, memecahkan masalah, dan bekerja sama dalam tim riset cilik"
  ],
  "Karate": [
    "Menguasai gerakan dasar kuda-kuda (dachi), pukulan (tsuki), dan tangkisan (uke)",
    "Mampu mempraktikkan rangkaian jurus kata dasar dengan tenaga dan konsentrasi",
    "Menjunjung tinggi sumpah karate, disiplin diri, rasa hormat, dan pengendalian emosi"
  ],
  "Pencak Silat": [
    "Menguasai teknik dasar kuda-kuda, pola langkah, dan pukulan-tangkisan beladiri",
    "Mampu mempraktikkan jurus seni tunggal dan teknik pertahanan diri secara terkoordinasi",
    "Menunjukkan sikap ksatria, budi pekerti luhur, dan disiplin tinggi"
  ],
  "Renang": [
    "Menguasai teknik pernapasan, meluncur, dan gerakan kayuhan renang dengan baik",
    "Mampu mempraktikkan gaya dada (breaststroke) atau gaya bebas secara teratur",
    "Menunjukkan keberanian di dalam air serta menjaga keselamatan diri saat berenang"
  ],
  "Seni Musik": [
    "Mampu memainkan alat musik ritmis maupun melodis dengan tempo dan ketukan yang tepat",
    "Menunjukkan kepekaan nada, musikalitas, dan kekompakan dalam ansambel musik",
    "Menunjukkan rasa percaya diri dan ekspresi seni yang positif"
  ],
  "Tari": [
    "Menguasai wiraga (gerakan dasar tari), wirama (ketukan irama musik), dan wirasa (ekspresi)",
    "Mampu menghafal susunan pola lantai dan gerak tari dengan luwes dan kompak",
    "Menunjukkan apresiasi terhadap seni budaya dan percaya diri saat tampil"
  ],
  "Robotik": [
    "Memahami konsep dasar perakitan komponen mekanik dan elektronika robotik",
    "Mampu menyusun logika algoritma pemrograman dasar untuk menggerakkan modul",
    "Menunjukkan kreativitas dalam berinovasi dan tekun dalam menyelesaikan uji coba (troubleshooting)"
  ],
  "English Club": [
    "Percaya diri dalam berkomunikasi dan mengekspresikan gagasan dalam bahasa Inggris sederhana",
    "Menguasai kosakata fungsional tematik dan pelafalan (pronunciation) dengan jelas",
    "Antusias berpartisipasi dalam permainan bahasa, storytelling, dan dialog interaktif"
  ],
  "Study Club": [
    "Aktif berpartisipasi dan memiliki rasa ingin tahu yang tinggi dalam belajar",
    "Mampu menyelesaikan tugas dan tantangan pemecahan masalah dengan baik",
    "Mampu berkolaborasi dalam tim dan berbagi pemahaman dengan teman"
  ]
};

export function getEkskulTps(allTps: Record<string, any[]> | undefined | null, ekskulName: string): any[] {
  if (!ekskulName) return [];
  const clean = ekskulName.trim();
  const lowerClean = clean.toLowerCase();

  // Deleted items set
  const deletedArr = Array.isArray(allTps?._deleted)
    ? allTps._deleted
    : (Array.isArray(allTps?.deleted_tps) ? allTps.deleted_tps : []);
  const deletedSet = new Set(deletedArr.map((id: any) => String(id || '').trim()));

  // Retrieve any custom TPs saved for this ekskul
  const fromAllTps = getSubjectTps(allTps, clean);
  const fromPrefix = getSubjectTps(allTps, `Ekskul ${clean}`);
  const customTps: any[] = [];
  [...fromAllTps, ...fromPrefix].forEach((p) => {
    const id = String(p.id || '').trim();
    if (id && !deletedSet.has(id) && !customTps.some((c) => String(c.id).trim() === id)) {
      customTps.push(p);
    }
  });

  // Find matching default texts
  const matchedKey = Object.keys(DEFAULT_EKSKUL_TPS).find((k) => {
    const lk = k.toLowerCase();
    return lk === lowerClean || lowerClean.includes(lk) || lk.includes(lowerClean);
  });

  const defaultTexts = matchedKey
    ? DEFAULT_EKSKUL_TPS[matchedKey]
    : [
        `Menguasai teknik dan keterampilan dasar dalam kegiatan ${clean}`,
        `Menunjukkan kedisiplinan, keaktifan, dan antusiasme dalam setiap sesi latihan`,
        `Menunjukkan sikap sportivitas, etika yang baik, dan kerja sama tim`
      ];

  const defaultTps = defaultTexts
    .map((text, idx) => ({
      id: `tp_eks_${clean.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${idx + 1}`,
      text,
      kelas: "all",
      isDefault: true
    }))
    .filter((tp) => !deletedSet.has(tp.id));

  if (customTps.length === 0) {
    return defaultTps;
  }

  // Merge custom TPs with default TPs (custom first, then defaults that don't duplicate text)
  const merged = [...customTps];
  defaultTps.forEach((def) => {
    const isDup = merged.some(
      (m) =>
        String(m.id).trim() === String(def.id).trim() ||
        String(m.text || "").trim().toLowerCase() === def.text.trim().toLowerCase()
    );
    if (!isDup) {
      merged.push(def);
    }
  });

  return merged;
}

export function cleanTpList(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.filter((tp) => !isSampleTp(tp));
}

/**
 * Safely looks up TP templates for a subject across all variations (casing, quotes, aliases),
 * strictly excluding any dummy / sample templates, while guaranteeing strict isolation between subjects.
 * Merges TPs across aliases (e.g. Sirah & Siroh, Life Skill & Life skill, TIK & Informatika).
 */
export function getSubjectTps(allTps: Record<string, any[]> | undefined | null, subject: string): any[] {
  if (!allTps || typeof allTps !== "object" || !subject) return [];

  const cleanSubject = String(subject).trim();
  if (!cleanSubject) return [];

  const normTarget = normalizeSubjectKey(cleanSubject) || cleanSubject;
  const lowerClean = cleanSubject.toLowerCase();
  const lowerNorm = normTarget.toLowerCase();

  const map = new Map<string, any>();

  // Check all keys in allTps that match cleanSubject, lowerClean, normTarget, or normalizeSubjectKey(key) === normTarget
  for (const [key, list] of Object.entries(allTps)) {
    if (!Array.isArray(list)) continue;
    const lowerKey = key.trim().toLowerCase();
    const normKey = normalizeSubjectKey(key) || key;

    if (
      key === cleanSubject ||
      lowerKey === lowerClean ||
      key === normTarget ||
      lowerKey === lowerNorm ||
      normKey === normTarget ||
      normalizeSubjectKey(key) === normTarget
    ) {
      cleanTpList(list).forEach((tp) => {
        if (tp && tp.id && tp.text) {
          map.set(String(tp.id).trim(), tp);
        }
      });
    }
  }

  return Array.from(map.values());
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


