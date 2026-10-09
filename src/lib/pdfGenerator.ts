import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Student, Grade, WaliKelasNote, Teacher } from "../types";

export interface GeneratePdfOptions {
  student: Student;
  grades: Grade[];
  waliKelasNote: WaliKelasNote;
  waliKelas: Teacher | null;
  principal: { name: string; nip: string };
  format: {
    semesterName?: string;
    tahunPelajaran?: string;
    showLogo?: boolean;
    paperSize?: string; // "A4" | "F4"
    tanggalRaport?: string;
    signaturePosition?: "kanan" | "tengah" | "kiri";
    watermarkSize?: number;
    watermarkOpacity?: number;
  };
  base64Logos?: {
    school?: string;
    jsit?: string;
    cahayaAmal?: string;
  };
  allSubjects?: string[];
}

export const formatTitleCase = (str: string) => {
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
};

export const normalizeSub = (str: string) => {
  return (str || "")
    .replace(/[’'`]/g, "'")
    .replace(/\s*&\s*/g, " dan ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

export const findGradeForSubject = (gradesList: Grade[], targetSub: string): Grade | undefined => {
  if (!Array.isArray(gradesList) || !targetSub) return undefined;

  const direct = gradesList.find((g) => g && g.subject === targetSub);
  if (direct) return direct;

  const normTarget = normalizeSub(targetSub);
  const normMatch = gradesList.find(
    (g) => g && normalizeSub(g.subject) === normTarget
  );
  if (normMatch) return normMatch;

  const aliases: Record<string, string[]> = {
    PAI: ["pai", "pendidikan agama islam", "agama islam", "agama"],
    PPKN: [
      "ppkn",
      "pkn",
      "pendidikan pancasila",
      "pendidikan pancasila dan kewarganegaraan",
    ],
    "Bahasa Indonesia": ["bahasa indonesia", "b. indonesia", "b indonesia", "bindo"],
    Matematika: ["matematika", "mtk", "math"],
    IPAS: ["ipas", "ilmu pengetahuan alam dan sosial", "ipa dan ips", "ipa", "ips", "sains"],
    IPA: ["ipa", "ilmu pengetahuan alam", "sains"],
    IPS: ["ips", "ilmu pengetahuan sosial", "sosial"],
    "Bahasa Inggris": ["bahasa inggris", "b. inggris", "b inggris", "english", "bing"],
    PJOK: [
      "pjok",
      "penjas",
      "penjaskes",
      "pendidikan jasmani olahraga dan kesehatan",
      "olahraga",
    ],
    Prakarya: ["prakarya", "prakarya dan kewirausahaan", "sbk"],
    "Seni Budaya": ["seni budaya", "seni", "kesenian", "sbk"],
    TIK: [
      "tik",
      "informatika",
      "teknologi informasi dan komunikasi",
      "teknologi informasi",
      "komputer",
    ],
    Informatika: [
      "tik",
      "informatika",
      "teknologi informasi dan komunikasi",
      "teknologi informasi",
      "komputer",
    ],
    "Life Skill": [
      "life skill",
      "life skills",
      "keterampilan hidup",
      "life skill (keterampilan hidup)",
    ],
    "Life skill": [
      "life skill",
      "life skills",
      "keterampilan hidup",
      "life skill (keterampilan hidup)",
    ],
    "Bahasa Arab": ["bahasa arab", "b. arab", "b arab", "arab"],
    "Sirah Nabawiyah": [
      "sirah",
      "siroh",
      "sirah nabawiyah",
      "sirah nabawiyah (sejarah islam)",
      "sejarah islam",
      "sejarah kebudayaan islam",
      "ski",
    ],
    Sirah: [
      "sirah",
      "siroh",
      "sirah nabawiyah",
      "sirah nabawiyah (sejarah islam)",
      "sejarah islam",
      "sejarah kebudayaan islam",
      "ski",
    ],
    "Tahsin ABaTaTsa": [
      "tahsin abatatsa",
      "tahsin",
      "tahsin al-qur'an",
      "tahsin al-quran",
      "tahsin al qur'an",
    ],
    "Tahfizh Al-Qur’an": [
      "tahfizh al-qur'an",
      "tahfizh al-quran",
      "tahfidz al-qur'an",
      "tahfidz al-quran",
      "tahfizh",
      "tahfidz",
      "tahfizh al qur'an",
    ],
    "Do’a Harian dan Hadits": [
      "do'a harian dan hadits",
      "doa harian dan hadits",
      "do'a dan hadits",
      "doa dan hadist",
      "doa & hadist",
      "doa dan hadits",
      "do'a harian & hadits",
    ],
    "Wudhu dan Sholat": [
      "wudhu dan sholat",
      "wudhu dan shalat",
      "wudhu & sholat",
      "wudhu & shalat",
      "sholat dan wudhu",
      "shalat dan wudhu",
      "wudhu",
      "sholat",
      "shalat",
    ],
  };

  for (const [key, aliasList] of Object.entries(aliases)) {
    const normKey = normalizeSub(key);
    if (normTarget === normKey || aliasList.includes(normTarget)) {
      const found = gradesList.find((g) => {
        const normG = normalizeSub(g.subject);
        return normG === normKey || aliasList.includes(normG);
      });
      if (found) return found;
    }
  }

  return gradesList.find((g) => {
    const normG = normalizeSub(g.subject);
    return (
      normG.length >= 4 &&
      (normG.includes(normTarget) || normTarget.includes(normG))
    );
  });
};

export const getNumericKelas = (kelasStr?: string): number => {
  const str = String(kelasStr || "").trim();
  const match = str.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return 1;
};

export const formatFaseKelas = (kelas: string) => {
  const k = String(kelas || "").trim();
  if (k === "1") return "A / I (Satu)";
  if (k === "2") return "A / II (Dua)";
  if (k === "3") return "B / III (Tiga)";
  if (k === "4") return "B / IV (Empat)";
  if (k === "5") return "C / V (Lima)";
  if (k === "6") return "C / VI (Enam)";
  if (k === "7") return "D / VII (Tujuh)";
  if (k === "8") return "D / VIII (Delapan)";
  if (k === "9") return "D / IX (Sembilan)";
  return `Fase SD / Kelas ${k}`;
};

export const getSchoolName = (kelas: string) => {
  const k = String(kelas || "").trim().toUpperCase();
  if (
    k === "7" ||
    k === "8" ||
    k === "9" ||
    k.startsWith("VII") ||
    k.startsWith("VIII") ||
    k.startsWith("IX") ||
    k.includes("7") ||
    k.includes("8") ||
    k.includes("9") ||
    k.includes("VII") ||
    k.includes("VIII") ||
    k.includes("IX")
  ) {
    return "SMP ISLAM SMART PANGKAL PINANG";
  }
  return "SD ISLAM SMART PANGKAL PINANG";
};

export const getOfficialSubjectName = (sub: string, index: number) => {
  const map: { [key: string]: string } = {
    PAI: "Pendidikan Agama Islam",
    PPKN: "Pendidikan Pancasila dan Kewarganegaraan",
    "Bahasa Indonesia": "Bahasa Indonesia",
    Matematika: "Matematika",
    IPAS: "Ilmu Pengetahuan Alam dan Sosial (IPAS)",
    IPA: "Ilmu Pengetahuan Alam",
    IPS: "Ilmu Pengetahuan Sosial",
    "Bahasa Inggris": "Bahasa Inggris",
    PJOK: "Pendidikan Jasmani Olahraga dan Kesehatan",
    Informatika: "Teknologi Informasi dan Komunikasi (TIK)",
    TIK: "Teknologi Informasi dan Komunikasi (TIK)",
    Prakarya: "Prakarya",
    "Bahasa Arab": "Bahasa Arab",
    Sirah: "Sirah Nabawiyah (Sejarah Islam)",
    "Sirah Nabawiyah": "Sirah Nabawiyah (Sejarah Islam)",
    Siroh: "Sirah Nabawiyah (Sejarah Islam)",
    "Life skill": "Life Skill (Keterampilan Hidup)",
    "Life Skill": "Life Skill (Keterampilan Hidup)",
    "Seni Budaya": "Seni Budaya",
    "Tahsin ABaTaTsa": "Tahsin ABaTaTsa",
    "Tahfizh Al-Qur’an": "Tahfizh Al-Qur’an",
    "Tahfizh Al-Qur'an": "Tahfizh Al-Qur’an",
    "Do’a Harian dan Hadits": "Do’a Harian dan Hadits",
    "Do'a Harian dan Hadits": "Do’a Harian dan Hadits",
    "Wudhu dan Sholat": "Wudhu dan Sholat",
  };
  const normSub = normalizeSub(sub);
  for (const [k, v] of Object.entries(map)) {
    if (normalizeSub(k) === normSub) {
      return `${index + 1}. ${v}`;
    }
  }
  return `${index + 1}. ${map[sub] || sub}`;
};

export const generateDescription = (g: Grade | undefined, studentName: string) => {
  if (!g) return "";
  const name = formatTitleCase(studentName || "Siswa");
  const sub = g.subject || "mata pelajaran ini";

  if (g.deskripsi && g.deskripsi.trim() !== "") {
    return g.deskripsi.trim();
  }
  if ((g as any).description && String((g as any).description).trim() !== "") {
    return String((g as any).description).trim();
  }

  if (!g.tps || !Array.isArray(g.tps) || g.tps.length === 0) {
    const cap = g.capaian || (g.score && g.score >= 90 ? "A" : g.score && g.score >= 80 ? "B" : "C") || "B";
    if (cap === "A" || cap === "Sangat Baik") {
      return `Alhamdulillah, ananda ${name} dalam pembelajaran ${sub} menunjukkan penguasaan yang optimal dan sangat baik pada seluruh capaian kompetensi pembelajaran. Pertahankan prestasimu, teruslah bertumbuh dengan rendah hati, dan tetap bersemangat.`;
    } else if (cap === "B" || cap === "Baik") {
      return `Alhamdulillah, ananda ${name} dalam pembelajaran ${sub} menunjukkan penguasaan yang baik dalam memahami dan menguasai materi pembelajaran. Teruslah rajin berlatih untuk mencapai hasil yang semakin optimal.`;
    } else if (cap === "C" || cap === "Cukup") {
      return `Ananda ${name} dalam pembelajaran ${sub} menunjukkan penguasaan yang cukup dan perlu terus meningkatkan keaktifan serta ketekunan belajar di kelas dan di rumah.`;
    } else {
      return `Ananda ${name} dalam pembelajaran ${sub} masih memerlukan bimbingan dan pendampingan lebih lanjut. Tetaplah bersemangat dan jangan ragu untuk terus bertanya dan belajar.`;
    }
  }

  const achieved = g.tps
    .filter((tp) => tp.achieved)
    .map((tp) => (tp.text || "").trim())
    .filter(Boolean);
  const needImprovement = g.tps
    .filter((tp) => !tp.achieved)
    .map((tp) => (tp.text || "").trim())
    .filter(Boolean);

  const joinItems = (items: string[]) => {
    const cleaned = items.map((i) => i.trim().replace(/\.+$/, ""));
    if (cleaned.length === 0) return "";
    if (cleaned.length === 1) return cleaned[0];
    if (cleaned.length === 2) return `${cleaned[0]} dan ${cleaned[1]}`;
    return `${cleaned.slice(0, -1).join(", ")}, dan ${cleaned[cleaned.length - 1]}`;
  };

  let desc = "";
  if (achieved.length > 0 && needImprovement.length === 0) {
    desc = `Alhamdulillah, ananda ${name} dalam pembelajaran ${sub} menunjukkan penguasaan yang optimal dalam ${joinItems(achieved)}. Pertahankan prestasimu, teruslah bertumbuh dengan rendah hati, dan yakinlah setiap ikhtiar baikmu hari ini akan membuka pintu masa depan yang indah.`;
  } else if (achieved.length > 0 && needImprovement.length > 0) {
    desc = `Alhamdulillah, ananda ${name} dalam pembelajaran ${sub} menunjukkan penguasaan yang optimal dalam ${joinItems(achieved)}. Namun masih memerlukan bimbingan dan pendampingan lebih lanjut dalam ${joinItems(needImprovement)}. Tetaplah bersemangat, jangan pernah lelah untuk mencoba karena setiap proses belajarmu sangatlah berharga.`;
  } else if (needImprovement.length > 0) {
    desc = `Ananda ${name} dalam pembelajaran ${sub} masih memerlukan bimbingan dan pendampingan lebih lanjut dalam ${joinItems(needImprovement)}. Jangan berkecil hati, percayalah pada kemampuan dirimu; dengan kesabaran, doa, dan usaha yang tekun, ananda pasti mampu meraih hal yang lebih baik.`;
  } else {
    desc = `Alhamdulillah, ananda ${name} dalam pembelajaran ${sub} telah mengikuti proses pembelajaran dengan baik.`;
  }

  return desc.trim();
};

export const getEkskulGrades = (e: any) => {
  if (e && e.usaha && e.proses && e.capaian) {
    return {
      usaha: String(e.usaha).trim(),
      proses: String(e.proses).trim(),
      capaian: String(e.capaian).trim(),
    };
  }
  const pred = (e?.capaian || e?.predicate || "B").trim();
  let letter = "B";
  if (pred === "Sangat Baik" || pred === "A") letter = "A";
  else if (pred === "Baik" || pred === "B") letter = "B";
  else if (pred === "Cukup" || pred === "C") letter = "C";
  else if (pred === "Kurang" || pred === "D") letter = "D";

  return {
    usaha: e?.usaha || letter,
    proses: e?.proses || letter,
    capaian: e?.capaian || letter,
  };
};

/**
 * Generates a jsPDF instance for a single student report
 */
export async function generateStudentPdfDoc(options: GeneratePdfOptions): Promise<jsPDF> {
  const {
    student,
    grades,
    waliKelasNote,
    waliKelas,
    principal,
    format,
    base64Logos = {},
    allSubjects = [],
  } = options;

  const isF4 = format.paperSize === "F4";
  const isA4 = !isF4;
  const formattedStudentName = formatTitleCase(student?.name || "");
  const numericKelas = getNumericKelas(student?.kelas);

  const baseUmum = numericKelas <= 2
    ? ["PAI", "PPKN", "Bahasa Indonesia", "Matematika", "PJOK"]
    : ["PAI", "PPKN", "Bahasa Indonesia", "Matematika", "PJOK", "IPAS"];

  const additional: string[] = [];
  const checkList = [...(grades || []).map((g) => g?.subject || ""), ...allSubjects];
  for (const item of checkList) {
    if (!item) continue;
    const norm = normalizeSub(item);
    if (norm.includes("seni") && !additional.includes("Seni Budaya")) {
      additional.push("Seni Budaya");
    }
    if (norm.includes("prakarya") && !additional.includes("Prakarya")) {
      additional.push("Prakarya");
    }
  }
  const activeUmum = [...baseUmum, ...additional];

  const activeMulok = numericKelas <= 3
    ? ["Bahasa Arab", "Bahasa Inggris", "Life Skill"]
    : ["Bahasa Arab", "Bahasa Inggris", "TIK"];

  const activeKeislaman = [
    "Tahsin ABaTaTsa",
    "Tahfizh Al-Qur’an",
    "Do’a Harian dan Hadits",
    "Wudhu dan Sholat",
    "Sirah Nabawiyah",
  ];

  const getSubjectUsaha = (sub: string) => {
    const g = findGradeForSubject(grades, sub);
    return g && g.usaha ? g.usaha : "-";
  };
  const getSubjectProses = (sub: string) => {
    const g = findGradeForSubject(grades, sub);
    return g && g.proses ? g.proses : "-";
  };
  const getSubjectCapaian = (sub: string) => {
    const g = findGradeForSubject(grades, sub);
    return g && (g.capaian || (g as any).predicate) ? (g.capaian || (g as any).predicate) : "-";
  };
  const getSubjectDescription = (sub: string) => {
    const g = findGradeForSubject(grades, sub);
    if (g) {
      if (g.deskripsi && g.deskripsi.trim() !== "") return g.deskripsi.trim();
      if ((g as any).description && String((g as any).description).trim() !== "") return String((g as any).description).trim();
      return generateDescription(g, student?.name);
    }
    return "-";
  };

  const schoolLogoSrc = base64Logos.school || "";
  const jsitLogoSrc = base64Logos.jsit || "";
  const cahayaAmalLogoSrc = base64Logos.cahayaAmal || "";

  // Preload watermark image
  const wmImg = new Image();
  wmImg.crossOrigin = "anonymous";
  if (schoolLogoSrc) {
    await new Promise<void>((resolve) => {
      wmImg.onload = () => resolve();
      wmImg.onerror = () => resolve();
      wmImg.src = schoolLogoSrc;
    });
  }

  // Wrapper placed in document flow (invisible, no events) ensuring accurate rendering & layout calculation
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = isA4 ? "720px" : "750px";
  wrapper.style.background = "transparent";
  wrapper.style.opacity = "0.01";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-9999";

  const pdfContainer = document.createElement("div");
  pdfContainer.id = "pdf-container-root";
  pdfContainer.style.position = "relative";
  pdfContainer.style.width = isA4 ? "720px" : "750px";
  pdfContainer.style.background = "transparent";
  pdfContainer.style.padding = isA4 ? "4px 0px" : "5px 0px";
  pdfContainer.style.boxSizing = "border-box";

  const schoolName = getSchoolName(student.kelas);
  const pdfHtmlContent = `
    <style>
      .pdf-wrapper { 
        font-family: 'Times New Roman', Times, serif; 
        font-size: ${isA4 ? "9.5pt" : "11pt"}; 
        line-height: ${isA4 ? "1.25" : "1.4"}; 
        color: #000000 !important; 
        background-color: transparent !important; 
        position: relative;
      }
      .pdf-wrapper * {
        color: #000000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .pdf-meta-table { width: 100%; border: none; margin-bottom: ${isA4 ? "3px" : "5px"}; font-size: ${isA4 ? "9pt" : "10pt"}; border-collapse: collapse; margin-left: auto !important; margin-right: auto !important; background-color: transparent !important; }
      .pdf-meta-table td { padding: ${isA4 ? "0.5px 2px" : "1px 3px"}; vertical-align: middle; color: #000000 !important; background-color: transparent !important; }
      .pdf-box-table { width: 100%; border-collapse: collapse; margin-bottom: ${isA4 ? "2.5px" : "4.5px"}; border: 1.2px solid black; background-color: transparent !important; margin-left: auto !important; margin-right: auto !important; }
      .pdf-box-table td { border: 1px solid black; padding: ${isA4 ? "1px 3px" : "2px 4px"}; vertical-align: middle; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; color: #000000 !important; background-color: transparent !important; }
      .pdf-box-table td[style*="font-size: 8.5pt"] {
        vertical-align: top !important;
        padding-top: ${isA4 ? "1px" : "2px"} !important;
        padding-bottom: ${isA4 ? "2.5px" : "5px"} !important;
        font-size: ${isA4 ? "8pt" : "8.5pt"} !important;
      }
      .pdf-box-table tr:nth-child(2) td[style*="font-size: 9.5pt"]:not([style*="padding"]) {
        vertical-align: top !important;
        padding-top: ${isA4 ? "1px" : "2.5px"} !important;
        padding-bottom: ${isA4 ? "2.5px" : "5.5px"} !important;
        font-size: ${isA4 ? "8.5pt" : "9.5pt"} !important;
      }
      .pdf-heading { margin: ${isA4 ? "4.5px 0 1.5px 0" : "10px 0 5px 0"}; text-transform: uppercase; font-size: ${isA4 ? "8.75pt" : "9.5pt"}; font-weight: bold; color: #000000 !important; page-break-after: avoid !important; break-after: avoid !important; }
      .pdf-signature-table { width: 100% !important; border: none; margin-top: ${isA4 ? "4px" : "12px"}; border-collapse: collapse; margin-left: auto !important; margin-right: auto !important; table-layout: fixed !important; }
      .pdf-signature-table td { text-align: center; vertical-align: top; color: #000000 !important; }
    </style>
    <div class="pdf-wrapper">
      <div>
        ${
          format.showLogo && schoolLogoSrc
            ? `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${isA4 ? "6px" : "15px"}; width: 100%; border-bottom: ${isA4 ? "2.5px" : "3px"} double #000000; padding-bottom: ${isA4 ? "6px" : "12px"};">
            <!-- Left Side: JSIT and Yayasan Cahaya Amal logos -->
            <div style="width: ${isA4 ? "110px" : "165px"}; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-start; gap: ${isA4 ? "6px" : "10px"};">
              ${jsitLogoSrc ? `<div style="width: ${isA4 ? "48px" : "75px"}; height: ${isA4 ? "48px" : "75px"}; display: flex; align-items: center; justify-content: center; background-color: #ffffff; box-sizing: border-box;">
                <img src="${jsitLogoSrc}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>` : ''}
              ${cahayaAmalLogoSrc ? `<div style="width: ${isA4 ? "48px" : "75px"}; height: ${isA4 ? "48px" : "75px"}; display: flex; align-items: center; justify-content: center; background-color: #ffffff; box-sizing: border-box;">
                <img src="${cahayaAmalLogoSrc}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>` : ''}
            </div>
            <!-- Center: School name and report metadata -->
            <div style="text-align: center; flex-grow: 1; padding: 0 6px;">
              <h2 style="margin: 0; text-transform: uppercase; font-size: ${isA4 ? "11pt" : "11.5pt"}; color: #000000; font-weight: bold; line-height: 1.25;">${schoolName}</h2>
              <h3 style="margin: 2px 0; text-transform: uppercase; font-size: ${isA4 ? "9.5pt" : "10pt"}; color: #000000; font-weight: bold; line-height: 1.25;">LAPORAN SUMATIF TENGAH SEMESTER (STS)</h3>
              <h4 style="margin: 2px 0; font-size: ${isA4 ? "9pt" : "9.5pt"}; color: #000000; font-weight: bold; line-height: 1.25;">SEMESTER ${format.semesterName ? format.semesterName.toUpperCase() : "GANJIL"}</h4>
              <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "8pt" : "8.5pt"}; font-weight: bold; color: #000000; line-height: 1.25;">TAHUN PELAJARAN ${format.tahunPelajaran || "2026-2027"}</p>
            </div>
            <!-- Right Side: School logo -->
            <div style="width: ${isA4 ? "110px" : "165px"}; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              <div style="width: ${isA4 ? "48px" : "75px"}; height: ${isA4 ? "48px" : "75px"}; display: flex; align-items: center; justify-content: center; border: 1.5px solid #cccccc; border-radius: 50%; overflow: hidden; background-color: #ffffff;">
                <img src="${schoolLogoSrc}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            </div>
          </div>
          `
            : `
          <div style="text-align: center; margin-bottom: ${isA4 ? "6px" : "15px"}; width: 100%; border-bottom: ${isA4 ? "2.5px" : "3px"} double #000000; padding-bottom: ${isA4 ? "6px" : "12px"};">
            <h2 style="margin: 0; text-transform: uppercase; font-size: ${isA4 ? "12pt" : "14pt"}; color: #000000; font-weight: bold;">${schoolName}</h2>
            <h3 style="margin: 2px 0; text-transform: uppercase; font-size: ${isA4 ? "10.5pt" : "12pt"}; color: #000000; font-weight: bold;">LAPORAN SUMATIF TENGAH SEMESTER (STS)</h3>
            <h4 style="margin: 2px 0; font-size: ${isA4 ? "9.5pt" : "11pt"}; color: #000000; font-weight: bold;">SEMESTER ${format.semesterName ? format.semesterName.toUpperCase() : "GANJIL"}</h4>
            <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "9pt" : "10.5pt"}; font-weight: bold; color: #000000;">TAHUN PELAJARAN ${format.tahunPelajaran || "2026-2027"}</p>
          </div>
          `
        }

      <table class="pdf-meta-table">
        <tr>
          <td style="width: 15%; font-weight: normal;">Nama</td>
          <td style="width: 2%;">:</td>
          <td style="width: 35%; font-weight: bold;">${formattedStudentName}</td>
          <td style="width: 18%; font-weight: normal;">Fase/Kelas</td>
          <td style="width: 2%;">:</td>
          <td style="width: 28%; font-weight: bold;">${formatFaseKelas(student.kelas)}</td>
        </tr>
        <tr>
          <td style="font-weight: normal;">NISN/ NIS</td>
          <td>:</td>
          <td style="font-weight: bold;">${student.nisn || "-"}</td>
          <td style="font-weight: normal;">Semester</td>
          <td>:</td>
          <td style="font-weight: bold;">${format.semesterName || "Ganjil"}</td>
        </tr>
      </table>

      <h4 class="pdf-heading">A. Sikap</h4>
      
      <!-- Spiritual Aspect Table -->
      <table class="pdf-box-table" style="page-break-inside: avoid;">
        <tr>
          <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
            1. Spiritual
          </td>
          <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
            Usaha
          </td>
          <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
            Proses
          </td>
          <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
            Capaian
          </td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
            ${waliKelasNote.spiritualUsaha || "-"}
          </td>
          <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
            ${waliKelasNote.spiritualProses || "-"}
          </td>
          <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
            ${waliKelasNote.spiritualCapaian || "-"}
          </td>
        </tr>
        <tr>
          <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
            <strong>Deskripsi:</strong> ${waliKelasNote.spiritualDeskripsi || ""}
          </td>
        </tr>
      </table>

      <!-- Sosial Aspect Table -->
      <table class="pdf-box-table" style="page-break-inside: avoid;">
        <tr>
          <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
            2. Sosial
          </td>
          <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
            Usaha
          </td>
          <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
            Proses
          </td>
          <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
            Capaian
          </td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
            ${waliKelasNote.sosialUsaha || "-"}
          </td>
          <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
            ${waliKelasNote.sosialProses || "-"}
          </td>
          <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
            ${waliKelasNote.sosialCapaian || "-"}
          </td>
        </tr>
        <tr>
          <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
            <strong>Deskripsi:</strong> ${waliKelasNote.sosialDeskripsi || ""}
          </td>
        </tr>
      </table>

      <h4 class="pdf-heading">B. Umum</h4>
      ${activeUmum
        .map((sub, idx) => {
          const title = getOfficialSubjectName(sub, idx);
          const usahaGrade = getSubjectUsaha(sub);
          const prosesGrade = getSubjectProses(sub);
          const capaianGrade = getSubjectCapaian(sub);
          const desc = getSubjectDescription(sub);

          return `
          <table class="pdf-box-table" style="page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                ${title}
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Usaha
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Proses
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${usahaGrade}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${prosesGrade}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${capaianGrade}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                <strong>Deskripsi:</strong> ${desc}
              </td>
            </tr>
          </table>
        `;
        })
        .join("")}

      <h4 class="pdf-heading">C. Muatan Lokal</h4>
      ${activeMulok
        .map((sub, idx) => {
          const title = getOfficialSubjectName(sub, idx);
          const usahaGrade = getSubjectUsaha(sub);
          const prosesGrade = getSubjectProses(sub);
          const capaianGrade = getSubjectCapaian(sub);
          const desc = getSubjectDescription(sub);

          return `
          <table class="pdf-box-table" style="page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                ${title}
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Usaha
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Proses
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${usahaGrade}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${prosesGrade}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${capaianGrade}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                <strong>Deskripsi:</strong> ${desc}
              </td>
            </tr>
          </table>
        `;
        })
        .join("")}

      <h4 class="pdf-heading">D. Keislaman</h4>
      ${activeKeislaman
        .map((sub, idx) => {
          const title = getOfficialSubjectName(sub, idx);
          const usahaGrade = getSubjectUsaha(sub);
          const prosesGrade = getSubjectProses(sub);
          const capaianGrade = getSubjectCapaian(sub);
          const desc = getSubjectDescription(sub);

          return `
          <table class="pdf-box-table" style="page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                ${title}
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Usaha
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Proses
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${usahaGrade}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${prosesGrade}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${capaianGrade}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                <strong>Deskripsi:</strong> ${desc}
              </td>
            </tr>
          </table>
        `;
        })
        .join("")}

      <h4 class="pdf-heading">E. Ekstrakurikuler dan Keterampilan</h4>
      ${
        ((waliKelasNote as any).ekskul || []).length === 0
          ? `
        <table class="pdf-box-table" style="page-break-inside: avoid;">
          <tr>
            <td style="text-align: center; font-size: ${isA4 ? "8.5pt" : "10pt"}; padding: ${isA4 ? "3px 4px" : "5px"}; font-style: italic; color: #555;">
              Tidak mengikuti kegiatan ekstrakurikuler.
            </td>
          </tr>
        </table>
      `
          : ((waliKelasNote as any).ekskul || [])
              .map((e: any, idx: number) => {
                const eGrades = getEkskulGrades(e);
                return `
          <table class="pdf-box-table" style="page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                ${idx + 1}. Ekstrakurikuler ${e.type || "Pilihan"}: ${e.name}
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Usaha
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Proses
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${eGrades.usaha}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${eGrades.proses}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${eGrades.capaian}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                <strong>Deskripsi:</strong> ${e.description || e.deskripsi || "-"}
              </td>
            </tr>
          </table>
        `;
              })
              .join("")
      }

      <h4 class="pdf-heading">F. Saran-Saran</h4>
      <table class="pdf-box-table" style="page-break-inside: avoid;">
        <tr>
          <td style="padding: ${isA4 ? "2.5px 4.5px 4px 4.5px" : "6px 8px 10px 8px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
            ${waliKelasNote.catatan || ""}
          </td>
        </tr>
      </table>

      <!-- Indivisible Footer Block containing Kedisiplinan and Signatures -->
      <div class="pdf-footer-block" style="page-break-inside: avoid; break-inside: avoid;">
        <h4 class="pdf-heading" style="margin: ${isA4 ? "4.5px 0 1.5px 0" : "12px 0 6px 0"};">G. Kedisiplinan</h4>
        <table class="pdf-box-table" style="page-break-inside: avoid; text-align: center; border-collapse: collapse; width: 100%; margin-bottom: 0;">
          <tr style="background-color: transparent;">
            <td style="font-weight: bold; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; font-family: 'Times New Roman', Times, serif; width: 33.3%; padding: ${isA4 ? "2px 2px" : "6px 4px"}; vertical-align: middle; text-align: center; line-height: 1.2; color: #000000 !important;">Sakit</td>
            <td style="font-weight: bold; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; font-family: 'Times New Roman', Times, serif; width: 33.3%; padding: ${isA4 ? "2px 2px" : "6px 4px"}; vertical-align: middle; text-align: center; line-height: 1.2; color: #000000 !important;">Izin</td>
            <td style="font-weight: bold; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; font-family: 'Times New Roman', Times, serif; width: 33.3%; padding: ${isA4 ? "2px 2px" : "6px 4px"}; vertical-align: middle; text-align: center; line-height: 1.2; color: #000000 !important;">Tanpa Keterangan</td>
          </tr>
          <tr>
            <td style="font-size: ${isA4 ? "8.5pt" : "9.5pt"}; text-align: center; vertical-align: middle; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: ${isA4 ? "2px 2px" : "6px 4px"}; line-height: 1.2; color: #000000 !important;">${waliKelasNote.sakit && Number(waliKelasNote.sakit) > 0 ? `${waliKelasNote.sakit} Hari` : "- Hari"}</td>
            <td style="font-size: ${isA4 ? "8.5pt" : "9.5pt"}; text-align: center; vertical-align: middle; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: ${isA4 ? "2px 2px" : "6px 4px"}; line-height: 1.2; color: #000000 !important;">${waliKelasNote.izin && Number(waliKelasNote.izin) > 0 ? `${waliKelasNote.izin} Hari` : "- Hari"}</td>
            <td style="font-size: ${isA4 ? "8.5pt" : "9.5pt"}; text-align: center; vertical-align: middle; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: ${isA4 ? "2px 2px" : "6px 4px"}; line-height: 1.2; color: #000000 !important;">${waliKelasNote.alpa && Number(waliKelasNote.alpa) > 0 ? `${waliKelasNote.alpa} Hari` : "- Hari"}</td>
          </tr>
        </table>

        <table class="pdf-signature-table" style="page-break-inside: avoid; width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-top: ${isA4 ? "5px" : "12px"};">
          <colgroup>
            <col style="width: 50%;" />
            <col style="width: 50%;" />
          </colgroup>
          <tr>
            <td style="width: 50%; padding-bottom: ${isA4 ? "3px" : "30px"}; text-align: center; vertical-align: top;">
              <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0;">&nbsp;<br />Orang Tua/Wali Siswa</p>
              <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">……………………………</p>
            </td>
            <td style="width: 50%; padding-bottom: ${isA4 ? "3px" : "30px"}; text-align: center; vertical-align: top;">
              <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0;">Pangkal Pinang, ${format.tanggalRaport || "17 Juni 2026"}<br />Wali Kelas Kelas ${student.kelas}</p>
              <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${waliKelas ? waliKelas.name : "……………………………"}</p>
            </td>
          </tr>
          ${
            format.signaturePosition === "kiri"
              ? `
          <tr>
            <td style="width: 50%; text-align: center; padding-top: ${isA4 ? "2px" : "10px"}; vertical-align: top;">
              <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0; line-height: 1.3;">Mengetahui,<br />Kepala Sekolah</p>
              <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${principal.name}</p>
            </td>
            <td style="width: 50%; text-align: center; vertical-align: top;">&nbsp;</td>
          </tr>
          `
              : format.signaturePosition === "tengah"
              ? `
          <tr>
            <td colspan="2" style="width: 100%; text-align: center; padding-top: ${isA4 ? "2px" : "10px"}; vertical-align: top;">
              <div style="display: inline-block; text-align: center; margin: 0 auto;">
                <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0; line-height: 1.3;">Mengetahui,<br />Kepala Sekolah</p>
                <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${principal.name}</p>
              </div>
            </td>
          </tr>
          `
              : `
          <tr>
            <td style="width: 50%; text-align: center; vertical-align: top;">&nbsp;</td>
            <td style="width: 50%; text-align: center; padding-top: ${isA4 ? "2px" : "10px"}; vertical-align: top;">
              <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0; line-height: 1.3;">Mengetahui,<br />Kepala Sekolah</p>
              <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${principal.name}</p>
            </td>
          </tr>
          `
          }
        </table>
      </div>
      </div>
    </div>
  `;

  pdfContainer.innerHTML = pdfHtmlContent;
  wrapper.appendChild(pdfContainer);
  document.body.appendChild(wrapper);

  try {
    const images = Array.from(pdfContainer.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve(true);
        return new Promise((res) => {
          img.onload = () => res(true);
          img.onerror = () => res(false);
        });
      }),
    );

    await new Promise((res) => setTimeout(res, 60));

    const canvas = await html2canvas(pdfContainer, {
      scale: 2.0,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      logging: false,
      windowWidth: isA4 ? 720 : 750,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const stylesheets = clonedDoc.querySelectorAll('link[rel="stylesheet"], style');
        stylesheets.forEach((sheet) => {
          if (!sheet.closest('#pdf-container-root')) {
            sheet.remove();
          }
        });
      },
    });

    const pageWidth = isF4 ? 215 : 210;
    const pageHeight = isF4 ? 330 : 297;
    const marginTop = isA4 ? 6 : 10;
    const marginBottom = isA4 ? 6 : 12;
    const marginLeft = isA4 ? 10 : 12;
    const marginRight = isA4 ? 10 : 12;

    const printWidth = pageWidth - marginLeft - marginRight;
    const printHeight = pageHeight - marginTop - marginBottom;

    const maxPageCanvasHeight = Math.floor(
      (printHeight / printWidth) * canvas.width,
    );

    const containerRect = pdfContainer.getBoundingClientRect();
    const scaleFactor = canvas.width / (pdfContainer.offsetWidth || (isA4 ? 720 : 750));
    const blockElements = Array.from(
      pdfContainer.querySelectorAll<HTMLElement>(
        ".pdf-box-table, .pdf-heading, .pdf-signature-table, .pdf-meta-table, .pdf-footer-block",
      ),
    );

    interface CutPoint {
      prevBottom: number;
      nextTop: number;
    }

    const cutPoints: CutPoint[] = [];

    for (let i = 1; i < blockElements.length; i++) {
      const prevEl = blockElements[i - 1];
      const nextEl = blockElements[i];

      if (prevEl.classList.contains("pdf-heading")) {
        continue;
      }

      if (prevEl.closest(".pdf-footer-block") && nextEl.closest(".pdf-footer-block")) {
        continue;
      }

      const prevRect = prevEl.getBoundingClientRect();
      const nextRect = nextEl.getBoundingClientRect();

      const prevBottomCanvas = (prevRect.bottom - containerRect.top) * scaleFactor;
      const nextTopCanvas = (nextRect.top - containerRect.top) * scaleFactor;

      const gapMid = (prevBottomCanvas + nextTopCanvas) / 2;
      const safeCut = Math.round(gapMid);

      cutPoints.push({
        prevBottom: safeCut,
        nextTop: safeCut,
      });
    }

    interface PageSlice {
      startY: number;
      endY: number;
    }

    const pageSlices: PageSlice[] = [];
    let currentStartY = 0;

    while (currentStartY < canvas.height) {
      const maxCanvasY = currentStartY + maxPageCanvasHeight;

      if (maxCanvasY >= canvas.height) {
        pageSlices.push({
          startY: currentStartY,
          endY: canvas.height,
        });
        break;
      }

      let chosenCut: CutPoint | null = null;
      for (const cp of cutPoints) {
        if (cp.prevBottom > currentStartY + maxPageCanvasHeight * 0.3 && cp.prevBottom <= maxCanvasY) {
          chosenCut = cp;
        }
      }

      if (chosenCut) {
        pageSlices.push({
          startY: currentStartY,
          endY: chosenCut.prevBottom,
        });
        currentStartY = chosenCut.nextTop;
      } else {
        pageSlices.push({
          startY: currentStartY,
          endY: maxCanvasY,
        });
        currentStartY = maxCanvasY;
      }
    }

    const totalPages = pageSlices.length;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: isF4 ? [215, 330] : "a4",
      compress: true,
    });

    for (let p = 0; p < totalPages; p++) {
      if (p > 0) {
        pdf.addPage(isF4 ? [215, 330] : "a4", "portrait");
      }

      const startY = pageSlices[p].startY;
      const sliceHeight = pageSlices[p].endY - startY;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = maxPageCanvasHeight;

      const sliceCtx = sliceCanvas.getContext("2d");
      if (sliceCtx) {
        sliceCtx.fillStyle = "#ffffff";
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

        if (wmImg.complete && wmImg.naturalWidth > 0) {
          sliceCtx.save();
          const targetOpacity =
            typeof format.watermarkOpacity === "number" && format.watermarkOpacity > 0
              ? format.watermarkOpacity
              : 0.08;
          sliceCtx.globalAlpha = targetOpacity;

          const userSize = format.watermarkSize || (isA4 ? 380 : 440);
          const scale = canvas.width / (isA4 ? 720 : 750);
          const wmPixelSize = userSize * scale;

          const imgAspect = wmImg.naturalWidth / wmImg.naturalHeight;
          let drawW = wmPixelSize;
          let drawH = wmPixelSize;
          if (imgAspect > 1) {
            drawH = wmPixelSize / imgAspect;
          } else {
            drawW = wmPixelSize * imgAspect;
          }

          const wx = (sliceCanvas.width - drawW) / 2;
          const wy = (sliceCanvas.height - drawH) / 2;

          sliceCtx.drawImage(wmImg, wx, wy, drawW, drawH);
          sliceCtx.restore();
        }

        sliceCtx.drawImage(
          canvas,
          0,
          startY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );
      }

      const sliceImgHeightMm = printHeight;
      const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(
        sliceDataUrl,
        "JPEG",
        marginLeft,
        marginTop,
        printWidth,
        sliceImgHeightMm,
        undefined,
        "FAST",
      );

      pdf.setFont("times", "normal");
      pdf.setFontSize(isA4 ? 8.5 : 9);
      pdf.setTextColor(80, 80, 80);
      pdf.text(
        `Halaman ${p + 1} dari ${totalPages}`,
        pageWidth - marginRight,
        pageHeight - (isA4 ? 4.5 : 6),
        { align: "right" },
      );
    }

    return pdf;
  } finally {
    if (wrapper && document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}
