import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Student, Grade, WaliKelasNotesMap, Teacher } from "../types";
import { generateStudentPdfDoc, formatTitleCase } from "./pdfGenerator";
import logoUrl from "../assets/images/smp_logo_exact_match_revised_1783840969621.jpg";
import logoJsitUrl from "../assets/images/logo_jsit_indonesia_1783956323407.jpg";
import logoCahayaAmalUrl from "../assets/images/logo_cahaya_amal_1783956338475.jpg";

export interface BatchDownloadProgress {
  current: number;
  total: number;
  currentStudentName: string;
  status: "idle" | "preparing" | "generating" | "zipping" | "completed" | "error";
  errorMessage?: string;
}

export const convertUrlToBase64 = async (url: string): Promise<string> => {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          resolve(url);
        }
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
};

export async function downloadAllRaportZip(options: {
  students: Student[];
  grades: Grade[];
  allClassNotes: WaliKelasNotesMap;
  waliKelas: Teacher | null;
  selectedClass: string;
  onProgress?: (progress: BatchDownloadProgress) => void;
}): Promise<void> {
  const { students, grades, allClassNotes, waliKelas, selectedClass, onProgress } = options;

  if (!students || students.length === 0) {
    throw new Error("Tidak ada data siswa untuk diunduh.");
  }

  // 1. Fetch principal & format settings
  onProgress?.({
    current: 0,
    total: students.length,
    currentStudentName: "",
    status: "preparing",
  });

  let principal = {
    name: "Sobariyani, S.Pd.",
    nip: "19800101 200501 1 003",
  };

  let format: any = {
    semesterName: "Ganjil",
    tahunPelajaran: "2026/2027",
    fontSize: "11pt",
    showLogo: true,
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
  };

  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    const data = await res.json();
    const settingsData = data?.settings || data;
    if (settingsData && typeof settingsData === "object") {
      const pName = settingsData.principalName ?? settingsData.settings?.principalName;
      const pNip = settingsData.principalNip ?? settingsData.settings?.principalNip;
      if (pName) principal.name = String(pName).trim();
      if (pNip) principal.nip = String(pNip).trim();

      const fmt = settingsData.format;
      if (fmt && typeof fmt === "object") {
        format = { ...format, ...fmt };
      }
    }
  } catch (err) {
    console.warn("Using fallback settings for batch pdf:", err);
  }

  // Fallback to local storage if available
  try {
    const explicitName = localStorage.getItem("smart_sts_principal_name");
    const explicitNip = localStorage.getItem("smart_sts_principal_nip");
    if (explicitName) principal.name = explicitName;
    if (explicitNip) principal.nip = explicitNip;
  } catch (e) {}

  // 2. Preload base64 images
  const [school, jsit, cahayaAmal] = await Promise.all([
    convertUrlToBase64(logoUrl),
    convertUrlToBase64(logoJsitUrl),
    convertUrlToBase64(logoCahayaAmalUrl),
  ]);

  const base64Logos = { school, jsit, cahayaAmal };

  // 3. Preload all subjects
  let allSubjects: string[] = [];
  try {
    const subRes = await fetch("/api/subjects");
    const subData = await subRes.json();
    if (Array.isArray(subData)) {
      allSubjects = subData;
    }
  } catch (e) {}

  // 4. Generate PDF for each student sequentially & add to ZIP
  const zip = new JSZip();
  const folderName = `Raport_Kelas_${selectedClass}_STS_${format.semesterName || "Ganjil"}`;
  const folder = zip.folder(folderName) || zip;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const studentGrades = grades.filter(
      (g) => String(g.studentId).trim() === String(student.id).trim()
    );
    const studentNote = allClassNotes[student.id] || {
      studentId: student.id,
      sakit: 0,
      izin: 0,
      alpa: 0,
      catatan: `Ananda ${student.name} menunjukkan kepribadian dan budi pekerti yang baik. Pertahankan terus semangat belajarmu.`,
      spiritualUsaha: "B",
      spiritualProses: "B",
      spiritualCapaian: "B",
      spiritualDeskripsi: `Alhamdulillah ananda ${student.name} menunjukkan perkembangan spiritual yang baik.`,
      sosialUsaha: "B",
      sosialProses: "B",
      sosialCapaian: "B",
      sosialDeskripsi: `Alhamdulillah ananda ${student.name} mudah bergaul, memiliki rasa empati tinggi, serta sopan santun.`,
      ekskul: [],
    };

    onProgress?.({
      current: i + 1,
      total: students.length,
      currentStudentName: student.name,
      status: "generating",
    });

    try {
      const doc = await generateStudentPdfDoc({
        student,
        grades: studentGrades,
        waliKelasNote: studentNote,
        waliKelas,
        principal,
        format,
        base64Logos,
        allSubjects,
      });

      const pdfBlob = doc.output("blob");
      const safeName = (student.name || "Siswa")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, "_");
      const fileName = `Raport_STS_${safeName}.pdf`;

      folder.file(fileName, pdfBlob);
    } catch (err) {
      console.error(`Gagal membuat PDF untuk siswa ${student.name}:`, err);
      // Continue to next student so batch doesn't break entirely
    }
  }

  // 5. Build ZIP and trigger download
  onProgress?.({
    current: students.length,
    total: students.length,
    currentStudentName: "Mengompresi berkas ZIP...",
    status: "zipping",
  });

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const zipFileName = `Kumpulan_Raport_STS_Kelas_${selectedClass}.zip`;
  saveAs(zipBlob, zipFileName);

  onProgress?.({
    current: students.length,
    total: students.length,
    currentStudentName: "Selesai!",
    status: "completed",
  });
}
